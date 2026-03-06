/**
 * Google Sheets Slot Sync Service — Two-Tab Edition
 *
 * SHEET STRUCTURE (two tabs in the same spreadsheet):
 *
 *   Tab "Professionals" — set once per counsellor, never touch again:
 *     | Professional | Role | Experience | Languages | Areas | Approach | Photo URL |
 *
 *   Tab "Slots" — admin updates whenever availability changes:
 *     | Professional | Date | Time |
 *
 * Backend sync:
 *   - On server start: immediate sync via Sheets API (authenticated, no cache)
 *   - Every 30 minutes: auto re-sync
 *   - On demand: POST /api/slots/sync  (API key protected)
 *
 * Falls back to CSV (GOOGLE_SHEET_URL) if service account is not configured.
 * Falls back to dev slots if neither is configured.
 */

const https = require('https')
const http = require('http')
const crypto = require('crypto')
const AvailabilitySlot = require('../models/AvailabilitySlot')
const ProfessionalsService = require('./professionals.service')

// ─── Service Account JWT Auth ─────────────────────────────────────────────────

async function getSAToken() {
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
    const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
    if (!email || !rawKey) return null
    const privateKey = rawKey.replace(/\\n/g, '\n')
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
            r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { res(JSON.parse(d).access_token) } catch { rej(new Error('Token parse failed')) } }) })
        req.on('error', rej); req.write(body); req.end()
    })
}

async function sheetsGet(path, token) {
    return new Promise((res, rej) => {
        const req = https.request({
            hostname: 'sheets.googleapis.com', path, method: 'GET',
            headers: { Authorization: `Bearer ${token}` }
        },
            r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { res(JSON.parse(d)) } catch { res(d) } }) })
        req.on('error', rej); req.end()
    })
}


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
        professional: lower.findIndex((c) => c.includes('professional') || c.includes('counsellor') || c.includes('counselor') || c === 'name'),
        date: lower.findIndex((c) => c.includes('date')),
        time: lower.findIndex((c) => c.includes('time')),
        // Optional bio columns — if present, professionals cache is auto-built
        title: lower.findIndex((c) => c === 'title' || c === 'designation' || c === 'role'),
        bio: lower.findIndex((c) => c === 'bio' || c === 'about' || c === 'description'),
        specializations: lower.findIndex((c) => c.includes('specializ') || c.includes('expertise')),
        areas: lower.findIndex((c) => c === 'areas' || c.includes('focus') || c === 'area of focus'),
        // Card display columns
        approach: lower.findIndex((c) => c === 'approach' || c.includes('therapeutic') || c.includes('modality')),
        experience: lower.findIndex((c) => c === 'experience' || c === 'exp' || c === 'years'),
        languages: lower.findIndex((c) => c.includes('language') || c.includes('speaks') || c.includes('tongue')),
        mode: lower.findIndex((c) => c === 'mode' || c.includes('session mode') || c.includes('online')),
        price: lower.findIndex((c) => c === 'price' || c.includes('fee') || c.includes('rate') || c.includes('amount')),
        // Photo URL — direct image link (Google Drive, Cloudinary, GitHub raw, etc.)
        photoUrl: lower.findIndex((c) => c === 'photo url' || c === 'photo' || c === 'image' || c === 'image url' || c === 'photo_url'),
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
        || cols.experience !== -1 || cols.languages !== -1 || cols.mode !== -1 || cols.price !== -1
        || cols.photoUrl !== -1

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
        // Guard: skip placeholder/empty names
        const INVALID_NAMES = ['na', 'n/a', '-', 'none', 'tbd', 'tba', 'null', 'undefined']
        if (name && hasBioColumns && !INVALID_NAMES.includes(name.toLowerCase())) {
            const profKey = name.toLowerCase() // single declaration — no duplicate
            const rawSpecializations = cols.specializations !== -1 ? values[cols.specializations]?.trim() : ''
            const rawAreas = cols.areas !== -1 ? values[cols.areas]?.trim() : ''
            const rawApproach = cols.approach !== -1 ? values[cols.approach]?.trim() : ''

            const incoming = {
                name,
                title: cols.title !== -1 ? (values[cols.title]?.trim() || '') : '',
                bio: cols.bio !== -1 ? (values[cols.bio]?.trim() || '') : '',
                specializations: rawSpecializations ? rawSpecializations.split(',').map((s) => s.trim()).filter(Boolean) : [],
                areas: rawAreas ? rawAreas.split(',').map((s) => s.trim()).filter(Boolean) : [],
                approach: rawApproach ? rawApproach.split(',').map((s) => s.trim()).filter(Boolean) : [],
                experience: cols.experience !== -1 ? (values[cols.experience]?.trim() || '') : '',
                languages: cols.languages !== -1 ? (values[cols.languages]?.trim() || '') : '',
                mode: cols.mode !== -1 ? (values[cols.mode]?.trim() || '') : '',
                price: cols.price !== -1 ? (values[cols.price]?.trim() || '') : '',
                photoUrl: cols.photoUrl !== -1 ? (values[cols.photoUrl]?.trim() || '') : '',
            }

            if (!profMap.has(profKey)) {
                profMap.set(profKey, incoming)
            } else {
                // Richest-row wins: merge, preferring non-empty values
                const existing = profMap.get(profKey)
                const merged = {}
                for (const field of Object.keys(incoming)) {
                    const inc = incoming[field]
                    const ex = existing[field]
                    merged[field] = Array.isArray(inc)
                        ? (inc.length >= (ex?.length || 0) ? inc : ex)
                        : (inc || ex || '')
                }
                profMap.set(profKey, merged)
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

/**
 * Primary sync path: read Professionals + Slots tabs via Sheets API (authenticated).
 * - Professionals tab → populates profiles cache (name, photo, role, areas, etc.)
 * - Slots tab         → populates availability slots
 * Falls back to legacy CSV sync if service account is not configured.
 */
async function syncSlotsFromSheet() {
    const sheetId = process.env.GOOGLE_SHEET_ID
    const rawUrl = process.env.GOOGLE_SHEET_URL

    // ── Path A: Authenticated two-tab read (preferred) ────────────────────────
    if (sheetId && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
        let token
        try {
            token = await getSAToken()
        } catch (err) {
            console.warn(`[Slot Sync] SA auth failed: ${err.message} — falling back to CSV`)
        }

        if (token) {
            console.log('[Slot Sync] Using Sheets API (authenticated)...')
            const errors = [], warnings = []

            // 1. Read Professionals tab
            let professionals = []
            try {
                const profData = await sheetsGet(
                    `/v4/spreadsheets/${sheetId}/values/${encodeURIComponent('Professionals')}`,
                    token
                )
                const profRows = profData.values || []
                if (profRows.length >= 2) {
                    const header = profRows[0].map(h => (h || '').toLowerCase().trim())
                    const nameCol = header.findIndex(h => h.includes('professional') || h.includes('name'))
                    const roleCol = header.findIndex(h => h.includes('role') || h.includes('title'))
                    const expCol = header.findIndex(h => h.includes('experience') || h.includes('exp'))
                    const langCol = header.findIndex(h => h.includes('language'))
                    const areasCol = header.findIndex(h => h.includes('area'))
                    const approachCol = header.findIndex(h => h.includes('approach'))
                    const photoCol = header.findIndex(h => h.includes('photo'))
                    for (let i = 1; i < profRows.length; i++) {
                        const r = profRows[i]
                        const name = nameCol !== -1 ? (r[nameCol] || '').trim() : ''
                        if (!name || name.toLowerCase() === 'na') continue
                        professionals.push({
                            name,
                            title: roleCol !== -1 ? (r[roleCol] || '') : '',
                            experience: expCol !== -1 ? (r[expCol] || '') : '',
                            languages: langCol !== -1 ? (r[langCol] || '') : '',
                            areas: areasCol !== -1 ? r[areasCol]?.split(',').map(s => s.trim()).filter(Boolean) || [] : [],
                            approach: approachCol !== -1 ? r[approachCol]?.split(',').map(s => s.trim()).filter(Boolean) || [] : [],
                            photoUrl: photoCol !== -1 ? (r[photoCol] || '') : '',
                        })
                    }
                    console.log(`[Slot Sync] Professionals tab: ${professionals.length} profiles loaded`)
                    if (professionals.length > 0) ProfessionalsService.setProfessionals(professionals)
                } else {
                    warnings.push('Professionals tab is empty — add professional rows there')
                }
            } catch (err) {
                warnings.push(`Could not read Professionals tab: ${err.message}`)
            }

            // 2. Read Slots tab
            let slots = []
            try {
                const slotData = await sheetsGet(
                    `/v4/spreadsheets/${sheetId}/values/${encodeURIComponent('Slots')}`,
                    token
                )
                const slotRows = slotData.values || []
                if (slotRows.length >= 2) {
                    const header = slotRows[0].map(h => (h || '').toLowerCase().trim())
                    const proCol = header.findIndex(h => h.includes('professional') || h.includes('counsellor'))
                    const dateCol = header.findIndex(h => h.includes('date'))
                    const timeCol = header.findIndex(h => h.includes('time'))
                    if (dateCol === -1 || timeCol === -1) {
                        errors.push('Slots tab missing Date or Time column')
                    } else {
                        for (let i = 1; i < slotRows.length; i++) {
                            const r = slotRows[i]
                            const pro = proCol !== -1 ? (r[proCol] || '').trim() : 'General'
                            const date = (r[dateCol] || '').trim()
                            const time = (r[timeCol] || '').trim()
                            // Skip placeholder rows and empty rows
                            if (!date || !time) continue
                            if (date.toLowerCase().includes('dd/mm') || time.toLowerCase().includes('hh:mm')) continue
                            if (date.toLowerCase().includes('e.g') || time.toLowerCase().includes('e.g')) continue
                            const INVALID = ['na', 'n/a', '-', 'none', 'tbd', '']
                            if (INVALID.includes(pro.toLowerCase()) || INVALID.includes(date.toLowerCase())) continue
                            slots.push({ professional: pro, date, time })
                        }
                    }
                    console.log(`[Slot Sync] Slots tab: ${slots.length} valid slots loaded`)
                } else {
                    warnings.push('Slots tab has no data rows — add availability slots there')
                }
            } catch (err) {
                errors.push(`Could not read Slots tab: ${err.message}`)
            }

            if (slots.length === 0) {
                if (errors.length) console.warn('[Slot Sync] ⚠️  Errors:', errors.join(' | '))
                console.warn('[Slot Sync] No slots found — schedule page will show empty. Add slots to the Slots tab.')
            } else {
                AvailabilitySlot.loadFromUpload(slots, 'sheets-api-authenticated')
            }
            if (warnings.length) console.warn('[Slot Sync] ⚠️ ', warnings.join(' | '))
            return { count: slots.length, errors, warnings, professionals: professionals.length }
        }
    }

    // ── Path B: Legacy CSV fallback (single-tab, unauthenticated) ─────────────
    if (!rawUrl) {
        return {
            count: 0, errors: [], warnings: [], skipped: true,
            message: 'Neither service account nor GOOGLE_SHEET_URL configured — using dev slots.',
        }
    }

    const sheetUrl = normaliseSheetsUrl(rawUrl)
    console.log('[Slot Sync] Falling back to CSV sync...')
    const csvText = await fetchUrl(sheetUrl)
    const { slots, errors, warnings, professionals } = parseCsvToSlots(csvText)

    if (slots.length === 0) {
        throw new Error(`No valid slots parsed from CSV. Errors: ${errors.join('; ')}`)
    }
    AvailabilitySlot.loadFromUpload(slots, 'csv-fallback')
    console.log(`[Slot Sync] ✅ CSV fallback: ${slots.length} slots synced`)
    if (professionals.length > 0) ProfessionalsService.setProfessionals(professionals)
    return { count: slots.length, errors, warnings, professionals: professionals.length }
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
