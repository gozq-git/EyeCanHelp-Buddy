import React from 'react'

function CB({ checked, label }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', pointerEvents: 'none', userSelect: 'none', marginBottom: '3px' }}>
      <input type="checkbox" checked={!!checked} readOnly style={{ margin: 0, pointerEvents: 'none' }} />
      {label}
    </label>
  )
}

const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })

export default function PostOpChecklistDoc() {
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
          <CB checked={true} label="Age-related macular degeneration" />
          <CB checked={false} label="Other causes of macular degeneration" />
          <CB checked={false} label="Macular edema" />
        </div>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <strong>You have received an injection into your: Intravitreal</strong>
        <div style={{ marginTop: '4px' }}>
          Lucentis / <span style={{ textDecoration: 'underline', fontWeight: 600, color: '#1565C0' }}>Faricimab</span> / Eylea / Others
        </div>
        <div>
          <span style={{ textDecoration: 'underline', fontWeight: 600, color: '#1565C0' }}>Right</span> / Left eye on{' '}
          <span style={{ textDecoration: 'underline', fontWeight: 600, color: '#1565C0' }}>{today}</span>
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
