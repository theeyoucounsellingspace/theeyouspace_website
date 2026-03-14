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
    const sheetId = (process.env.GOOGLE_SHEET_ID || '').replace(/[^a-zA-Z0-9-_]/g, '')
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
    const readUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent('Slots')}`
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
    // NOTE: Do NOT match 'name' generically — it could match patient name columns
    const header = rows[0].map(h => (h || '').toLowerCase().trim())
    const proCol = header.findIndex(h => h.includes('professional') || h.includes('counsellor') || h.includes('counselor'))
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
    // Read the actual sheetId (tab ID) from metadata — don't assume it's 0 or named 'Sheet1'
    const sheetMetaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties`
    let gid = 0
    let tabName = 'Sheet1'
    try {
        const meta = await getJson(sheetMetaUrl, token)
        gid = meta?.sheets?.[0]?.properties?.sheetId ?? 0
        tabName = meta?.sheets?.[0]?.properties?.title || 'Sheet1'
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



module.exports = { removeSlotFromSheet, appendBookingToSheet, updateBookingStatusInSheet, restoreBookingsFromSheet }

/**
 * restoreBookingsFromSheet()
 *
 * Called once on server startup. Reads the "All Bookings" tab from Google Sheet
 * and rebuilds the in-memory Booking store — so confirmed bookings survive server restarts.
 *
 * Column layout (All Bookings tab):
 *   A: Professional  B: Booking ID  C: Patient Name  D: Email  E: Phone
 *   F: Date          G: Time        H: Session Type  ...       M: Status  O: Confirmed At
 *
 * Non-blocking — errors are logged only, never thrown.
 * Returns: number of bookings restored.
 */
async function restoreBookingsFromSheet() {
    const Booking = require('../models/Booking')
    const sheetId = (process.env.GOOGLE_SHEET_ID || '').replace(/[^a-zA-Z0-9-_]/g, '')
    if (!sheetId) {
        console.log('[BookingRestore] GOOGLE_SHEET_ID not set — skipping restore')
        return 0
    }

    let token
    try {
        token = await getAccessToken()
    } catch (err) {
        console.error('[BookingRestore] Auth failed:', err.message)
        return 0
    }
    if (!token) {
        console.log('[BookingRestore] No service account configured — skipping restore')
        return 0
    }

    try {
        const data = await getJson(
            `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent('All Bookings')}`,
            token
        )
        const rows = data.values || []
        if (rows.length < 2) {
            console.log('[BookingRestore] "All Bookings" tab is empty — nothing to restore')
            return 0
        }

        // Column index constants  (header row = rows[0], data starts at rows[1])
        const C = {
            professional: 0,
            bookingId: 1,
            name: 2,
            email: 3,
            phone: 4,
            date: 5,
            time: 6,
            sessionType: 7,
            status: 13,
            confirmedAt: 15,
        }

        let restored = 0
        let skipped = 0

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i]
            const bookingId = (row[C.bookingId] || '').trim()

            // Must look like a real booking ID
            if (!bookingId || !bookingId.startsWith('TYS-')) { skipped++; continue }

            // Skip if already in memory (page reload without full restart)
            if (Booking.findById(bookingId)) { skipped++; continue }

            const statusInSheet = (row[C.status] || 'Confirmed').trim()
            const rawType = (row[C.sessionType] || '').toLowerCase()
            const professional = (row[C.professional] || '').trim()
            const date = (row[C.date] || '').trim()
            const time = (row[C.time] || '').trim()

            Booking.restore({
                id: bookingId,
                professional,
                name: (row[C.name] || '').trim(),
                email: (row[C.email] || '').trim(),
                phone: (row[C.phone] || '').trim() || null,
                selectedSlot: { date, time, professional },
                sessionType: rawType.includes('priority') ? 'priority' : 'normal',
                paymentStatus: 'paid',
                bookingStatus: statusInSheet.toLowerCase() === 'rescheduled' ? 'rescheduled' : 'confirmed',
                createdAt: (row[C.confirmedAt] || new Date().toISOString()),
            })
            restored++
        }

        console.log(`[BookingRestore] ✅ Restored ${restored} booking(s) from Google Sheet (${skipped} skipped)`)
        return restored
    } catch (err) {
        console.error('[BookingRestore] ❌ Restore failed:', err.message)
        return 0
    }
}


/**
 * updateBookingStatusInSheet(bookingId, professional, date, time, newStatus)
 *
 * Finds the row in the professional's tab matching bookingId (column A)
 * and updates the Status column (column M, index 12) to newStatus.
 * Non-throwing — all failures are logged only.
 */
async function updateBookingStatusInSheet(bookingId, professional, date, time, newStatus) {
    const sheetId = (process.env.GOOGLE_SHEET_ID || '').replace(/[^a-zA-Z0-9-_]/g, '')
    if (!sheetId || !bookingId) return

    let token
    try { token = await getAccessToken() } catch { return }
    if (!token) return

    try {
        const tabName = (professional || 'Unknown').replace(/[\[\]:*?/\\]/g, '').trim().slice(0, 95)

        // Read the professional's tab
        const data = await getJson(
            `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(tabName)}`,
            token
        )
        const rows = data.values || []
        if (rows.length < 2) return

        // Column A = Booking ID, Column M (index 12) = Status
        const BOOKING_ID_COL = 0
        const STATUS_COL = 12

        let targetRow = -1
        for (let i = 1; i < rows.length; i++) {
            if ((rows[i][BOOKING_ID_COL] || '').trim() === bookingId) {
                targetRow = i + 1 // 1-indexed for Sheets API
                break
            }
        }

        if (targetRow === -1) {
            console.warn(`[SheetWriteback] updateStatus: booking ${bookingId} not found in tab "${tabName}"`)
            return
        }

        // Write new status to column M of that row
        const range = `${tabName}!M${targetRow}`
        await putJson(
            `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
            token,
            { range, majorDimension: 'ROWS', values: [[newStatus]] }
        )
        console.log(`[SheetWriteback] ✅ Status updated to "${newStatus}" for booking ${bookingId} in tab "${tabName}"`)
    } catch (err) {
        console.error('[SheetWriteback] updateStatus failed:', err.message)
    }
}


// ─── Booking Writeback ────────────────────────────────────────────────────────

const { label, labelList, CONCERN_LABELS, DURATION_LABELS, IMPACT_LABELS } = require('../utils/triageLabels')

/** Column headers for each professional's tab */
const BOOKING_HEADERS = [
    'Booking ID', 'Patient Name', 'Email', 'Phone',
    'Date', 'Time', 'Session Type',
    'Primary Concern', 'Duration', 'Affected Areas', 'First Session?',
    'Booking Source', 'Status', 'Notes', 'Confirmed At',
]

/** Column headers for the All Bookings aggregate tab (prepends Professional) */
const ALL_BOOKINGS_HEADERS = ['Professional', ...BOOKING_HEADERS]

/**
 * Sanitise a professional name to be a valid Google Sheets tab title.
 * Sheets forbids: [ ] : * ? / \  and max 100 chars.
 */
function toTabName(name) {
    return (name || 'Unknown')
        .replace(/[\[\]:*?/\\]/g, '')
        .trim()
        .slice(0, 95)
}

/**
 * List all tab titles in the sheet.
 * Returns Map<title, sheetId(gid)>
 */
async function listTabs(sheetId, token) {
    const meta = await getJson(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties`,
        token
    )
    if (meta.error) throw new Error(`listTabs: ${meta.error.message}`)
    const map = new Map()
    for (const s of (meta.sheets || [])) {
        map.set(s.properties.title, s.properties.sheetId)
    }
    return map
}

/**
 * Create a new tab, write headers to row 1, return the new gid.
 */
async function createTabWithHeaders(sheetId, token, tabTitle, headers) {
    // 1. Add the sheet tab
    const addResp = await postJson(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`,
        token,
        { requests: [{ addSheet: { properties: { title: tabTitle } } }] }
    )
    if (addResp.error) throw new Error(`createTab "${tabTitle}": ${addResp.error.message}`)
    const newGid = addResp.replies?.[0]?.addSheet?.properties?.sheetId

    // 2. Write header row
    await putJson(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(tabTitle + '!A1')}?valueInputOption=RAW`,
        token,
        { range: `${tabTitle}!A1`, majorDimension: 'ROWS', values: [headers] }
    )
    console.log(`[SheetWriteback] Created tab "${tabTitle}" with ${headers.length} columns`)
    return newGid
}

/**
 * Append a single row to an existing tab (auto-finds next empty row).
 */
async function appendRow(sheetId, token, tabTitle, values) {
    const range = `${tabTitle}!A:A`
    const resp = await postJson(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
        token,
        { range, majorDimension: 'ROWS', values: [values] }
    )
    if (resp.error) throw new Error(`appendRow to "${tabTitle}": ${resp.error.message}`)
    return resp
}

/**
 * PUT helper (for writing values — Sheets API uses PUT for updates)
 */
async function putJson(url, token, body) {
    const bodyStr = JSON.stringify(body)
    return new Promise((resolve, reject) => {
        const parsed = new URL(url)
        const req = https.request({
            hostname: parsed.hostname,
            path: parsed.pathname + parsed.search,
            method: 'PUT',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(bodyStr),
            },
        }, (res) => {
            let d = ''; res.on('data', c => d += c)
            res.on('end', () => { try { resolve(JSON.parse(d)) } catch { resolve(d) } })
        })
        req.on('error', reject); req.write(bodyStr); req.end()
    })
}

/**
 * Append confirmed booking details to:
 *   1. A tab named after the professional (auto-created on first booking)
 *   2. The aggregate "All Bookings" tab (auto-created if absent)
 *
 * Non-blocking  — call with .catch() only; never awaited on the critical path.
 * Non-throwing  — all errors are logged, not re-raised.
 */
async function appendBookingToSheet(booking) {
    const sheetId = (process.env.GOOGLE_SHEET_ID || '').replace(/[^a-zA-Z0-9-_]/g, '')
    if (!sheetId) {
        console.warn('[SheetWriteback] GOOGLE_SHEET_ID not set — skipping booking writeback')
        return
    }

    let token
    try {
        token = await getAccessToken()
    } catch (err) {
        console.error('[SheetWriteback] Auth failed for booking writeback:', err.message)
        return
    }
    if (!token) {
        console.warn('[SheetWriteback] No service account configured — skipping booking writeback')
        return
    }

    try {
        // ── Build the row values ───────────────────────────────────────────────
        const triage = booking.triageData || {}
        const slot = booking.selectedSlot || {}
        const proName = booking.professional || slot.professional || 'Unknown'
        const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })

        const bookingRow = [
            booking.id || '',
            booking.name || '',
            booking.email || '',
            booking.phone || '',
            slot.date || '',
            slot.time || '',
            booking.sessionType === 'priority' ? 'Priority Session' : 'Regular Session',
            label(CONCERN_LABELS, triage.concern),
            label(DURATION_LABELS, triage.duration),
            labelList(IMPACT_LABELS, triage.impacts),
            triage.isFirstTimer === true ? 'Yes' : triage.isFirstTimer === false ? 'No' : '',
            'Website',
            'Confirmed',
            '',            // Notes — counsellor fills manually
            now,
        ]

        const allBookingsRow = [proName, ...bookingRow]

        // ── Ensure tabs exist ──────────────────────────────────────────────────
        const tabs = await listTabs(sheetId, token)
        const tabName = toTabName(proName)

        if (!tabs.has(tabName)) {
            await createTabWithHeaders(sheetId, token, tabName, BOOKING_HEADERS)
        }
        if (!tabs.has('All Bookings')) {
            await createTabWithHeaders(sheetId, token, 'All Bookings', ALL_BOOKINGS_HEADERS)
        }

        // ── Append rows ────────────────────────────────────────────────────────
        await Promise.all([
            appendRow(sheetId, token, tabName, bookingRow),
            appendRow(sheetId, token, 'All Bookings', allBookingsRow),
        ])

        console.log(`[SheetWriteback] ✅ Booking ${booking.id} written to "${tabName}" + "All Bookings"`)
    } catch (err) {
        // Never block the confirmation flow — just log
        console.error('[SheetWriteback] ❌ Booking writeback failed:', err.message)
    }
}

