import React from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../components/Button'
import CalmContainer from '../components/CalmContainer'
import { ROUTES, EMERGENCY_CONTACTS, WHATSAPP_LINK } from '../utils/constants'
import './Priority.css'

function Priority() {
  const navigate = useNavigate()

  return (
    <CalmContainer>
      <div className="priority">
        <h2 className="priority-title">We're here for you</h2>
        <p className="priority-text">
          If you're in immediate distress or having thoughts of self-harm, please reach out to emergency services right away.
        </p>
        <div className="priority-emergency">
          <p className="emergency-title">Emergency contacts (India):</p>
          <ul className="emergency-list">
            {EMERGENCY_CONTACTS.map((contact, index) => (
              <li key={index}>
                <span className="contact-name">{contact.name}</span>
                <span className="contact-number">{contact.number}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="priority-text">
          For urgent support that isn't an emergency, you can reach out to us via WhatsApp below. We'll do our best to connect you with someone as soon as possible.
        </p>
        <div className="priority-actions">
          <a
            href={WHATSAPP_LINK}
            className="btn btn-primary whatsapp-btn"
            target="_blank"
            rel="noopener noreferrer"
          >
            Connect via WhatsApp (+91 73581 54022)
          </a>
          <Button
            variant="secondary"
            onClick={() => navigate(ROUTES.HOME)}
          >
            Return to home
          </Button>
        </div>
      </div>
    </CalmContainer>
  )
}

export default Priority
