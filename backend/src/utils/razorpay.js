const Razorpay = require('razorpay')
const { RAZORPAY_CONFIG } = require('./constants')

// ── Lazy singleton ────────────────────────────────────────────────────────────
// Razorpay is initialised on first use — not at module load.
// This prevents a missing RAZORPAY_KEY_ID from crashing the entire server on
// startup, so the schedule / slots still work even when payment isn't configured.

let _razorpay = null

function getRazorpay() {
  if (_razorpay) return _razorpay

  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET

  if (!keyId || !keySecret) {
    throw new Error(
      'Razorpay credentials not configured — set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in environment variables.'
    )
  }

  _razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret })
  console.log('[Razorpay] ✅ Initialized with key:', keyId.slice(0, 12) + '...')
  return _razorpay
}

// Warn at startup if keys are missing — but never crash
if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  console.warn('[Razorpay] ⚠️  RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET not set — payment endpoints will fail until keys are added to env vars')
}

// ── Create order ──────────────────────────────────────────────────────────────

async function createOrder(orderData) {
  try {
    const options = {
      amount: orderData.amount,
      currency: orderData.currency || RAZORPAY_CONFIG.CURRENCY,
      receipt: orderData.receipt,
      notes: { ...orderData.notes, prefix: RAZORPAY_CONFIG.NOTES_PREFIX },
    }
    const order = await getRazorpay().orders.create(options)
    return order
  } catch (error) {
    console.error('[Razorpay] Order creation error:', error.message)
    throw new Error('Failed to create payment order')
  }
}

// ── Verify signature ──────────────────────────────────────────────────────────

function verifyPaymentSignature(orderId, paymentId, signature) {
  const crypto = require('crypto')
  const secret = process.env.RAZORPAY_KEY_SECRET
  if (!secret) throw new Error('RAZORPAY_KEY_SECRET not set')
  const generated = crypto
    .createHmac('sha256', secret)
    .update(orderId + '|' + paymentId)
    .digest('hex')
  return generated === signature
}

// ── Fetch payment ─────────────────────────────────────────────────────────────

async function getPaymentDetails(paymentId) {
  try {
    return await getRazorpay().payments.fetch(paymentId)
  } catch (error) {
    console.error('[Razorpay] Payment fetch error:', error.message)
    throw new Error('Failed to fetch payment details')
  }
}

// ── Refund ────────────────────────────────────────────────────────────────────

async function initiateRefund(paymentId, amountPaise) {
  try {
    const options = amountPaise ? { amount: amountPaise } : {}
    const refund = await getRazorpay().payments.refund(paymentId, options)
    console.log(`[Razorpay] Refund initiated: ${refund.id} for payment ${paymentId}`)
    return refund
  } catch (error) {
    console.error('[Razorpay] Refund error:', error.message)
    throw new Error(`Refund failed: ${error.error?.description || error.message}`)
  }
}

module.exports = {
  getRazorpay,
  createOrder,
  verifyPaymentSignature,
  getPaymentDetails,
  initiateRefund,
}
