/**
 * Google Sheets Write-back Service
 *
 * After a slot is successfully booked and payment is confirmed,
 * this service removes that row from the Google Sheet so:
 *   1. The slot never reappears after a server restart
 *   2. The sheet remains the single persistent source of truth
 *
 * Requires a Google Service Account with Editor access to the sheet.
 *
 * Setup (one time):
 *   1. Go to console.cloud.google.com → Create project → Enable "Google Sheets API"
 *   2. IAM & Admin → Service Accounts → Create → download JSON key
 *   3. Open the JSON key — copy client_email and private_key into Render env vars:
 *        GOOGLE_SERVICE_ACCOUNT_EMAIL=xxx@xxx.iam.gserviceaccount.com
 *        GOOGLE_SERVICE_ACCOUNT_KEY=-----BEGIN PRIVATE KEY-----\n...
 *   4. In your Google Sheet → Share → add the service account email as Editor
 *   5. Also set GOOGLE_SHEET_ID=1DnHC5VSmn7nE4a9XNEljSrIwAKaBSSWmEewDpE8_5u0 (the ID from your sheet URL)
 *
 * If the env vars are not set, this module noops gracefully — no crash,
 * the slot is still marked booked in memory for the current server lifetime.
 */

const https = require('https')

// ── JWT / Auth token for Service Account ─────────────────────────────────────

let _cachedToken = null
let _tokenExpiry = 0

/**
 * Obtain a short-lived OAuth2 access token using a Service Account JWT.
 */
async function getAccessToken() {
    // Return cached token if still valid (with 60s buffer)
    if (_cachedToken && Date.now() < _tokenExpiry - 60_000) return _cachedToken

    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
    const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY

    if (!email || !rawKey) return null // not configured — noop

    // The private key stored in env vars has literal \n — restore them
    const privateKey = rawKey.replace(/\\n/g, '\n')

    const now = Math.floor(Date.now() / 1000)
    const payload = {
        iss: email,
        scope: 'https://www.googleapis.com/auth/spreadsheets',
        aud: 'https://oauth2.googleapis.com/token',
        exp: now + 3600,
        iat: now,
    }

    // Build JWT (header.payload.signature) using node built-ins only
    const { createSign } = require('crypto')
    const encode = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url')
    const header = encode({ alg: 'RS256', typ: 'JWT' })
    const body = encode(payload)
    const sigInput = `${header}.${body}`

    const sign = createSign('RSA-SHA256')
    sign.update(sigInput)
    const sig = sign.sign(privateKey, 'base64url')
    const jwt = `${sigInput}.${sig}`

    // Exchange JWT for access token
    const tokenResponse = await postJson('https://oauth2.googleapis.com/token', null, {
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
    }, true /* form-encoded */)

    _cachedToken = tokenResponse.access_token
    _tokenExpiry = Date.now() + tokenResponse.expires_in * 1000
    return _cachedToken
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

async function postJson(url, token, payload, formEncoded = false) {
    const body = formEncoded
        ? new URLSearchParams(payload).toString()
        : JSON.stringify(payload)

    const headers = {
        'Content-Type': formEncoded ? 'application/x-www-form-urlencoded' : 'application/json',
        'Content-Length': Buffer.byteLength(body),
    }
    if (token) headers['Authorization'] = `Bearer ${token}`

    const parsed = new URL(url)
    const { body: resp } = await httpsRequest(url, {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers,
    }, body)
    return resp
}

async function getJson(url, token) {
    const parsed = new URL(url)
    const { body } = await httpsRequest(url, {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
    })
    return body
}

// ── Core: find and delete the booked row from the sheet ──────────────────────

/**
 * Remove a booked slot from the Google Sheet.
 * Matches by Professional + Date + Time (case-insensitive, whitespace-tolerant).
 *
 * @param {string} professional
 * @param {string} date
 * @param {string} time
 * @returns {Promise<{removed: boolean, reason: string}>}
 */
async function removeSlotFromSheet(professional, date, time) {
    const sheetId = process.env.GOOGLE_SHEET_ID
    if (!sheetId) {
        return { removed: false, reason: 'GOOGLE_SHEET_ID not set — skipping write-back' }
    }

    let token
    try {
        token = await getAccessToken()
    } catch (err) {
        return { removed: false, reason: `Auth failed: ${err.message}` }
    }
    if (!token) {
        return { removed: false, reason: 'Service account not configured — skipping write-back' }
    }

    // 1. Read all values from the sheet
    const readUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1`
    let rows
    try {
        const resp = await getJson(readUrl, token)
        rows = resp.values || []
    } catch (err) {
        return { removed: false, reason: `Failed to read sheet: ${err.message}` }
    }

    if (rows.length < 2) {
        return { removed: false, reason: 'Sheet has no data rows' }
    }

    // 2. Detect column indices from header row
    const header = rows[0].map(h => (h || '').toLowerCase().trim())
    const proCol = header.findIndex(h => h.includes('professional') || h.includes('counsellor') || h.includes('name'))
    const dateCol = header.findIndex(h => h.includes('date'))
    const timeCol = header.findIndex(h => h.includes('time'))

    if (dateCol === -1 || timeCol === -1) {
        return { removed: false, reason: 'Could not detect Date/Time columns in sheet header' }
    }

    const norm = (s) => (s || '').trim().toLowerCase()

    // 3. Find the matching row (1-indexed for Sheets API; row 1 = header)
    let targetRowIndex = -1
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i]
        const rowPro = proCol !== -1 ? norm(row[proCol]) : ''
        const rowDate = norm(row[dateCol])
        const rowTime = norm(row[timeCol])

        const proMatch = proCol === -1 || rowPro === norm(professional)
        if (proMatch && rowDate === norm(date) && rowTime === norm(time)) {
            targetRowIndex = i + 1 // +1 because Sheets rows start at 1
            break
        }
    }

    if (targetRowIndex === -1) {
        return { removed: false, reason: `Row not found in sheet for ${professional} | ${date} | ${time}` }
    }

    // 4. Delete the row using batchUpdate
    const sheetMetaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties`
    let gid = 0
    try {
        const meta = await getJson(sheetMetaUrl, token)
        gid = meta?.sheets?.[0]?.properties?.sheetId || 0
    } catch (_) { /* use default gid=0 */ }

    const deleteUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`
    const deletePayload = {
        requests: [{
            deleteDimension: {
                range: {
                    sheetId: gid,
                    dimension: 'ROWS',
                    startIndex: targetRowIndex - 1, // 0-indexed
                    endIndex: targetRowIndex,        // exclusive
                }
            }
        }]
    }

    try {
        const result = await postJson(deleteUrl, token, deletePayload)
        if (result.error) {
            return { removed: false, reason: `Sheets API error: ${result.error.message}` }
        }
        console.log(`[SheetWriteback] ✅ Removed row ${targetRowIndex} from sheet: ${professional} | ${date} | ${time}`)
        return { removed: true, reason: 'Row deleted from Google Sheet' }
    } catch (err) {
        return { removed: false, reason: `Delete request failed: ${err.message}` }
    }
}

module.exports = { removeSlotFromSheet }
