const nodemailer = require('nodemailer')
const { paiseToRupees } = require('../utils/pricing.service')

// Configure email transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

/**
 * Send booking confirmation email
 * @param {Object} booking - Booking object
 * @returns {Promise<void>}
 */
async function sendBookingConfirmation(booking) {
  const { name, email, selectedSlot, pricing, sessionType } = booking

  const baseAmount = paiseToRupees(pricing.baseAmount)
  const platformFee = paiseToRupees(pricing.platformFee)
  const totalAmount = paiseToRupees(pricing.totalAmount)

  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: 'Your session is confirmed - Thee You Space',
    html: `
      <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 2rem; background-color: #FDFBF7; color: #2A2520;">
        <h1 style="font-size: 2rem; font-weight: 400; margin-bottom: 1rem; color: #2A2520;">Your session is confirmed</h1>
        
        <p style="font-size: 1.125rem; line-height: 1.75; color: #5A5248; margin-bottom: 2rem;">
          Hi ${name},
        </p>
        
        <p style="font-size: 1.125rem; line-height: 1.75; color: #5A5248; margin-bottom: 1.5rem;">
          We're looking forward to meeting you. Here are your session details:
        </p>
        
        <div style="background-color: #FFFFFF; padding: 1.5rem; border-radius: 12px; margin-bottom: 2rem; border: 1px solid #E8E0D6;">
          <p style="margin: 0.5rem 0; font-size: 1rem; color: #2A2520;">
            <strong>Session Type:</strong> ${sessionType === 'normal' ? 'Regular Session' : 'Priority Session'}
          </p>
          <p style="margin: 0.5rem 0; font-size: 1rem; color: #2A2520;">
            <strong>Date:</strong> ${selectedSlot.date}
          </p>
          <p style="margin: 0.5rem 0; font-size: 1rem; color: #2A2520;">
            <strong>Time:</strong> ${selectedSlot.time}
          </p>
          <p style="margin: 0.5rem 0; font-size: 1rem; color: #2A2520;">
            <strong>Booking ID:</strong> ${booking.id}
          </p>
        </div>
        
        <div style="background-color: #FAF7F2; padding: 1.5rem; border-radius: 12px; margin-bottom: 2rem; border-left: 4px solid #A68B6F;">
          <p style="margin: 0.5rem 0; font-size: 1rem; color: #2A2520;">
            <strong>Payment Summary:</strong>
          </p>
          <p style="margin: 0.5rem 0; font-size: 0.9rem; color: #5A5248;">
            Session fee: ₹${baseAmount.toFixed(2)}
          </p>
          <p style="margin: 0.5rem 0; font-size: 0.9rem; color: #5A5248;">
            Processing fee: ₹${platformFee.toFixed(2)}
          </p>
          <p style="margin: 0.5rem 0; font-size: 1rem; color: #2A2520; font-weight: 500;">
            Total paid: ₹${totalAmount.toFixed(2)}
          </p>
        </div>
        
        <p style="font-size: 1rem; line-height: 1.75; color: #5A5248; margin-bottom: 2rem;">
          If you need to reschedule or have any questions, please reach out to us.
        </p>
        
        <p style="font-size: 1rem; line-height: 1.75; color: #5A5248;">
          Take care,<br>
          Thee You Space
        </p>
      </div>
    `,
  }

  try {
    await transporter.sendMail(mailOptions)
    console.log(`Booking confirmation email sent to ${email}`)
  } catch (error) {
    console.error('Email sending error:', error)
    // Don't throw - email failure shouldn't break the booking flow
  }
}

module.exports = {
  sendBookingConfirmation,
}
