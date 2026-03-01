const express = require('express')
const router = express.Router()
const { getPriorityPricing } = require('../services/priority.service')

/**
 * GET /api/priority/pricing
 * Get priority session pricing
 */
router.get('/pricing', (req, res) => {
  try {
    const pricing = getPriorityPricing()

    res.json({
      success: true,
      pricing: {
        displayAmount: pricing.displayAmount,   // 1020 (INR)
        totalAmount: pricing.totalAmount,      // 102000 (paise)
        currency: pricing.currency,
      },
    })
  } catch (error) {
    console.error('Error fetching priority pricing:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch priority pricing',
    })
  }
})

module.exports = router
