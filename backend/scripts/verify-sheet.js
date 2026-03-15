/**
 * Verify current sheet state via Sheets API (bypasses CSV cache lag)
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') })
const https = require('https')
const crypto = require('crypto')

const SHEET_ID = process.env.GOOGLE_SHEET_ID
const SA_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
const SA_KEY = (process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '').replace(/\\n/g, '\n')

async function getToken() {
    const now = Math.floor(Date.now() / 1000)
    const payload = { iss: SA_EMAIL, scope: 'https://www.googleapis.com/auth/spreadsheets', aud: 'https://oauth2.googleapis.com/token', exp: now + 3600, iat: now }
    const encode = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url')
    const h = encode({ alg: 'RS256', typ: 'JWT' })
    const b = encode(payload)
    const sign = crypto.createSign('RSA-SHA256'); sign.update(`${h}.${b}`)
    const jwt = `${h}.${b}.${sign.sign(SA_KEY, 'base64url')}`
    const body = new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }).toString()
    return new Promise((res, rej) => {
        const req = https.request({ hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } }, (r) => {
            let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d).access_token))
        }); req.on('error', rej); req.write(body); req.end()
    })
}

async function main() {
    const token = await getToken()
    const data = await new Promise((res, rej) => {
        const req = https.request({ hostname: 'sheets.googleapis.com', path: `/v4/spreadsheets/${SHEET_ID}/values/Sheet1`, method: 'GET', headers: { Authorization: `Bearer ${token}` } }, (r) => {
            let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)))
        }); req.on('error', rej); req.end()
    })
    const rows = data.values || []
    console.log(`\nSheet has ${rows.length} rows:\n`)
    rows.forEach((r, i) => console.log(`Row ${i + 1}: ${JSON.stringify(r)}`))
}

main().catch(err => console.error('Error:', err.message))
