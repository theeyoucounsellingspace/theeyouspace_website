/**
 * Scheduler Service — runs timed background jobs without any cron dependency.
 *
 * Jobs:
 *   1. Stale slot cleanup        — every hour
 *   2. Session reminders         — every hour (24hr + 1hr windows)
 *   3. Morning brief             — daily at 8 AM IST
 *   4. No-show follow-up         — every hour (45min–2hr after session)
 *   5. Auto-reseed               — every 6 hours — refills Sheet when slots < 30
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


// ── Job 4: No-show follow-up ───────────────────────────────────────────────────

async function sendNoShowEmails() {
    const { sendNoShowFollowUp } = require('./email.service')
    const now = Date.now()
    const WINDOW_MIN = 45 * 60 * 1000  // 45min after session starts
    const CUTOFF_MS = 2 * 60 * 60 * 1000  // stop after 2hr

    const bookings = Booking.getAll().filter(b =>
        b.paymentStatus === 'paid' &&
        b.bookingStatus === 'confirmed' &&
        !b.noShowEmailSent &&
        b.selectedSlot?.date &&
        b.selectedSlot?.time
    )

    for (const booking of bookings) {
        try {
            const sessionTime = parseSlotDateTime(booking.selectedSlot.date, booking.selectedSlot.time)
            if (!sessionTime) continue
            const elapsed = now - sessionTime.getTime()
            if (elapsed >= WINDOW_MIN && elapsed <= CUTOFF_MS) {
                await sendNoShowFollowUp(booking)
                Booking.updateById(booking.id, { noShowEmailSent: true })
                console.log(`[Scheduler] 📧 No-show follow-up sent for booking ${booking.id}`)
            }
        } catch (err) {
            console.error(`[Scheduler] No-show job failed for ${booking.id}:`, err.message)
        }
    }
}

// ── Check if current IST hour matches target ──────────────────────────────────

function isIstHour(targetHour) {
    const istNow = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
    return istNow.getUTCHours() === targetHour
}

// ── Job 5: Auto-reseed when slots run low ────────────────────────────────────
// Runs every 6 hours. If available slots drop below 30, automatically
// re-runs the seed script to refill the next 14 days — then syncs backend.

const LOW_SLOT_THRESHOLD = 30   // reseed when fewer than this many slots remain
let lastReseedDate = null       // prevent re-seeding more than once per day

async function autoReseedIfLow() {
    const available = AvailabilitySlot.getAll().filter(s => s.available).length
    const istNow = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
    const todayKey = `${istNow.getUTCFullYear()}-${istNow.getUTCMonth()}-${istNow.getUTCDate()}`

    if (available >= LOW_SLOT_THRESHOLD) return  // plenty of slots, skip
    if (lastReseedDate === todayKey) return       // already reseeded today

    console.log(`[AutoReseed] ⚠️  Only ${available} slots left — auto-reseeding Sheet...`)

    try {
        // Dynamically require seed function (avoids circular dep on startup)
        const { seedSlotsToSheet } = require('../utils/slotSeeder')
        const count = await seedSlotsToSheet()
        lastReseedDate = todayKey
        console.log(`[AutoReseed] ✅ ${count} fresh slots written to Sheet`)

        // Trigger an immediate backend sync to load the new slots
        const { syncSlotsFromSheet } = require('./googleSheets.service')
        await syncSlotsFromSheet()
        console.log('[AutoReseed] ✅ Backend synced with fresh slots')
    } catch (err) {
        console.error('[AutoReseed] ❌ Failed:', err.message)
    }
}

// ── Main scheduler loop ───────────────────────────────────────────────────────

function startScheduler() {
    let lastBriefDate = null  // prevent re-sending brief on same day
    let reseedTick = 0        // count hourly ticks for 6hr reseed check

    const tick = async () => {
        try {
            // Job 1: always
            cleanupPastSlots()

            // Job 2: reminders (24hr + 1hr windows)
            await sendSessionReminders()

            // Job 4: no-show follow-up (45min–2hr after session)
            await sendNoShowEmails()

            // Job 5: auto-reseed check every 6 hours
            reseedTick++
            if (reseedTick >= 6) {
                reseedTick = 0
                await autoReseedIfLow()
            }

            // Job 3: morning brief — once per day at 8 AM IST
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
    if (timer.unref) timer.unref()
    console.log('[Scheduler] ✅ Started — cleanup | reminders | no-show | auto-reseed (every 6hr) | morning brief')
    return timer
}

module.exports = { startScheduler, cleanupPastSlots }
