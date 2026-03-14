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

async function testSheetAccess(token, sheetId) {
    return new Promise((res) => {
        const req = https.request({
            hostname: 'sheets.googleapis.com',
            path: `/v4/spreadsheets/${sheetId}?includeGridData=false`,
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` }
        }, r => {
            let d = ''; r.on('data', c => d += c);
            r.on('end', () => {
                try { res({ status: r.statusCode, data: JSON.parse(d) }) } catch (e) { res({ status: r.statusCode, data: d }) }
            })
        });
        req.on('error', (e) => res({ status: 500, error: e.message }));
        req.end();
    })
}

async function testSMTP() {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: false, // STARTTLS on port 587
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });

    const net = require('net');
    const testPort = (port) => new Promise((res) => {
        const socket = net.createConnection(port, 'smtp.gmail.com');
        socket.setTimeout(4000);
        socket.on('connect', () => { socket.destroy(); res({ success: true }); });
        socket.on('error', (e) => { res({ success: false, error: e.message }); });
        socket.on('timeout', () => { socket.destroy(); res({ success: false, error: 'Timeout' }); });
    });

    const port587 = await testPort(587);
    const port465 = await testPort(465);

    try {
        const timeoutPromise = new Promise((_, rej) => setTimeout(() => rej(new Error('SMTP Verification Timeout (10s)')), 10000));
        await Promise.race([transporter.verify(), timeoutPromise]);
        return { success: true, connectivity: { port587, port465 } };
    } catch (e) {
        return { success: false, error: e.message, code: e.code, connectivity: { port587, port465 } };
    }
}


router.get('/diagnostic', async (req, res) => {
    const k = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '';
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';

    let authResult = null;
    let sheetResult = null;
    let smtpResult = null;

    smtpResult = await testSMTP();

    if (k && email) {
        authResult = await testAuth(email, k);
        const cleanSheetId = (process.env.GOOGLE_SHEET_ID || '').replace(/[^a-zA-Z0-9-_]/g, '')
        if (authResult?.access_token && cleanSheetId) {
            sheetResult = await testSheetAccess(authResult.access_token, cleanSheetId);
        }
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
        authResult: authResult ? (authResult.error_thrown ? authResult.error_thrown : (authResult.access_token ? 'valid_token' : authResult)) : null,
        sheetResult,
        smtpResult,
        smtpUser: process.env.SMTP_USER ? (process.env.SMTP_USER.slice(0, 3) + '***' + process.env.SMTP_USER.slice(-4)) : 'NOT_SET',
        smtpConfig: {
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: process.env.SMTP_PORT || '587'
        }
    })
})

module.exports = router
