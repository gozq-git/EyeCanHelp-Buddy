import React, { useState } from 'react'
import { submitAcknowledgement } from '../api/client'

const SECTION_STYLE = {
  background: '#fff',
  border: '1px solid #e0e0e0',
  borderRadius: '8px',
  padding: '20px',
  marginBottom: '20px',
}

const SECTION_TITLE = {
  marginTop: 0,
  marginBottom: '16px',
  color: '#333',
  fontSize: '14px',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

const FIELD_STYLE = { marginBottom: '14px' }
const LABEL_STYLE = { display: 'block', marginBottom: '5px', fontWeight: 600, fontSize: '13px', color: '#444' }
const INPUT_STYLE = { width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '14px', boxSizing: 'border-box' }
const SELECT_STYLE = { ...INPUT_STYLE, background: '#fff' }

function TextInput({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div style={FIELD_STYLE}>
      <label style={LABEL_STYLE}>{label}</label>
      <input type={type} value={value} onChange={onChange} placeholder={placeholder} style={INPUT_STYLE} />
    </div>
  )
}

function CheckboxField({ label, checked, onChange }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', cursor: 'pointer', fontSize: '14px', color: '#333' }}>
      <input type="checkbox" checked={checked} onChange={onChange} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
      {label}
    </label>
  )
}

const EMPTY_RECORD = {
  patient_id: '',
  record_name: '',
  record_diagnosis: '',
  record_eyes: 'OD',
  record_number_of_injections: 1,
  validity_of_consent: false,
  last3mths_admission: false,
  stroke_heartAtt_last6mths: false,
  taking_antibiotics: false,
  pregnant: false,
}

const EMPTY_PAYMENT = {
  payment_id: '',
  payment_name: '',
  payment_diagnosis: '',
  payment_maxMedisave: '',
  payment_estCostPerInjection: '',
  payment_mode: 'Medisave',
}

export default function AcknowledgementForm() {
  const [rec, setRec] = useState(EMPTY_RECORD)
  const [pay, setPay] = useState(EMPTY_PAYMENT)
  const [confirmation, setConfirmation] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const setRecField = (field) => (e) => setRec((r) => ({ ...r, [field]: e.target.value }))
  const setRecCheck = (field) => (e) => setRec((r) => ({ ...r, [field]: e.target.checked }))
  const setPayField = (field) => (e) => setPay((p) => ({ ...p, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setConfirmation(null)
    try {
      const payload = {
        patient_record: {
          ...rec,
          record_number_of_injections: parseInt(rec.record_number_of_injections, 10) || 1,
        },
        payment: {
          ...pay,
          payment_maxMedisave: parseFloat(pay.payment_maxMedisave) || 0,
          payment_estCostPerInjection: parseFloat(pay.payment_estCostPerInjection) || 0,
        },
      }
      const res = await submitAcknowledgement(payload)
      setConfirmation(res.data)
      setRec(EMPTY_RECORD)
      setPay(EMPTY_PAYMENT)
    } catch {
      setError('Submission failed. Please check all fields and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: '700px', margin: '40px auto', padding: '24px' }}>
      <h2 style={{ marginTop: 0, color: '#0066cc' }}>UC2 — Patient Acknowledgement</h2>

      {confirmation && (
        <div style={{ ...SECTION_STYLE, borderLeft: '4px solid #2e7d32', background: '#f1f8f1' }}>
          <p style={{ margin: '0 0 4px', fontWeight: 700, color: '#2e7d32' }}>Acknowledgement Submitted</p>
          <p style={{ margin: '0 0 2px', fontSize: '13px', color: '#444' }}>Record ID: <strong>{confirmation.record_id}</strong></p>
          <p style={{ margin: 0, fontSize: '13px', color: '#444' }}>Issued: {confirmation.issued}</p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Patient Record Section */}
        <div style={SECTION_STYLE}>
          <h3 style={SECTION_TITLE}>Patient Record — DiagnosticReport</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <TextInput label="Patient ID" value={rec.patient_id} onChange={setRecField('patient_id')} placeholder="e.g. P001" />
            <TextInput label="Patient Name" value={rec.record_name} onChange={setRecField('record_name')} placeholder="Full name" />
            <TextInput label="Diagnosis (ICD-10)" value={rec.record_diagnosis} onChange={setRecField('record_diagnosis')} placeholder="e.g. H35.31" />
            <div style={FIELD_STYLE}>
              <label style={LABEL_STYLE}>Target Eye</label>
              <select value={rec.record_eyes} onChange={setRecField('record_eyes')} style={SELECT_STYLE}>
                <option value="OD">Right Eye (OD)</option>
                <option value="OS">Left Eye (OS)</option>
                <option value="OU">Both Eyes (OU)</option>
              </select>
            </div>
            <TextInput label="Number of Injections" value={rec.record_number_of_injections} onChange={setRecField('record_number_of_injections')} type="number" />
          </div>

          <div style={{ borderTop: '1px solid #e0e0e0', paddingTop: '14px', marginTop: '4px' }}>
            <div style={{ ...LABEL_STYLE, marginBottom: '10px' }}>Medical History &amp; Consent</div>
            <CheckboxField label="Consent is valid" checked={rec.validity_of_consent} onChange={setRecCheck('validity_of_consent')} />
            <CheckboxField label="Hospital admission in last 3 months" checked={rec.last3mths_admission} onChange={setRecCheck('last3mths_admission')} />
            <CheckboxField label="Stroke or heart attack in last 6 months" checked={rec.stroke_heartAtt_last6mths} onChange={setRecCheck('stroke_heartAtt_last6mths')} />
            <CheckboxField label="Currently taking antibiotics" checked={rec.taking_antibiotics} onChange={setRecCheck('taking_antibiotics')} />
            <CheckboxField label="Possibly pregnant" checked={rec.pregnant} onChange={setRecCheck('pregnant')} />
          </div>
        </div>

        {/* Payment Section */}
        <div style={SECTION_STYLE}>
          <h3 style={SECTION_TITLE}>Payment — Coverage</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <TextInput label="Payment ID" value={pay.payment_id} onChange={setPayField('payment_id')} placeholder="e.g. PAY001" />
            <TextInput label="Patient Name" value={pay.payment_name} onChange={setPayField('payment_name')} placeholder="Full name" />
            <TextInput label="Diagnosis (ICD-10)" value={pay.payment_diagnosis} onChange={setPayField('payment_diagnosis')} placeholder="e.g. H35.31" />
            <div style={FIELD_STYLE}>
              <label style={LABEL_STYLE}>Payment Mode</label>
              <select value={pay.payment_mode} onChange={setPayField('payment_mode')} style={SELECT_STYLE}>
                <option value="Medisave">Medisave</option>
                <option value="Cash">Cash</option>
                <option value="MediShield">MediShield</option>
                <option value="CHAS">CHAS</option>
              </select>
            </div>
            <TextInput label="Max Medisave (SGD)" value={pay.payment_maxMedisave} onChange={setPayField('payment_maxMedisave')} type="number" placeholder="0.00" />
            <TextInput label="Est. Cost per Injection (SGD)" value={pay.payment_estCostPerInjection} onChange={setPayField('payment_estCostPerInjection')} type="number" placeholder="0.00" />
          </div>
        </div>

        {error && <p style={{ color: '#c62828' }}>{error}</p>}

        <button
          type="submit"
          disabled={loading}
          style={{ padding: '12px 28px', background: '#0066cc', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '15px', fontWeight: 600, cursor: 'pointer' }}
        >
          {loading ? 'Submitting...' : 'Submit Acknowledgement'}
        </button>
      </form>
    </div>
  )
}
