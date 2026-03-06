/**
 * Two-tab sheet setup — run ONCE.
 *
 * Creates:
 *   Tab "Professionals" — permanent profile data (photo, role, languages, etc.)
 *   Tab "Slots"         — just Professional | Date | Time (admin edits only this)
 *
 * Usage: node backend/scripts/setup-two-tab-sheet.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') })
const https = require('https')
const crypto = require('crypto')

const SHEET_ID = process.env.GOOGLE_SHEET_ID
const SA_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
const SA_KEY = (process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '').replace(/\\n/g, '\n')

// ── All professional data — set once, never change unless profile updates ─────
const PROFESSIONALS = [
    {
        name: 'Jeevan KJ',
        role: 'Counselling Psychologist',
        experience: '2+ yrs exp',
        languages: 'Tamil, English',
        areas: 'School Counseling, Career Guidance',
        approach: 'Person-Centered Support, Strengths-Based Career Mapping',
        photoUrl: 'https://raw.githubusercontent.com/theeyoucounsellingspace/theeyouspace_website/main/frontend/src/assets/team/jeevan.png',
    },
    {
        name: 'Leaskar Paulraj DJ',
        role: 'Counselling Psychologist',
        experience: '2+ yrs exp',
        languages: 'Tamil, English',
        areas: 'Family Concerns, Disability Coping, General Stress',
        approach: 'CBT, PCT, Family Counselling',
        photoUrl: 'https://raw.githubusercontent.com/theeyoucounsellingspace/theeyouspace_website/main/frontend/src/assets/team/leaskar.jpg',
    },
    {
        name: 'Abijith KB',
        role: 'Counselling Psychologist',
        experience: '2+ yrs exp',
        languages: 'Tamil, Malayalam, English',
        areas: 'Work Stress, Work-Life Balance, Relationships, Academics',
        approach: 'CBT, Person-Centered Therapy, Psychoanalytic Therapy',
        photoUrl: 'https://raw.githubusercontent.com/theeyoucounsellingspace/theeyouspace_website/main/frontend/src/assets/team/abijith.png',
    },
    {
        name: 'Mohammed Muhaiyadeen M',
        role: 'Counselling Psychologist',
        experience: '2+ yrs exp',
        languages: 'Tamil, English',
        areas: 'Relationships, Identity, Work Stress, Academics, Professional Growth, Anxiety, Grief',
        approach: 'CBT, Person-Centered Therapy, Couple Counselling',
        photoUrl: 'https://raw.githubusercontent.com/theeyoucounsellingspace/theeyouspace_website/main/frontend/src/assets/team/mohammed.jpg',
    },
    {
        name: 'Joan Ana',
        role: 'Counselling Psychologist',
        experience: '1.5+ yrs exp',
        languages: 'Tamil, English',
        areas: 'Anxiety, Grief, Identity, Social Anxiety, Life Transitions',
        approach: 'CBT, Mindfulness, Motivational Interviewing, Trauma-Informed Care',
        photoUrl: 'https://raw.githubusercontent.com/theeyoucounsellingspace/theeyouspace_website/main/frontend/src/assets/team/joan.jpg',
    },
]

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

// ── HTTP ──────────────────────────────────────────────────────────────────────

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

const GET = (p, t) => sheetsReq('GET', p, t, null)
const POST = (p, t, b) => sheetsReq('POST', p, t, b)
const PUT = (p, t, b) => sheetsReq('PUT', p, t, b)

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    if (!SHEET_ID || !SA_EMAIL || !SA_KEY) {
        console.error('❌ Missing: GOOGLE_SHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_KEY')
        process.exit(1)
    }

    console.log('🔑 Authenticating...')
    const token = await getToken()
    console.log('✅ Authenticated\n')

    // 1. Get existing tabs
    const meta = await GET(`/v4/spreadsheets/${SHEET_ID}?fields=sheets.properties`, token)
    if (meta.error) throw new Error(`Metadata error: ${meta.error.message}`)

    const existingTabs = meta.sheets.map(s => ({ title: s.properties.title, gid: s.properties.sheetId }))
    console.log('📋 Existing tabs:', existingTabs.map(t => `"${t.title}"`).join(', '))

    const hasSlots = existingTabs.some(t => t.title === 'Slots')
    const hasProfessionals = existingTabs.some(t => t.title === 'Professionals')
    const sheet1 = existingTabs.find(t => t.title === 'Sheet1')

    const requests = []

    // 2. Rename "Sheet1" → "Slots" if it exists and "Slots" tab doesn't yet
    if (sheet1 && !hasSlots) {
        requests.push({
            updateSheetProperties: {
                properties: { sheetId: sheet1.gid, title: 'Slots' },
                fields: 'title',
            }
        })
        console.log('🔄 Will rename "Sheet1" → "Slots"')
    }

    // 3. Add "Professionals" tab if it doesn't exist
    if (!hasProfessionals) {
        requests.push({
            addSheet: { properties: { title: 'Professionals', index: 0 } }
        })
        console.log('➕ Will create "Professionals" tab')
    }

    if (requests.length > 0) {
        const batchResp = await POST(`/v4/spreadsheets/${SHEET_ID}:batchUpdate`, token, { requests })
        if (batchResp.error) throw new Error(`batchUpdate failed: ${batchResp.error.message}`)
        console.log('✅ Tabs created/renamed\n')
    } else {
        console.log('ℹ️  Tabs already exist — skipping creation\n')
    }

    // 4. Write Professionals tab — full profile data, one row per person
    const profHeader = ['Professional', 'Role', 'Experience', 'Languages', 'Areas', 'Approach', 'Photo URL']
    const profRows = PROFESSIONALS.map(p => [p.name, p.role, p.experience, p.languages, p.areas, p.approach, p.photoUrl])
    const profValues = [profHeader, ...profRows]

    console.log('✍️  Writing Professionals tab...')
    const profRange = `Professionals!A1:G${profValues.length}`
    // First clear
    await POST(`/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent('Professionals')}:clear`, token, {})
    const profResp = await PUT(
        `/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(profRange)}?valueInputOption=RAW`,
        token,
        { range: profRange, majorDimension: 'ROWS', values: profValues }
    )
    if (profResp.error) throw new Error(`Professionals write failed: ${profResp.error.message}`)
    console.log(`✅ Professionals tab: ${profResp.updatedRows} rows written`)

    // 5. Write Slots tab — clean header + empty annotated row showing the format
    const slotsHeader = ['Professional', 'Date', 'Time']
    const slotsExample = [
        ['← Replace with professional name exactly as spelled in Professionals tab', 'e.g. 10/3/2026', 'e.g. 10:00 AM'],
    ]
    const slotsValues = [slotsHeader, ...slotsExample]

    console.log('✍️  Writing Slots tab...')
    const slotsRange = `Slots!A1:C${slotsValues.length}`
    await POST(`/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent('Slots')}:clear`, token, {})
    const slotsResp = await PUT(
        `/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(slotsRange)}?valueInputOption=RAW`,
        token,
        { range: slotsRange, majorDimension: 'ROWS', values: slotsValues }
    )
    if (slotsResp.error) throw new Error(`Slots write failed: ${slotsResp.error.message}`)
    console.log(`✅ Slots tab: ${slotsResp.updatedRows} rows written\n`)

    console.log('🎉 Done!\n')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('  PROFESSIONALS tab: one-time setup ✅ — never touch again')
    console.log('  SLOTS tab: admin adds/removes rows here for availability')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('\n  Admin workflow (ongoing):')
    console.log('  1. Open Slots tab')
    console.log('  2. Add a new row: Professional name | Date | Time')
    console.log('  3. Delete a row when a slot is taken or cancelled')
    console.log('  4. Backend auto-syncs every 30 min — nothing else needed')
    console.log('\n  When a new counsellor joins:')
    console.log('  1. Add their row in Professionals tab (one time)')
    console.log('  2. Add their slots in the Slots tab')
    console.log('  → They appear on the website automatically on next sync\n')
}

main().catch(err => {
    console.error('\n❌ Failed:', err.message)
    process.exit(1)
})
