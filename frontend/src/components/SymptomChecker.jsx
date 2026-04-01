import React, { useState } from 'react'
import { assessSymptoms } from '../api/client'

const SEVERITY_COLOR = {
  mild: '#2e7d32',
  severe: '#c62828',
  unclear: '#e65100',
}

export default function SymptomChecker() {
  const [patientId, setPatientId] = useState('')
  const [symptoms, setSymptoms] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!patientId.trim() || !symptoms.trim()) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await assessSymptoms(patientId.trim(), symptoms.trim())
      setResult(res.data)
    } catch {
      setError('Failed to assess symptoms. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: '600px', margin: '40px auto', padding: '24px', background: '#fff', borderRadius: '12px', boxShadow: '0 2px 12px rgba(0,0,0,0.1)' }}>
      <h2 style={{ marginTop: 0, color: '#0066cc' }}>Post-Injection Symptom Checker</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600 }}>Patient ID</label>
          <input
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            placeholder="e.g. P001"
            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '14px', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600 }}>Describe your symptoms</label>
          <textarea
            value={symptoms}
            onChange={(e) => setSymptoms(e.target.value)}
            placeholder="e.g. I have mild discomfort and tearing in my eye"
            rows={4}
            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '14px', resize: 'vertical', boxSizing: 'border-box' }}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          style={{ padding: '10px 24px', background: '#0066cc', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
        >
          {loading ? 'Checking...' : 'Check Symptoms'}
        </button>
      </form>

      {error && <p style={{ color: '#c62828', marginTop: '16px' }}>{error}</p>}

      {result && (
        <div style={{ marginTop: '24px', padding: '16px', borderRadius: '8px', background: '#f5f5f5', borderLeft: `4px solid ${SEVERITY_COLOR[result.severity]}` }}>
          <p style={{ margin: '0 0 8px', fontWeight: 700, color: SEVERITY_COLOR[result.severity], textTransform: 'uppercase', fontSize: '13px' }}>
            {result.severity} symptoms
          </p>
          <p style={{ margin: 0, lineHeight: 1.6 }}>{result.advice}</p>
        </div>
      )}
    </div>
  )
}
