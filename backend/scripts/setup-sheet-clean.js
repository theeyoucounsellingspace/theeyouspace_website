/**
 * Sheet Setup Script — run once to:
 * 1. Clear all existing data (including NA rows)
 * 2. Write the correct header row
 * 3. Pre-populate Joan Ana's GitHub photo URL
 * 4. Add ready-to-fill template rows for all 5 professionals
 *
 * Usage: node backend/scripts/setup-sheet-clean.js
 *
 * Requirements: GOOGLE_SHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_KEY in backend/.env
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') })
const https = require('https')
const crypto = require('crypto')

const SHEET_ID = process.env.GOOGLE_SHEET_ID
const SA_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
const SA_KEY = (process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '').replace(/\\n/g, '\n')

// GitHub raw URLs for all team photos
const PHOTO_URLS = {
    'Jeevan KJ': 'https://raw.githubusercontent.com/theeyoucounsellingspace/theeyouspace_website/main/frontend/src/assets/team/jeevan.png',
    'Leaskar Paulraj DJ': 'https://raw.githubusercontent.com/theeyoucounsellingspace/theeyouspace_website/main/frontend/src/assets/team/leaskar.jpg',
    'Abijith KB': 'https://raw.githubusercontent.com/theeyoucounsellingspace/theeyouspace_website/main/frontend/src/assets/team/abijith.png',
    'Mohammed Muhaiyadeen M': 'https://raw.githubusercontent.com/theeyoucounsellingspace/theeyouspace_website/main/frontend/src/assets/team/mohammed.jpg',
    'Joan Ana': 'https://raw.githubusercontent.com/theeyoucounsellingspace/theeyouspace_website/main/frontend/src/assets/team/joan.jpg',
}

// ── JWT Auth ──────────────────────────────────────────────────────────────────

async function getAccessToken() {
    const now = Math.floor(Date.now() / 1000)
    const payload = {
        iss: SA_EMAIL,
        scope: 'https://www.googleapis.com/auth/spreadsheets',
        aud: 'https://oauth2.googleapis.com/token',
        exp: now + 3600,
        iat: now,
    }
    const encode = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url')
    const header = encode({ alg: 'RS256', typ: 'JWT' })
    const body = encode(payload)
    const sigInput = `${header}.${body}`
    const sign = crypto.createSign('RSA-SHA256')
    sign.update(sigInput)
    const sig = sign.sign(SA_KEY, 'base64url')
    const jwt = `${sigInput}.${sig}`

    const resp = await post('https://oauth2.googleapis.com/token', null,
        { grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt },
        true)
    return resp.access_token
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

function request(url, options, bodyStr) {
    return new Promise((resolve, reject) => {
        const parsed = new URL(url)
        const req = https.request({ hostname: parsed.hostname, path: parsed.pathname + parsed.search, ...options }, (res) => {
            let data = ''
            res.on('data', c => { data += c })
            res.on('end', () => {
                try { resolve(JSON.parse(data)) } catch { resolve(data) }
            })
        })
        req.on('error', reject)
        if (bodyStr) req.write(bodyStr)
        req.end()
    })
}

async function post(url, token, payload, formEncoded = false) {
    const body = formEncoded ? new URLSearchParams(payload).toString() : JSON.stringify(payload)
    const headers = {
        'Content-Type': formEncoded ? 'application/x-www-form-urlencoded' : 'application/json',
        'Content-Length': Buffer.byteLength(body),
    }
    if (token) headers['Authorization'] = `Bearer ${token}`
    return request(url, { method: 'POST', headers }, body)
}

async function get(url, token) {
    return request(url, { method: 'GET', headers: { Authorization: `Bearer ${token}` } })
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    if (!SHEET_ID || !SA_EMAIL || !SA_KEY) {
        console.error('❌ Missing env vars: GOOGLE_SHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_KEY')
        process.exit(1)
    }

    console.log('🔑 Getting access token...')
    const token = await getAccessToken()
    console.log('✅ Authenticated')

    // 1. Get sheet metadata to find actual tab ID and name
    const meta = await get(
        `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?fields=sheets.properties`,
        token
    )
    const sheetProps = meta?.sheets?.[0]?.properties
    const gid = sheetProps?.sheetId ?? 0
    const tabTitle = sheetProps?.title || 'Sheet1'
    console.log(`📋 Sheet tab: "${tabTitle}" (gid=${gid})`)

    // 2. Clear ALL existing content
    console.log('🧹 Clearing all existing content...')
    const clearResp = await post(
        `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(tabTitle)}:clear`,
        token, {}
    )
    if (clearResp.error) throw new Error(`Clear failed: ${clearResp.error.message}`)
    console.log('✅ Sheet cleared')

    // 3. Build the new data
    // Header row
    const header = ['Professional', 'Date', 'Time', 'Photo URL']

    // Template rows — one placeholder slot per professional (easy to fill in)
    // Format: DD/MM/YYYY to avoid ambiguity
    const rows = [
        ['Jeevan KJ', 'DD/MM/YYYY', 'HH:MM AM/PM', PHOTO_URLS['Jeevan KJ']],
        ['Leaskar Paulraj DJ', 'DD/MM/YYYY', 'HH:MM AM/PM', PHOTO_URLS['Leaskar Paulraj DJ']],
        ['Abijith KB', 'DD/MM/YYYY', 'HH:MM AM/PM', PHOTO_URLS['Abijith KB']],
        ['Mohammed Muhaiyadeen M', 'DD/MM/YYYY', 'HH:MM AM/PM', PHOTO_URLS['Mohammed Muhaiyadeen M']],
        ['Joan Ana', 'DD/MM/YYYY', 'HH:MM AM/PM', PHOTO_URLS['Joan Ana']],
    ]

    const values = [header, ...rows]

    // 4. Write new data
    console.log('✍️  Writing header + template rows...')
    const writeResp = await post(
        `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(tabTitle)}!A1:D${values.length}?valueInputOption=RAW`,
        token,
        { range: `${tabTitle}!A1:D${values.length}`, majorDimension: 'ROWS', values }
    )

    // Sheets values.update uses PUT not POST — use batchUpdate instead
    if (writeResp.error) {
        throw new Error(`Write failed: ${writeResp.error.message}`)
    }

    // Actually Sheets API update requires PUT — re-do with correct method
    console.log('✍️  Using correct PUT for values...')
    const putResp = await new Promise((resolve, reject) => {
        const body = JSON.stringify({ range: `${tabTitle}!A1:D${values.length}`, majorDimension: 'ROWS', values })
        const parsed = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(tabTitle)}!A1:D${values.length}?valueInputOption=RAW`)
        const req = https.request({
            hostname: parsed.hostname,
            path: parsed.pathname + parsed.search,
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
            },
        }, (res) => {
            let data = ''
            res.on('data', c => { data += c })
            res.on('end', () => {
                try { resolve(JSON.parse(data)) } catch { resolve(data) }
            })
        })
        req.on('error', reject)
        req.write(body)
        req.end()
    })

    if (putResp.error) throw new Error(`PUT failed: ${putResp.error.message}`)
    console.log(`✅ Written ${putResp.updatedRows} rows, ${putResp.updatedColumns} columns`)

    console.log('\n🎉 Sheet is ready!\n')
    console.log('📋 Current state:')
    console.log('   Row 1: Header (Professional | Date | Time | Photo URL)')
    console.log('   Row 2: Jeevan KJ        — photo URL ✅, date/time = placeholder')
    console.log('   Row 3: Leaskar Paulraj DJ — photo URL ✅, date/time = placeholder')
    console.log('   Row 4: Abijith KB       — photo URL ✅, date/time = placeholder')
    console.log('   Row 5: Mohammed Muhaiyadeen M — photo URL ✅, date/time = placeholder')
    console.log('   Row 6: Joan Ana         — photo URL ✅, date/time = placeholder')
    console.log('\n📝 NEXT STEPS for admin:')
    console.log('   1. Open the sheet: https://docs.google.com/spreadsheets/d/' + SHEET_ID)
    console.log('   2. Replace DD/MM/YYYY and HH:MM AM/PM with actual available dates and times')
    console.log('   3. Add more rows for more slots (copy the pattern from existing rows)')
    console.log('   4. Column D (Photo URL) is already filled — leave it unless photo changes')
    console.log('   5. Backend auto-syncs every 30 min — no need to restart anything')
}

main().catch(err => {
    console.error('❌ Setup failed:', err.message)
    process.exit(1)
})
