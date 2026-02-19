import React from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../components/Button'
import CalmContainer from '../components/CalmContainer'
import { APP_NAME, APP_TAGLINE, ROUTES } from '../utils/constants'
import './Home.css'

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
              Get Started
            </Button>
            <Button
              variant="secondary"
              onClick={() => navigate(ROUTES.PRIORITY)}
            >
              I need to talk to someone now
            </Button>
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
