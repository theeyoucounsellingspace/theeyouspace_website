/**
 * Error handling middleware
 * Sanitizes errors for production - never expose sensitive information
 */

const errorHandler = (err, req, res, next) => {
    // Log the full error for debugging
    console.error('[Error]', {
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        path: req.path,
        method: req.method,
        ip: req.ip,
        timestamp: new Date().toISOString(),
    })

    // Determine status code
    const statusCode = err.statusCode || err.status || 500

    // Production: Never expose stack traces or detailed error messages
    const isDevelopment = process.env.NODE_ENV === 'development'

    res.status(statusCode).json({
        success: false,
        error: isDevelopment ? err.message : 'An error occurred. Please try again later.',
        ...(isDevelopment && { stack: err.stack }),
    })
}

// 404 handler for undefined routes
const notFoundHandler = (req, res) => {
    console.warn('[404] Route not found:', req.method, req.path, 'IP:', req.ip)
    res.status(404).json({
        success: false,
        error: 'Resource not found',
    })
}

module.exports = {
    errorHandler,
    notFoundHandler,
}
