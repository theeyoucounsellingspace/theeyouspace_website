/**
 * slotSeeder.js — importable slot generation + Sheet write utility.
 *
 * Used by:
 *   - scheduler.service.js (auto-reseed when slots run low)
 *   - backend/scripts/seed-slots.js (manual CLI run)
 *
 * Generates 14 days of slots for all 5 professionals and writes them
 * to the Google Sheet Slots tab. Clears existing rows first.
 * Returns the count of slots written.
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
    const rawKey = (process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '').replace(/\\n/g, '\n')
    if (!email || !rawKey) throw new Error('Missing service account credentials')

    const now = Math.floor(Date.now() / 1000)
    const payload = { iss: email, scope: 'https://www.googleapis.com/auth/spreadsheets', aud: 'https://oauth2.googleapis.com/token', exp: now + 3600, iat: now }
    const enc = o => Buffer.from(JSON.stringify(o)).toString('base64url')
    const h = enc({ alg: 'RS256', typ: 'JWT' }), b = enc(payload)
    const sgn = crypto.createSign('RSA-SHA256')
    sgn.update(`${h}.${b}`)
    const jwt = `${h}.${b}.${sgn.sign(rawKey, 'base64url')}`
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
    const sheetId = process.env.GOOGLE_SHEET_ID
    if (!sheetId) throw new Error('GOOGLE_SHEET_ID not set')

    const token = await getToken()
    const slotRows = generateSlots()
    const allValues = [['Professional', 'Date', 'Time'], ...slotRows]
    const range = `Slots!A1:C${allValues.length}`

    // Clear then write
    await sheetsReq('POST', `/v4/spreadsheets/${sheetId}/values/${encodeURIComponent('Slots')}:clear`, token, {})
    const resp = await sheetsReq('PUT',
        `/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
        token,
        { range, majorDimension: 'ROWS', values: allValues }
    )

    if (resp.error) throw new Error(`Sheet write failed: ${resp.error.message}`)
    return slotRows.length
}

module.exports = { seedSlotsToSheet, generateSlots, SLOT_CONFIG }
