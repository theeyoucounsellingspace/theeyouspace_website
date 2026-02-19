const express = require('express')
const router = express.Router()
const { body, validationResult } = require('express-validator')
const { verifyAndProcessPayment } = require('../services/payment.service')
const { paymentLimiter } = require('../middleware/rateLimiter.middleware')
const Booking = require('../models/Booking')

/**
 * POST /api/payment/verify
 * Verify payment and confirm booking
 */
router.post(
  '/verify',
  paymentLimiter, // Rate limiter
  [
    body('orderId').notEmpty().withMessage('Order ID is required'),
    body('paymentId').notEmpty().withMessage('Payment ID is required'),
    body('signature').notEmpty().withMessage('Signature is required'),
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

      const booking = await verifyAndProcessPayment({
        orderId: req.body.orderId,
        paymentId: req.body.paymentId,
        signature: req.body.signature,
      })

      // ===== CRITICAL SECURITY: Payment amount verification =====
      // Verify payment amount matches expected amount from booking
      const razorpayPayment = await require('../utils/razorpay').getPaymentDetails(req.body.paymentId)

      if (razorpayPayment.amount !== booking.pricing.totalAmount) {
        console.error(`[Security] Payment amount mismatch! Expected: ${booking.pricing.totalAmount}, Got: ${razorpayPayment.amount}`)
        throw new Error('Payment amount verification failed')
      }

      res.json({
        success: true,
        booking,
      })
    } catch (error) {
      console.error('Payment verification error:', error.message)
      res.status(400).json({
        success: false,
        error: error.message,
      })
    }
  }
)

/**
 * POST /api/payment/failure
 * Handle payment failure
 * Rate limited
 */
router.post(
  '/failure',
  paymentLimiter, // Rate limiter
  [body('orderId').notEmpty().withMessage('Order ID is required')],
  (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        })
      }

      const { orderId } = req.body
      const booking = handlePaymentFailure(orderId)

      res.json({
        success: true,
        booking,
        message: 'Payment failure recorded',
      })
    } catch (error) {
      console.error('Error handling payment failure:', error)
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to handle payment failure',
      })
    }
  }
)

/**
 * POST /api/payment/webhook
 * Razorpay webhook handler
 * Idempotent - safe to process multiple times
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const crypto = require('crypto')
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET
    const signature = req.headers['x-razorpay-signature']

    console.log('[Webhook] Received webhook request')

    if (!secret) {
      console.error('[Webhook] RAZORPAY_WEBHOOK_SECRET not configured')
      return res.status(500).json({ success: false, error: 'Webhook not configured' })
    }

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(req.body))
      .digest('hex')

    if (signature !== expectedSignature) {
      console.warn('[Webhook] Invalid webhook signature')
      return res.status(400).json({ success: false, error: 'Invalid webhook signature' })
    }

    const event = JSON.parse(req.body.toString())
    const { event: eventType, payload } = event

    console.log(`[Webhook] Event type: ${eventType}`)

    // Handle payment success events
    if (eventType === 'payment.captured' || eventType === 'payment.authorized') {
      const { order_id, id: paymentId } = payload.payment.entity

      console.log(`[Webhook] Processing payment event - Order: ${order_id}, Payment: ${paymentId}`)

      try {
        // Note: verifyAndProcessPayment is already idempotent
        // It will safely return existing booking if already processed
        await verifyAndProcessPayment({
          orderId: order_id,
          paymentId: paymentId,
          signature: signature, // Use webhook signature as verification
        })
        console.log(`[Webhook] Payment processed successfully - Order: ${order_id}`)
      } catch (error) {
        // Log but don't fail webhook - payment may have been processed via frontend callback
        console.log(`[Webhook] Payment processing note for ${order_id}: ${error.message}`)
      }
    }

    // Always respond 200 to acknowledge receipt
    res.json({ success: true })
  } catch (error) {
    console.error('[Webhook] Error processing webhook:', error)
    // Still respond 200 to prevent webhook retries
    res.status(200).json({ success: true, error: 'Logged for review' })
  }
})

module.exports = router
