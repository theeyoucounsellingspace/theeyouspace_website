/**
 * Slot Upload Router
 * POST /api/slots/upload  — Admin uploads Excel/CSV with available slots
 * GET  /api/slots/status  — Check upload status
 * DELETE /api/slots/clear — Clear all slots (admin)
 *
 * Protected by EXPORT_API_KEY (same key used for CSV export).
 * Only the counsellor/admin should know this key.
 */

const express = require('express')
const multer = require('multer')
const router = express.Router()
const { processSlotUpload } = require('../services/slotUpload.service')
const AvailabilitySlot = require('../models/AvailabilitySlot')
const { requireApiKey } = require('../middleware/auth.middleware')

// Store file in memory (no disk writes needed)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB max
    },
    fileFilter: (req, file, cb) => {
        const allowed = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
            'application/vnd.ms-excel', // .xls
            'text/csv',
            'application/csv',
            'text/plain',
        ]
        // Some browsers send application/octet-stream for CSV
        if (allowed.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls|csv)$/i)) {
            cb(null, true)
        } else {
            cb(new Error(`Unsupported file type: ${file.mimetype}. Use .xlsx or .csv`))
        }
    },
})

/**
 * POST /api/slots/upload
 * Upload Excel/CSV file with available slots
 * Protected by API key
 *
 * Expected file format:
 * | Date           | Time     |
 * | Monday, Mar 3  | 10:00 AM |
 */
router.post('/upload', requireApiKey, upload.single('slots'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({
            success: false,
            error: 'No file uploaded. Send a file in the "slots" field.',
        })
    }

    try {
        const result = processSlotUpload(
            req.file.buffer,
            req.file.originalname,
            req.file.mimetype
        )

        res.json({
            success: true,
            message: `Loaded ${result.count} slots successfully`,
            count: result.count,
            warnings: result.warnings,
            parseErrors: result.errors,
            status: result.status,
        })
    } catch (err) {
        console.error('[Slot Upload] Error:', err.message)
        res.status(400).json({
            success: false,
            error: err.message,
        })
    }
})

/**
 * GET /api/slots/status
 * Check current slot upload status
 * Protected by API key
 */
router.get('/status', requireApiKey, (req, res) => {
    const status = AvailabilitySlot.getUploadStatus()
    res.json({ success: true, ...status })
})

/**
 * DELETE /api/slots/clear
 * Clear all slots (dangerous — use only to reset)
 * Protected by API key
 */
router.delete('/clear', requireApiKey, (req, res) => {
    AvailabilitySlot.loadFromUpload([], 'admin-clear')
    res.json({ success: true, message: 'All slots cleared' })
})

/**
 * POST /api/slots/sync
 * Force an immediate re-sync from Google Sheet
 * Useful after updating the sheet and wanting changes live instantly
 * Protected by API key
 */
const { syncSlotsFromSheet } = require('../services/googleSheets.service')

router.post('/sync', requireApiKey, async (req, res) => {
    try {
        const result = await syncSlotsFromSheet()
        if (result.skipped) {
            return res.status(200).json({
                success: true,
                message: result.message,
                skipped: true,
            })
        }
        res.json({
            success: true,
            message: `Synced ${result.count} slots from Google Sheet`,
            count: result.count,
            warnings: result.warnings,
            parseErrors: result.errors,
        })
    } catch (err) {
        console.error('[Slot Sync] Manual sync failed:', err.message)
        res.status(500).json({
            success: false,
            error: err.message,
        })
    }
})

module.exports = router
