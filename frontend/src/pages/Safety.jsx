import React from 'react'
import CalmContainer from '../components/CalmContainer'
import './Safety.css'

function Safety() {
  return (
    <CalmContainer>
      <div className="safety">
        <h2 className="safety-title">Safety & Terms</h2>
        
        <section className="safety-section">
          <h3 className="section-title">Your Safety</h3>
          <p className="section-text">
            Your wellbeing is our priority. If you're experiencing a mental health emergency or having thoughts of self-harm, please contact emergency services immediately.
          </p>
          <p className="section-text">
            Our sessions are designed to provide support and guidance, but they are not a substitute for emergency medical care.
          </p>
        </section>

        <section className="safety-section">
          <h3 className="section-title">Confidentiality</h3>
          <p className="section-text">
            What you share in our sessions is confidential. We respect your privacy and are committed to creating a safe space for you to express yourself.
          </p>
          <p className="section-text">
            There are legal limits to confidentiality, such as situations involving imminent harm to yourself or others, which we would discuss with you if they arise.
          </p>
        </section>

        <section className="safety-section">
          <h3 className="section-title">Cancellation Policy</h3>
          <p className="section-text">
            We understand that life happens. If you need to reschedule or cancel your session, please let us know at least 24 hours in advance.
          </p>
          <p className="section-text">
            Cancellations made less than 24 hours before your session may be subject to a cancellation fee.
          </p>
        </section>

        <section className="safety-section">
          <h3 className="section-title">Contact</h3>
          <p className="section-text">
            If you have questions or concerns, please reach out to us. We're here to help.
          </p>
        </section>
      </div>
    </CalmContainer>
  )
}

export default Safety
