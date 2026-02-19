import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Triage from './pages/Triage'
import Matching from './pages/Matching'
import Schedule from './pages/Schedule'
import DetailsPayment from './pages/DetailsPayment'
import Confirmation from './pages/Confirmation'
import Priority from './pages/Priority'
import Safety from './pages/Safety'
import About from './pages/About'
import ScrollToTop from './components/ScrollToTop'
import { ROUTES } from './utils/constants'

function App() {
  return (
    <Router>
      <ScrollToTop />
      <Layout>
        <Routes>
          <Route path={ROUTES.HOME} element={<Home />} />
          <Route path={ROUTES.TRIAGE} element={<Triage />} />
          <Route path={ROUTES.MATCHING} element={<Matching />} />
          <Route path={ROUTES.SCHEDULE} element={<Schedule />} />
          <Route path={ROUTES.DETAILS_PAYMENT} element={<DetailsPayment />} />
          <Route path={ROUTES.CONFIRMATION} element={<Confirmation />} />
          <Route path={ROUTES.PRIORITY} element={<Priority />} />
          <Route path={ROUTES.SAFETY} element={<Safety />} />
          <Route path={ROUTES.ABOUT} element={<About />} />
        </Routes>
      </Layout>
    </Router>
  )
}

export default App
