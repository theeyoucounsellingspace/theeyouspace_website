const Razorpay = require('razorpay')
const { RAZORPAY_CONFIG } = require('./constants')

// Initialize Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
})

/**
 * Create a Razorpay order
 * @param {Object} orderData - { amount, currency, receipt, notes }
 * @returns {Promise<Object>} Razorpay order
 */
async function createOrder(orderData) {
  try {
    const options = {
      amount: orderData.amount, // in paise
      currency: orderData.currency || RAZORPAY_CONFIG.CURRENCY,
      receipt: orderData.receipt,
      notes: {
        ...orderData.notes,
        prefix: RAZORPAY_CONFIG.NOTES_PREFIX,
      },
    }

    const order = await razorpay.orders.create(options)
    return order
  } catch (error) {
    console.error('Razorpay order creation error:', error)
    throw new Error('Failed to create payment order')
  }
}

/**
 * Verify Razorpay payment signature
 * @param {string} orderId
 * @param {string} paymentId
 * @param {string} signature
 * @returns {boolean}
 */
function verifyPaymentSignature(orderId, paymentId, signature) {
  const crypto = require('crypto')
  const secret = process.env.RAZORPAY_KEY_SECRET
  const generatedSignature = crypto
    .createHmac('sha256', secret)
    .update(orderId + '|' + paymentId)
    .digest('hex')

  return generatedSignature === signature
}

/**
 * Fetch payment details from Razorpay
 * @param {string} paymentId
 * @returns {Promise<Object>} Payment details
 */
async function getPaymentDetails(paymentId) {
  try {
    const payment = await razorpay.payments.fetch(paymentId)
    return payment
  } catch (error) {
    console.error('Razorpay payment fetch error:', error)
    throw new Error('Failed to fetch payment details')
  }
}

/**
 * Initiate a full refund for a payment
 * @param {string} paymentId - razorpayPaymentId
 * @param {number} amountPaise - optional, omit for full refund
 * @returns {Promise<Object>} Refund object
 */
async function initiateRefund(paymentId, amountPaise) {
  try {
    const options = amountPaise ? { amount: amountPaise } : {}
    const refund = await razorpay.payments.refund(paymentId, options)
    console.log(`[Razorpay] Refund initiated: ${refund.id} for payment ${paymentId}`)
    return refund
  } catch (error) {
    console.error('Razorpay refund error:', error)
    throw new Error(`Refund failed: ${error.error?.description || error.message}`)
  }
}

module.exports = {
  razorpay,
  createOrder,
  verifyPaymentSignature,
  getPaymentDetails,
  initiateRefund,
}
