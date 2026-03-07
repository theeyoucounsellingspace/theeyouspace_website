/**
 * dateParser.js — Parse Indian-format date/time strings into JS Date objects.
 *
 * Indian sheet dates (admin enters): D/M/YYYY, D-M-YYYY, DD/MM/YYYY
 * Times: "10:00 AM", "10:00 am", "10 AM", "10:00", "14:00"
 *
 * parseSlotDateTime(date, time) → Date | null
 * isMoreThan24HoursAway(date, time) → boolean
 */

const MONTH_MAP = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
}

/**
 * Parse a date string (D/M/YYYY, D-M-YYYY, D M YYYY, D Mon YYYY, etc.) → { day, month, year }
 */
function parseDateStr(str) {
    if (!str) return null
    str = str.trim()

    // Numeric: 10/3/2026  or  10-3-2026  or  10.3.2026
    const numMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/)
    if (numMatch) {
        let [, a, b, y] = numMatch.map(Number)
        if (y < 100) y += 2000 // handle 2-digit year
        // Treat as D/M/YYYY (Indian convention)
        return { day: a, month: b - 1, year: y }
    }

    // Text month: "10 Mar 2026" or "10 March 2026"
    const textMatch = str.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{2,4})$/)
    if (textMatch) {
        let [, d, mon, y] = textMatch
        const m = MONTH_MAP[mon.toLowerCase().slice(0, 3)]
        if (m === undefined) return null
        return { day: parseInt(d), month: m, year: parseInt(y) }
    }

    // "Monday, Mar 10" — day-of-week prefix (no year — use current/next year)
    const dowMatch = str.match(/[A-Za-z]+,?\s+([A-Za-z]+)\s+(\d{1,2})/)
    if (dowMatch) {
        const [, mon, d] = dowMatch
        const m = MONTH_MAP[mon.toLowerCase().slice(0, 3)]
        if (m === undefined) return null
        const year = new Date().getFullYear()
        return { day: parseInt(d), month: m, year }
    }

    return null
}

/**
 * Parse a time string ("10:00 AM", "10:00", "10 AM", "14:00") → { hours, minutes }
 */
function parseTimeStr(str) {
    if (!str) return null
    str = str.trim()

    const match12 = str.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i)
    if (match12) {
        let h = parseInt(match12[1])
        const m = parseInt(match12[2] || '0')
        const period = match12[3].toLowerCase()
        if (period === 'pm' && h !== 12) h += 12
        if (period === 'am' && h === 12) h = 0
        return { hours: h, minutes: m }
    }

    const match24 = str.match(/^(\d{1,2}):(\d{2})$/)
    if (match24) {
        return { hours: parseInt(match24[1]), minutes: parseInt(match24[2]) }
    }

    return null
}

/**
 * Parse a slot date + time string into a JS Date (IST assumed).
 * Returns null if parsing fails — callers must handle null gracefully.
 *
 * @param {string} dateStr — e.g. "10/3/2026"
 * @param {string} timeStr — e.g. "10:00 AM"
 * @returns {Date|null}
 */
function parseSlotDateTime(dateStr, timeStr) {
    const d = parseDateStr(dateStr)
    const t = parseTimeStr(timeStr)
    if (!d || !t) return null

    // Construct as IST (UTC+5:30)
    const ist = new Date(Date.UTC(d.year, d.month, d.day, t.hours - 5, t.minutes - 30))
    if (isNaN(ist.getTime())) return null
    return ist
}

/**
 * Returns true if the session is strictly more than 24 hours from now.
 * Returns false if parsing fails (conservative — better to block reschedule than allow past-window).
 */
function isMoreThan24HoursAway(dateStr, timeStr) {
    const sessionTime = parseSlotDateTime(dateStr, timeStr)
    if (!sessionTime) return false
    const diffMs = sessionTime.getTime() - Date.now()
    return diffMs > 24 * 60 * 60 * 1000
}

/**
 * Returns true if the slot date has already passed (end of that day in IST).
 */
function isSlotInPast(dateStr, timeStr) {
    const sessionTime = parseSlotDateTime(dateStr, timeStr)
    if (!sessionTime) return false // unknown — keep the slot
    return sessionTime.getTime() < Date.now()
}

/**
 * Format a Date as a readable IST string for emails/logs.
 */
function toISTString(date) {
    return date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
}

module.exports = { parseSlotDateTime, isMoreThan24HoursAway, isSlotInPast, toISTString }
