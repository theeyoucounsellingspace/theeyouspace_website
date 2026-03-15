import React from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../components/Button'
import CalmContainer from '../components/CalmContainer'
import { APP_NAME, APP_TAGLINE, ROUTES } from '../utils/constants'
import './Home.css'

const WA_LINK = `${import.meta.env.VITE_WHATSAPP_LINK || 'https://wa.me/917358154022'}?text=${encodeURIComponent('Hi, I need to book a priority session urgently.')}`

function Home() {
  const navigate = useNavigate()

  return (
    <div className="home">
      <CalmContainer centered>
        <div className="home-content">
          <h1 className="home-title">{APP_NAME}</h1>
          <p className="home-tagline">{APP_TAGLINE}</p>
          <p className="home-description">
            A safe space to explore what's on your mind and find support that feels right for you.
          </p>
          <div className="home-actions">
            <Button
              variant="primary"
              onClick={() => navigate(ROUTES.TRIAGE)}
            >
              Book a session
            </Button>
            <a
              href={WA_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
              style={{ textDecoration: 'none', textAlign: 'center' }}
            >
              Book a session "now"
            </a>
          </div>

          <div className="home-footer">
            <button
              className="home-link"
              onClick={() => navigate(ROUTES.ABOUT)}
            >
              About Us
            </button>
          </div>
        </div>
      </CalmContainer>
    </div>
  )
}

export default Home
