require('dotenv').config()
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const mongoSanitize = require('express-mongo-sanitize')
const xss = require('xss-clean')

// Import routes
const bookingRoutes = require('./routes/booking.routes')
const paymentRoutes = require('./routes/payment.routes')
const priorityRoutes = require('./routes/priority.routes')
const exportRoutes = require('./routes/export.routes')
const slotsRoutes = require('./routes/slots.routes')
const professionalsRoutes = require('./routes/professionals.routes')

// Google Sheets sync
const { startAutoSync } = require('./services/googleSheets.service')

// Import middleware
const { apiLimiter } = require('./middleware/rateLimiter.middleware')
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler.middleware')
const requestLogger = require('./middleware/requestLogger.middleware')

const app = express()
const PORT = process.env.PORT || 3000

// ===== SECURITY MIDDLEWARE =====

// 1. Security Headers (helmet)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://checkout.razorpay.com"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.razorpay.com"],
      frameSrc: ["https://api.razorpay.com"],
    },
  },
}))

// 2. CORS Configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Allowed origins
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      'http://localhost:3000',
      process.env.FRONTEND_URL
    ];

    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      console.log('Blocked by CORS:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
}
app.use(cors(corsOptions))

// 3. Request Size Limits (prevent DOS)
// Store raw buffer for Razorpay webhook signature verification
app.use(express.json({
  limit: '10kb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}))
app.use(express.urlencoded({ extended: true, limit: '10kb' }))

// 4. Data Sanitization against NoSQL injection
app.use(mongoSanitize())

// 5. Data Sanitization against XSS
app.use(xss())

// 6. Global Rate Limiting
app.use(apiLimiter)

// 7. Request Logging (security audit trail)
app.use(requestLogger)

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// API routes
app.use('/api/booking', bookingRoutes)
app.use('/api/payment', paymentRoutes)
app.use('/api/priority', priorityRoutes)
app.use('/api/export', exportRoutes)
app.use('/api/slots', slotsRoutes)
app.use('/api/professionals', professionalsRoutes)

// ===== ERROR HANDLING =====

// 404 handler (must be after all routes)
app.use(notFoundHandler)

// Global error handler (must be last)
app.use(errorHandler)

// ===== START SERVER =====

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`)

  // Validate required environment variables
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    console.warn('⚠️  Warning: Razorpay credentials not configured')
  }

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('⚠️  Warning: Email credentials not configured')
  }

  // Start Google Sheets auto-sync (every 30 minutes, falls back to dev slots)
  startAutoSync(30)
})

module.exports = app
