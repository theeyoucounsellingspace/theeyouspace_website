import React from 'react'
import './CalmContainer.css'

function CalmContainer({
  children,
  centered = false,
  maxWidth = '600px',
  className = '',
  ...props
}) {
  const style = {
    maxWidth,
    margin: centered ? '0 auto' : '0',
    width: '100%',
  }

  const classes = `calm-container ${className}`.trim()

  return (
    <div className={classes} style={style} {...props}>
      {children}
    </div>
  )
}

export default CalmContainer
