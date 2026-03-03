import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '../utils/constants'
import leaskarPhoto from '../assets/team/leaskar.jpg'
import jeevanPhoto from '../assets/team/jeevan.png'
import abijithPhoto from '../assets/team/abijith.png'
import mohammedPhoto from '../assets/team/mohammed.jpg'
import './About.css'

const WHATSAPP = import.meta.env.VITE_WHATSAPP_LINK || 'https://wa.me/917358154022'
const EMAIL = import.meta.env.VITE_CONTACT_EMAIL || 'theeyoucounsellingspace@gmail.com'
const PHONE = '+91 73581 54022'

// ── Team data (4 Founders) ──────────────────────────────────────────────────
const TEAM = [
    {
        name: 'Jeevan KJ',
        role: 'Counselling Psychologist',
        exp: '2+ yrs exp',
        languages: 'Tamil, English',
        areas: ['School Counseling', 'Career Guidance'],
        approach: ['Person-Centered Support', 'Strengths-Based Career Mapping'],
        photo: jeevanPhoto,
    },
    {
        name: 'Leaskar Paulraj DJ',
        role: 'Counselling Psychologist',
        exp: '2+ yrs exp',
        languages: 'Tamil, English',
        areas: ['Family Concerns', 'Disability Coping', 'General Stress'],
        approach: ['CBT', 'PCT', 'Family Counselling'],
        photo: leaskarPhoto,
    },
    {
        name: 'Abijith KB',
        role: 'Counselling Psychologist',
        exp: '2+ yrs exp',
        languages: 'Tamil, Malayalam, English',
        areas: ['Work Stress', 'Work-Life Balance', 'Relationships', 'Academics'],
        approach: ['CBT', 'Person-Centered Therapy', 'Psychoanalytic Therapy'],
        photo: abijithPhoto,
    },
    {
        name: 'Mohammed Muhaiyadeen M',
        role: 'Counselling Psychologist',
        exp: '2+ yrs exp',
        languages: 'Tamil, English',
        areas: ['Relationships', 'Identity', 'Work Stress', 'Academics', 'Professional Growth', 'Anxiety', 'Grief'],
        approach: ['CBT', 'Person-Centered Therapy', 'Couple Counselling'],
        photo: mohammedPhoto,
    },
]

// Deterministic initials avatar colours — one per person, stable
const AVATAR_GRADIENTS = [
    'linear-gradient(135deg, #7A9E87 0%, #A6C4AD 100%)',
    'linear-gradient(135deg, #9E8AB8 0%, #BEB0D4 100%)',
    'linear-gradient(135deg, #C4975A 0%, #E2BC88 100%)',
    'linear-gradient(135deg, #7B9EAE 0%, #A8C3CF 100%)',
    'linear-gradient(135deg, #B8849A 0%, #D4A9BB 100%)',
]

function TeamCard({ member, index }) {
    const [expanded, setExpanded] = useState(false)
    const initials = member.name.split(' ').slice(0, 2).map(w => w[0]).join('')
    const gradient = AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length]

    return (
        <div className={`team-card ${expanded ? 'team-card--open' : ''}`}>
            {/* Top row */}
            <div className="team-card-top">
                {/* Avatar / Photo */}
                <div className="team-avatar" style={{ background: member.photo ? 'transparent' : gradient }}>
                    {member.photo
                        ? <img src={member.photo} alt={member.name} className="team-avatar-img" />
                        : <span className="team-avatar-initials">{initials}</span>
                    }
                </div>

                {/* Identity */}
                <div className="team-identity">
                    <h3 className="team-name">{member.name}</h3>
                    <p className="team-role">{member.role} · {member.exp}</p>
                    <p className="team-lang">🗣 {member.languages}</p>
                </div>

                {/* Expand toggle */}
                <button
                    className="team-toggle"
                    onClick={() => setExpanded(e => !e)}
                    aria-expanded={expanded}
                    aria-label={`${expanded ? 'Collapse' : 'Expand'} ${member.name}'s profile`}
                >
                    <span className="team-toggle-icon">{expanded ? '−' : '+'}</span>
                </button>
            </div>

            {/* Area chips — always visible */}
            <div className="team-areas">
                {member.areas.map(a => (
                    <span key={a} className="team-chip">{a}</span>
                ))}
            </div>

            {/* Expanded: Approach */}
            {expanded && (
                <div className="team-approach">
                    <p className="team-approach-label">Therapeutic approach</p>
                    <div className="team-approach-tags">
                        {member.approach.map(a => (
                            <span key={a} className="team-approach-tag">{a}</span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

function About() {
    const navigate = useNavigate()

    return (
        <div className="about-page">

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

            {/* ── Meet the team ───────────────────────────────────── */}
            <section className="about-section">
                <h2 className="about-section-title">Meet the team</h2>
                <p className="about-body" style={{ marginBottom: '1.75rem' }}>
                    Each of our professionals brings a distinct perspective and a shared commitment to
                    ethical, empathetic care. Tap any card to learn about their approach.
                </p>
                <div className="team-grid">
                    {TEAM.map((member, i) => (
                        <TeamCard key={member.name} member={member} index={i} />
                    ))}
                </div>
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
                        care</strong>. If you or someone you know is in immediate danger, please visit
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
