/**
 * setup-sheet-photos.js
 *
 * One-time script: adds a "Photo URL" column to the Google Sheet and
 * populates GitHub raw image URLs for the 4 founders who already
 * have photos in the repo.
 *
 * Run once:
 *   node backend/scripts/setup-sheet-photos.js
 *
 * Requires: GOOGLE_SHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_KEY in .env
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') })

const https = require('https')
const { createSign } = require('crypto')

// ── GitHub raw base URL (public repo) ─────────────────────────────────────────
const GITHUB_RAW = 'https://raw.githubusercontent.com/theeyoucounsellingspace/theeyouspace_website/main/frontend/src/assets/team'

// Photo URLs for founders who already have images in the repo
const FOUNDER_PHOTOS = {
    'jeevan kj': `${GITHUB_RAW}/jeevan.png`,
    'leaskar paulraj dj': `${GITHUB_RAW}/leaskar.jpg`,
    'abijith kb': `${GITHUB_RAW}/abijith.png`,
    'mohammed muhaiyadeen m': `${GITHUB_RAW}/mohammed.jpg`,
}

// ── Auth ──────────────────────────────────────────────────────────────────────

async function getAccessToken() {
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
    const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
    if (!email || !rawKey) throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_SERVICE_ACCOUNT_KEY in .env')

    const privateKey = rawKey.replace(/\\n/g, '\n')
    const now = Math.floor(Date.now() / 1000)
    const payload = {
        iss: email,
        scope: 'https://www.googleapis.com/auth/spreadsheets',
        aud: 'https://oauth2.googleapis.com/token',
        exp: now + 3600,
        iat: now,
    }
    const encode = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url')
    const header = encode({ alg: 'RS256', typ: 'JWT' })
    const body = encode(payload)
    const sigInput = `${header}.${body}`
    const sign = createSign('RSA-SHA256')
    sign.update(sigInput)
    const sig = sign.sign(privateKey, 'base64url')
    const jwt = `${sigInput}.${sig}`

    const resp = await postForm('https://oauth2.googleapis.com/token', {
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
    })
    if (!resp.access_token) throw new Error(`Token exchange failed: ${JSON.stringify(resp)}`)
    return resp.access_token
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

function httpsRequest(url, options, body) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, options, (res) => {
            let data = ''
            res.on('data', c => { data += c })
            res.on('end', () => {
                try { resolve({ status: res.statusCode, body: JSON.parse(data) }) }
                catch { resolve({ status: res.statusCode, body: data }) }
            })
        })
        req.on('error', reject)
        if (body) req.write(body)
        req.end()
    })
}

async function postForm(url, payload) {
    const body = new URLSearchParams(payload).toString()
    const parsed = new URL(url)
    const { body: resp } = await httpsRequest(url, {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(body),
        },
    }, body)
    return resp
}

async function sheetsGet(url, token) {
    const parsed = new URL(url)
    const { body } = await httpsRequest(url, {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
    })
    return body
}

async function sheetsPost(url, token, payload) {
    const body = JSON.stringify(payload)
    const parsed = new URL(url)
    const { body: resp } = await httpsRequest(url, {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
        },
    }, body)
    return resp
}

async function sheetsPut(url, token, payload) {
    const body = JSON.stringify(payload)
    const parsed = new URL(url)
    const { body: resp } = await httpsRequest(url, {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
        },
    }, body)
    return resp
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    const sheetId = process.env.GOOGLE_SHEET_ID
    if (!sheetId) throw new Error('GOOGLE_SHEET_ID not set in .env')

    console.log('🔐 Getting access token...')
    const token = await getAccessToken()
    console.log('✅ Authenticated')

    // 1. Read the current sheet
    const readUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1`
    console.log('📖 Reading sheet...')
    const sheetData = await sheetsGet(readUrl, token)
    const rows = sheetData.values || []
    if (rows.length < 1) throw new Error('Sheet is empty')

    const header = rows[0]
    console.log(`📋 Headers: ${header.join(' | ')}`)

    // 2. Check if "Photo URL" column already exists
    const normalise = s => (s || '').toLowerCase().trim()
    let photoColIndex = header.findIndex(h => normalise(h) === 'photo url' || normalise(h) === 'photo' || normalise(h) === 'photo_url')

    if (photoColIndex === -1) {
        // Add "Photo URL" as the last column
        photoColIndex = header.length
        const colLetter = colIndexToLetter(photoColIndex)
        console.log(`➕ Adding "Photo URL" header at column ${colLetter}...`)

        const headerUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1!${colLetter}1?valueInputOption=RAW`
        await sheetsPut(headerUrl, token, { values: [['Photo URL']] })
        console.log('✅ Header added')
    } else {
        console.log(`ℹ️  "Photo URL" column already exists at index ${photoColIndex}`)
    }

    // 3. Find the professional column
    const profColIndex = header.findIndex(h =>
        normalise(h).includes('professional') || normalise(h).includes('counsellor') || normalise(h) === 'name'
    )
    if (profColIndex === -1) throw new Error('Cannot find Professional/Name column in sheet')

    // 4. For each row, if the professional is a founder and has no photo URL, fill it in
    const updates = []
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i]
        const proName = (row[profColIndex] || '').trim()
        const existingPhoto = (row[photoColIndex] || '').trim()
        const photoUrl = FOUNDER_PHOTOS[proName.toLowerCase()]

        if (photoUrl && !existingPhoto) {
            updates.push({ rowIndex: i + 1, photoUrl }) // +1 for 1-based row
        }
    }

    if (updates.length === 0) {
        console.log('ℹ️  No rows need updating (all founders already have photo URLs, or no founder rows exist)')
        return
    }

    // 5. Write photo URLs in a batch
    console.log(`✏️  Writing ${updates.length} photo URL(s)...`)
    const colLetter = colIndexToLetter(photoColIndex)
    const valueRange = {
        range: `Sheet1!${colLetter}1:${colLetter}${rows.length + 1}`,
        values: Array.from({ length: rows.length }, (_, i) => {
            if (i === 0) return ['Photo URL'] // header
            const row = rows[i]
            const proName = (row[profColIndex] || '').trim()
            const existingPhoto = (row[photoColIndex] || '').trim()
            const photoUrl = FOUNDER_PHOTOS[proName.toLowerCase()]
            return [existingPhoto || photoUrl || '']
        }),
    }

    const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchUpdate`
    const result = await sheetsPost(batchUrl, token, {
        valueInputOption: 'RAW',
        data: [valueRange],
    })

    if (result.error) throw new Error(`Batch update failed: ${result.error.message}`)
    console.log(`✅ Done! Updated ${result.totalUpdatedCells} cell(s).`)
    console.log('\n📝 Summary:')
    console.log('   - "Photo URL" column is now in your sheet')
    console.log('   - 4 founders have their GitHub raw image URLs populated')
    console.log('   - Joan Ana and future counsellors: paste a Google Drive URL in that column when ready')
    console.log('   - Next sync will pick up all photo URLs automatically')
}

function colIndexToLetter(index) {
    let letter = ''
    let n = index
    while (n >= 0) {
        letter = String.fromCharCode((n % 26) + 65) + letter
        n = Math.floor(n / 26) - 1
    }
    return letter
}

main().catch(err => {
    console.error('❌ Error:', err.message)
    process.exit(1)
})
