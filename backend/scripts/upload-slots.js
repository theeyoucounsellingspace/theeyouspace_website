#!/usr/bin/env node
/**
 * Thee You Space — Upload Availability Slots
 *
 * Usage:
 *   node scripts/upload-slots.js path/to/availability.xlsx
 *   node scripts/upload-slots.js path/to/availability.csv
 *
 * Requirements:
 *   - Backend must be running (npm run dev in /backend)
 *   - EXPORT_API_KEY must match the one in backend/.env
 *
 * Excel format (two columns, any order, case-insensitive):
 *   | Date              | Time     |
 *   | Monday, Feb 24    | 10:00 AM |
 *   | Monday, Feb 24    | 2:00 PM  |
 */

const fs = require('fs')
const path = require('path')
const https = require('https')
const http = require('http')

// ── Config ────────────────────────────────────────────────
const API_URL = process.env.API_URL || 'http://localhost:3000'
const API_KEY = process.env.EXPORT_API_KEY || 'dev-export-key-123'
// ─────────────────────────────────────────────────────────

const filePath = process.argv[2]

if (!filePath) {
    console.error('❌  Usage: node scripts/upload-slots.js <path-to-file.xlsx|.csv>')
    process.exit(1)
}

const absolutePath = path.resolve(filePath)

if (!fs.existsSync(absolutePath)) {
    console.error(`❌  File not found: ${absolutePath}`)
    process.exit(1)
}

const ext = path.extname(filePath).toLowerCase()
if (!['.xlsx', '.xls', '.csv'].includes(ext)) {
    console.error(`❌  Unsupported file type "${ext}". Use .xlsx or .csv`)
    process.exit(1)
}

// Read file
const fileBuffer = fs.readFileSync(absolutePath)
const fileName = path.basename(absolutePath)

console.log(`📄  Uploading "${fileName}" (${fileBuffer.length} bytes)…`)

// Build multipart form data
const boundary = `----FormBoundary${Date.now().toString(16)}`
const contentType = ext === '.csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const bodyParts = [
    `--${boundary}\r\n`,
    `Content-Disposition: form-data; name="slots"; filename="${fileName}"\r\n`,
    `Content-Type: ${contentType}\r\n\r\n`,
]

const header = Buffer.from(bodyParts.join(''))
const footer = Buffer.from(`\r\n--${boundary}--\r\n`)
const body = Buffer.concat([header, fileBuffer, footer])

const url = new URL(`${API_URL}/api/slots/upload`)
const lib = url.protocol === 'https:' ? https : http

const options = {
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    path: url.pathname,
    method: 'POST',
    headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
        'X-API-Key': API_KEY,
    },
}

const req = lib.request(options, (res) => {
    let data = ''
    res.on('data', (chunk) => (data += chunk))
    res.on('end', () => {
        try {
            const json = JSON.parse(data)
            if (json.success) {
                console.log(`✅  Success! Loaded ${json.count} slots`)
                if (json.warnings?.length) {
                    console.warn('⚠️   Warnings:')
                    json.warnings.forEach((w) => console.warn(`     ${w}`))
                }
                if (json.parseErrors?.length) {
                    console.error('❌  Parse errors:')
                    json.parseErrors.forEach((e) => console.error(`     ${e}`))
                }
                console.log('\n📊  Current status:')
                console.log(`     Total:     ${json.status.totalSlots} slots`)
                console.log(`     Available: ${json.status.availableSlots}`)
                console.log(`     Booked:    ${json.status.bookedSlots}`)
            } else {
                console.error(`❌  Upload failed: ${json.error}`)
                process.exit(1)
            }
        } catch (e) {
            console.error(`❌  Invalid response: ${data}`)
            process.exit(1)
        }
    })
})

req.on('error', (err) => {
    console.error(`❌  Connection error: ${err.message}`)
    console.error('    Is the backend running? (npm run dev in /backend)')
    process.exit(1)
})

req.write(body)
req.end()
