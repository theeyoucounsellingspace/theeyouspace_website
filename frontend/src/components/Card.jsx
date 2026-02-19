import React from 'react'

function Card({ 
  children, 
  selected = false, 
  onClick,
  className = '',
  ...props 
}) {
  const baseClass = 'card'
  const selectedClass = selected ? 'card-selected' : ''
  const classes = `${baseClass} ${selectedClass} ${className}`.trim()

  const Component = onClick ? 'button' : 'div'
  
  return (
    <Component
      className={classes}
      onClick={onClick}
      {...props}
    >
      {children}
    </Component>
  )
}

export default Card
