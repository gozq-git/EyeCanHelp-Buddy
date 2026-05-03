import React from 'react'

export default function EyeLogoSVG({ size = 40 }) {
  const id = `eyeGrad_${size}`
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1565C0" />
          <stop offset="100%" stopColor="#3B6EF8" />
        </linearGradient>
      </defs>
      {/* Outer chat bubble ellipse */}
      <ellipse cx="50" cy="45" rx="44" ry="34" stroke={`url(#${id})`} strokeWidth="5" fill="none" />
      {/* Speech bubble tail */}
      <path d="M22 74 Q12 88 6 94 Q18 85 28 76" fill={`url(#${id})`} />
      {/* Inner eye oval */}
      <ellipse cx="50" cy="45" rx="26" ry="17" stroke={`url(#${id})`} strokeWidth="4" fill="none" />
      {/* Iris */}
      <circle cx="50" cy="45" r="9" fill={`url(#${id})`} />
      {/* Pupil highlight */}
      <circle cx="54" cy="42" r="3" fill="white" opacity="0.7" />
    </svg>
  )
}
