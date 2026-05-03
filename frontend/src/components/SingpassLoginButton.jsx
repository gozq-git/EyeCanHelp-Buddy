import React, { useState } from 'react'

export default function SingpassLoginButton({ onLogin }) {
  const [loading, setLoading] = useState(false)

  const handleClick = () => {
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      onLogin()
    }, 600)
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      style={{
        width: '100%',
        height: '50px',
        background: '#F5A623',
        border: 'none',
        borderRadius: '24px',
        cursor: loading ? 'not-allowed' : 'pointer',
        fontSize: '16px',
        fontWeight: 700,
        color: '#D63C2A',
        opacity: loading ? 0.75 : 1,
        transition: 'opacity 0.2s',
        fontFamily: 'inherit',
      }}
    >
      {loading ? 'Logging in…' : 'Singpass Login'}
    </button>
  )
}
