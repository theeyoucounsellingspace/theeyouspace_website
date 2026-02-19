import React from 'react'

function ProgressDots({ 
  current = 0, 
  total = 3,
  className = '',
  ...props 
}) {
  return (
    <div className={`progress-dots ${className}`.trim()} {...props}>
      {Array.from({ length: total }).map((_, index) => (
        <div
          key={index}
          className={`progress-dot ${index === current ? 'progress-dot-active' : ''}`}
        />
      ))}
    </div>
  )
}

export default ProgressDots
