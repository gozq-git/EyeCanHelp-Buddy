import React, { useState } from 'react'
import { getEpicPatient, getEpicRecord } from '../api/client'

const CARD_STYLE = {
  background: '#fff',
  border: '1px solid #e0e0e0',
  borderRadius: '8px',
  padding: '16px',
  marginBottom: '16px',
}

const LABEL_STYLE = { fontWeight: 600, color: '#555', fontSize: '13px', marginBottom: '2px' }
const VALUE_STYLE = { fontSize: '15px', color: '#222', marginBottom: '12px' }

function Field({ label, value }) {
  return (
    <div>
      <div style={LABEL_STYLE}>{label}</div>
      <div style={VALUE_STYLE}>{value ?? '—'}</div>
    </div>
  )
}

function Badge({ value, trueLabel = 'Yes', falseLabel = 'No' }) {
  const active = Boolean(value)
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: '12px',
      fontSize: '13px',
      fontWeight: 600,
      background: active ? '#e8f5e9' : '#ffebee',
      color: active ? '#2e7d32' : '#c62828',
    }}>
      {active ? trueLabel : falseLabel}
    </span>
  )
}

const EYE_LABEL = { OD: 'Right Eye (OD)', OS: 'Left Eye (OS)', OU: 'Both Eyes (OU)' }

export default function EpicLookup() {
  const [patientId, setPatientId] = useState('')
  const [patient, setPatient] = useState(null)
  const [record, setRecord] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLookup = async (e) => {
    e.preventDefault()
    const id = patientId.trim()
    if (!id) return
    setLoading(true)
    setError('')
    setPatient(null)
    setRecord(null)
    try {
      const [patientRes, recordRes] = await Promise.all([
        getEpicPatient(id),
        getEpicRecord(id),
      ])
      setPatient(patientRes.data)
      setRecord(recordRes.data)
    } catch {
      setError('Patient not found or EPIC service unavailable.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: '700px', margin: '40px auto', padding: '24px' }}>
      <h2 style={{ marginTop: 0, color: '#0066cc' }}>UC1 — EPIC Patient Lookup</h2>

      <form onSubmit={handleLookup} style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        <input
          value={patientId}
          onChange={(e) => setPatientId(e.target.value)}
          placeholder="Enter Patient ID (e.g. P001)"
          style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '14px' }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{ padding: '10px 20px', background: '#0066cc', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
        >
          {loading ? 'Looking up...' : 'Lookup'}
        </button>
      </form>

      {error && <p style={{ color: '#c62828' }}>{error}</p>}

      {patient && (
        <div style={CARD_STYLE}>
          <h3 style={{ marginTop: 0, color: '#333', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            FHIR Patient — {patient.resourceType}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
            <Field label="Patient ID" value={patient.patient_id} />
            <Field label="Name" value={patient.patient_name} />
            <Field label="Date of Birth" value={patient.patient_dob} />
            <Field label="Phone Number" value={patient.phone_number} />
          </div>
        </div>
      )}

      {record && (
        <div style={CARD_STYLE}>
          <h3 style={{ marginTop: 0, color: '#333', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            FHIR DiagnosticReport — {record.resourceType}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
            <Field label="Diagnosis (ICD-10)" value={record.record_diagnosis} />
            <Field label="Target Eye" value={EYE_LABEL[record.record_eyes] ?? record.record_eyes} />
            <Field label="Number of Injections" value={record.record_number_of_injections} />
            <div>
              <div style={LABEL_STYLE}>Consent Valid</div>
              <div style={{ marginBottom: '12px' }}>
                <Badge value={record.validity_of_consent} trueLabel="Valid" falseLabel="Invalid" />
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid #e0e0e0', paddingTop: '12px', marginTop: '4px' }}>
            <div style={{ ...LABEL_STYLE, marginBottom: '10px' }}>Medical History Flags</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {[
                ['Admitted (last 3 months)', record.last3mths_admission],
                ['Stroke / Heart Attack (last 6 months)', record.stroke_heartAtt_last6mths],
                ['Taking Antibiotics', record.taking_antibiotics],
                ['Pregnant', record.pregnant],
              ].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Badge value={val} />
                  <span style={{ fontSize: '13px', color: '#444' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
