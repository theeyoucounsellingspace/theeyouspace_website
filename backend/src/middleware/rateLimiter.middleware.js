const rateLimit = require('express-rate-limit')

/**
 * Rate limiting middleware to prevent abuse
 * Server-side protection against brute force and DOS attacks
 */

// General API rate limiter
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { success: false, error: 'Too many requests. Please try again in a few minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
})

const bookingLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: { success: false, error: 'Too many booking attempts. Please try again later.' },
    skipSuccessfulRequests: false,
})

const paymentLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 20,
    message: { success: false, error: 'Too many payment requests. Please contact support if you need help.' },
})

const exportLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 2,
    message: { success: false, error: 'Export rate limit exceeded. Please wait before retrying.' },
})

const slotLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: { success: false, error: 'Too many requests. Please slow down.' },
})

module.exports = {
    apiLimiter,
    bookingLimiter,
    paymentLimiter,
    exportLimiter,
    slotLimiter,
}
