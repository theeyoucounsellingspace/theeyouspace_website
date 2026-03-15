import React from 'react';
import CalmContainer from './CalmContainer';
import Button from './Button';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught an update error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <CalmContainer centered>
          <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
            <h1 style={{ fontFamily: 'var(--font-family-serif)', marginBottom: 'var(--spacing-md)' }}>Something went quiet.</h1>
            <p style={{ color: 'var(--color-text-light)', marginBottom: 'var(--spacing-lg)' }}>
              We encountered a small ripple in the space. Don't worry, your progress is likely safe.
            </p>
            <Button variant="primary" onClick={() => window.location.href = '/'}>
              Return Home
            </Button>
            <p style={{ marginTop: 'var(--spacing-xl)', fontSize: '0.8rem', opacity: 0.5 }}>
              Ref: {this.state.error?.message || 'Unknown perturbation'}
            </p>
          </div>
        </CalmContainer>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
