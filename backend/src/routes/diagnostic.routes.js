const express = require('express')
const router = express.Router()
const crypto = require('crypto')
const https = require('https')

async function testAuth(email, rawKey) {
    try {
        const privateKey = rawKey.replace(/\\n/g, '\n').replace(/\n/g, '\n')
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
                headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) }
            },
                r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d))) })
            req.on('error', rej); req.write(body); req.end()
        })
    } catch (err) {
        return { error_thrown: err.message, stack: err.stack }
    }
}


router.get('/diagnostic', async (req, res) => {
    const k = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '';
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';

    let authResult = null;
    if (k && email) {
        authResult = await testAuth(email, k);
    }

    res.json({
        hasSheetId: !!process.env.GOOGLE_SHEET_ID,
        sheetIdLen: (process.env.GOOGLE_SHEET_ID || '').length,
        hasEmail: !!email,
        emailLen: email.length,
        hasKey: !!k,
        keyLen: k.length,
        keyStart: k.slice(0, 30),
        keyContainsRealNewline: k.includes('\n'),
        keyContainsEscapedNewline: k.includes('\\n'),
        razorpayKeyIdLen: (process.env.RAZORPAY_KEY_ID || '').length,
        frontendUrl: process.env.FRONTEND_URL,
        authResult
    })
})

module.exports = router
