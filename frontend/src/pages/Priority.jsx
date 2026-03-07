import React from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../components/Button'
import CalmContainer from '../components/CalmContainer'
import { ROUTES, WHATSAPP_LINK } from '../utils/constants'
import './Priority.css'

function Priority() {
  const navigate = useNavigate()

  return (
    <CalmContainer>
      <div className="priority">

        <p className="priority-eyebrow">Priority Session</p>
        <h2 className="priority-title">You'll hear back faster.</h2>
        <p className="priority-sub">
          When waiting isn't an option, we move you up the queue.
          A counsellor from our team will reach out to confirm your slot within a few hours.
        </p>

        {/* Primary CTA — WhatsApp, no number visible */}
        <div className="priority-cta-block">
          <a
            href={WHATSAPP_LINK}
            className="priority-wa-btn"
            target="_blank"
            rel="noopener noreferrer"
          >
            Message us on WhatsApp →
          </a>
          <p className="priority-cta-note">
            Just send a "Hi" — we'll take it from there.
          </p>
        </div>

        <div className="priority-divider">or</div>

        {/* Secondary CTA — back into the standard booking flow */}
        <div className="priority-book-block">
          <Button
            variant="primary"
            onClick={() => navigate(ROUTES.TRIAGE)}
          >
            Book a session now
          </Button>
          <p className="priority-book-note">
            Pick a counsellor and a time that works for you.
          </p>
        </div>

        {/* Fine print — present, not prominent */}
        <p className="priority-fine">
          If you are in immediate danger, please call 112 or visit your nearest emergency room.
        </p>

      </div>
    </CalmContainer>
  )
}

export default Priority
