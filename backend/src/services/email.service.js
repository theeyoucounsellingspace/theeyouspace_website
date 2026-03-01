const nodemailer = require('nodemailer')

// Configure email transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: false, // STARTTLS on port 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

/**
 * Send booking confirmation email
 * Called after payment is verified successfully.
 * @param {Object} booking - Booking object from Booking.toJSON()
 */
async function sendBookingConfirmation(booking) {
  const { name, email, selectedSlot, pricing, sessionType } = booking

  if (!email) {
    console.error('[Email] No email address on booking — skipping confirmation')
    return
  }

  // Guard: pricing may store displayAmount (rupees integer) directly
  // The Booking model stores: { displayAmount, totalAmount (paise), currency }
  const totalRupees = pricing?.displayAmount
    ? pricing.displayAmount
    : pricing?.totalAmount
      ? Math.round(pricing.totalAmount / 100)
      : null

  const professional = selectedSlot?.professional || booking.professional || null
  const sessionLabel = sessionType === 'normal' ? 'Regular Session' : 'Priority Session'

  const mailOptions = {
    from: process.env.SMTP_FROM || `Thee You Space <${process.env.SMTP_USER}>`,
    to: email,
    subject: `Your session is confirmed — Thee You Space`,
    html: `
      <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 2rem; background-color: #FDFBF7; color: #2A2520;">

        <div style="margin-bottom: 2rem;">
          <h1 style="font-size: 1.75rem; font-weight: 400; margin: 0 0 0.25rem; color: #2A2520;">
            Your session is confirmed ✓
          </h1>
          <p style="margin: 0; font-size: 0.9rem; color: #8a7d70;">Booking ID: ${booking.id}</p>
        </div>

        <p style="font-size: 1.05rem; line-height: 1.75; color: #5A5248; margin-bottom: 1.5rem;">
          Hi ${name},<br><br>
          We're looking forward to meeting you. Here are your session details:
        </p>

        <div style="background-color: #FFFFFF; padding: 1.5rem; border-radius: 12px; margin-bottom: 1.5rem; border: 1px solid #E8E0D6;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 0.45rem 0; font-size: 0.95rem; color: #8a7d70; width: 140px;">Session type</td>
              <td style="padding: 0.45rem 0; font-size: 0.95rem; color: #2A2520; font-weight: 500;">${sessionLabel}</td>
            </tr>
            ${professional ? `
            <tr>
              <td style="padding: 0.45rem 0; font-size: 0.95rem; color: #8a7d70;">Professional</td>
              <td style="padding: 0.45rem 0; font-size: 0.95rem; color: #2A2520; font-weight: 500;">${professional}</td>
            </tr>` : ''}
            <tr>
              <td style="padding: 0.45rem 0; font-size: 0.95rem; color: #8a7d70;">Date</td>
              <td style="padding: 0.45rem 0; font-size: 0.95rem; color: #2A2520; font-weight: 500;">${selectedSlot?.date || '—'}</td>
            </tr>
            <tr>
              <td style="padding: 0.45rem 0; font-size: 0.95rem; color: #8a7d70;">Time</td>
              <td style="padding: 0.45rem 0; font-size: 0.95rem; color: #2A2520; font-weight: 500;">${selectedSlot?.time || '—'}</td>
            </tr>
            ${totalRupees !== null ? `
            <tr>
              <td style="padding: 0.45rem 0; font-size: 0.95rem; color: #8a7d70;">Amount paid</td>
              <td style="padding: 0.45rem 0; font-size: 0.95rem; color: #2A2520; font-weight: 500;">₹${totalRupees}</td>
            </tr>` : ''}
          </table>
        </div>

        <p style="font-size: 0.95rem; line-height: 1.75; color: #5A5248; margin-bottom: 2rem;">
          If you need to reschedule or have any questions, reply to this email or reach us at
          <a href="mailto:${process.env.SMTP_USER}" style="color: #7a6e6b;">${process.env.SMTP_USER}</a>.
        </p>

        <p style="font-size: 0.95rem; line-height: 1.75; color: #5A5248; margin: 0;">
          Take care,<br>
          <strong>Thee You Space</strong><br>
          <em style="font-size: 0.85rem; color: #8a7d70;">where You Open Up</em>
        </p>
      </div>
    `,
  }

  try {
    const info = await transporter.sendMail(mailOptions)
    console.log(`[Email] ✅ Confirmation sent to ${email} — messageId: ${info.messageId}`)
  } catch (error) {
    // Log the full error so it shows up in Render logs — don't throw (must not break payment flow)
    console.error(`[Email] ❌ Failed to send to ${email}:`, error.message)
    if (error.code) console.error(`[Email] SMTP error code: ${error.code}`)
  }
}

module.exports = { sendBookingConfirmation }
