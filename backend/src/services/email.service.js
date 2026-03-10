const nodemailer = require('nodemailer')
const { CONCERN_LABELS, DURATION_LABELS, IMPACT_LABELS, label, labelList } = require('../utils/triageLabels')
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

      ${booking.meetUrl ? `
      <div style="text-align:center; margin: 1.75rem 0 0.5rem;">
        <a href="${booking.meetUrl}"
           style="display:inline-block; background:#1a73e8; color:#fff; text-decoration:none;
                  font-size:1rem; font-weight:600; padding:0.85rem 2rem; border-radius:999px;
                  font-family:sans-serif; letter-spacing:0.01em;">
          🎥 Join your session
        </a>
        <p style="font-size:0.78rem; color:#8a7d70; margin:0.6rem 0 0;">
          This Google Meet link is only for your scheduled session on ${selectedSlot?.date} at ${selectedSlot?.time} IST.
        </p>
      </div>
      ` : `
      <div style="background:#fdf8f3; border:1px solid #e8d9c0; border-radius:10px; padding:1rem 1.25rem; margin:1.5rem 0 0.5rem; font-size:0.88rem; color:#7a6250;">
        <strong>📋 Session link coming soon</strong><br>
        Your counsellor will reach out with a video link closer to your session time.
      </div>
      `}

      <div style="text-align:center; margin: 1.5rem 0;">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/reschedule?bid=${booking.id}"
           style="display:inline-block; background:#8B7355; color:#fff; text-decoration:none; font-size:0.9rem; font-weight:600; padding:0.7rem 1.6rem; border-radius:999px; font-family:sans-serif;">
          Reschedule this session
        </a>
        <p style="font-size:0.75rem; color:#8a7d70; margin:0.5rem 0 0;">
          Must be requested at least 24 hours before your session time.
        </p>
      </div>

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

      ${booking.meetUrl ? `
      <div style="margin-top: 1.5rem; background: #e8f0fe; border: 1.5px solid #1a73e8; border-radius: 10px; padding: 1rem 1.25rem;">
        <strong style="color: #1a73e8;">🎥 Google Meet Link</strong><br>
        <a href="${booking.meetUrl}" style="color: #1557b0; font-size: 0.95rem; word-break: break-all;">${booking.meetUrl}</a>
        <p style="font-size: 0.8rem; color: #555; margin: 0.4rem 0 0;">The patient has received this same link in their confirmation email.</p>
      </div>
      ` : ''}

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

module.exports = {
  sendBookingConfirmation,
  sendSessionPrepEmail,
  sendSessionReminder,
  sendOneHourReminder,
  sendCounsellorMorningBrief,
  sendRescheduleConfirmation,
  sendRescheduleAlert,
}

// ── 1hr reminder (urgent — session starting soon) ────────────────────────────

async function sendOneHourReminder(booking) {
  const name = booking.name?.split(' ')[0] || 'there'
  const slot = booking.selectedSlot || {}
  const { generateMeetUrl } = require('./calendarMeet.service')
  const meetUrl = booking.meetUrl || generateMeetUrl(booking)

  const html = `<div style="${BASE}">
    <p style="font-size:0.85rem; color:#8a7d70; margin:0 0 1rem; text-transform:uppercase; letter-spacing:0.08em;">Starting soon</p>
    <h2 style="font-family:Georgia,serif; font-weight:400; font-size:1.6rem; margin:0 0 1rem; color:#2A2520;">Your session starts in 1 hour</h2>
    <p style="font-size:1rem; line-height:1.75; color:#5A5248; margin-bottom:1.5rem;">
      Hi ${name}, your session is coming up at <strong>${slot.time} IST</strong> today.
    </p>
    <div style="text-align:center; margin:1rem 0 1.5rem;">
      <a href="${meetUrl}"
         style="display:inline-block; background:#1a73e8; color:#fff; text-decoration:none;
                font-size:1.1rem; font-weight:600; padding:1rem 2.5rem; border-radius:999px;
                font-family:sans-serif; letter-spacing:0.01em;">
        🎥 Join your session now
      </a>
    </div>
    <p style="font-size:0.85rem; color:#8a7d70; text-align:center; margin:0;">Booking ID: ${booking.id}</p>
    <p style="font-size:0.95rem; color:#5A5248; margin:1.5rem 0 0;">Take care,<br><strong>Thee You Space</strong><br><em style="font-size:0.85rem; color:#8a7d70;">where You Open Up</em></p>
  </div>`

  await _send({ to: booking.email, subject: `Your session starts in 1 hour — Thee You Space`, html, tag: '1hr-reminder', bookingId: booking.id })
}

// ── Session reminder (24hr before) ────────────────────────────────────────────

async function sendSessionReminder(booking) {
  const name = booking.name?.split(' ')[0] || 'there'
  const proName = booking.professional || ''
  const slot = booking.selectedSlot || {}

  // Regenerate Jitsi URL (deterministic — same as confirmation email)
  const { generateMeetUrl } = require('./calendarMeet.service')
  const meetUrl = booking.meetUrl || generateMeetUrl(booking)

  const html = `<div style="${BASE}">
    <p style="font-size:0.85rem; color:#8a7d70; margin:0 0 1rem; text-transform:uppercase; letter-spacing:0.08em;">Session Reminder</p>
    <h2 style="font-family:Georgia,serif; font-weight:400; font-size:1.6rem; margin:0 0 1rem; color:#2A2520;">Your session is tomorrow</h2>
    <p style="font-size:1rem; line-height:1.75; color:#5A5248; margin-bottom:1.5rem;">
      Hi ${name}, just a reminder that your counselling session is coming up tomorrow.
    </p>
    <div style="${CARD}">
      <table style="width:100%; border-collapse:collapse;">
        ${proName ? row('Your counsellor', proName) : ''}
        ${row('Date', slot.date)}
        ${row('Time', slot.time)}
        ${row('Session type', booking.sessionType === 'priority' ? 'Priority Session' : 'Regular Session')}
        ${row('Booking ID', booking.id)}
      </table>
    </div>

    <div style="text-align:center; margin:1.5rem 0 0.5rem;">
      <a href="${meetUrl}"
         style="display:inline-block; background:#1a73e8; color:#fff; text-decoration:none;
                font-size:1rem; font-weight:600; padding:0.85rem 2rem; border-radius:999px;
                font-family:sans-serif; letter-spacing:0.01em;">
        🎥 Join your session
      </a>
      <p style="font-size:0.78rem; color:#8a7d70; margin:0.5rem 0 0;">
        Your video link for ${slot.date} at ${slot.time} IST.
      </p>
    </div>

    <p style="font-size:0.9rem; color:#5A5248; line-height:1.75; margin:1.5rem 0 0.5rem;">
      Need to reschedule? You must do so at least 24 hours before your session:
    </p>
    <div style="text-align:center; margin:0.75rem 0;">
      <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/reschedule?bid=${booking.id}"
         style="display:inline-block; background:#8B7355; color:#fff; text-decoration:none; font-size:0.85rem; font-weight:600; padding:0.6rem 1.4rem; border-radius:999px; font-family:sans-serif;">
        Reschedule this session
      </a>
    </div>
    <p style="font-size:0.95rem; color:#5A5248; margin:1.5rem 0 0;">Take care,<br><strong>Thee You Space</strong><br><em style="font-size:0.85rem; color:#8a7d70;">where You Open Up</em></p>
  </div>`

  await _send({ to: booking.email, subject: 'Reminder: Your session is tomorrow — Thee You Space', html, tag: 'reminder', bookingId: booking.id })
}

// ── Counsellor morning brief ──────────────────────────────────────────────────

async function sendCounsellorMorningBrief(allBookings, byPro) {
  const to = process.env.NOTIFY_EMAIL || process.env.SMTP_USER
  const date = allBookings[0]?.selectedSlot?.date || 'Today'

  const proSections = Object.entries(byPro).map(([pro, bkgs]) => {
    const sessionRows = bkgs.map(b =>
      `<li style="margin-bottom:0.5rem;"><strong>${b.selectedSlot?.time}</strong> — ${b.name} (${b.email})${b.phone ? ` · ${b.phone}` : ''}</li>`
    ).join('')
    return `<div style="${CARD}">
      <p style="font-weight:600; font-size:1rem; margin:0 0 0.75rem; color:#2A2520;">${pro}</p>
      <ul style="margin:0; padding-left:1.25rem; color:#5A5248; font-size:0.9rem; line-height:1.8;">${sessionRows}</ul>
    </div>`
  }).join('')

  const html = `<div style="${BASE}">
    <p style="font-size:0.85rem; color:#8a7d70; margin:0 0 1rem; text-transform:uppercase; letter-spacing:0.08em;">Morning Brief</p>
    <h2 style="font-family:Georgia,serif; font-weight:400; font-size:1.6rem; margin:0 0 0.5rem; color:#2A2520;">Sessions for ${date}</h2>
    <p style="font-size:0.95rem; color:#5A5248; margin:0 0 1.5rem;">${allBookings.length} session(s) scheduled today.</p>
    ${proSections}
    <p style="font-size:0.8rem; color:#8a7d70; margin:1.5rem 0 0;">Sent automatically by Thee You Space at 8 AM IST.</p>
  </div>`

  await _send({ to, subject: `Morning Brief: ${allBookings.length} session(s) today — ${date}`, html, tag: 'morning-brief', bookingId: 'N/A' })
}

// ── Reschedule confirmation (to patient) ─────────────────────────────────────

async function sendRescheduleConfirmation(booking, newSlot) {
  const name = booking.name?.split(' ')[0] || 'there'
  const html = `<div style="${BASE}">
    <p style="font-size:0.85rem; color:#8a7d70; margin:0 0 1rem; text-transform:uppercase; letter-spacing:0.08em;">Booking Updated</p>
    <h2 style="font-family:Georgia,serif; font-weight:400; font-size:1.6rem; margin:0 0 1rem; color:#2A2520;">Your session has been rescheduled</h2>
    <p style="font-size:1rem; line-height:1.75; color:#5A5248; margin-bottom:1.5rem;">
      Hi ${name}, your session has been moved to the new slot below.
    </p>
    <div style="${CARD}">
      <table style="width:100%; border-collapse:collapse;">
        ${booking.professional ? row('Your counsellor', booking.professional) : ''}
        ${row('New date', newSlot.date)}
        ${row('New time', newSlot.time)}
        ${row('Session type', booking.sessionType === 'priority' ? 'Priority Session' : 'Regular Session')}
        ${row('Booking ID', booking.id)}
      </table>
    </div>
    <p style="font-size:0.75rem; color:#8a7d70; margin:0;">You can reschedule again up to 24 hours before your session using the link in your original confirmation email.</p>
  </div>`

  await _send({ to: booking.email, subject: 'Your session has been rescheduled — Thee You Space', html, tag: 'reschedule-confirmation', bookingId: booking.id })
}

// ── Reschedule alert (to practice inbox) ─────────────────────────────────────

async function sendRescheduleAlert(booking, oldSlot, newSlot) {
  const to = process.env.NOTIFY_EMAIL || process.env.SMTP_USER
  const html = `<div style="${BASE}">
    <p style="font-size:0.85rem; color:#8a7d70; margin:0 0 1rem; text-transform:uppercase; letter-spacing:0.08em;">Reschedule Alert</p>
    <h2 style="font-family:Georgia,serif; font-weight:400; font-size:1.5rem; margin:0 0 1rem; color:#2A2520;">Session rescheduled by patient</h2>
    <div style="${CARD}">
      <table style="width:100%; border-collapse:collapse;">
        ${row('Booking ID', booking.id)}
        ${row('Patient', booking.name)}
        ${row('Email', booking.email)}
        ${booking.phone ? row('Phone', booking.phone) : ''}
        ${booking.professional ? row('Counsellor', booking.professional) : ''}
        ${row('Old slot', `${oldSlot.date} at ${oldSlot.time}`)}
        ${row('New slot', `${newSlot.date} at ${newSlot.time}`)}
      </table>
    </div>
    <p style="font-size:0.8rem; color:#8a7d70; margin:0;">Sheet has been updated automatically.</p>
  </div>`

  await _send({ to, subject: `Reschedule: ${booking.name} moved to ${newSlot.date} ${newSlot.time}`, html, tag: 'reschedule-alert', bookingId: booking.id })
}
