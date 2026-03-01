const { createOrder, verifyPaymentSignature, getPaymentDetails } = require('../utils/razorpay')
const { getPricing } = require('../utils/pricing.service')
const { SESSION_TYPES, PAYMENT_STATUS, BOOKING_STATUS } = require('../utils/constants')
const Booking = require('../models/Booking')
const { bookSlot, releaseSlot } = require('./calendar.service')
const { sendBookingConfirmation } = require('./email.service')
const { removeSlotFromSheet } = require('./sheetWriteback.service')

/**
 * Create a payment order for booking
 * @param {Object} bookingData - { sessionType, name, email, phone, selectedSlot, paymentMethod }
 * @returns {Promise<Object>} { booking, order }
 */
async function createPaymentOrder(bookingData) {
  const { sessionType, selectedSlot } = bookingData

  console.log(`[Order Creation] Creating order for ${sessionType} session, user: ${bookingData.email}`)

  // Validate slot availability
  const { isSlotAvailable } = require('./calendar.service')
  if (!isSlotAvailable(selectedSlot.date, selectedSlot.time)) {
    console.error(`[Order Creation] Slot unavailable: ${selectedSlot.date} ${selectedSlot.time}`)
    throw new Error('Selected slot is no longer available')
  }

  // Get pricing
  const pricing = getPricing(sessionType)
  console.log(`[Order Creation] Pricing: Rs.${pricing.displayAmount} incl. taxes (${pricing.totalAmount} paise)`)

  // Create booking record
  const booking = Booking.create({
    ...bookingData,
    pricing: {
      displayAmount: pricing.displayAmount,
      totalAmount: pricing.totalAmount,
      currency: pricing.currency,
    },
    paymentStatus: PAYMENT_STATUS.PENDING,
    bookingStatus: BOOKING_STATUS.PENDING,
  })

  console.log(`[Order Creation] Booking created: ${booking.id}`)

  // Create Razorpay order (amount in paise)
  const order = await createOrder({
    amount: pricing.totalAmount,
    currency: 'INR',
    receipt: booking.id,
    notes: {
      bookingId: booking.id,
      sessionType: sessionType,
      name: bookingData.name,
      email: bookingData.email,
    },
  })

  console.log(`[Order Creation] Razorpay order created: ${order.id} for booking: ${booking.id}`)

  // Update booking with order ID
  booking.razorpayOrderId = order.id
  Booking.updateById(booking.id, { razorpayOrderId: order.id })

  return {
    booking: booking.toJSON(),
    order: {
      id: order.id,
      amount: order.amount,
      currency: order.currency,
      key: process.env.RAZORPAY_KEY_ID,
    },
  }
}

/**
 * Verify and process payment
 * @param {Object} paymentData - { orderId, paymentId, signature }
 * @returns {Promise<Object>} Updated booking
 */
async function verifyAndProcessPayment(paymentData) {
  const { orderId, paymentId, signature } = paymentData

  console.log(`[Payment Verification] Starting verification for order: ${orderId}, payment: ${paymentId}`)

  // Find booking by order ID
  const booking = Booking.findByRazorpayOrderId(orderId)
  if (!booking) {
    console.error(`[Payment Verification] Booking not found for order: ${orderId}`)
    throw new Error('Booking not found')
  }

  // IDEMPOTENCY: Check if payment already processed
  if (booking.paymentStatus === PAYMENT_STATUS.SUCCESS) {
    console.log(`[Payment Verification] Payment already processed for booking: ${booking.id}`)
    return booking.toJSON()
  }

  // Verify payment signature
  console.log(`[Payment Verification] Verifying signature for booking: ${booking.id}`)
  if (!verifyPaymentSignature(orderId, paymentId, signature)) {
    console.error(`[Payment Verification] Invalid signature for booking: ${booking.id}`)
    throw new Error('Invalid payment signature')
  }

  // Fetch payment details from Razorpay
  console.log(`[Payment Verification] Fetching payment details from Razorpay for: ${paymentId}`)
  const razorpayPayment = await getPaymentDetails(paymentId)

  // Verify payment status
  if (razorpayPayment.status !== 'captured' && razorpayPayment.status !== 'authorized') {
    console.error(`[Payment Verification] Payment not successful. Status: ${razorpayPayment.status}, Booking: ${booking.id}`)
    throw new Error('Payment not successful')
  }

  console.log(`[Payment Verification] Payment successful. Status: ${razorpayPayment.status}, Booking: ${booking.id}`)

  // Update booking
  const updates = {
    razorpayPaymentId: paymentId,
    paymentStatus: PAYMENT_STATUS.SUCCESS,
    bookingStatus: BOOKING_STATUS.CONFIRMED,
  }
  Booking.updateById(booking.id, updates)

  // Book the slot in memory
  const slotBooked = bookSlot(
    booking.selectedSlot.date,
    booking.selectedSlot.time,
    booking.id
  )

  if (!slotBooked) {
    // Slot was taken — race condition
    console.warn(`[Booking Confirmation] Slot unavailable for booking ${booking.id}`)
  } else {
    console.log(`[Booking Confirmation] Slot booked in memory for booking ${booking.id}`)

    // Remove the slot from Google Sheet so it never reappears after restart
    removeSlotFromSheet(
      booking.selectedSlot.professional || booking.professional,
      booking.selectedSlot.date,
      booking.selectedSlot.time
    ).then(result => {
      if (result.removed) {
        console.log(`[SheetWriteback] Slot removed from sheet for booking ${booking.id}`)
      } else {
        console.warn(`[SheetWriteback] Could not remove from sheet: ${result.reason}`)
      }
    }).catch(err => {
      console.error(`[SheetWriteback] Unexpected error for booking ${booking.id}:`, err.message)
    })
  }

  // Send confirmation email (non-blocking)
  const updatedBooking = Booking.findById(booking.id)

  // Don't await - email sending should not block the response
  sendBookingConfirmation(updatedBooking).catch(err => {
    console.error(`[Email] Failed to send confirmation for booking ${booking.id}:`, err.message)
  })

  console.log(`[Booking Confirmation] Booking ${booking.id} confirmed successfully`)

  return updatedBooking.toJSON()
}

/**
 * Handle payment failure
 * @param {string} orderId
 * @returns {Object} Updated booking
 */
function handlePaymentFailure(orderId) {
  const booking = Booking.findByRazorpayOrderId(orderId)
  if (!booking) {
    throw new Error('Booking not found')
  }

  const updates = {
    paymentStatus: PAYMENT_STATUS.FAILED,
  }
  Booking.updateById(booking.id, updates)

  return Booking.findById(booking.id).toJSON()
}

module.exports = {
  createPaymentOrder,
  verifyAndProcessPayment,
  handlePaymentFailure,
}
