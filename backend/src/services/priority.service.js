const { getPricing } = require('../utils/pricing.service')
const { SESSION_TYPES } = require('../utils/constants')

/**
 * Get priority session pricing
 * @returns {Object} Pricing breakdown
 */
function getPriorityPricing() {
  return getPricing(SESSION_TYPES.PRIORITY)
}

module.exports = {
  getPriorityPricing,
}
