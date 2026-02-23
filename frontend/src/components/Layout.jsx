import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { APP_NAME, ROUTES } from '../utils/constants'
import './Layout.css'

const EMAIL = import.meta.env.VITE_CONTACT_EMAIL || 'theeyoucounsellingspace@gmail.com'

function Layout({ children }) {
  const location = useLocation()
  const isHomePage = location.pathname === ROUTES.HOME

  return (
    <div className="layout">
      {/* Header — hidden on home page */}
      {!isHomePage && (
        <header className="layout-header">
          <div className="layout-container">
            <Link to={ROUTES.HOME} className="logo">
              {APP_NAME}
            </Link>
          </div>
        </header>
      )}

      <main className="layout-main">
        <div className="layout-container">
          {children}
        </div>
      </main>

      {/* ── Footer ─────────────────────────────────────── */}
      <footer className="layout-footer">
        <div className="layout-container footer-inner">

          {/* Disclaimer */}
          <p className="footer-disclaimer">
            Sessions at Thee You Space are conducted by trained Counseling Psychologists.
            This is an outpatient service and is <strong>not a substitute for emergency psychiatric care</strong>.
            {' '}If you are in immediate danger, call iCall:{' '}
            <a href="tel:9152987821" className="footer-link">9152987821</a>{' '}
            or visit your nearest emergency room.
          </p>

          {/* Links row */}
          <div className="footer-links">
            <Link to={ROUTES.ABOUT} className="footer-link">About</Link>
            <span className="footer-divider" aria-hidden="true">·</span>
            <Link to={ROUTES.SAFETY} className="footer-link">Safety &amp; Terms</Link>
            <span className="footer-divider" aria-hidden="true">·</span>
            <a href={`mailto:${EMAIL}`} className="footer-link">{EMAIL}</a>
          </div>

          <p className="footer-copy">
            © {new Date().getFullYear()} Thee You Space. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}

export default Layout
