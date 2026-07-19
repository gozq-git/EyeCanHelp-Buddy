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

// Labels match the source form verbatim (note "Eyelea"); aliases cover the
// clinical spellings we may receive in record_medication.
const MED_OPTIONS = [
  { label: 'Lucentis', aliases: ['lucentis', 'ranibizumab'] },
  { label: 'Avastin', aliases: ['avastin', 'bevacizumab'] },
  { label: 'Eyelea', aliases: ['eyelea', 'eylea', 'aflibercept'] },
  { label: 'Others', aliases: [] },
]

const black = '#1a1a1a'

function CB({ checked, label }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: black, pointerEvents: 'none', userSelect: 'none', marginBottom: '6px' }}>
      <input
        type="checkbox"
        checked={!!checked}
        readOnly
        style={{ width: '15px', height: '15px', margin: 0, flexShrink: 0, pointerEvents: 'none', accentColor: black }}
      />
      {label}
    </label>
  )
}

export default function PostIvtAdviceForm({ formData }) {
  const diagnosis = formData?.record_diagnosis || 'H35.31'
  const condition = DIAGNOSIS_MAP[diagnosis] || diagnosis
  const eye = EYE_MAP[formData?.record_eyes] || null
  const medication = formData?.record_medication || 'Eylea (Aflibercept)'
  const date = formData?.issued
    ? new Date(formData.issued).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })

  const medLower = medication.toLowerCase()
  const activeMed = (MED_OPTIONS.find(o => o.aliases.some(a => medLower.includes(a))) || MED_OPTIONS.at(-1)).label

  const underlineFill = { textDecoration: 'underline', fontWeight: 700 }

  return (
    <div style={{
      border: '1px solid #bbb',
      borderRadius: '8px',
      padding: '18px 20px',
      background: '#fff',
      color: black,
      fontFamily: '"Times New Roman", Georgia, serif',
      fontSize: '12px',
      lineHeight: '1.5',
    }}>
      {/* Letterhead — NHG Eye Institute + Tan Tock Seng Hospital logos, cropped
          from the source form image (700x904) which has a thin black page frame
          on every edge. We show only source rect x:[8,692], y:[34,94] so the
          top and left/right frame lines are cropped out.
          Knobs (source px): L/R = 8/692 (→ Wv 684), T = 34, band height 60.
          Percentages are width-relative (margin %s resolve against width), so
          the crop scales with the card. */}
      <div style={{ width: '100%', aspectRatio: '684 / 60', overflow: 'hidden', marginBottom: '12px' }}>
        <img
          src="/postivt-letterhead.png"
          alt="National Healthcare Group Eye Institute and Tan Tock Seng Hospital"
          style={{ width: '102.34%', display: 'block', marginLeft: '-1.17%', marginTop: '-4.97%' }}
        />
      </div>

      <h2 style={{ fontSize: '14px', fontWeight: 700, textDecoration: 'underline', margin: '0 0 14px' }}>
        POST INTRAVITREAL INJECTION INFORMATION SHEET
      </h2>

      {/* You have: */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ marginBottom: '8px' }}>You have:</div>
        <div style={{ paddingLeft: '40px' }}>
          {ALL_CONDITIONS.map(c => (
            <CB key={c} checked={c === condition} label={c} />
          ))}
        </div>
      </div>

      {/* Injection details */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ marginBottom: '6px' }}>You have received an injection into your eye:</div>
        <div style={{ display: 'flex', gap: '20px', paddingLeft: '0' }}>
          <span>Intravitreal</span>
          <span>
            {MED_OPTIONS.map((med, i) => (
              <span key={med.label}>
                {i > 0 && ' / '}
                <span style={med.label === activeMed ? underlineFill : {}}>{med.label}</span>
              </span>
            ))}
            {'  '}<span style={{ borderBottom: `1px solid ${black}`, display: 'inline-block', minWidth: '120px' }}>&nbsp;</span>
          </span>
        </div>
        <div style={{ paddingLeft: '92px', marginTop: '6px' }}>
          <span style={(eye === 'Right' || eye === 'Both') ? underlineFill : {}}>Right</span>
          {' / '}
          <span style={(eye === 'Left' || eye === 'Both') ? underlineFill : {}}>Left</span>
          {' eye on '}
          <span style={{ borderBottom: `1px solid ${black}`, display: 'inline-block', minWidth: '220px', fontWeight: 700, textAlign: 'center' }}>
            {date}
          </span>
        </div>
      </div>

      {/* Normal side effects */}
      <div style={{ marginBottom: '14px' }}>
        <div>It is normal to experience mild side effects such as:</div>
        <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
          <li>Eye discomfort</li>
          <li>Superficial bleeding (subconjunctival hemorrhage)</li>
          <li>Floaters (due to small air bubbles)</li>
        </ul>
      </div>

      {/* Warning symptoms — black, matching the form (not red) */}
      <div style={{ marginBottom: '14px' }}>
        <div>However, if you have:</div>
        <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
          <li>Eye pain</li>
          <li>Increased blurring of vision</li>
          <li>Increasing eye redness</li>
          <li>Light sensitivity</li>
          <li>Numbness or weakness of your limbs</li>
          <li>Chest pain or chest tightness</li>
        </ul>
      </div>

      {/* Contact — single bordered box, office- then after-hours stacked */}
      <div style={{ marginBottom: '4px' }}>
        You should <span style={{ textDecoration: 'underline' }}>immediately</span> contact:
      </div>
      <div style={{ border: `1px solid ${black}`, padding: '12px 16px' }}>
        <div>During office hours (8:30am to 5:30pm, weekdays):</div>
        <ul style={{ margin: '4px 0 12px 18px', padding: 0 }}>
          <li>Please call <strong>81263632</strong></li>
        </ul>
        <div>After office hours (including weekends and public holidays):</div>
        <ul style={{ margin: '4px 0 8px 18px', padding: 0 }}>
          <li>Call eye doctor on call via TTSH operator at <strong>6256 6011</strong> OR</li>
          <li>Walk in to TTSH Emergency Department<br />(together with this information sheet at)</li>
        </ul>
        <div style={{ paddingLeft: '40px', lineHeight: '1.5' }}>
          Tan Tock Seng Hospital<br />
          Basement 1<br />
          11 Jalan Tan Tock Seng<br />
          Singapore 308433
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '10px', color: '#555' }}>
        <span>03 July 2015</span>
        <span>MEC-MEY-155-03</span>
      </div>
    </div>
  )
}
