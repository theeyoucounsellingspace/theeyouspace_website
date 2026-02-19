/**
 * Slot Upload Service
 * Parses Excel (.xlsx) and CSV files and loads slots into AvailabilitySlot model
 *
 * Expected Excel format (any column order, case-insensitive headers):
 * | Date          | Time     |
 * |---------------|----------|
 * | Mon, Feb 24   | 10:00 AM |
 * | Mon, Feb 24   | 2:00 PM  |
 * | Tue, Feb 25   | 11:00 AM |
 *
 * Also supports full date format:
 * | Monday, Feb 24 | 10:00 AM |
 */

const xlsx = require('xlsx')
const AvailabilitySlot = require('../models/AvailabilitySlot')

/**
 * Normalize a time string to HH:MM AM/PM format
 */
function normalizeTime(raw) {
    if (!raw) return null
    const str = String(raw).trim()

    // Already in correct format
    if (/^\d{1,2}:\d{2}\s?(AM|PM)$/i.test(str)) {
        return str.toUpperCase().replace(/\s+/, ' ')
    }

    // Handle 24-hour format (e.g. 14:00)
    const hr24 = str.match(/^(\d{1,2}):(\d{2})$/)
    if (hr24) {
        const h = parseInt(hr24[1], 10)
        const m = hr24[2]
        const period = h >= 12 ? 'PM' : 'AM'
        const hour = h > 12 ? h - 12 : h === 0 ? 12 : h
        return `${hour}:${m} ${period}`
    }

    // Handle numeric Excel time value (fraction of day)
    if (!isNaN(Number(raw))) {
        const totalMinutes = Math.round(Number(raw) * 24 * 60)
        const h = Math.floor(totalMinutes / 60)
        const m = totalMinutes % 60
        const period = h >= 12 ? 'PM' : 'AM'
        const hour = h > 12 ? h - 12 : h === 0 ? 12 : h
        return `${hour}:${String(m).padStart(2, '0')} ${period}`
    }

    return str
}

/**
 * Normalize a date to a readable string format.
 * We keep it as-is from Excel but clean whitespace.
 */
function normalizeDate(raw) {
    if (!raw) return null

    // If Excel gave us a Date object serial number
    if (typeof raw === 'number') {
        const d = xlsx.SSF.parse_date_code(raw)
        if (d) {
            const date = new Date(d.y, d.m - 1, d.d)
            return date.toLocaleDateString('en-IN', {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
            })
        }
    }

    // String date — just clean it up
    return String(raw).trim()
}

/**
 * Parse an uploaded Excel or CSV buffer and return slot objects.
 * @param {Buffer} buffer - File buffer (from multer)
 * @param {string} mimetype - File MIME type
 * @returns {{ slots: Array, errors: Array, warnings: Array }}
 */
function parseSlotFile(buffer, mimetype) {
    const workbook = xlsx.read(buffer, { type: 'buffer', cellDates: false })
    const sheetName = workbook.SheetNames[0]

    if (!sheetName) {
        throw new Error('Excel file has no sheets')
    }

    const sheet = workbook.Sheets[sheetName]
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' })

    if (!rows.length) {
        throw new Error('Excel sheet is empty')
    }

    // Detect column name (case-insensitive)
    const firstRow = rows[0]
    const colKeys = Object.keys(firstRow)

    const dateCol = colKeys.find((k) => /date/i.test(k))
    const timeCol = colKeys.find((k) => /time/i.test(k))

    if (!dateCol || !timeCol) {
        throw new Error(
            `Could not find "Date" and "Time" columns. Found: ${colKeys.join(', ')}`
        )
    }

    const slots = []
    const errors = []
    const warnings = []

    rows.forEach((row, index) => {
        const rowNum = index + 2 // Spreadsheet row (1-indexed + header)
        const rawDate = row[dateCol]
        const rawTime = row[timeCol]

        if (!rawDate && !rawTime) {
            // Skip empty rows silently
            return
        }

        const date = normalizeDate(rawDate)
        const time = normalizeTime(rawTime)

        if (!date) {
            errors.push(`Row ${rowNum}: Missing date value`)
            return
        }

        if (!time) {
            errors.push(`Row ${rowNum}: Missing time value for date "${date}"`)
            return
        }

        // Check for duplicate
        const isDuplicate = slots.some((s) => s.date === date && s.time === time)
        if (isDuplicate) {
            warnings.push(`Row ${rowNum}: Duplicate "${date} ${time}" — skipped`)
            return
        }

        slots.push({ date, time })
    })

    return { slots, errors, warnings }
}

/**
 * Process the uploaded file and load slots into the system.
 * @param {Buffer} buffer - File buffer
 * @param {string} originalName - Original filename
 * @param {string} mimetype - File MIME type
 * @returns {{ count: number, errors: [], warnings: [], status: object }}
 */
function processSlotUpload(buffer, originalName, mimetype) {
    const { slots, errors, warnings } = parseSlotFile(buffer, mimetype)

    if (slots.length === 0) {
        throw new Error(
            `No valid slots found in "${originalName}". ${errors.join('. ')}`
        )
    }

    const count = AvailabilitySlot.loadFromUpload(slots, `upload:${originalName}`)
    const status = AvailabilitySlot.getUploadStatus()

    return { count, errors, warnings, status }
}

module.exports = { processSlotUpload, parseSlotFile }
