// Pricing configuration
// All amounts stored in paise (1 rupee = 100 paise)
const PRICING_CONFIG = {
  NORMAL_SESSION: {
    baseAmount: 60000, // ₹600
    platformFee: 1300, // ₹13 (to match final total of ₹613)
  },
  PRIORITY_SESSION: {
    baseAmount: 100000, // ₹1000
    platformFee: 2000, // ₹20 (2% of ₹1000)
  },
  // Note: Normal session fee is ₹13 (2.17%) to match exact total
  // Priority session fee is ₹20 (2%) as specified
}

// Session types
const SESSION_TYPES = {
  NORMAL: 'normal',
  PRIORITY: 'priority',
}

// Payment statuses
const PAYMENT_STATUS = {
  PENDING: 'pending',
  SUCCESS: 'success',
  FAILED: 'failed',
  REFUNDED: 'refunded',
}

// Booking statuses
const BOOKING_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
}

// Razorpay configuration
const RAZORPAY_CONFIG = {
  CURRENCY: 'INR',
  NOTES_PREFIX: 'TYS',
}

module.exports = {
  PRICING_CONFIG,
  SESSION_TYPES,
  PAYMENT_STATUS,
  BOOKING_STATUS,
  RAZORPAY_CONFIG,
}
