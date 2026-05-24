import React, { useState } from 'react'

export default function SingpassLoginButton({ onLogin }) {
  const [patientId, setPatientId] = useState('')
  const [loading, setLoading] = useState(false)

  const handleClick = () => {
    if (!patientId.trim()) return
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      onLogin(patientId.trim().toUpperCase())
    }, 600)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <input
        value={patientId}
        onChange={e => setPatientId(e.target.value)}
        placeholder="username"
        disabled={loading}
        style={{
          width: '100%',
          padding: '10px 16px',
          borderRadius: '24px',
          border: '1px solid #E8E8E8',
          fontSize: '14px',
          fontFamily: 'inherit',
          outline: 'none',
          boxSizing: 'border-box',
          background: loading ? '#f5f5f5' : '#FAFAFA',
        }}
      />
      <button
        onClick={handleClick}
        disabled={loading || !patientId.trim()}
        style={{
          width: '100%',
          height: '50px',
          background: '#F5A623',
          border: 'none',
          borderRadius: '24px',
          cursor: loading || !patientId.trim() ? 'not-allowed' : 'pointer',
          fontSize: '16px',
          fontWeight: 700,
          color: '#D63C2A',
          opacity: loading || !patientId.trim() ? 0.75 : 1,
          transition: 'opacity 0.2s',
          fontFamily: 'inherit',
        }}
      >
        {loading ? 'Logging in…' : 'Singpass Login'}
      </button>
    </div>
  )
}
