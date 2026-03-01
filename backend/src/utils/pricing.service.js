/**
 * Pricing Service
 * All prices are GST-inclusive (18%) final amounts.
 * Razorpay expects amounts in paise (1 INR = 100 paise).
 */

// Final prices shown to the customer — inclusive of all taxes
const PRICING_INR = {
  normal: 613,   // Rs.613 all-inclusive
  priority: 1020,  // Rs.1020 all-inclusive
}

/**
 * Get pricing details for a session type.
 * @param {string} sessionType - 'normal' or 'priority'
 * @returns {{ displayAmount: number, totalAmount: number, currency: string }}
 *   displayAmount  -> human-readable INR (for the frontend)
 *   totalAmount    -> paise (for Razorpay API)
 */
const getPricing = (sessionType = 'normal') => {
  const inr = PRICING_INR[sessionType] || PRICING_INR.normal
  return {
    displayAmount: inr,          // 613 / 1020
    totalAmount: inr * 100,    // 61300 / 102000 paise for Razorpay
    currency: 'INR',
  }
}

module.exports = { getPricing, PRICING_INR }
