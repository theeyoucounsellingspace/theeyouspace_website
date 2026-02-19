import React from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../components/Button'
import CalmContainer from '../components/CalmContainer'
import { ROUTES } from '../utils/constants'
import './About.css'

const TEAM_MEMBERS = [
    {
        name: 'Mohammed Muhaiyadeen M',
        title: 'Counseling Psychologist',
        specialization: 'CBT, Person-Centered Therapy, and Couple Counselling',
        focus: 'Supports clients with relationships, academics, and professional growth, focusing on clarity, balance, and sustainable change.',
    },
    {
        name: 'Leasker Paulraj DJ',
        title: 'Counseling Psychologist',
        specialization: 'CBT, Person-Centered Therapy, and Family Counselling',
        focus: 'Works with family concerns, coping with disability, and general stress through structured, compassionate care.',
    },
    {
        name: 'Jeevan KJ',
        title: 'Counseling Psychologist',
        specialization: 'School Counseling and Career Guidance',
        focus: 'Uses person-centered support and strengths-based career mapping to help individuals build confidence and direction.',
    },
    {
        name: 'Abijith KB',
        title: 'Counseling Psychologist',
        specialization: 'CBT and Person-Centered Therapy',
        focus: 'Supports working professionals and students in navigating academic and professional challenges with clarity and purpose.',
    },
]

function About() {
    const navigate = useNavigate()

    return (
        <CalmContainer>
            <div className="about">
                <div className="about-header">
                    <h2 className="about-title">About Thee You Space</h2>
                </div>

                <div className="about-content">
                    <p className="about-intro">
                        Thee You Space is a collective of trained Counseling Psychologists committed to providing compassionate, evidence-based mental health care.
                    </p>

                    <p className="about-text">
                        Founded by four friends who graduated with a Master's degree in Applied Psychology — <strong>Mohammed Muhaiyadeen M</strong>, <strong>Abijith KB</strong>, <strong>Jeevan KJ</strong>, and <strong>Leasker Paulraj DJ</strong> — our journey began with a shared belief: everyone deserves access to ethical, empathetic, and meaningful psychological support.
                    </p>

                    <p className="about-text">
                        Rooted in scientific practice and human connection, we create a safe, confidential space where individuals can explore challenges, build resilience, and move toward clarity and emotional wellbeing.
                    </p>

                    <div className="about-services">
                        <h3>Our team supports:</h3>
                        <ul className="about-list">
                            <li>School students</li>
                            <li>Persons with disabilities</li>
                            <li>Working professionals</li>
                            <li>Families</li>
                        </ul>
                    </div>

                    <p className="about-text">
                        We work across emotional wellbeing, academic concerns, workplace stress, relationships, and family dynamics — offering personalized care guided by proven therapeutic approaches.
                    </p>

                    <div className="about-philosophy">
                        <p>
                            At Thee You Space, therapy is not about fixing — it's about understanding, growth, and empowerment.
                        </p>
                    </div>
                </div>

                <div className="about-team">
                    <h3 className="team-title">Meet Our Team</h3>
                    <div className="team-grid">
                        {TEAM_MEMBERS.map((member, index) => (
                            <div key={index} className="team-member">
                                <h4 className="member-name">{member.name}</h4>
                                <p className="member-title">{member.title}</p>
                                <p className="member-specialization">
                                    <strong>Specializes in:</strong> {member.specialization}
                                </p>
                                <p className="member-focus">{member.focus}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="about-actions">
                    <Button variant="primary" onClick={() => navigate(ROUTES.TRIAGE)}>
                        Book a session
                    </Button>
                    <Button variant="secondary" onClick={() => navigate(ROUTES.HOME)}>
                        Back to home
                    </Button>
                </div>
            </div>
        </CalmContainer>
    )
}

export default About
