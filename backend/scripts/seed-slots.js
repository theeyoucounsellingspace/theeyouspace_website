/**
 * seed-slots.js — Populates the Slots tab with real upcoming slots for all professionals.
 *
 * Generates slots for the next 14 days (Mon–Sat only), morning + afternoon for each counsellor.
 * Safe to re-run — clears the Slots tab first, then writes fresh slots.
 * Booked slots are managed separately (they get deleted from this tab by the backend).
 *
 * Usage: node backend/scripts/seed-slots.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') })
const https = require('https')
const crypto = require('crypto')

const SHEET_ID = process.env.GOOGLE_SHEET_ID
const SA_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
const SA_KEY = (process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '').replace(/\\n/g, '\n')

// ── Slot configuration per professional ──────────────────────────────────────
// Each professional gets different time slots to simulate real scheduling.
// Adjust times here whenever needed.

const SLOT_CONFIG = [
    {
        name: 'Jeevan KJ',
        times: ['10:00 AM', '12:00 PM', '4:00 PM'],
        days: [1, 2, 3, 4, 6],   // Mon Tue Wed Thu Sat (0=Sun, 6=Sat)
    },
    {
        name: 'Leaskar Paulraj DJ',
        times: ['11:00 AM', '3:00 PM', '6:00 PM'],
        days: [1, 3, 5, 6],      // Mon Wed Fri Sat
    },
    {
        name: 'Abijith KB',
        times: ['9:00 AM', '11:00 AM', '5:00 PM'],
        days: [2, 3, 4, 5],      // Tue Wed Thu Fri
    },
    {
        name: 'Mohammed Muhaiyadeen M',
        times: ['10:00 AM', '2:00 PM', '5:00 PM'],
        days: [1, 2, 4, 6],      // Mon Tue Thu Sat
    },
    {
        name: 'Joan Ana',
        times: ['9:30 AM', '12:00 PM', '3:30 PM'],
        days: [1, 2, 3, 5, 6],   // Mon Tue Wed Fri Sat
    },
]

const DAYS_AHEAD = 14   // generate slots for the next 14 days

// ── Format date as D/M/YYYY (Indian convention, what the backend parses) ──────
function formatDate(date) {
    return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`
}

// ── Generate all slots ────────────────────────────────────────────────────────
function generateSlots() {
    const rows = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    for (let d = 1; d <= DAYS_AHEAD; d++) {
        const date = new Date(today)
        date.setDate(today.getDate() + d)
        const dayOfWeek = date.getDay() // 0=Sun…6=Sat

        for (const pro of SLOT_CONFIG) {
            if (!pro.days.includes(dayOfWeek)) continue
            for (const time of pro.times) {
                rows.push([pro.name, formatDate(date), time])
            }
        }
    }

    // Sort by date then professional then time
    rows.sort((a, b) => {
        const [aD, aM, aY] = a[1].split('/').map(Number)
        const [bD, bM, bY] = b[1].split('/').map(Number)
        const da = new Date(aY, aM - 1, aD)
        const db = new Date(bY, bM - 1, bD)
        if (da - db !== 0) return da - db
        if (a[0] !== b[0]) return a[0].localeCompare(b[0])
        return a[2].localeCompare(b[2])
    })

    return rows
}

// ── Auth ──────────────────────────────────────────────────────────────────────
async function getToken() {
    const now = Math.floor(Date.now() / 1000)
    const payload = {
        iss: SA_EMAIL, scope: 'https://www.googleapis.com/auth/spreadsheets',
        aud: 'https://oauth2.googleapis.com/token', exp: now + 3600, iat: now,
    }
    const enc = o => Buffer.from(JSON.stringify(o)).toString('base64url')
    const h = enc({ alg: 'RS256', typ: 'JWT' }), b = enc(payload)
    const sgn = crypto.createSign('RSA-SHA256')
    sgn.update(`${h}.${b}`)
    const jwt = `${h}.${b}.${sgn.sign(SA_KEY, 'base64url')}`
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

const POST = (p, t, b) => sheetsReq('POST', p, t, b)
const PUT = (p, t, b) => sheetsReq('PUT', p, t, b)

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
    if (!SHEET_ID || !SA_EMAIL || !SA_KEY) {
        console.error('❌ Missing env vars: GOOGLE_SHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_KEY')
        process.exit(1)
    }

    console.log('🔑 Authenticating...')
    const token = await getToken()
    console.log('✅ Authenticated\n')

    const slotRows = generateSlots()
    console.log(`📅 Generated ${slotRows.length} slots for the next ${DAYS_AHEAD} days\n`)

    // Preview by professional
    const byPro = {}
    for (const [name] of slotRows) {
        byPro[name] = (byPro[name] || 0) + 1
    }
    for (const [name, count] of Object.entries(byPro)) {
        console.log(`   ${name}: ${count} slots`)
    }
    console.log()

    const header = [['Professional', 'Date', 'Time']]
    const allValues = [...header, ...slotRows]
    const range = `Slots!A1:C${allValues.length}`

    console.log('🧹 Clearing Slots tab...')
    await POST(
        `/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent('Slots')}:clear`,
        token, {}
    )

    console.log('✍️  Writing slots...')
    const resp = await PUT(
        `/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
        token,
        { range, majorDimension: 'ROWS', values: allValues }
    )

    if (resp.error) throw new Error(`Write failed: ${resp.error.message}`)
    console.log(`\n✅ Slots tab: ${resp.updatedRows - 1} slot rows written (1 header row)\n`)

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('  Backend auto-syncs from this tab every 30 minutes.')
    console.log('  To load slots immediately: restart the backend server.')
    console.log('  To add more slots: add rows manually to the Slots tab.')
    console.log('  Format: Professional Name (exact) | D/M/YYYY | H:MM AM/PM')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

main().catch(err => {
    console.error('\n❌ Failed:', err.message)
    process.exit(1)
})
