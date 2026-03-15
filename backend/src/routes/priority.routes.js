const express = require('express')
const router = express.Router()
const AvailabilitySlot = require('../models/AvailabilitySlot')
const ProfessionalsService = require('../services/professionals.service')
const { createPaymentOrder } = require('../services/payment.service')
const { body, validationResult } = require('express-validator')

/**
 * GET /api/priority/validate/:token
 * Validates a secure priority link and returns counselor details.
 */
router.get('/validate/:token', (req, res) => {
  try {
    const { token } = req.params
    const slot = AvailabilitySlot.findByToken(token)

    if (!slot || !slot.available) {
      return res.status(404).json({
        success: false,
        error: 'This priority link is invalid or the session has already been booked.'
      })
    }

    // Get the professional's rich bio/photo
    const professional = ProfessionalsService.getProfessionalByName(slot.professional)

    res.json({
      success: true,
      slot: {
        date: slot.date,
        time: slot.time,
        professional: slot.professional,
        token: slot.token
      },
      professional: professional || { name: slot.professional }
    })
  } catch (error) {
    console.error('Error validating priority token:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/**
 * POST /api/priority/checkout
 * Standardized checkout for priority sessions (fixed price ₹1020).
 */
router.post(
  '/checkout',
  [
    body('token').notEmpty().withMessage('Priority token is required'),
    body('name').notEmpty().trim().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('phone').notEmpty().withMessage('Phone is required')
  ],
  async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() })
    }

    try {
      const { token, name, email, phone, triageData } = req.body
      const slot = AvailabilitySlot.findByToken(token)

      if (!slot || !slot.available) {
        return res.status(400).json({ success: false, error: 'Slot is no longer available' })
      }

      // Hardcoded priority rate: 102000 paise (₹1020)
      const PRIORITY_AMOUNT = 102000 
      const PRIORITY_DISPLAY = 1020

      // Create the payment order
      // We tag it as 'priority' so the payment service knows to handle it as such
      const result = await createPaymentOrder({
        sessionType: 'priority',
        name,
        email,
        phone,
        triageData: { ...triageData, urgencyLevel: 'priority' },
        selectedSlot: {
            date: slot.date,
            time: slot.time,
            professional: slot.professional
        },
        amount: PRIORITY_AMOUNT
      })

      if (!result.success) {
        return res.status(500).json(result)
      }

      // Lock the slot so no one else can use this link during payment
      AvailabilitySlot.lockSlot(slot.id, 10)

      res.json({
        success: true,
        orderId: result.orderId,
        bookingId: result.bookingId,
        amount: PRIORITY_AMOUNT,
        displayAmount: PRIORITY_DISPLAY,
        currency: 'INR',
        keyId: process.env.RAZORPAY_KEY_ID,
        professional: slot.professional
      })

    } catch (error) {
      console.error('Priority checkout error:', error)
      res.status(500).json({ success: false, error: 'Failed to initiate priority checkout' })
    }
  }
)

module.exports = router
