const express = require('express')
const router = express.Router()
const Booking = require('../models/Booking')
const { requireApiKey } = require('../middleware/auth.middleware')
const { exportLimiter } = require('../middleware/rateLimiter.middleware')

/**
 * GET /api/export/bookings
 * Export all bookings as CSV
 * Protected: Requires API key authentication + rate limiting
 */
router.get('/bookings', exportLimiter, requireApiKey, (req, res) => {
    try {
        const bookings = Booking.getAll()

        // CSV headers
        const headers = [
            'Booking ID',
            'Session Type',
            'Name',
            'Email',
            'Phone',
            'Date',
            'Time',
            'Base Amount (₹)',
            'Platform Fee (₹)',
            'Total Amount (₹)',
            'Payment Method',
            'Payment Status',
            'Booking Status',
            'Razorpay Order ID',
            'Razorpay Payment ID',
            'Created At',
            'Updated At',
        ]

        // Convert bookings to CSV rows
        const rows = bookings.map((booking) => {
            const baseAmount = (booking.pricing.baseAmount / 100).toFixed(2)
            const platformFee = (booking.pricing.platformFee / 100).toFixed(2)
            const totalAmount = (booking.pricing.totalAmount / 100).toFixed(2)

            return [
                booking.id,
                booking.sessionType,
                booking.name,
                booking.email,
                booking.phone || '',
                booking.selectedSlot.date,
                booking.selectedSlot.time,
                baseAmount,
                platformFee,
                totalAmount,
                booking.paymentMethod,
                booking.paymentStatus,
                booking.bookingStatus,
                booking.razorpayOrderId || '',
                booking.razorpayPaymentId || '',
                booking.createdAt,
                booking.updatedAt,
            ]
        })

        // Build CSV content
        const csvContent = [
            headers.join(','),
            ...rows.map((row) =>
                row.map((field) => {
                    // Escape fields containing commas or quotes
                    if (typeof field === 'string' && (field.includes(',') || field.includes('"'))) {
                        return `"${field.replace(/"/g, '""')}"`
                    }
                    return field
                }).join(',')
            ),
        ].join('\n')

        // Set headers for CSV download
        res.setHeader('Content-Type', 'text/csv; charset=utf-8')
        res.setHeader('Content-Disposition', 'attachment; filename=bookings.csv')

        // Add BOM for Excel UTF-8 compatibility
        res.write('\uFEFF')
        res.send(csvContent)

        console.log(`CSV export successful - ${bookings.length} bookings exported`)
    } catch (error) {
        console.error('Error exporting bookings:', error)
        res.status(500).json({
            success: false,
            error: 'Failed to export bookings',
        })
    }
})

module.exports = router
