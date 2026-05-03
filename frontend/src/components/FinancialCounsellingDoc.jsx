import React from 'react'

const DIAGNOSES = [
  { label: 'AMD (Exudative) H12.3', code: 'H35.31' },
  { label: 'Hemifacial Spasm Q234', code: null },
  { label: 'AMD (Other) H12.3', code: 'H35.39' },
  { label: 'Retinal Detachment H34.5', code: null },
  { label: 'CSME H45.6', code: 'H36.0' },
  { label: 'RVO (Branch) H45.6', code: 'H34.81' },
  { label: 'Diabetic + CSME F12.34', code: null },
  { label: 'RVO (Central) H45.6', code: 'H34.82' },
  { label: 'Cystoid ME H45.8', code: null },
  { label: 'Blepharospasm Q345', code: null },
  { label: 'Diabetic Maculopathy E12.34', code: null },
  { label: 'ONP E23.45', code: null },
  { label: 'DRP E34.58', code: null },
]

function CB({ checked, label }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', pointerEvents: 'none', userSelect: 'none' }}>
      <input type="checkbox" checked={!!checked} readOnly style={{ margin: 0, width: '10px', height: '10px', pointerEvents: 'none' }} />
      <span style={{ fontSize: '10px' }}>{label}</span>
    </span>
  )
}

function FlexRow({ children, gap = 10, wrap = true }) {
  return (
    <div style={{ display: 'flex', gap, flexWrap: wrap ? 'wrap' : 'nowrap', alignItems: 'center', marginBottom: '5px' }}>
      {children}
    </div>
  )
}

function Line() {
  return <div style={{ borderTop: '1px solid #ddd', margin: '6px 0' }} />
}

export default function FinancialCounsellingDoc({ formData = {} }) {
  const {
    date = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    surgeon = 'Dr. Koh CS',
    mcr = '0001231241',
    site = 'OD',
    diagnosis = 'H35.31',
    estCost = 123,
    injections = 1,
    paymentMode = 'Medisave',
  } = formData

  const isLeft = site === 'OS' || site === 'OU'
  const isRight = site === 'OD' || site === 'OU'
  const isBilat = site === 'OU'

  return (
    <div style={{
      border: '1px solid #bbb',
      borderRadius: '8px',
      padding: '12px',
      background: '#fff',
      fontFamily: 'Arial, sans-serif',
      fontSize: '10px',
      lineHeight: '1.5',
    }}>
      <div style={{ textAlign: 'center', color: '#D32F2F', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase' }}>
        Outpatient Procedures (Intravitreal)
      </div>
      <div style={{ textAlign: 'center', fontWeight: 700, fontSize: '10px', borderBottom: '1px solid #ccc', paddingBottom: '6px', marginBottom: '8px' }}>
        Financial Counselling &amp; Advice
      </div>

      <FlexRow>
        <span><strong>Nature:</strong> Medical</span>
        <span><strong>Date:</strong> <span style={{ color: '#1565C0', fontWeight: 600 }}>{date}</span></span>
      </FlexRow>
      <FlexRow>
        <span><strong>Surgeon:</strong> {surgeon}</span>
        <span><strong>MCR:</strong> {mcr}</span>
      </FlexRow>

      <FlexRow>
        <strong>Site:</strong>
        <CB checked={isLeft} label="LEFT" />
        <CB checked={isRight} label="RIGHT" />
        <CB checked={isBilat} label="BILAT" />
      </FlexRow>

      <FlexRow>
        <strong>Class:</strong>
        {['PTE', 'PTEP', 'PTRF', 'NR', 'Other'].map(c => <CB key={c} checked={false} label={c} />)}
      </FlexRow>

      <Line />

      <div style={{ fontWeight: 700, fontSize: '10px', marginBottom: '4px' }}>Diagnosis:</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px', marginBottom: '6px' }}>
        {DIAGNOSES.map(d => (
          <CB key={d.label} checked={d.code === diagnosis} label={d.label} />
        ))}
      </div>

      <Line />

      <div style={{ fontWeight: 700, marginBottom: '4px' }}>Procedure: * Intravitreal Inj (Unilateral)</div>
      <div style={{ marginBottom: '2px' }}>
        <CB checked={true} label="1B SL700V1A — Nurse-Led" />
        <span style={{ color: '#1565C0', fontSize: '9px', marginLeft: '4px' }}>(Code: 2245-07)</span>
      </div>
      <div style={{ marginBottom: '6px' }}>
        <CB checked={false} label="1B SL700XX — Intravitreal Inj" />
      </div>

      <div style={{ fontWeight: 700, marginBottom: '3px' }}>Drug:</div>
      <div style={{ marginBottom: '8px' }}>
        <CB checked={true} label="Faricimab (Vabysmo) TLU123" />
      </div>

      <div style={{ background: '#fff8f8', border: '1px solid #fdd', borderRadius: '4px', padding: '6px', marginBottom: '8px' }}>
        <strong>Est. Hospital Bill: </strong>
        <span style={{ color: '#D32F2F', fontWeight: 700, fontSize: '14px' }}>${estCost}</span>
        {' '}for {injections} injection(s)
        <div style={{ fontSize: '9px', color: '#777', marginTop: '3px' }}>
          Note: 1. Price subject to GST. 2. Consult fee, diagnostics &amp; non-std drugs NOT included. 3. Charges may change.
        </div>
      </div>

      <div style={{ fontSize: '9px', marginBottom: '8px' }}>
        I have been given financial counselling on the estimated bill of ${estCost} for {injections} injection(s) and fully understand. Actual cost may differ from estimate.
      </div>

      <Line />

      <FlexRow>
        <strong>Counselling In:</strong>
        {['Mandarin', 'English', 'Malay', 'Tamil'].map(lang => (
          <CB key={lang} checked={lang === 'English'} label={lang} />
        ))}
      </FlexRow>

      <FlexRow>
        <strong>Payment:</strong>
        {['Medisave', 'Life', 'IP', 'CSC', 'Cash'].map(p => (
          <CB key={p} checked={p === paymentMode} label={p} />
        ))}
      </FlexRow>

      <Line />

      <div style={{ fontSize: '10px' }}>
        <div style={{ marginBottom: '5px' }}>
          Counselling Staff: <span style={{ display: 'inline-block', width: '80px', borderBottom: '1px solid #333' }}></span>
          &nbsp;&nbsp;Date: <span style={{ display: 'inline-block', width: '50px', borderBottom: '1px solid #333' }}></span>
        </div>
        <div style={{ marginBottom: '5px' }}>
          Patient/Relative: <span style={{ display: 'inline-block', width: '80px', borderBottom: '1px solid #333' }}></span>
          &nbsp;&nbsp;Date: <span style={{ display: 'inline-block', width: '50px', borderBottom: '1px solid #333' }}></span>
        </div>
        <div>
          Relationship: <span style={{ display: 'inline-block', width: '110px', borderBottom: '1px solid #333' }}></span>
        </div>
      </div>
    </div>
  )
}
