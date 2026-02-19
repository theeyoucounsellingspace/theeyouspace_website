/**
 * Pricing Service
 * Handles calculation of session prices based on type and duration
 */

const PRICING = {
  normal: 1000, // ₹1000 for normal session
  priority: 2000 // ₹2000 for priority session
}

/**
 * Get price for a session type
 * @param {string} sessionType - 'normal' or 'priority'
 * @returns {number} - Price in INR
 */
const getPricing = (sessionType = 'normal') => {
  return PRICING[sessionType] || PRICING.normal
}

module.exports = {
  getPricing,
  PRICING
}
