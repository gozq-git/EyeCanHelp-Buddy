import React from 'react'

const DIAGNOSIS_MAP = {
  'H35.31': 'Age-related macular degeneration',
  'H36.0':  'Macular edema',
  'H34.8':  'Other causes of macular degeneration',
}

const EYE_MAP = { OD: 'Right', OS: 'Left', OU: 'Both' }

const ALL_CONDITIONS = [
  'Age-related macular degeneration',
  'Other causes of macular degeneration',
  'Macular edema',
]

function CB({ checked, label }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', pointerEvents: 'none', userSelect: 'none', marginBottom: '3px' }}>
      <input type="checkbox" checked={!!checked} readOnly style={{ margin: 0, pointerEvents: 'none' }} />
      {label}
    </label>
  )
}

export default function PostOpChecklistDoc({ formData }) {
  const diagnosis = formData?.record_diagnosis || 'H35.31'
  const condition = DIAGNOSIS_MAP[diagnosis] || diagnosis
  const eye = EYE_MAP[formData?.record_eyes] || null
  const medication = formData?.record_medication || 'Faricimab (Vabysmo)'
  const date = formData?.issued
    ? new Date(formData.issued).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })

  const MED_OPTIONS = ['Lucentis', 'Faricimab', 'Eylea', 'Others']
  const activeMed = MED_OPTIONS.find(m => medication.toLowerCase().includes(m.toLowerCase())) || 'Others'

  return (
    <div style={{
      border: '1px solid #bbb',
      borderRadius: '8px',
      padding: '14px',
      background: '#fff',
      fontFamily: 'Arial, sans-serif',
      fontSize: '11px',
      lineHeight: '1.6',
    }}>
      <div style={{ textAlign: 'center', color: '#D32F2F', fontWeight: 700, fontSize: '12px', textTransform: 'uppercase' }}>
        Post Intravitreal Injection
      </div>
      <div style={{ textAlign: 'center', fontWeight: 600, fontSize: '11px', borderBottom: '1px solid #ccc', paddingBottom: '6px', marginBottom: '10px' }}>
        Advice form (filled)
      </div>

      <div style={{ marginBottom: '10px' }}>
        <strong>You have:</strong>
        <div style={{ marginTop: '4px', paddingLeft: '4px' }}>
          {ALL_CONDITIONS.map(c => (
            <CB key={c} checked={c === condition} label={c} />
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <strong>You have received an injection into your: Intravitreal</strong>
        <div style={{ marginTop: '4px' }}>
          {MED_OPTIONS.map((med, i) => (
            <span key={med}>
              {i > 0 && ' / '}
              <span style={med === activeMed ? { textDecoration: 'underline', fontWeight: 600, color: '#1565C0' } : {}}>{med}</span>
            </span>
          ))}
        </div>
        <div>
          {eye
            ? <><span style={{ textDecoration: 'underline', fontWeight: 600, color: '#1565C0' }}>{eye}</span>{eye !== 'Both' && ' eye'} on{' '}</>
            : 'Eye: _____ on '}
          <span style={{ textDecoration: 'underline', fontWeight: 600, color: '#1565C0' }}>{date}</span>
        </div>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <strong>It is normal to experience mild side effects such as:</strong>
        <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
          <li>Eye discomfort or mild eye pain</li>
          <li>Superficial bleeding (subconjunctival hemorrhage)</li>
          <li>Floaters (due to small air bubbles)</li>
        </ul>
      </div>

      <div style={{ marginBottom: '12px' }}>
        <strong style={{ color: '#D32F2F' }}>However, within 1 week of the procedure if you have:</strong>
        <ul style={{ margin: '4px 0 0 16px', padding: 0, color: '#D32F2F' }}>
          <li>Increased eye pain</li>
          <li>Increased blurring of vision</li>
          <li>Increasing eye redness</li>
          <li>Light sensitivity</li>
          <li>Numbness or weakness of your limbs</li>
          <li>Chest pain or chest tightness</li>
        </ul>
      </div>

      <strong>You should immediately contact:</strong>
      <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
        <div style={{
          flex: 1, border: '1px solid #ccc', borderRadius: '6px', padding: '10px', fontSize: '11px', lineHeight: '1.6',
        }}>
          <div>8am to 5pm on weekdays</div>
          <div>and 8am-12pm on Saturday</div>
          <div style={{ marginTop: '4px' }}>Please call</div>
          <div style={{ fontWeight: 700, fontSize: '18px', color: '#222', letterSpacing: '1px' }}>9123 4567</div>
        </div>
        <div style={{
          flex: 1, border: '1px solid #fbb', borderRadius: '6px', padding: '10px', background: '#FFEBEE', fontSize: '11px', lineHeight: '1.6',
        }}>
          <div style={{ fontWeight: 700, marginBottom: '4px' }}>After office hours</div>
          <div style={{ fontSize: '10px', color: '#555', marginBottom: '6px' }}>(Including weekends &amp; holidays):</div>
          <div>Walk in to the</div>
          <div style={{ fontWeight: 700 }}>XX Hospital</div>
          <div>Emergency Department</div>
          <div style={{ fontSize: '10px', color: '#555', marginTop: '4px' }}>(with this sheet)</div>
        </div>
      </div>
    </div>
  )
}
