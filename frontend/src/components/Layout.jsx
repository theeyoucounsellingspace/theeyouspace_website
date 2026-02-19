import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { APP_NAME, ROUTES } from '../utils/constants'
import './Layout.css'

function Layout({ children }) {
  const location = useLocation()
  const isHomePage = location.pathname === ROUTES.HOME

  return (
    <div className="layout">
      {/* Only show header on non-home pages */}
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
      <footer className="layout-footer">
        <div className="layout-container">
          <p className="footer-text">
            <Link to={ROUTES.SAFETY}>Safety & Terms</Link>
          </p>
        </div>
      </footer>
    </div>
  )
}

export default Layout
