import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import Button from '../components/Button'
import CalmContainer from '../components/CalmContainer'
import { ROUTES } from '../utils/constants'
import './Confirmation.css'

function Confirmation() {
  const navigate = useNavigate()
  const location = useLocation()
  const booking = location.state?.booking
  const isFirstTimer = location.state?.isFirstTimer ?? false   // passed from DetailsPayment

  return (
    <CalmContainer centered>
      <div className="confirmation">
        <div className="confirmation-icon" aria-hidden="true">
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>

        {/* ── Personalised heading ── */}
        {isFirstTimer ? (
          <>
            <h2 className="confirmation-title">You took the step.</h2>
            <p className="confirmation-lead">
              That takes courage — and we don't take that lightly. You've just done something
              genuinely difficult, and we're honored that you chose to do it with us.
            </p>
            <p className="confirmation-body">
              This is a safe, confidential space. There's no right way to start. Show up as you
              are — we'll meet you exactly there.
            </p>
          </>
        ) : (
          <>
            <h2 className="confirmation-title">Welcome back.</h2>
            <p className="confirmation-lead">
              Same safe space — with every session we learn a little more, and this one will
              be no different. You know what to expect. Take a breath.
            </p>
            <p className="confirmation-body">
              We're glad you're back, and we'll be ready for you at the scheduled time.
            </p>
          </>
        )}

        {/* ── Booking summary ── */}
        {booking && (
          <div className="confirmation-details">
            {booking.id && (
              <p className="confirmation-detail-row">
                <span>Booking ID</span>
                <strong>{booking.id}</strong>
              </p>
            )}
            {booking.selectedSlot && (
              <>
                <p className="confirmation-detail-row">
                  <span>Date</span>
                  <strong>{booking.selectedSlot.date}</strong>
                </p>
                <p className="confirmation-detail-row">
                  <span>Time</span>
                  <strong>{booking.selectedSlot.time}</strong>
                </p>
              </>
            )}
          </div>
        )}

        <p className="confirmation-email-note">
          A confirmation email is on its way to you with all the details.
        </p>

        <p className="confirmation-reminder">
          If you need to reschedule, contact us at least 24 hours before your session:<br />
          <a href="mailto:theeyoucounsellingspace@gmail.com" className="confirmation-link">
            theeyoucounsellingspace@gmail.com
          </a>
        </p>

        <div className="confirmation-actions">
          <Button variant="primary" onClick={() => navigate(ROUTES.HOME)}>
            Return home
          </Button>
        </div>
      </div>
    </CalmContainer>
  )
}

export default Confirmation
