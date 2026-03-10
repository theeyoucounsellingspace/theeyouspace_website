/**
 * Scheduler Service — runs timed background jobs without any cron dependency.
 *
 * Jobs:
 *   1. Stale slot cleanup     — every hour — removes past-date slots from memory
 *   2. Session reminders      — every hour — emails patient 24-25hr before their session
 *   3. Counsellor morning brief — daily at 8 AM IST — emails practice inbox with that day's sessions
 *
 * All jobs are fire-and-forget, non-blocking, non-crashing.
 */

const Booking = require('../models/Booking')
const AvailabilitySlot = require('../models/AvailabilitySlot')
const { isSlotInPast, isMoreThan24HoursAway, parseSlotDateTime } = require('../utils/dateParser')

// ── Job 1: Stale slot cleanup ─────────────────────────────────────────────────

function cleanupPastSlots() {
    const all = AvailabilitySlot.getAll()
    const stale = all.filter(s => s.available && isSlotInPast(s.date, s.time))
    stale.forEach(s => AvailabilitySlot.bookSlot(s.id, 'EXPIRED')) // mark unavailable
    if (stale.length > 0) {
        console.log(`[Scheduler] 🧹 Cleaned up ${stale.length} past slot(s)`)
    }
}

// ── Job 2: Session reminder emails ────────────────────────────────────────────

async function sendSessionReminders() {
    const { sendSessionReminder, sendOneHourReminder } = require('./email.service')
    const bookings = Booking.getAll().filter(b =>
        b.paymentStatus === 'paid' &&
        b.bookingStatus === 'confirmed' &&
        b.selectedSlot?.date &&
        b.selectedSlot?.time
    )

    for (const booking of bookings) {
        try {
            const sessionTime = parseSlotDateTime(booking.selectedSlot.date, booking.selectedSlot.time)
            if (!sessionTime) continue

            const hoursUntil = (sessionTime.getTime() - Date.now()) / (1000 * 60 * 60)

            // 24hr reminder — send when session is 24–25 hours away
            if (hoursUntil >= 24 && hoursUntil <= 25 && !booking.sessionReminderSent) {
                await sendSessionReminder(booking)
                Booking.updateById(booking.id, { sessionReminderSent: true })
                console.log(`[Scheduler] 📧 24hr reminder sent for booking ${booking.id}`)
            }

            // 1hr reminder — send when session is 1–2 hours away
            if (hoursUntil >= 1 && hoursUntil <= 2 && !booking.oneHourReminderSent) {
                await sendOneHourReminder(booking)
                Booking.updateById(booking.id, { oneHourReminderSent: true })
                console.log(`[Scheduler] 📧 1hr reminder sent for booking ${booking.id}`)
            }
        } catch (err) {
            console.error(`[Scheduler] Reminder failed for booking ${booking.id}:`, err.message)
        }
    }
}

// ── Job 3: Counsellor morning brief ───────────────────────────────────────────

async function sendMorningBrief() {
    const { sendCounsellorMorningBrief } = require('./email.service')

    // Get today's date as D/M/YYYY in IST
    const now = new Date()
    const istOffset = 5.5 * 60 * 60 * 1000
    const istNow = new Date(now.getTime() + istOffset)
    const todayStr = `${istNow.getUTCDate()}/${istNow.getUTCMonth() + 1}/${istNow.getUTCFullYear()}`

    // Find confirmed bookings for today
    const todayBookings = Booking.getAll().filter(b =>
        b.paymentStatus === 'paid' &&
        b.bookingStatus === 'confirmed' &&
        b.selectedSlot?.date
    ).filter(b => {
        // Normalise stored date to D/M/YYYY for comparison
        const d = b.selectedSlot.date.trim()
        const parsed = require('../utils/dateParser').parseSlotDateTime(d, '12:00 PM')
        if (!parsed) return false
        const bDate = new Date(parsed.getTime() + istOffset)
        const bStr = `${bDate.getUTCDate()}/${bDate.getUTCMonth() + 1}/${bDate.getUTCFullYear()}`
        return bStr === todayStr
    })

    if (todayBookings.length === 0) {
        console.log('[Scheduler] Morning brief: no sessions today')
        return
    }

    // Group by professional
    const byPro = {}
    for (const b of todayBookings) {
        const pro = b.professional || 'Unassigned'
        if (!byPro[pro]) byPro[pro] = []
        byPro[pro].push(b)
    }

    await sendCounsellorMorningBrief(todayBookings, byPro)
    console.log(`[Scheduler] 📋 Morning brief sent — ${todayBookings.length} session(s) today`)
}

// ── Check if current IST hour matches target ──────────────────────────────────

function isIstHour(targetHour) {
    const istNow = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
    return istNow.getUTCHours() === targetHour
}

// ── Main scheduler loop ───────────────────────────────────────────────────────

function startScheduler() {
    let lastBriefDate = null // prevent re-sending brief on same day

    const tick = async () => {
        try {
            // Job 1: always
            cleanupPastSlots()

            // Job 2: always (checks internally if window applies)
            await sendSessionReminders()

            // Job 3: once per day at 8 AM IST
            if (isIstHour(8)) {
                const istNow = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
                const todayKey = `${istNow.getUTCFullYear()}-${istNow.getUTCMonth()}-${istNow.getUTCDate()}`
                if (lastBriefDate !== todayKey) {
                    await sendMorningBrief()
                    lastBriefDate = todayKey
                }
            }
        } catch (err) {
            console.error('[Scheduler] Tick error:', err.message)
        }
    }

    // Run immediately on start, then every hour
    tick()
    const timer = setInterval(tick, 60 * 60 * 1000)
    if (timer.unref) timer.unref() // don't prevent process exit
    console.log('[Scheduler] ✅ Started — slot cleanup + session reminders + morning brief')
    return timer
}

module.exports = { startScheduler, cleanupPastSlots }
