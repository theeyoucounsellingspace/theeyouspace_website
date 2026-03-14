/**
 * slotSeeder.js — importable slot generation + Sheet write utility.
 *
 * Used by:
 *   - scheduler.service.js (auto-reseed when slots run low)
 *   - backend/scripts/seed-slots.js (manual CLI run)
 *
 * Generates 14 days of slots for all professionals and writes them
 * to the Google Sheet Slots tab. Only appends MISSING slots (additive).
 * Returns the count of slots added.
 */

const https = require('https')
const crypto = require('crypto')

const SLOT_CONFIG = [
    { name: 'Jeevan KJ', times: ['10:00 AM', '12:00 PM', '4:00 PM'], days: [1, 2, 3, 4, 6] },
    { name: 'Leaskar Paulraj DJ', times: ['11:00 AM', '3:00 PM', '6:00 PM'], days: [1, 3, 5, 6] },
    { name: 'Abijith KB', times: ['9:00 AM', '11:00 AM', '5:00 PM'], days: [2, 3, 4, 5] },
    { name: 'Mohammed Muhaiyadeen M', times: ['10:00 AM', '2:00 PM', '5:00 PM'], days: [1, 2, 4, 6] },
    { name: 'Joan Ana', times: ['9:30 AM', '12:00 PM', '3:30 PM'], days: [1, 2, 3, 5, 6] },
]

const DAYS_AHEAD = 14

function formatDate(date) {
    return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`
}

function generateSlots() {
    const rows = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    for (let d = 1; d <= DAYS_AHEAD; d++) {
        const date = new Date(today)
        date.setDate(today.getDate() + d)
        const dow = date.getDay()
        for (const pro of SLOT_CONFIG) {
            if (!pro.days.includes(dow)) continue
            for (const time of pro.times) {
                rows.push([pro.name, formatDate(date), time])
            }
        }
    }

    rows.sort((a, b) => {
        const [aD, aM, aY] = a[1].split('/').map(Number)
        const [bD, bM, bY] = b[1].split('/').map(Number)
        return new Date(aY, aM - 1, aD) - new Date(bY, bM - 1, bD)
    })

    return rows
}

async function getToken() {
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
    const rawKey = (process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '')
    const privateKey = rawKey
        .replace(/\\n/g, '\n')  // dotenv escaped: \\n → \n
        .replace(/\n/g, '\n')   // Render literal: \n → newline
    if (!email || !privateKey.includes('-----BEGIN PRIVATE KEY-----')) throw new Error('Missing service account credentials')

    const now = Math.floor(Date.now() / 1000)
    const payload = { iss: email, scope: 'https://www.googleapis.com/auth/spreadsheets', aud: 'https://oauth2.googleapis.com/token', exp: now + 3600, iat: now }
    const enc = o => Buffer.from(JSON.stringify(o)).toString('base64url')
    const h = enc({ alg: 'RS256', typ: 'JWT' }), b = enc(payload)
    const sgn = crypto.createSign('RSA-SHA256')
    sgn.update(`${h}.${b}`)
    const jwt = `${h}.${b}.${sgn.sign(privateKey, 'base64url')}`
    const body = new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }).toString()

    return new Promise((res, rej) => {
        const req = https.request({
            hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
        }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d).access_token)) })
        req.on('error', rej); req.write(body); req.end()
    })
}

function sheetsReq(method, path, token, body) {
    const bodyStr = body ? JSON.stringify(body) : null
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    if (bodyStr) headers['Content-Length'] = Buffer.byteLength(bodyStr)
    return new Promise((res, rej) => {
        const req = https.request({ hostname: 'sheets.googleapis.com', path, method, headers },
            r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { res(JSON.parse(d)) } catch { res(d) } }) })
        req.on('error', rej)
        if (bodyStr) req.write(bodyStr)
        req.end()
    })
}

/**
 * seedSlotsToSheet() — writes fresh 14-day slots to the Google Sheet.
 * Returns the number of slot rows written.
 */
async function seedSlotsToSheet() {
    const sheetId = (process.env.GOOGLE_SHEET_ID || '').replace(/[^a-zA-Z0-9-_]/g, '')
    if (!sheetId) throw new Error('GOOGLE_SHEET_ID not set')

    const token = await getToken()

    // 1. Read existing slots
    let existingRows = []
    try {
        const resp = await sheetsReq('GET', `/v4/spreadsheets/${sheetId}/values/${encodeURIComponent('Slots')}`, token)
        existingRows = resp.values || []
    } catch (err) {
        console.warn('[SlotSeeder] Could not read existing slots, proceeding carefully...')
    }

    // 2. Filter out past slots from the sheet to keep it lean (Retention Policy)
    // We keep slots from "Today" onwards
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Header row preserved
    const header = existingRows[0] || ['Professional', 'Date', 'Time']
    const futureRows = existingRows.slice(1).filter(r => {
        const [d, m, y] = (r[1] || '').split('/').map(Number)
        if (!d || !m || !y) return true // keep rows we can't parse
        const slotDate = new Date(y, m - 1, d)
        return slotDate >= today
    })

    // Set of "Professional|Date|Time" strings for O(1) lookup
    const existingKeys = new Set(
        futureRows.map(r => `${(r[0] || '').trim()}|${(r[1] || '').trim()}|${(r[2] || '').trim()}`)
    )

    // 3. Generate target slots and filter out those that already exist
    const generated = generateSlots()
    const missingOnly = generated.filter(row => {
        const key = `${row[0]}|${row[1]}|${row[2]}`
        return !existingKeys.has(key)
    })

    if (missingOnly.length === 0 && futureRows.length === (existingRows.length - 1)) {
        console.log('[SlotSeeder] No changes needed — sheet is already up to date.')
        return 0
    }

    // 4. Update the sheet: Rewrite with Future Rows + Missing Rows
    // We rewrite the entire sheet to purge the old slots
    const allRows = [header, ...futureRows, ...missingOnly]

    // Clear first to avoid leftover rows if sheet shrank
    await sheetsReq('POST', `/v4/spreadsheets/${sheetId}/values/${encodeURIComponent('Slots')}:clear`, token, {})

    const range = `Slots!A1:C${allRows.length}`
    const resp = await sheetsReq('PUT',
        `/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
        token,
        { range, majorDimension: 'ROWS', values: allRows }
    )

    if (resp.error) throw new Error(`Sheet update failed: ${resp.error.message}`)
    console.log(`[SlotSeeder] ✅ Sheet updated. Kept ${futureRows.length} future slots, added ${missingOnly.length} new ones, purged old ones.`)
    return missingOnly.length
}

module.exports = { seedSlotsToSheet, generateSlots, SLOT_CONFIG }
