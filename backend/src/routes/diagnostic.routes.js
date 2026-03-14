const express = require('express')
const router = express.Router()

router.get('/diagnostic', (req, res) => {
    const k = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '';
    res.json({
        hasSheetId: !!process.env.GOOGLE_SHEET_ID,
        sheetIdLen: (process.env.GOOGLE_SHEET_ID || '').length,
        hasEmail: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        emailLen: (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '').length,
        hasKey: !!k,
        keyLen: k.length,
        keyStart: k.slice(0, 30),
        keyContainsRealNewline: k.includes('\n'),
        keyContainsEscapedNewline: k.includes('\\n'),
        razorpayKeyIdLen: (process.env.RAZORPAY_KEY_ID || '').length,
        frontendUrl: process.env.FRONTEND_URL,
    })
})

module.exports = router
