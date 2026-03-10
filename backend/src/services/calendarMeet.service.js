/**
 * calendarMeet.service.js
 *
 * Creates a Google Calendar event with an auto-generated Google Meet link
 * for each confirmed booking. The meet URL is stored on the booking and
 * included in the confirmation email.
 *
 * Requirements (one-time setup):
 *   1. Google Calendar API enabled in Google Cloud Console (same project)
 *   2. A shared "Thee You Space Sessions" Google Calendar — service account added as Editor
 *   3. GOOGLE_CALENDAR_ID= in .env
 *
 * No GOOGLE_CALENDAR_ID → function returns null silently (email sends without meet link).
 */

const https = require('https')
const crypto = require('crypto')
const { parseSlotDateTime } = require('../utils/dateParser')

// ── Auth — Calendar scope ─────────────────────────────────────────────────────

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
        exp: now + 3600,
        iat: now,
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
            hostname: 'oauth2.googleapis.com',
            path: '/token',
            method: 'POST',
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
                    else reject(new Error(parsed.error_description || 'No access_token in response'))
                } catch {
                    reject(new Error('Calendar token parse failed'))
                }
            })
        })
        req.on('error', reject)
        req.write(body)
        req.end()
    })
}

// ── Calendar API POST ─────────────────────────────────────────────────────────

function calendarPost(path, token, body) {
    const bodyStr = JSON.stringify(body)
    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: 'www.googleapis.com',
            path,
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(bodyStr),
            },
        }, r => {
            let d = ''
            r.on('data', c => d += c)
            r.on('end', () => {
                try { resolve(JSON.parse(d)) } catch { resolve(d) }
            })
        })
        req.on('error', reject)
        req.write(bodyStr)
        req.end()
    })
}

// ── Format IST datetime for Calendar API ─────────────────────────────────────

function toISOist(date) {
    // Google Calendar needs "+05:30" offset
    const pad = n => String(n).padStart(2, '0')
    const ist = new Date(date.getTime() + (5.5 * 60 * 60 * 1000))
    return `${ist.getUTCFullYear()}-${pad(ist.getUTCMonth() + 1)}-${pad(ist.getUTCDate())}` +
        `T${pad(ist.getUTCHours())}:${pad(ist.getUTCMinutes())}:00+05:30`
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * createMeetEvent(booking) → string | null
 *
 * Creates a Google Calendar event with a Google Meet link for the booking.
 * Returns the meet URL string, or null if not configured or on failure.
 *
 * Graceful: never throws — all errors are logged only.
 */
async function createMeetEvent(booking) {
    const calendarId = process.env.GOOGLE_CALENDAR_ID
    if (!calendarId) {
        console.log('[MeetEvent] GOOGLE_CALENDAR_ID not set — skipping meet creation')
        return null
    }

    const slot = booking.selectedSlot || {}
    if (!slot.date || !slot.time) {
        console.warn('[MeetEvent] Booking has no selectedSlot date/time — skipping')
        return null
    }

    // Parse slot time into a proper Date
    const startDate = parseSlotDateTime(slot.date, slot.time)
    if (!startDate) {
        console.warn(`[MeetEvent] Could not parse slot date "${slot.date}" time "${slot.time}" — skipping`)
        return null
    }

    // Session duration: 60 min normal, 75 min priority
    const durationMs = booking.sessionType === 'priority' ? 75 * 60 * 1000 : 60 * 60 * 1000
    const endDate = new Date(startDate.getTime() + durationMs)

    let token
    try {
        token = await getCalendarToken()
    } catch (err) {
        console.error('[MeetEvent] Auth failed:', err.message)
        return null
    }
    if (!token) {
        console.error('[MeetEvent] No Calendar token — check service account credentials')
        return null
    }

    const eventBody = {
        summary: `Counselling Session${booking.professional ? ` — ${booking.professional}` : ''}`,
        description: [
            `Patient: ${booking.name}`,
            `Session type: ${booking.sessionType === 'priority' ? 'Priority' : 'Regular'} Session`,
            `Booking ID: ${booking.id}`,
            '',
            'Booked via Thee You Space',
        ].join('\n'),
        start: { dateTime: toISOist(startDate), timeZone: 'Asia/Kolkata' },
        end: { dateTime: toISOist(endDate), timeZone: 'Asia/Kolkata' },
        attendees: [
            { email: booking.email, displayName: booking.name },
        ],
        conferenceData: {
            createRequest: {
                requestId: `tys-${booking.id}-${Date.now()}`,
                conferenceSolutionKey: { type: 'hangoutsMeet' },
            },
        },
        reminders: {
            useDefault: false,
            overrides: [
                { method: 'email', minutes: 24 * 60 },  // 24hr email reminder
                { method: 'popup', minutes: 15 },        // 15min popup
            ],
        },
        guestsCanModifyEvent: false,
        guestsCanInviteOthers: false,
    }

    try {
        const event = await calendarPost(
            `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1&sendUpdates=all`,
            token,
            eventBody
        )

        if (event.error) {
            console.error('[MeetEvent] Calendar API error:', event.error.message || JSON.stringify(event.error))
            return null
        }

        // Extract meet link from response
        const meetUrl = event.hangoutLink
            || event.conferenceData?.entryPoints?.find(ep => ep.entryPointType === 'video')?.uri
            || null

        if (meetUrl) {
            console.log(`[MeetEvent] ✅ Meet created for booking ${booking.id}: ${meetUrl}`)
        } else {
            console.warn('[MeetEvent] Event created but no meet link returned — does the calendar support Meet?')
        }

        return meetUrl
    } catch (err) {
        console.error('[MeetEvent] Unexpected error:', err.message)
        return null
    }
}

module.exports = { createMeetEvent }
