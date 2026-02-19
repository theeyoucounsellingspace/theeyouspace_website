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

    // Convert to rupees for display
    const baseAmount = pricing.baseAmount / 100
    const platformFee = pricing.platformFee / 100
    const totalAmount = pricing.totalAmount / 100

    res.json({
      success: true,
      pricing: {
        baseAmount,
        platformFee,
        totalAmount,
        currency: 'INR',
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
