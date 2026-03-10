/**
 * calendarMeet.service.js
 *
 * Two responsibilities:
 *   1. Generate a unique, secure video meeting URL for the booking (Jitsi Meet).
 *      No API needed — always works — URL derived from booking ID + HMAC hash.
 *
 *   2. Create a Google Calendar event (no conferencing) on the practice calendar
 *      so the team sees all sessions in one view. Optional — skipped if
 *      GOOGLE_CALENDAR_ID is not configured.
 *
 * Why Jitsi over Google Meet API?
 *   Google Calendar conferencing (Meet) requires Google Workspace.
 *   Jitsi (meet.jit.si) is free, open-source, and needs zero API setup.
 *   The room URL is deterministic from the booking ID — stable, unguessable.
 */

const https = require('https')
const crypto = require('crypto')
const { parseSlotDateTime } = require('../utils/dateParser')

// ── 1. Meet URL — Jitsi (no API, always works) ───────────────────────────────

/**
 * Generates a deterministic Jitsi Meet room URL from the booking ID.
 * Room name = short HMAC of booking ID → unguessable but stable.
 * e.g. https://meet.jit.si/TYS-a3f9b1-JeevanKJ
 */
function generateMeetUrl(booking) {
    const secret = process.env.JITSI_SECRET || 'theeyouspace-sessions'
    const hash = crypto.createHmac('sha256', secret)
        .update(booking.id)
        .digest('hex')
        .slice(0, 8)
    const proSlug = (booking.professional || 'session')
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(0, 20)
    const room = `TYS-${hash}-${proSlug}`
    return `https://meet.jit.si/${room}`
}

// ── 2. Calendar event (no conferencing) — optional ───────────────────────────

async function getCalendarToken() {
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
    const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
    if (!email || !rawKey) return null

    const privateKey = rawKey.replace(/\\n/g, '\n')
    const now = Math.floor(Date.now() / 1000)
    const payload = {
        iss: email,
        scope: 'https://www.googleapis.com/auth/calendar',
        aud: 'https://oauth2.googleapis.com/token',
        exp: now + 3600, iat: now,
    }
    const enc = o => Buffer.from(JSON.stringify(o)).toString('base64url')
    const h = enc({ alg: 'RS256', typ: 'JWT' })
    const b = enc(payload)
    const sgn = crypto.createSign('RSA-SHA256')
    sgn.update(`${h}.${b}`)
    const jwt = `${h}.${b}.${sgn.sign(privateKey, 'base64url')}`

    const body = new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
    }).toString()

    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(body),
            },
        }, r => {
            let d = ''
            r.on('data', c => d += c)
            r.on('end', () => {
                try {
                    const parsed = JSON.parse(d)
                    if (parsed.access_token) resolve(parsed.access_token)
                    else reject(new Error(parsed.error_description || 'No access_token'))
                } catch { reject(new Error('Token parse failed')) }
            })
        })
        req.on('error', reject)
        req.write(body)
        req.end()
    })
}

function calendarPost(path, token, body) {
    const bodyStr = JSON.stringify(body)
    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: 'www.googleapis.com', path, method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(bodyStr),
            },
        }, r => {
            let d = ''
            r.on('data', c => d += c)
            r.on('end', () => { try { resolve(JSON.parse(d)) } catch { resolve(d) } })
        })
        req.on('error', reject)
        req.write(bodyStr)
        req.end()
    })
}

function toISOist(date) {
    const pad = n => String(n).padStart(2, '0')
    const ist = new Date(date.getTime() + (5.5 * 60 * 60 * 1000))
    return `${ist.getUTCFullYear()}-${pad(ist.getUTCMonth() + 1)}-${pad(ist.getUTCDate())}` +
        `T${pad(ist.getUTCHours())}:${pad(ist.getUTCMinutes())}:00+05:30`
}

async function createCalendarEvent(booking, meetUrl) {
    const calendarId = process.env.GOOGLE_CALENDAR_ID
    if (!calendarId) return  // optional — skip silently

    const slot = booking.selectedSlot || {}
    const startDate = parseSlotDateTime(slot.date, slot.time)
    if (!startDate) return

    const durationMs = booking.sessionType === 'priority' ? 75 * 60 * 1000 : 60 * 60 * 1000
    const endDate = new Date(startDate.getTime() + durationMs)

    let token
    try { token = await getCalendarToken() } catch { return }
    if (!token) return

    const eventBody = {
        summary: `Session — ${booking.professional || 'Counsellor'} & ${booking.name}`,
        description: [
            `Patient: ${booking.name}  (${booking.email})`,
            `Booking ID: ${booking.id}`,
            `Session: ${booking.sessionType === 'priority' ? 'Priority' : 'Regular'}`,
            '',
            `Video link: ${meetUrl}`,
            '',
            'Booked via Thee You Space',
        ].join('\n'),
        start: { dateTime: toISOist(startDate), timeZone: 'Asia/Kolkata' },
        end: { dateTime: toISOist(endDate), timeZone: 'Asia/Kolkata' },
        location: meetUrl,
        reminders: {
            useDefault: false,
            overrides: [{ method: 'popup', minutes: 15 }],
        },
    }

    try {
        const event = await calendarPost(
            `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
            token, eventBody
        )
        if (event.error) {
            console.warn('[CalendarEvent] Could not create event:', event.error.message)
        } else {
            console.log(`[CalendarEvent] ✅ Event added to practice calendar for booking ${booking.id}`)
        }
    } catch (err) {
        console.warn('[CalendarEvent] Unexpected error:', err.message)
    }
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * createMeetEvent(booking) → string
 *
 * Always returns a Jitsi Meet URL immediately (no API call needed).
 * Also asynchronously creates a Google Calendar event for team visibility.
 * Never throws, never returns null.
 */
async function createMeetEvent(booking) {
    // 1. Generate meet URL instantly (no API, synchronous)
    const meetUrl = generateMeetUrl(booking)
    console.log(`[MeetEvent] ✅ Meet URL generated for ${booking.id}: ${meetUrl}`)

    // 2. Create calendar event in background (non-blocking, optional)
    createCalendarEvent(booking, meetUrl).catch(err =>
        console.warn('[CalendarEvent] Background error:', err.message)
    )

    return meetUrl
}

module.exports = { createMeetEvent, generateMeetUrl }
