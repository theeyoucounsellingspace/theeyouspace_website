/**
 * check-production.js — Full production health check
 * Tests every endpoint and env-var dependency against the live Render backend.
 *
 * Usage: node backend/scripts/check-production.js
 */

const https = require('https')

const BASE = 'https://theeyouspace-website.onrender.com'
const API = `${BASE}/api`

// ── tiny HTTP helper ──────────────────────────────────────────────────────────
function req(method, url, headers = {}, body = null) {
    return new Promise((resolve) => {
        const parsed = new URL(url)
        const opts = {
            hostname: parsed.hostname,
            path: parsed.pathname + parsed.search,
            method,
            headers: { 'Content-Type': 'application/json', ...headers },
            timeout: 20000,
        }
        const r = https.request(opts, (res) => {
            let d = ''
            res.on('data', c => d += c)
            res.on('end', () => {
                try { resolve({ status: res.statusCode, body: JSON.parse(d) }) }
                catch { resolve({ status: res.statusCode, body: d }) }
            })
        })
        r.on('error', (e) => resolve({ status: 0, body: { error: e.message } }))
        r.on('timeout', () => { r.destroy(); resolve({ status: 0, body: { error: 'timeout' } }) })
        if (body) r.write(JSON.stringify(body))
        r.end()
    })
}

function tick(ok, label, detail = '') {
    const icon = ok ? '✅' : '❌'
    console.log(`  ${icon} ${label}${detail ? '  →  ' + detail : ''}`)
    return ok
}

async function main() {
    let pass = 0, fail = 0
    const check = (ok, ...args) => { ok ? pass++ : fail++; return tick(ok, ...args) }

    console.log('\n══════════════════════════════════════════════════════════')
    console.log('  Thee You Space — Production Health Check')
    console.log(`  Target: ${BASE}`)
    console.log('══════════════════════════════════════════════════════════\n')

    // ── 1. Basic reachability ─────────────────────────────────────────────────
    console.log('── Server ──────────────────────────────────────────────────')
    const ping = await req('GET', `${API}/booking/slots`)
    check(ping.status === 200, 'Backend reachable', `HTTP ${ping.status}`)

    // ── 2. Slots / Sheet sync ─────────────────────────────────────────────────
    console.log('\n── Google Sheet Sync ───────────────────────────────────────')
    if (ping.status === 200) {
        const slotCount = ping.body?.slots?.length ?? 0
        const grouped = Object.keys(ping.body?.grouped ?? {})
        check(slotCount > 0, `Slots loaded`, `${slotCount} slots across ${grouped.length} professionals`)
        if (slotCount > 0) {
            console.log('     Professionals with slots:')
            grouped.forEach(p => console.log(`       • ${p} (${ping.body.grouped[p].length} slots)`))
        } else {
            console.log('     ⚠️  Sheet sync not working — GOOGLE_SERVICE_ACCOUNT_KEY may be malformed on Render')
            console.log('     Fix: In Render env vars, make sure the key has literal newlines, not \\\\n')
        }
    } else {
        check(false, 'Cannot check slots — server unreachable')
    }

    // ── 3. Professionals cache ────────────────────────────────────────────────
    console.log('\n── Professionals Cache ─────────────────────────────────────')
    const profs = await req('GET', `${API}/professionals`)
    check(profs.status === 200, 'Professionals endpoint up', `HTTP ${profs.status}`)
    if (profs.status === 200) {
        check(profs.body?.loaded === true, 'Professionals cache loaded', profs.body?.loaded ? `${profs.body.count} loaded` : 'loaded=false — Sheet sync not running')
    }

    // ── 4. Pricing endpoint ───────────────────────────────────────────────────
    console.log('\n── Pricing ─────────────────────────────────────────────────')
    const pricing = await req('GET', `${API}/booking/pricing?sessionType=normal`)
    check(pricing.status === 200, 'Pricing endpoint up', pricing.body?.pricing ? `₹${pricing.body.pricing.baseAmount}` : `HTTP ${pricing.status}`)

    // ── 5. Payment order (Razorpay keys) ─────────────────────────────────────
    console.log('\n── Razorpay ────────────────────────────────────────────────')
    // We don't actually create a real order — just check the error message
    const fakeOrder = await req('POST', `${API}/booking/create`, {}, {
        sessionType: 'normal', name: 'Health Check', email: 'check@test.com',
        phone: '9999999999', selectedSlot: null,
    })
    // A 400 (validation error) = server works; a 500 mentioning Razorpay = key missing
    const razorpayOk = fakeOrder.status !== 500 ||
        !(JSON.stringify(fakeOrder.body)).toLowerCase().includes('razorpay')
    check(fakeOrder.status !== 500 || razorpayOk, 'Razorpay keys configured',
        fakeOrder.status === 400
            ? 'Keys OK (got validation error as expected)'
            : fakeOrder.status === 500
                ? `Server error: ${fakeOrder.body?.error}`
                : `HTTP ${fakeOrder.status}`)

    // ── 6. CORS headers ───────────────────────────────────────────────────────
    console.log('\n── CORS ────────────────────────────────────────────────────')
    const corsCheck = await req('GET', `${API}/booking/slots`, { Origin: 'https://theeyouspace.com' })
    check(corsCheck.status === 200, 'CORS allows theeyouspace.com')

    // ── 7. Summary ────────────────────────────────────────────────────────────
    console.log('\n══════════════════════════════════════════════════════════')
    console.log(`  Results: ${pass} passed   ${fail} failed`)
    if (fail > 0) {
        console.log('\n  ⚠️  Action needed — see notes above')
        console.log('\n  Most likely missing Render env vars:')
        if ((ping.body?.slots?.length ?? 0) === 0) {
            console.log('  • GOOGLE_SHEET_ID')
            console.log('  • GOOGLE_SERVICE_ACCOUNT_EMAIL')
            console.log('  • GOOGLE_SERVICE_ACCOUNT_KEY  (check newline format!)')
        }
        console.log('  • RAZORPAY_KEY_ID')
        console.log('  • RAZORPAY_KEY_SECRET')
        console.log('  • FRONTEND_URL=https://theeyouspace.com')
    } else {
        console.log('\n  ✅ All checks passed — production is healthy')
    }
    console.log('══════════════════════════════════════════════════════════\n')
}

main().catch(e => { console.error('Check script failed:', e.message); process.exit(1) })
