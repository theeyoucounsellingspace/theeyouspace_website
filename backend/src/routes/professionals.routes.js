const express = require('express')
const router = express.Router()
const { getAllProfessionals, getProfessional, isLoaded, getLastSyncAt } = require('../services/professionals.service')

/**
 * GET /api/professionals
 * Returns all professionals currently in the cache.
 * Populated automatically on every Google Sheet sync.
 *
 * Edge cases:
 *  - Cache not yet loaded (server just started, sync pending) → returns empty array + meta flag
 *  - Sheet has no bio columns → returns name-only entries (frontend renders gracefully)
 */
router.get('/', (req, res) => {
    const professionals = getAllProfessionals()
    res.json({
        success: true,
        loaded: isLoaded(),
        lastSyncAt: getLastSyncAt(),
        count: professionals.count,
        professionals,
    })
})

/**
 * GET /api/professionals/:name
 * Returns a single professional by name (case-insensitive).
 * Always returns a valid object — uses a safe fallback for unknown names.
 */
router.get('/:name', (req, res) => {
    const professional = getProfessional(decodeURIComponent(req.params.name))
    res.json({
        success: true,
        professional,
    })
})

module.exports = router
