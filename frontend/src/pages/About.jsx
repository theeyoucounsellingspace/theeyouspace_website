import React from 'react'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '../utils/constants'
import './About.css'

const WHATSAPP = import.meta.env.VITE_WHATSAPP_LINK || 'https://wa.me/917358154022'
const EMAIL = import.meta.env.VITE_CONTACT_EMAIL || 'theeyoucounsellingspace@gmail.com'
const PHONE = '+91 73581 54022'

function About() {
    const navigate = useNavigate()

    return (
        <div className="about-page">

            {/* Back */}
            <button className="about-back" onClick={() => navigate(ROUTES.HOME)} aria-label="Back to home">
                ←
            </button>

            {/* ── Hero ───────────────────────────────────────────── */}
            <section className="about-hero">
                <h1 className="about-heading">Sometimes, life gets heavy.</h1>
                <p className="about-lead">
                    Emotions become difficult to name. Relationships feel strained.
                    The pressure of daily responsibilities leaves little room to pause and breathe.
                    Thee You Space exists for exactly those moments — to offer a space that is
                    safe, structured, and genuinely supportive.
                </p>
            </section>

            {/* ── Who we are ─────────────────────────────────────── */}
            <section className="about-section">
                <h2 className="about-section-title">Who we are</h2>
                <p className="about-body">
                    We are a collective of Counseling Psychologists with postgraduate training in
                    Applied Psychology, founded by{' '}
                    <strong>Mohammed Muhaiyadeen M</strong>,{' '}
                    <strong>Abijith KB</strong>,{' '}
                    <strong>Jeevan KJ</strong>, and{' '}
                    <strong>Leaskar Paulraj DJ</strong> — four colleagues who graduated together
                    and chose to build something meaningful with what they learned.
                </p>
                <p className="about-body">
                    Our practice is built on a simple but firm belief: every person, regardless
                    of age, background, or circumstance, deserves access to ethical and empathetic
                    psychological support.
                </p>
            </section>

            {/* ── What we believe ────────────────────────────────── */}
            <section className="about-section about-section--belief">
                <blockquote className="about-quote">
                    "Therapy, at its core, is not about correcting who you are.
                    It is about understanding where you are — and finding, at your own pace,
                    where you would like to be."
                </blockquote>
                <p className="about-body">
                    We integrate evidence-based therapeutic frameworks with genuine human presence.
                    Every session is guided by professional integrity, confidentiality, and deep
                    respect for your individual experience. You will not be judged here. You will be heard.
                </p>
            </section>

            {/* ── Who we support ─────────────────────────────────── */}
            <section className="about-section">
                <h2 className="about-section-title">Who we support</h2>
                <ul className="about-support-list">
                    <li>School students navigating academic and emotional challenges</li>
                    <li>Persons with disabilities</li>
                    <li>Working professionals managing stress and burnout</li>
                    <li>Families working through complex dynamics</li>
                    <li>Anyone who simply needs a safe place to talk</li>
                </ul>
                <p className="about-body">Whatever brings you here, we meet you where you are.</p>
            </section>

            {/* ── Our commitment ─────────────────────────────────── */}
            <section className="about-section">
                <h2 className="about-section-title">Our commitment to you</h2>
                <p className="about-body">
                    At Thee You Space, your wellbeing is not a problem to be solved — it is a
                    journey to be supported. We provide a confidential, professionally governed
                    environment where growth happens gradually, meaningfully, and on your terms.
                </p>
                <p className="about-body about-tagline">When you are ready, we are here.</p>
            </section>

            {/* ── Contact ─────────────────────────────────────────── */}
            <section className="about-section about-contact">
                <h2 className="about-section-title">Get in touch</h2>
                <p className="about-body">
                    For queries, session rescheduling, or general support:
                </p>
                <div className="contact-items">
                    <a className="contact-item" href={`tel:${PHONE.replace(/\s/g, '')}`}>
                        <span className="contact-icon" aria-hidden="true">📞</span>
                        <span>{PHONE}</span>
                    </a>
                    <a className="contact-item" href={`mailto:${EMAIL}`}>
                        <span className="contact-icon" aria-hidden="true">✉️</span>
                        <span>{EMAIL}</span>
                    </a>
                </div>

                {/* ── WhatsApp express — separate, subtler section ── */}
                <div className="contact-express">
                    <p className="contact-express-heading">Need a faster response?</p>
                    <p className="contact-express-body">
                        If you're in a place where waiting feels difficult, you can send us a message
                        on WhatsApp. We'll get back to you as quickly as we can.
                        Priority and express sessions are available — a separate arrangement applies.
                    </p>
                    <a
                        className="contact-express-link"
                        href={WHATSAPP}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Message us on WhatsApp for express support"
                    >
                        <span aria-hidden="true">↗</span> Message us on WhatsApp
                    </a>
                </div>
            </section>

            {/* ── Disclaimer ──────────────────────────────────────── */}
            <section className="about-disclaimer">
                <p>
                    <strong>Professional service notice:</strong> Sessions at Thee You Space are provided
                    voluntarily by you and conducted by trained Counseling Psychologists. This is an
                    outpatient counselling service and is <strong>not a substitute for emergency psychiatric
                        care</strong>. If you or someone you know is in immediate danger, please contact a
                    national helpline (iCall: <a href="tel:9152987821">9152987821</a>) or visit
                    your nearest emergency room.
                </p>
            </section>

            {/* ── CTA ─────────────────────────────────────────────── */}
            <div className="about-cta">
                <button className="about-cta-btn" onClick={() => navigate(ROUTES.TRIAGE)}>
                    Book a session
                </button>
            </div>

        </div>
    )
}

export default About
