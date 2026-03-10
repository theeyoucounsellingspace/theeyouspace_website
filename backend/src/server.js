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
const { syncSlotsFromSheet } = require('./services/googleSheets.service')
// Background scheduler
const { startScheduler } = require('./services/scheduler.service')
// Booking persistence restore
const { restoreBookingsFromSheet } = require('./services/sheetWriteback.service')

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

    // Build allowed origins list:
    // 1. Dev localhost ports
    // 2. FRONTEND_URL single value (backwards compat)
    // 3. ALLOWED_ORIGINS comma-separated list (production — add all domains here)
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      'http://localhost:3000',
    ];

    if (process.env.FRONTEND_URL) {
      allowedOrigins.push(process.env.FRONTEND_URL.trim());
    }

    if (process.env.ALLOWED_ORIGINS) {
      process.env.ALLOWED_ORIGINS.split(',').forEach(o => {
        const trimmed = o.trim();
        if (trimmed) allowedOrigins.push(trimmed);
      });
    }

    if (allowedOrigins.includes(origin)) {
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

async function startServer() {
  // Validate required environment variables
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    console.warn('⚠️  Warning: Razorpay credentials not configured')
  }
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('⚠️  Warning: Email credentials not configured')
  }
  if (!process.env.NOTIFY_EMAIL) {
    console.warn('⚠️  Warning: NOTIFY_EMAIL not set — internal emails will go to SMTP_USER')
  }

  // ── Pre-flight: load slots + restore bookings before accepting requests ──
  // Both run in parallel — server only starts once both are done.
  // This eliminates the race where the first visitor sees an empty schedule.
  console.log('[Startup] Syncing slots + restoring bookings...')
  const t0 = Date.now()

  await Promise.allSettled([
    syncSlotsFromSheet().catch(err =>
      console.error('[Startup] Initial slot sync failed:', err.message)
    ),
    restoreBookingsFromSheet().catch(err =>
      console.error('[Startup] Booking restore failed:', err.message)
    ),
  ])

  console.log(`[Startup] Pre-flight done in ${Date.now() - t0}ms`)

  // ── Start server ──────────────────────────────────────────────────────────
  app.listen(PORT, () => {
    console.log(`[Startup] ✅ Server listening on port ${PORT} (${process.env.NODE_ENV || 'development'})`)

    // Auto-resync every 10 min (keep slots fresh without hammering the API)
    const SYNC_INTERVAL_MIN = 10
    const syncTimer = setInterval(() => {
      syncSlotsFromSheet().catch(err =>
        console.error('[AutoSync] Periodic sync failed:', err.message)
      )
    }, SYNC_INTERVAL_MIN * 60 * 1000)
    if (syncTimer.unref) syncTimer.unref()
    console.log(`[AutoSync] Slot refresh every ${SYNC_INTERVAL_MIN} min`)

    // Background scheduler (slot cleanup + reminders + morning brief)
    startScheduler()
  })
}

startServer().catch(err => {
  console.error('[Startup] Fatal error:', err.message)
  process.exit(1)
})


module.exports = app
