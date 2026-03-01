/**
 * Google Sheets Slot Sync Service — Multi-Professional Edition
 *
 * Sheet format (3 columns, header row required):
 *   | Professional | Date           | Time     |
 *   |--------------|----------------|----------|
 *   | Dr. Priya    | Monday, Mar 3  | 10:00 AM |
 *   | Dr. Priya    | Monday, Mar 3  | 2:00 PM  |
 *   | Dr. Arjun    | Tuesday, Mar 4 | 11:00 AM |
 *   | Dr. Meera    | Tuesday, Mar 4 | 3:00 PM  |
 *
 * Each professional sees the WHOLE sheet, manages THEIR OWN rows.
 * If a column is missing, we fall back to 2-column mode (Date | Time).
 *
 * Backend sync:
 *   - On server start: immediate sync
 *   - Every 60 minutes: auto-sync
 *   - On demand: POST /api/slots/sync  (API key protected)
 *
 * Set in backend/.env:
 *   GOOGLE_SHEET_URL=https://docs.google.com/spreadsheets/d/SHEET_ID/export?format=csv
 */

const https = require('https')
const http = require('http')
const AvailabilitySlot = require('../models/AvailabilitySlot')
const ProfessionalsService = require('./professionals.service')

// ─── HTTP fetch with redirect support ────────────────────────────────────────

function fetchUrl(url, maxRedirects = 5) {
    return new Promise((resolve, reject) => {
        if (maxRedirects <= 0) {
            return reject(new Error('Too many redirects while fetching Google Sheet'))
        }
        try {
            const parsed = new URL(url)
            const lib = parsed.protocol === 'https:' ? https : http
            lib.get(url, { headers: { 'User-Agent': 'TheeyouSpace-SlotSync/1.0' } }, (res) => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    return fetchUrl(res.headers.location, maxRedirects - 1).then(resolve).catch(reject)
                }
                if (res.statusCode !== 200) {
                    res.resume()
                    return reject(new Error(`Google Sheets returned HTTP ${res.statusCode} — is the sheet public?`))
                }
                let data = ''
                res.setEncoding('utf8')
                res.on('data', (chunk) => (data += chunk))
                res.on('end', () => resolve(data))
            }).on('error', reject)
        } catch (err) {
            reject(err)
        }
    })
}

// ─── Normalise the export URL ─────────────────────────────────────────────────

/**
 * Accept any Google Sheets URL variation and return a proper CSV export URL.
 * Handles:
 *   .../edit               → export?format=csv
 *   .../edit?format=csv    → fixed
 *   .../edit#gid=0         → export?format=csv
 *   already correct URL    → unchanged
 */
function normaliseSheetsUrl(raw) {
    if (!raw) return null
    // Strip everything after the sheet ID
    const match = raw.match(/spreadsheets\/d\/([^\/\?#]+)/)
    if (!match) return raw // not a sheets URL — return as-is

    const sheetId = match[1]
    return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`
}

// ─── CSV parsing ──────────────────────────────────────────────────────────────

/**
 * Parse one CSV line, handling quoted commas.
 * Returns array of trimmed string values.
 */
function parseCsvLine(line) {
    const cols = []
    let current = ''
    let inQuotes = false
    for (const ch of line) {
        if (ch === '"') { inQuotes = !inQuotes; continue }
        if (ch === ',' && !inQuotes) { cols.push(current.trim()); current = ''; continue }
        current += ch
    }
    cols.push(current.trim())
    return cols
}

/**
 * Detect column indices from the header row (case-insensitive).
 */
function detectColumns(headerCols) {
    const lower = headerCols.map((c) => c.toLowerCase())
    return {
        professional: lower.findIndex((c) => c.includes('professional') || c.includes('counsellor') || c.includes('counselor') || c.includes('name')),
        date: lower.findIndex((c) => c.includes('date')),
        time: lower.findIndex((c) => c.includes('time')),
        // Optional bio columns — if present, professionals cache is auto-built
        title: lower.findIndex((c) => c === 'title' || c === 'designation'),
        bio: lower.findIndex((c) => c === 'bio' || c === 'about' || c === 'description'),
        specializations: lower.findIndex((c) => c.includes('specializ') || c.includes('approach')),
        areas: lower.findIndex((c) => c === 'areas' || c.includes('focus')),
    }
}

/**
 * Parse the raw CSV text into slot objects with professional names.
 */
function parseCsvToSlots(csvText) {
    const lines = csvText.trim().split(/\r?\n/)
    if (lines.length < 2) throw new Error('Sheet is empty or has only a header row')

    const headerCols = parseCsvLine(lines[0])
    const cols = detectColumns(headerCols)

    if (cols.date === -1) throw new Error(`No "Date" column found. Headers: ${headerCols.join(', ')}`)
    if (cols.time === -1) throw new Error(`No "Time" column found. Headers: ${headerCols.join(', ')}`)

    const hasProfessional = cols.professional !== -1
    const hasBioColumns = cols.title !== -1 || cols.bio !== -1 || cols.specializations !== -1 || cols.areas !== -1

    if (!hasProfessional) {
        console.warn('[Slot Sync] No "Professional" column found — slots will show without a professional name')
    }
    if (hasBioColumns) {
        console.log('[Slot Sync] Bio columns detected — professionals cache will be updated from sheet')
    }

    const slots = []
    const errors = []
    const warnings = []
    /** Map<lowercaseName, professionalObject> — deduplicates by name */
    const profMap = new Map()

    lines.slice(1).forEach((line, index) => {
        const rowNum = index + 2
        if (!line.trim()) return

        const values = parseCsvLine(line)
        const date = values[cols.date]?.trim()
        const time = values[cols.time]?.trim()
        const name = hasProfessional ? (values[cols.professional]?.trim() || '') : ''
        const professional = name || 'General'

        // ── Build professionals cache from bio columns ──────────────────
        if (name && hasBioColumns) {
            const key = name.toLowerCase()
            if (!profMap.has(key)) {
                // Parse comma-separated lists for specializations and areas
                const rawSpecializations = cols.specializations !== -1 ? values[cols.specializations]?.trim() : ''
                const rawAreas = cols.areas !== -1 ? values[cols.areas]?.trim() : ''

                profMap.set(key, {
                    name,
                    title: cols.title !== -1 ? (values[cols.title]?.trim() || '') : '',
                    bio: cols.bio !== -1 ? (values[cols.bio]?.trim() || '') : '',
                    specializations: rawSpecializations ? rawSpecializations.split(',').map((s) => s.trim()).filter(Boolean) : [],
                    areas: rawAreas ? rawAreas.split(',').map((s) => s.trim()).filter(Boolean) : [],
                })
            }
        } else if (name) {
            // No bio columns — still register the professional by name
            const key = name.toLowerCase()
            if (!profMap.has(key)) profMap.set(key, { name })
        }

        // ── Slot validation ─────────────────────────────────────────────
        if (!date && !time) return
        if (!date) { errors.push(`Row ${rowNum}: missing date`); return }
        if (!time) { errors.push(`Row ${rowNum}: missing time for "${date}"`); return }

        // Duplicate check (same professional + date + time)
        const isDuplicate = slots.some(
            (s) => s.date === date && s.time === time && s.professional === professional
        )
        if (isDuplicate) {
            warnings.push(`Row ${rowNum}: duplicate "${professional} – ${date} ${time}" — skipped`)
            return
        }

        slots.push({ date, time, professional })
    })

    return { slots, errors, warnings, professionals: [...profMap.values()] }
}

// ─── Sync ─────────────────────────────────────────────────────────────────────

async function syncSlotsFromSheet() {
    const rawUrl = process.env.GOOGLE_SHEET_URL
    if (!rawUrl) {
        return {
            count: 0, errors: [], warnings: [], skipped: true,
            message: 'GOOGLE_SHEET_URL not set — using dev slots. Add it to backend/.env to enable live sync.',
        }
    }

    const sheetUrl = normaliseSheetsUrl(rawUrl)
    console.log('[Slot Sync] Fetching from Google Sheet...')

    const csvText = await fetchUrl(sheetUrl)
    const { slots, errors, warnings, professionals } = parseCsvToSlots(csvText)

    if (slots.length === 0) {
        throw new Error(`No valid slots parsed. Errors: ${errors.join('; ')}`)
    }

    const count = AvailabilitySlot.loadFromUpload(slots, 'google-sheet-sync')
    console.log(`[Slot Sync] ✅ Synced ${count} slots from Google Sheet`)
    if (warnings.length) console.warn(`[Slot Sync] ⚠️  ${warnings.join(' | ')}`)

    // Update professionals cache (always — even if bio columns are absent, names are registered)
    if (professionals.length > 0) {
        ProfessionalsService.setProfessionals(professionals)
    }

    return { count, errors, warnings, professionals: professionals.length }
}

function startAutoSync(intervalMinutes = 60) {
    const ms = intervalMinutes * 60 * 1000

    syncSlotsFromSheet().catch((err) => {
        console.warn(`[Slot Sync] Initial sync failed — ${err.message}`)
        console.warn('[Slot Sync] Falling back to dev-seeded slots')
    })

    const timer = setInterval(() => {
        syncSlotsFromSheet().catch((err) => {
            console.warn(`[Slot Sync] Periodic sync failed — ${err.message}`)
        })
    }, ms)

    if (timer.unref) timer.unref()
    console.log(`[Slot Sync] Auto-sync every ${intervalMinutes} min (${process.env.GOOGLE_SHEET_URL ? 'sheet configured ✅' : 'no sheet URL — dev mode'})`)
    return timer
}

module.exports = { syncSlotsFromSheet, startAutoSync, normaliseSheetsUrl }
