/**
 * Authentication Middleware for CSV Export
 * Validates API key to restrict access to authorized professionals only
 */

/**
 * Verify API key from request headers
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next middleware
 */
function requireApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key']
  const validApiKey = process.env.EXPORT_API_KEY

  // Check if API key is configured
  if (!validApiKey) {
    console.error('EXPORT_API_KEY not configured in environment')
    return res.status(500).json({
      success: false,
      error: 'Export functionality not configured',
    })
  }

  // Check if API key is provided
  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: 'API key required. Please provide X-API-Key header.',
    })
  }

  // Validate API key
  if (apiKey !== validApiKey) {
    console.warn('Invalid API key attempt for export endpoint')
    return res.status(401).json({
      success: false,
      error: 'Invalid API key',
    })
  }

  // API key is valid, proceed
  next()
}

module.exports = {
  requireApiKey,
}
