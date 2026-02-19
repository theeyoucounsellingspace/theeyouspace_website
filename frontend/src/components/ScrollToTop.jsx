import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * ScrollToTop component
 * Scrolls window to top on every route change
 */
function ScrollToTop() {
    const { pathname } = useLocation()

    useEffect(() => {
        // Force scroll to top on route change
        // Use setTimeout to ensure DOM is ready
        setTimeout(() => {
            window.scrollTo(0, 0)
        }, 0)
    }, [pathname])

    return null
}

export default ScrollToTop
