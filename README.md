# Thee You Space

A secure, professional mental health counseling booking platform with Razorpay payment integration.

**Philosophy**: Deploy once, run reliably. Server-side validation, production-grade security, zero maintenance overhead.

---

## 🚀 Quick Start

### Prerequisites
- Node.js 16+
- npm or yarn
- Razorpay account (Test mode keys)
- SMTP email account (Gmail recommended)

### Installation

```bash
# Backend
cd backend
npm install
cp .env.example .env
# Edit .env with your credentials (see Configuration section)
npm start

# Frontend (new terminal)
cd frontend
npm install
cp .env.example .env
# Edit .env with your credentials
npm run dev
```

**Access**: Frontend at http://localhost:5173, Backend at http://localhost:3000

---

## ⚙️ Configuration

### Backend `.env`

```bash
# Server
PORT=3000
NODE_ENV=development
FRONTEND_URL=https://your-production-domain.com  # For CORS in production

# Razorpay (TEST MODE)
RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_key_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

# Email (Gmail example)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password  # Generate from Google Account settings
SMTP_FROM=Thee You Space <your-email@gmail.com>

# CSV Export Security
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
EXPORT_API_KEY=your-64-character-hex-string
```

### Frontend `.env`

```bash
VITE_API_BASE_URL=http://localhost:3000/api
VITE_RAZORPAY_KEY_ID=rzp_test_your_key_id
VITE_WHATSAPP_LINK=https://wa.me/your_number
```

**⚠️ Never commit `.env` files to version control!**

---

## 🏗️ Architecture

### Tech Stack
- **Backend**: Express.js, Razorpay SDK, Nodemailer
- **Frontend**: React, Vite, React Router
- **Security**: Helmet, Rate Limiting, XSS Protection, CORS Whitelist
- **Storage**: In-memory (production: migrate to PostgreSQL/MongoDB)

### Security Features ✅

**Server-Side Protection**:
- Rate limiting (prevents abuse, DOS attacks)
- XSS & NoSQL injection protection
- CORS whitelist (production domain only)
- Request size limits (10KB max)
- Security headers (CSP, HSTS ready)
- Input sanitization (all user data)

**Payment Security**:
- Server-side signature verification
- Payment amount verification (prevents tampering)
- Webhook signature validation
- Idempotent payment processing (no double charges)

**Data Protection**:
- API key authentication for CSV export
- Error sanitization (no stack traces in production)
- Comprehensive audit logging (IP, user agent, timestamps)

**Rate Limits**:
- Booking creation: 5/hour per IP
- Payments: 20/hour per IP
- Slot fetching: 10/minute
- CSV export: 2/minute
- General API: 100/15 minutes

---

## 📊 Operational Guide

### Viewing Bookings

Export via API (requires your `EXPORT_API_KEY`):
```bash
curl -H "X-API-Key: YOUR_EXPORT_API_KEY" \
  http://localhost:3000/api/export/bookings \
  -o bookings.csv
```

Open CSV in Excel. Columns include: Booking ID, Name, Email, Session Date/Time, Payment Status, etc.

### Payment Dashboard

All payment details available at: https://dashboard.razorpay.com
- Real-time payment status
- Refund management
- Settlement reports
- Customer payment history

### Email Notifications

Automatic confirmation emails sent on successful booking with:
- Booking ID
- Session date & time
- Payment receipt
- Professional's contact info (if configured)

**No manual intervention needed** ✅

---

## 🧪 Testing

### Test Cards (Razorpay Test Mode)

**Success**: `4111 1111 1111 1111`, any future date, any CVV
**Failure**: `4000 0000 0000 0002`

### End-to-End Test Flow

1. **Start servers** (see Quick Start)
2. **Navigate**: http://localhost:5173
3. **Book session**:
   - Complete triage questions
   - Select time slot
   - Enter details (use your real email to receive confirmation)
   - Pay with test card
4. **Verify**:
   - Confirmation page shows booking ID
   - Email received
   - Backend logs show: `[Booking Confirmation] Booking TYS-XXXXXX confirmed successfully`
   - CSV export contains booking

### Security Testing

**Rate Limiting**:
```bash
# Should block after 5 attempts in 1 hour
for i in {1..10}; do curl -X POST http://localhost:3000/api/booking/create; done
```

**CSV Export Auth**:
```bash
# Should return 401 Unauthorized
curl http://localhost:3000/api/export/bookings
```

**Payment Amount Tampering**: Backend validates amount server-side (automatically protected)

---

## 🚢 Production Deployment

### Pre-Deployment Checklist

- [ ] Environment variables configured in hosting platform
- [ ] `NODE_ENV=production` set
- [ ] HTTPS enabled (required for Razorpay)
- [ ] `FRONTEND_URL` points to production domain
- [ ] CORS configured for production domain only
- [ ] API keys rotated (new production keys)
- [ ] SMTP credentials tested
- [ ] Rate limits appropriate for expected traffic
- [ ] Database migrated from in-memory to PostgreSQL/MongoDB
- [ ] Backup strategy in place
- [ ] Monitoring & alerts configured

### Environment Variables in Production

**Required**:
- All backend `.env` variables
- All frontend `.env` variables (injected at build time with Vite)

**Never Expose**:
- `RAZORPAY_KEY_SECRET` (backend only!)
- `EXPORT_API_KEY` (share only via secure channels)
- `SMTP_PASS`

### Razorpay Production Setup

1. Switch from Test to Live mode in Razorpay dashboard
2. Generate new LIVE keys: https://dashboard.razorpay.com/app/keys
3. Update `.env` with LIVE keys (NEVER commit)
4. Configure webhook: https://dashboard.razorpay.com/app/webhooks
   - URL: `https://your-domain.com/api/payment/webhook`
   - Events: `payment.captured`, `payment.authorized`
   - Secret: Copy to `RAZORPAY_WEBHOOK_SECRET`
5. Test with small real transaction

### Database Migration (Before Production)

Current: In-memory storage (resets on server restart)
Production: PostgreSQL or MongoDB required

**Migration Steps**:
1. Install database driver: `npm install pg` or `npm install mongoose`
2. Update `backend/src/models/Booking.js` and `AvailabilitySlot.js`
3. Create database schema
4. Update services to use database queries
5. Test thoroughly in staging

---

## 🛡️ Security Hardening

### Implemented (Phase 1) ✅

- Rate limiting on all endpoints
- XSS protection
- NoSQL injection protection
- CORS whitelist
- Payment amount verification
- Security headers (helmet.js)
- Error sanitization
- Request logging

### Recommended (Phase 2)

- CSRF tokens for state-changing operations
- API key rotation mechanism
- IP whitelisting for CSV export
- Automated vulnerability scanning (`npm audit`)
- PII encryption at rest (when using database)
- Webhook timestamp validation
- Failed payment attempt limiting

### Penetration Testing

Before production launch, test:
- SQL/NoSQL injection attempts
- XSS in name, email fields
- CSRF on payment endpoints
- Authentication bypass (CSV export)
- Payment amount tampering
- Race conditions (double booking)
- DOS attacks (rate limiting effectiveness)

---

## 🔧 Maintenance

### Regular Tasks

**Weekly**:
- Review booking logs for anomalies
- Export CSV for record-keeping
- Check email delivery success rate

**Monthly**:
- Run `npm audit` and update dependencies
- Review Razorpay dashboard for payment issues
- Rotate `EXPORT_API_KEY` if shared widely

**Quarterly**:
- Security audit
- Performance review (if traffic high)
- Backup verification

### Monitoring

**Key Metrics**:
- Booking success rate (should be >95%)
- Payment verification failures (should be <1%)
- API response times (<500ms average)
- Email delivery rate (>98%)

**Alerts to Set**:
- Server errors spike (>10 in 5 minutes)
- Payment verification failures
- Rate limit hits (possible attack)
- Email delivery failures

### Troubleshooting

**Booking not confirmed**:
1. Check backend logs for errors
2. Verify payment in Razorpay dashboard
3. Check email sent successfully
4. Manually export CSV to verify booking created

**Email not received**:
1. Check spam folder
2. Verify SMTP credentials in `.env`
3. Check backend logs: `[Email] Failed to send...`
4. Test SMTP connection: `npm run test:email` (if implemented)

**Payment verification failed**:
1. Check Razorpay dashboard for payment status
2. Verify webhook signature matches
3. Check backend logs for signature verification error
4. Manual verification: Use Razorpay dashboard to confirm payment

---

## 📞 Support & Contact

**For Users**:
- Priority support: [WhatsApp link from VITE_WHATSAPP_LINK]
- Emergency: Listed on Priority page

**For Developers**:
- Security issues: [Your security contact email]
- Razorpay support: https://razorpay.com/support

**Resources**:
- Razorpay API Docs: https://razorpay.com/docs/api
- Razorpay Test Cards: https://razorpay.com/docs/payments/payments/test-card-details

---

## 📄 License & Compliance

**Data Protection**: User data stored securely, exported via authenticated API only
**Payment Compliance**: PCI-DSS compliant via Razorpay (no card data stored locally)
**Privacy**: No analytics, tracking, or third-party data sharing

---

## 🎯 Project Status

**Current State**: Production-ready in TEST mode
**Next Steps**: 
1. Configure production environment variables
2. Deploy to hosting platform
3. Test end-to-end in staging
4. Switch Razorpay to LIVE mode
5. Launch! 🚀

**Last Updated**: February 2026
**Version**: 1.0.0 (Production-Ready)