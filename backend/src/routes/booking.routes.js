const express = require('express')
const router = express.Router()
const { body, query, validationResult } = require('express-validator')
const { createPaymentOrder } = require('../services/payment.service')
const { getAvailableSlots } = require('../services/calendar.service')
const { getPricing } = require('../utils/pricing.service')
const { bookingLimiter, slotLimiter } = require('../middleware/rateLimiter.middleware')
const { SESSION_TYPES } = require('../utils/constants')

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

module.exports = router
