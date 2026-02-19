const rateLimit = require('express-rate-limit')

/**
 * Rate limiting middleware to prevent abuse
 * Server-side protection against brute force and DOS attacks
 */

// General API rate limiter
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
})

// Strict limiter for booking creation (prevent slot sniping)
const bookingLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // Max 5 booking attempts per hour
    message: 'Too many booking attempts. Please try again later.',
    skipSuccessfulRequests: false,
})

// Strict limiter for payment verification
const paymentLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20, // Max 20 payment operations per hour per IP
    message: 'Too many payment requests. Please contact support if you need assistance.',
})

// Very strict limiter for CSV export
const exportLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 2, // Max 2 export requests per minute
    message: 'Export rate limit exceeded. Please wait before requesting again.',
})

// Slot fetch limiter (prevent scraping)
const slotLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // Max 10 slot fetches per minute
    message: 'Too many requests. Please slow down.',
})

module.exports = {
    apiLimiter,
    bookingLimiter,
    paymentLimiter,
    exportLimiter,
    slotLimiter,
}
