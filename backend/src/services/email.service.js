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

// ── Human-readable label maps (matches Triage.jsx option IDs) ─────────────────

const CONCERN_LABELS = {
  anxiety_stress: 'Anxiety & Stress',
  depression_mood: 'Low Mood',
  relationship_family: 'Relationships & Family',
  work_academics: 'Work & Academics',
  grief_loss: 'Grief & Loss',
  trauma_regret: 'Trauma & Regret',
  self_identity: 'Self & Identity',
  general: 'Exploring / Not sure yet',
}

const DURATION_LABELS = {
  days: 'Just started (a few days)',
  weeks: 'A few weeks (2–6 weeks)',
  months: 'A few months (2–6 months)',
  longer: 'Over 6 months',
}

const IMPACT_LABELS = {
  sleep: 'Sleep',
  work_school: 'Work or studies',
  relationships: 'Relationships',
  daily_routine: 'Daily routine',
  physical: 'Body & health',
  mood: 'Mood',
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const BASE = 'font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 2rem; background-color: #FDFBF7; color: #2A2520;'
const CARD = 'background-color: #FFFFFF; padding: 1.5rem; border-radius: 12px; margin-bottom: 1.5rem; border: 1px solid #E8E0D6;'
const TD_LABEL = 'padding: 0.45rem 0; font-size: 0.9rem; color: #8a7d70; width: 160px; vertical-align: top;'
const TD_VALUE = 'padding: 0.45rem 0; font-size: 0.9rem; color: #2A2520; font-weight: 500;'

function row(label, value) {
  if (!value) return ''
  return `<tr><td style="${TD_LABEL}">${label}</td><td style="${TD_VALUE}">${value}</td></tr>`
}

// ──────────────────────────────────────────────────────────────────────────────
/**
 * Email 1: Patient booking confirmation
 * Sends only session logistics — warm and reassuring tone.
 */
async function sendBookingConfirmation(booking) {
  const { name, email, selectedSlot, pricing, sessionType, professional } = booking

  if (!email) {
    console.error('[Email] No email address on booking — skipping patient confirmation')
    return
  }

  const totalRupees = pricing?.displayAmount
    ? pricing.displayAmount
    : pricing?.totalAmount
      ? Math.round(pricing.totalAmount / 100)
      : null

  const proName = selectedSlot?.professional || professional || null
  const sessionLabel = sessionType === 'priority' ? 'Priority Session' : 'Regular Session'

  const html = `
    <div style="${BASE}">
      <div style="margin-bottom: 2rem;">
        <h1 style="font-size: 1.75rem; font-weight: 400; margin: 0 0 0.25rem; color: #2A2520;">Your session is confirmed ✓</h1>
        <p style="margin: 0; font-size: 0.85rem; color: #8a7d70;">Booking ID: ${booking.id}</p>
      </div>

      <p style="font-size: 1rem; line-height: 1.75; color: #5A5248; margin-bottom: 1.5rem;">
        Hi ${name},<br><br>
        We're looking forward to meeting you. Here are your session details:
      </p>

      <div style="${CARD}">
        <table style="width: 100%; border-collapse: collapse;">
          ${row('Session type', sessionLabel)}
          ${proName ? row('Your counsellor', proName) : ''}
          ${row('Date', selectedSlot?.date)}
          ${row('Time', selectedSlot?.time)}
          ${totalRupees !== null ? row('Amount paid', `₹${totalRupees}`) : ''}
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
  `

  await _send({
    to: email,
    subject: `Your session is confirmed — Thee You Space`,
    html,
    tag: 'patient-confirmation',
    bookingId: booking.id,
  })
}

// ──────────────────────────────────────────────────────────────────────────────
/**
 * Email 2: Internal session prep — sent to the practice inbox.
 * Contains full triage data + patient contact + professional assigned.
 * The team uses this to prepare the counsellor before the session.
 *
 * IMPORTANT: This email contains patient data — keep SMTP credentials secure.
 */
async function sendSessionPrepEmail(booking) {
  const notifyEmail = process.env.NOTIFY_EMAIL || process.env.SMTP_USER
  if (!notifyEmail) {
    console.error('[Email] No NOTIFY_EMAIL or SMTP_USER configured — skipping session prep email')
    return
  }

  const { name, email, phone, selectedSlot, pricing, sessionType, professional, triageData, id } = booking
  const proName = selectedSlot?.professional || professional || 'Not specified'
  const sessionLabel = sessionType === 'priority' ? '⚡ PRIORITY SESSION' : 'Regular Session'
  const isPriority = sessionType === 'priority'

  const totalRupees = pricing?.displayAmount
    ? pricing.displayAmount
    : pricing?.totalAmount
      ? Math.round(pricing.totalAmount / 100)
      : null

  // ── Triage section — only if data exists ──────────────────────────────────
  let triageSection = ''
  if (triageData) {
    const concern = CONCERN_LABELS[triageData.concern] || triageData.concern || '—'
    const duration = DURATION_LABELS[triageData.duration] || triageData.duration || '—'

    const impacts = Array.isArray(triageData.impacts) && triageData.impacts.length > 0
      ? triageData.impacts.map(i => IMPACT_LABELS[i] || i).join(', ')
      : '—'

    const firstTimer = triageData.isFirstTimer === true
      ? '✅ Yes — first time seeking counselling'
      : triageData.isFirstTimer === false
        ? 'No — has attended counselling before'
        : '—'

    triageSection = `
      <div style="margin-top: 1.5rem;">
        <h3 style="font-size: 1rem; font-weight: 600; color: #5A5248; margin: 0 0 0.75rem; text-transform: uppercase; letter-spacing: 0.06em;">
          Patient's Triage Responses
        </h3>
        <div style="${CARD}">
          <table style="width: 100%; border-collapse: collapse;">
            ${row('Primary concern', concern)}
            ${row('Going on for', duration)}
            ${row('Affected areas', impacts)}
            ${row('First counselling session?', firstTimer)}
          </table>
        </div>
      </div>
    `
  } else {
    triageSection = `<p style="font-size: 0.85rem; color: #8a7d70; font-style: italic;">No triage data available for this booking.</p>`
  }

  const priorityBanner = isPriority ? `
    <div style="background: #fff3e8; border: 1.5px solid #f0a040; border-radius: 10px; padding: 0.85rem 1.25rem; margin-bottom: 1.25rem;">
      <strong style="color: #b07030;">⚡ Priority Session</strong>
      <span style="color: #b07030; font-size: 0.9rem;"> — This patient requested faster access. Please reach out promptly to confirm their slot.</span>
    </div>
  ` : ''

  const html = `
    <div style="${BASE}">
      <div style="margin-bottom: 1.5rem;">
        <h1 style="font-size: 1.5rem; font-weight: 400; margin: 0 0 0.25rem; color: #2A2520;">New Session Booked</h1>
        <p style="margin: 0; font-size: 0.85rem; color: #8a7d70;">Booking ID: ${id} · Booking time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</p>
      </div>

      ${priorityBanner}

      <!-- Session logistics -->
      <h3 style="font-size: 1rem; font-weight: 600; color: #5A5248; margin: 0 0 0.75rem; text-transform: uppercase; letter-spacing: 0.06em;">
        Session Details
      </h3>
      <div style="${CARD}">
        <table style="width: 100%; border-collapse: collapse;">
          ${row('Session type', sessionLabel)}
          ${row('Assigned counsellor', `<strong>${proName}</strong>`)}
          ${row('Date', selectedSlot?.date || '—')}
          ${row('Time', selectedSlot?.time || '—')}
          ${totalRupees !== null ? row('Amount paid', `₹${totalRupees}`) : ''}
        </table>
      </div>

      <!-- Patient contact -->
      <h3 style="font-size: 1rem; font-weight: 600; color: #5A5248; margin: 1.5rem 0 0.75rem; text-transform: uppercase; letter-spacing: 0.06em;">
        Patient Contact
      </h3>
      <div style="${CARD}">
        <table style="width: 100%; border-collapse: collapse;">
          ${row('Name', name)}
          ${row('Email', `<a href="mailto:${email}" style="color: #7a6e6b;">${email}</a>`)}
          ${phone ? row('Phone', phone) : row('Phone', '<em style="color:#aaa">Not provided</em>')}
        </table>
      </div>

      ${triageSection}

      <p style="font-size: 0.8rem; color: #aaa9a5; margin-top: 2rem; line-height: 1.6; border-top: 1px solid #E8E0D6; padding-top: 1rem;">
        This is an automated internal notification from Thee You Space. Do not forward or share this email — it contains patient information.
      </p>
    </div>
  `

  await _send({
    to: notifyEmail,
    subject: `${isPriority ? '⚡ [PRIORITY] ' : ''}New session — ${proName} · ${selectedSlot?.date || '?'} ${selectedSlot?.time || ''}`,
    html,
    tag: 'session-prep',
    bookingId: id,
  })
}

// ── Shared send helper with logging ──────────────────────────────────────────
async function _send({ to, subject, html, tag, bookingId }) {
  const mailOptions = {
    from: process.env.SMTP_FROM || `Thee You Space <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
  }
  try {
    const info = await transporter.sendMail(mailOptions)
    console.log(`[Email:${tag}] ✅ Sent to ${to} — messageId: ${info.messageId} — booking: ${bookingId}`)
  } catch (error) {
    console.error(`[Email:${tag}] ❌ Failed to send to ${to} — booking: ${bookingId}:`, error.message)
    if (error.code) console.error(`[Email:${tag}] SMTP error code: ${error.code}`)
    // Do NOT throw — email failure must never break the payment confirmation flow
  }
}

module.exports = { sendBookingConfirmation, sendSessionPrepEmail }
