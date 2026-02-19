/**
 * Request logging middleware
 * Logs all incoming requests with security-relevant information
 */

const requestLogger = (req, res, next) => {
    const startTime = Date.now()

    // Log request details
    console.log(`[Request] ${req.method} ${req.path}`, {
        ip: req.ip || req.socket.remoteAddress,
        userAgent: req.get('user-agent'),
        timestamp: new Date().toISOString(),
    })

    // Log response time on completion
    res.on('finish', () => {
        const duration = Date.now() - startTime
        console.log(`[Response] ${req.method} ${req.path} ${res.statusCode} - ${duration}ms`)
    })

    next()
}

module.exports = requestLogger
