const express = require('express')
const router = express.Router()
const AvailabilitySlot = require('../models/AvailabilitySlot')

/**
 * GET /api/priority/links
 * Diagnostic endpoint to view active priority tokens.
 * In production, this should be protected by an API key.
 */
router.get('/links', (req, res) => {
    const slots = AvailabilitySlot.getPrioritySlots()
    const links = slots.map(s => ({
        professional: s.professional,
        date: s.date,
        time: s.time,
        token: s.token,
        link: `${process.env.FRONTEND_URL || 'https://theeyou.space'}/priority/${s.token}`
    }))

    res.json({
        success: true,
        count: links.length,
        links
    })
})

module.exports = router
