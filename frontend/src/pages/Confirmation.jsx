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

  return (
    <CalmContainer centered>
      <div className="confirmation">
        <div className="confirmation-content">
          <div className="confirmation-icon">
            <svg
              width="64"
              height="64"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
          <h2 className="confirmation-title">You're all set</h2>

          {booking && (
            <div className="confirmation-details">
              <p className="confirmation-text">
                <strong>Booking ID:</strong> {booking.id}
              </p>
              <p className="confirmation-text">
                <strong>Session:</strong> {booking.selectedSlot.date} at {booking.selectedSlot.time}
              </p>
            </div>
          )}

          <p className="confirmation-text">
            Your session has been confirmed. We've sent you an email with all the details.
          </p>
          <p className="confirmation-text">
            We're looking forward to meeting you.
          </p>
          <div className="confirmation-actions">
            <Button
              variant="primary"
              onClick={() => navigate(ROUTES.HOME)}
            >
              Return to home
            </Button>
          </div>
        </div>
      </div>
    </CalmContainer>
  )
}

export default Confirmation
