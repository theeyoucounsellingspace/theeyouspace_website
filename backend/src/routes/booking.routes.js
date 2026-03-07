const express = require('express')
const router = express.Router()
const { body, query, validationResult } = require('express-validator')
const { createPaymentOrder } = require('../services/payment.service')
const { getAvailableSlots, isSlotAvailable, bookSlot } = require('../services/calendar.service')
const { getPricing } = require('../utils/pricing.service')
const { bookingLimiter, slotLimiter } = require('../middleware/rateLimiter.middleware')
const { SESSION_TYPES } = require('../utils/constants')
const Booking = require('../models/Booking')
const { isMoreThan24HoursAway } = require('../utils/dateParser')
const { sendRescheduleConfirmation, sendRescheduleAlert } = require('../services/email.service')
const { removeSlotFromSheet, appendBookingToSheet, updateBookingStatusInSheet } = require('../services/sheetWriteback.service')

/**
 * GET /api/booking/slots
 * Get available time slots grouped by professional
 */
router.get('/slots', slotLimiter, (req, res) => {
  try {
    const slots = getAvailableSlots()

    // Flat list with professional name included
    const flatSlots = slots.map((slot) => ({
      id: slot.id,
      professional: slot.professional || 'General',
      date: slot.date,
      time: slot.time,
    }))

    // Also provide grouped view for easier frontend rendering
    const grouped = {}
    flatSlots.forEach((slot) => {
      const pro = slot.professional
      if (!grouped[pro]) grouped[pro] = []
      grouped[pro].push(slot)
    })

    res.json({
      success: true,
      slots: flatSlots,
      grouped,
    })
  } catch (error) {
    console.error('Error fetching slots:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch available slots',
    })
  }
})

/**
 * GET /api/booking/pricing
 * Get pricing for a session type
 */
router.get('/pricing', (req, res) => {
  try {
    const { sessionType } = req.query

    if (!sessionType || (sessionType !== SESSION_TYPES.NORMAL && sessionType !== SESSION_TYPES.PRIORITY)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid session type. Must be "normal" or "priority"',
      })
    }

    const pricing = getPricing(sessionType)

    res.json({
      success: true,
      pricing: {
        displayAmount: pricing.displayAmount,   // INR integer (613 or 1020)
        totalAmount: pricing.totalAmount,      // paise (61300 or 102000)
        currency: pricing.currency,
      },
    })
  } catch (error) {
    console.error('Error fetching pricing:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pricing',
    })
  }
})

/**
 * POST /api/booking/create
 * Create a new booking and Razorpay order
 * Rate limited to prevent slot sniping
 */
router.post(
  '/create',
  bookingLimiter, // Rate limiter first
  [
    body('sessionType').isIn([SESSION_TYPES.NORMAL, SESSION_TYPES.PRIORITY]).withMessage('Invalid session type'),
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('phone').optional().trim(),
    body('selectedSlot.date').notEmpty().withMessage('Date is required'),
    body('selectedSlot.time').notEmpty().withMessage('Time is required'),
    body('paymentMethod').isIn(['card', 'upi']).withMessage('Invalid payment method'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        })
      }

      const bookingData = req.body
      const result = await createPaymentOrder(bookingData)

      res.json({
        success: true,
        booking: result.booking,
        order: result.order,
      })
    } catch (error) {
      console.error('Error creating booking:', error)
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create booking',
      })
    }
  }
)

/**
 * GET /api/booking/:id/reschedule-check?email=xxx
 * Check if a booking is eligible for reschedule.
 * Returns: { eligible, name, professional, currentSlot, availableSlots, reason }
 */
router.get('/:id/reschedule-check', async (req, res) => {
  try {
    const booking = Booking.findById(req.params.id)
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' })

    // Email verification — patient must prove they own the booking
    const emailParam = (req.query.email || '').trim().toLowerCase()
    if (!emailParam || emailParam !== booking.email.toLowerCase()) {
      return res.status(403).json({ success: false, error: 'Email does not match this booking' })
    }

    // Must be a confirmed, paid booking
    if (booking.paymentStatus !== 'paid' || booking.bookingStatus !== 'confirmed') {
      return res.status(400).json({ success: false, eligible: false, reason: 'Booking is not in a reschedulable state' })
    }

    // 24hr window check
    const slot = booking.selectedSlot || {}
    const eligible = isMoreThan24HoursAway(slot.date, slot.time)
    if (!eligible) {
      return res.json({
        success: true,
        eligible: false,
        reason: 'The 24-hour reschedule window has passed',
        currentSlot: slot,
        contact: process.env.SMTP_USER || '',
      })
    }

    // Return available slots for the SAME professional only
    const pro = booking.professional || slot.professional
    const allSlots = getAvailableSlots()
    const availableSlots = allSlots
      .filter(s => (!pro || s.professional === pro))
      .map(s => ({ id: s.id, date: s.date, time: s.time, professional: s.professional }))

    return res.json({
      success: true,
      eligible: true,
      name: booking.name,
      professional: pro,
      currentSlot: slot,
      availableSlots,
    })
  } catch (err) {
    console.error('[Reschedule check] Error:', err.message)
    res.status(500).json({ success: false, error: 'Failed to check reschedule eligibility' })
  }
})

/**
 * POST /api/booking/:id/reschedule
 * Process a reschedule: update booking, sheet, send emails.
 * Body: { email, newSlotDate, newSlotTime }
 */
router.post('/:id/reschedule',
  [
    body('email').isEmail().withMessage('Valid email required'),
    body('newSlotDate').notEmpty().withMessage('New date required'),
    body('newSlotTime').notEmpty().withMessage('New time required'),
  ],
  async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() })

    try {
      const booking = Booking.findById(req.params.id)
      if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' })

      // Re-verify email server-side
      if ((req.body.email || '').toLowerCase() !== booking.email.toLowerCase()) {
        return res.status(403).json({ success: false, error: 'Email does not match this booking' })
      }

      // Re-check 24hr window server-side (never trust frontend)
      const oldSlot = { ...booking.selectedSlot }
      if (!isMoreThan24HoursAway(oldSlot.date, oldSlot.time)) {
        return res.status(400).json({ success: false, error: 'Reschedule window has closed (must be > 24 hours before session)' })
      }

      const { newSlotDate, newSlotTime } = req.body
      const pro = booking.professional || oldSlot.professional

      // Verify new slot exists and is available for the same professional
      if (!isSlotAvailable(newSlotDate, newSlotTime, pro)) {
        return res.status(409).json({ success: false, error: 'Selected slot is no longer available. Please pick another.' })
      }

      // Book the new slot
      const newSlot = { date: newSlotDate, time: newSlotTime, professional: pro }
      bookSlot(newSlotDate, newSlotTime, booking.id, pro)

      // Update booking in memory
      Booking.updateById(booking.id, {
        selectedSlot: newSlot,
        sessionReminderSent: false, // reset so reminder fires for new slot
      })

      const updatedBooking = Booking.findById(booking.id)

      // Non-blocking side effects
      Promise.allSettled([
        sendRescheduleConfirmation(updatedBooking, newSlot),
        sendRescheduleAlert(updatedBooking, oldSlot, newSlot),
        // Update sheet: mark old row as Rescheduled + add new slot removal
        updateBookingStatusInSheet(booking.id, pro, oldSlot.date, oldSlot.time, 'Rescheduled').catch(e =>
          console.error('[Reschedule] Sheet status update failed:', e.message)
        ),
        removeSlotFromSheet(pro, newSlotDate, newSlotTime).catch(e =>
          console.error('[Reschedule] New slot sheet removal failed:', e.message)
        ),
      ]).then(results => {
        results.forEach((r, i) => {
          if (r.status === 'rejected') console.error(`[Reschedule] Side effect ${i} failed:`, r.reason?.message)
        })
      })

      return res.json({
        success: true,
        message: 'Session rescheduled successfully',
        newSlot,
      })
    } catch (err) {
      console.error('[Reschedule] Error:', err.message)
      res.status(500).json({ success: false, error: 'Failed to process reschedule' })
    }
  }
)

module.exports = router
