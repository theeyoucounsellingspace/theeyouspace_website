import React, { useEffect, useState } from 'react'
import './CustomCursor.css'

function CustomCursor({ enabled = true }) {
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isVisible, setIsVisible] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    // Disable on mobile devices
    const checkMobile = () => {
      const mobile = window.matchMedia('(max-width: 768px)').matches || 
                     'ontouchstart' in window ||
                     navigator.maxTouchPoints > 0
      setIsMobile(mobile)
      return mobile
    }

    const isMobileDevice = checkMobile()
    window.addEventListener('resize', checkMobile)

    if (!enabled || isMobileDevice) {
      document.body.classList.remove('custom-cursor-enabled')
      return () => {
        document.body.classList.remove('custom-cursor-enabled')
        window.removeEventListener('resize', checkMobile)
      }
    }

    // Enable custom cursor
    document.body.classList.add('custom-cursor-enabled')

    const updateCursor = (e) => {
      setPosition({ x: e.clientX, y: e.clientY })
      setIsVisible(true)
    }

    const hideCursor = () => {
      setIsVisible(false)
    }

    window.addEventListener('mousemove', updateCursor)
    window.addEventListener('mouseenter', updateCursor)
    window.addEventListener('mouseleave', hideCursor)

    return () => {
      document.body.classList.remove('custom-cursor-enabled')
      window.removeEventListener('mousemove', updateCursor)
      window.removeEventListener('mouseenter', updateCursor)
      window.removeEventListener('mouseleave', hideCursor)
      window.removeEventListener('resize', checkMobile)
    }
  }, [enabled])

  if (!enabled || isMobile) {
    return null
  }

  return (
    <div
      className={`custom-cursor ${isVisible ? 'visible' : ''}`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
      aria-hidden="true"
    >
      <span className="cursor-letter">U</span>
    </div>
  )
}

export default CustomCursor
