import React from 'react'

const COPY = {
  en: {
    header: 'Outpatient Procedures (Intravitreal)',
    subHeader: 'Financial Counselling & Advice',
    nature: 'Nature:',
    medical: 'Medical',
    date: 'Date:',
    surgeon: 'Surgeon:',
    site: 'Site:',
    left: 'LEFT',
    right: 'RIGHT',
    both: 'BOTH',
    class: 'Class:',
    diagnosis: 'Diagnosis:',
    procedure: 'Procedure: * Intravitreal Inj',
    nurseLed: '1B SL700V1A — Nurse-Led Intravitreal Inj',
    doctorLed: '1B SL700VX — Intravitreal Inj',
    drug: 'Drug:',
    estBill: 'Est. Hospital Bill:',
    forInjections: 'for {count} injection(s)',
    maxMedisave: 'Max Medisave Claimable:',
    notAvailable: 'Not available',
    note: 'Note: 1. Price subject to GST. 2. Consult fee, diagnostics & non-std drugs NOT included. 3. Charges may change.',
    counsellingStatement: 'I have been given financial counselling on the estimated bill of {cost} for {count} injection(s) and fully understand. Actual cost may differ from estimate.',
    counsellingIn: 'Counselling In:',
    payment: 'Payment:',
    staff: 'Counselling Staff:',
    patientRelative: 'Patient/Relative:',
    relationship: 'Relationship:',
    others: 'Others',
    mandarin: 'Mandarin',
    english: 'English',
    malay: 'Malay',
    tamil: 'Tamil',
    diagnosisLabels: {
      'AMD (Exudative) H12.3': 'AMD (Exudative) H12.3',
      'Hemifacial Spasm Q234': 'Hemifacial Spasm Q234',
      'AMD (Other) H12.3': 'AMD (Other) H12.3',
      'Retinal Detachment H34.5': 'Retinal Detachment H34.5',
      'CSME H45.6': 'CSME H45.6',
      'RVO (Branch) H45.6': 'RVO (Branch) H45.6',
      'Diabetic + CSME F12.34': 'Diabetic + CSME F12.34',
      'RVO (Central) H45.6': 'RVO (Central) H45.6',
      'Cystoid ME H45.8': 'Cystoid ME H45.8',
      'Blepharospasm Q345': 'Blepharospasm Q345',
      'Diabetic Maculopathy E12.34': 'Diabetic Maculopathy E12.34',
      'ONP E23.45': 'ONP E23.45',
      'DRP E34.58': 'DRP E34.58',
    },
  },
  zh: {
    header: '门诊程序（玻璃体内注射）',
    subHeader: '财务咨询与建议',
    nature: '性质：',
    medical: '医疗',
    date: '日期：',
    surgeon: '医生：',
    site: '部位：',
    left: '左眼',
    right: '右眼',
    both: '双眼',
    class: '类别：',
    diagnosis: '诊断：',
    procedure: '程序：* 玻璃体内注射',
    nurseLed: '1B SL700V1A — 护士执行玻璃体内注射',
    doctorLed: '1B SL700VX — 玻璃体内注射',
    drug: '药物：',
    estBill: '预计医院账单：',
    forInjections: '{count} 次注射',
    maxMedisave: 'Medisave 最高可报销：',
    notAvailable: '暂无',
    note: '备注：1. 价格受 GST 影响。2. 不包含诊费、检查及非标准药物。3. 费用可能调整。',
    counsellingStatement: '我已接受关于预计账单 {cost}（{count} 次注射）的财务咨询并完全理解。实际费用可能与估算不同。',
    counsellingIn: '咨询语言：',
    payment: '付款：',
    staff: '咨询人员：',
    patientRelative: '患者/家属：',
    relationship: '关系：',
    others: '其他',
    mandarin: '华语',
    english: '英语',
    malay: '马来语',
    tamil: '泰米尔语',
    diagnosisLabels: {
      'AMD (Exudative) H12.3': 'AMD（渗出性）H12.3',
      'Hemifacial Spasm Q234': '半面痉挛 Q234',
      'AMD (Other) H12.3': 'AMD（其他）H12.3',
      'Retinal Detachment H34.5': '视网膜脱离 H34.5',
      'CSME H45.6': 'CSME H45.6',
      'RVO (Branch) H45.6': 'RVO（分支）H45.6',
      'Diabetic + CSME F12.34': '糖尿病 + CSME F12.34',
      'RVO (Central) H45.6': 'RVO（中央）H45.6',
      'Cystoid ME H45.8': '囊样黄斑水肿 H45.8',
      'Blepharospasm Q345': '眼睑痉挛 Q345',
      'Diabetic Maculopathy E12.34': '糖尿病黄斑病变 E12.34',
      'ONP E23.45': 'ONP E23.45',
      'DRP E34.58': 'DRP E34.58',
    },
  },
  ms: {
    header: 'Prosedur Pesakit Luar (Intravitreal)',
    subHeader: 'Kaunseling & Nasihat Kewangan',
    nature: 'Jenis:',
    medical: 'Perubatan',
    date: 'Tarikh:',
    surgeon: 'Pakar Bedah:',
    site: 'Lokasi:',
    left: 'KIRI',
    right: 'KANAN',
    both: 'KEDUA-DUA',
    class: 'Kelas:',
    diagnosis: 'Diagnosis:',
    procedure: 'Prosedur: * Suntikan Intravitreal',
    nurseLed: '1B SL700V1A — Suntikan Intravitreal oleh Jururawat',
    doctorLed: '1B SL700VX — Suntikan Intravitreal',
    drug: 'Ubat:',
    estBill: 'Anggaran Bil Hospital:',
    forInjections: 'untuk {count} suntikan',
    maxMedisave: 'Tuntutan Medisave Maksimum:',
    notAvailable: 'Tidak tersedia',
    note: 'Nota: 1. Harga tertakluk kepada GST. 2. Yuran konsultasi, diagnostik & ubat bukan standard TIDAK termasuk. 3. Caj boleh berubah.',
    counsellingStatement: 'Saya telah diberi kaunseling kewangan mengenai anggaran bil {cost} untuk {count} suntikan dan memahaminya sepenuhnya. Kos sebenar mungkin berbeza daripada anggaran.',
    counsellingIn: 'Kaunseling Dalam:',
    payment: 'Pembayaran:',
    staff: 'Kakitangan Kaunseling:',
    patientRelative: 'Pesakit/Saudara:',
    relationship: 'Hubungan:',
    others: 'Lain-lain',
    mandarin: 'Mandarin',
    english: 'Inggeris',
    malay: 'Melayu',
    tamil: 'Tamil',
    diagnosisLabels: {
      'AMD (Exudative) H12.3': 'AMD (Eksudatif) H12.3',
      'Hemifacial Spasm Q234': 'Kekejangan Hemifasial Q234',
      'AMD (Other) H12.3': 'AMD (Lain-lain) H12.3',
      'Retinal Detachment H34.5': 'Detasmen Retina H34.5',
      'CSME H45.6': 'CSME H45.6',
      'RVO (Branch) H45.6': 'RVO (Cabang) H45.6',
      'Diabetic + CSME F12.34': 'Diabetik + CSME F12.34',
      'RVO (Central) H45.6': 'RVO (Pusat) H45.6',
      'Cystoid ME H45.8': 'ME Sista H45.8',
      'Blepharospasm Q345': 'Blefarospasme Q345',
      'Diabetic Maculopathy E12.34': 'Makulopati Diabetik E12.34',
      'ONP E23.45': 'ONP E23.45',
      'DRP E34.58': 'DRP E34.58',
    },
  },
  ta: {
    header: 'வெளிநோயாளர் செயல்முறைகள் (Intravitreal)',
    subHeader: 'நிதி ஆலோசனை மற்றும் வழிகாட்டல்',
    nature: 'வகை:',
    medical: 'மருத்துவம்',
    date: 'தேதி:',
    surgeon: 'அறுவைச் சிகிச்சை நிபுணர்:',
    site: 'இடம்:',
    left: 'இடது',
    right: 'வலது',
    both: 'இரண்டும்',
    class: 'வகுப்பு:',
    diagnosis: 'நோயறிதல்:',
    procedure: 'செயல்முறை: * Intravitreal Inj',
    nurseLed: '1B SL700V1A — செவிலியர் வழிநடத்தும் Intravitreal Inj',
    doctorLed: '1B SL700VX — Intravitreal Inj',
    drug: 'மருந்து:',
    estBill: 'மதிப்பிடப்பட்ட மருத்துவமனை கட்டணம்:',
    forInjections: '{count} ஊசி செலுத்தல்களுக்கு',
    maxMedisave: 'அதிகபட்ச Medisave கோரிக்கை:',
    notAvailable: 'கிடைக்கவில்லை',
    note: 'குறிப்பு: 1. விலை GSTக்கு உட்பட்டது. 2. ஆலோசனை கட்டணம், பரிசோதனை மற்றும் தரநிலையற்ற மருந்துகள் சேர்க்கப்படவில்லை. 3. கட்டணங்கள் மாறலாம்.',
    counsellingStatement: '{count} ஊசி செலுத்தல்களுக்கு {cost} என்ற மதிப்பீட்டு கட்டணத்தை குறித்து எனக்கு நிதி ஆலோசனை வழங்கப்பட்டது, அதை முழுமையாக புரிந்துகொண்டேன். உண்மைச் செலவு மாறுபடலாம்.',
    counsellingIn: 'ஆலோசனை மொழி:',
    payment: 'கட்டணம்:',
    staff: 'ஆலோசனை பணியாளர்:',
    patientRelative: 'நோயாளர்/உறவினர்:',
    relationship: 'உறவு:',
    others: 'மற்றவை',
    mandarin: 'மந்திரின்',
    english: 'ஆங்கிலம்',
    malay: 'மலாய்',
    tamil: 'தமிழ்',
    diagnosisLabels: {
      'AMD (Exudative) H12.3': 'AMD (Exudative) H12.3',
      'Hemifacial Spasm Q234': 'Hemifacial Spasm Q234',
      'AMD (Other) H12.3': 'AMD (மற்றவை) H12.3',
      'Retinal Detachment H34.5': 'Retinal Detachment H34.5',
      'CSME H45.6': 'CSME H45.6',
      'RVO (Branch) H45.6': 'RVO (கிளை) H45.6',
      'Diabetic + CSME F12.34': 'Diabetic + CSME F12.34',
      'RVO (Central) H45.6': 'RVO (மைய) H45.6',
      'Cystoid ME H45.8': 'Cystoid ME H45.8',
      'Blepharospasm Q345': 'Blepharospasm Q345',
      'Diabetic Maculopathy E12.34': 'Diabetic Maculopathy E12.34',
      'ONP E23.45': 'ONP E23.45',
      'DRP E34.58': 'DRP E34.58',
    },
  },
}

const PAYMENT_OPTIONS = [
  {
    value: 'Medishield Life / Integrated Plan',
    label: {
      en: 'Medishield Life / Integrated Plan',
      zh: 'Medishield Life / 综合计划',
      ms: 'Medishield Life / Pelan Bersepadu',
      ta: 'Medishield Life / ஒருங்கிணைந்த திட்டம்',
    },
  },
  { value: 'CSC', label: { en: 'CSC', zh: 'CSC', ms: 'CSC', ta: 'CSC' } },
  {
    value: 'Medisave (Self)',
    label: {
      en: 'Medisave (Self)',
      zh: 'Medisave（本人）',
      ms: 'Medisave (Sendiri)',
      ta: 'Medisave (தானாக)',
    },
  },
  { value: 'MAF', label: { en: 'MAF', zh: 'MAF', ms: 'MAF', ta: 'MAF' } },
  { value: 'Cash', label: { en: 'Cash', zh: '现金', ms: 'Tunai', ta: 'பணம்' } },
  {
    value: 'NOK Medisave',
    label: {
      en: 'NOK Medisave',
      zh: '家属 Medisave',
      ms: 'Medisave NOK',
      ta: 'உறவினர் Medisave',
    },
  },
]

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

export default function FinancialCounsellingDoc({ formData = {}, language = 'en' }) {
  const {
    date = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    surgeon = 'Dr. Koh CS',
    mcr = '0001231241',
    diagnosis = 'H35.31',
    estCost,
    injections = 1,
    maxMedisaveClaimable,
    paymentMode = 'Medisave',
  } = formData
  const copy = COPY[language] || COPY.en

  // Site must tally with PostOp Eye (LEFT / RIGHT / BOTH). Mutually exclusive: exactly
  // one box checked. Empty string must fall through to 'OD' (matches PostOp's null fallback
  // showing nothing-vs-something behaviour symmetrically). Use || not destructuring default.
  const site = formData.site || 'OD'
  const isLeft = site === 'OS'
  const isRight = site === 'OD'
  const isBoth = site === 'OU'

  // Must mirror PostIvtAdviceDoc exactly so the two forms tally.
  // Use || (not destructuring default) so an empty-string medication still falls through.
  const medication = formData.medication || 'Faricimab (Vabysmo)'
  const classCode = (formData.classCode || '').toUpperCase()
  const performer = (formData.performer || 'Nurse').toLowerCase()
  const isNurseLed = performer.includes('nurse')
  const isDoctorLed = performer.includes('doctor')
  const MED_OPTIONS = [
    { value: 'Lucentis', label: 'Lucentis' },
    { value: 'Faricimab', label: 'Faricimab' },
    { value: 'Eylea', label: 'Eylea' },
    { value: 'Others', label: copy.others },
  ]
  const activeMed = MED_OPTIONS.find(m => medication.toLowerCase().includes(m.value.toLowerCase()))?.value || 'Others'
  const rawCost = String(estCost ?? '').trim()
  const rangeText = rawCost.includes('-')
    ? (() => {
        const [minPart, maxPart] = rawCost.split('-').map(v => v.trim().replace(/^\$/, ''))
        return `$${minPart} - $${maxPart}`
      })()
    : (rawCost ? (rawCost.startsWith('$') ? rawCost : `$${rawCost}`) : copy.notAvailable)

  const statement = copy.counsellingStatement
    .replace('{cost}', rangeText)
    .replace('{count}', String(injections))

  const injectionsLabel = copy.forInjections.replace('{count}', String(injections))

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
        {copy.header}
      </div>
      <div style={{ textAlign: 'center', fontWeight: 700, fontSize: '10px', borderBottom: '1px solid #ccc', paddingBottom: '6px', marginBottom: '8px' }}>
        {copy.subHeader}
      </div>

      <FlexRow>
        <span><strong>{copy.nature}</strong> {copy.medical}</span>
        <span><strong>{copy.date}</strong> <span style={{ color: '#1565C0', fontWeight: 600 }}>{date}</span></span>
      </FlexRow>
      <FlexRow>
        <span><strong>{copy.surgeon}</strong> {surgeon}</span>
        <span><strong>MCR:</strong> {mcr}</span>
      </FlexRow>

      <FlexRow>
        <strong>{copy.site}</strong>
        <CB checked={isLeft} label={copy.left} />
        <CB checked={isRight} label={copy.right} />
        <CB checked={isBoth} label={copy.both} />
      </FlexRow>

      <FlexRow>
        <strong>{copy.class}</strong>
        {['PTE', 'SUB'].map(c => <CB key={c} checked={classCode === c} label={c} />)}
      </FlexRow>

      <Line />

      <div style={{ fontWeight: 700, fontSize: '10px', marginBottom: '4px' }}>{copy.diagnosis}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px', marginBottom: '6px' }}>
        {DIAGNOSES.map(d => (
          <CB key={d.label} checked={d.code === diagnosis} label={copy.diagnosisLabels[d.label] || d.label} />
        ))}
      </div>

      <Line />

      <div style={{ fontWeight: 700, marginBottom: '4px' }}>{copy.procedure}</div>
      <div style={{ marginBottom: '2px' }}>
        <CB checked={isNurseLed || !isDoctorLed} label={copy.nurseLed} />
      </div>
      <div style={{ marginBottom: '6px' }}>
        <CB checked={isDoctorLed} label={copy.doctorLed} />
      </div>

      <div style={{ fontWeight: 700, marginBottom: '3px' }}>{copy.drug}</div>
      <FlexRow>
        {MED_OPTIONS.map((m) => <CB key={m.value} checked={m.value === activeMed} label={m.label} />)}
      </FlexRow>

      <div style={{ background: '#fff8f8', border: '1px solid #fdd', borderRadius: '4px', padding: '6px', marginBottom: '8px' }}>
        <strong>{copy.estBill} </strong>
        <span style={{ color: '#D32F2F', fontWeight: 700, fontSize: '14px' }}>{rangeText}</span>
        {' '}{injectionsLabel}
        <div style={{ fontSize: '9px', color: '#444', marginTop: '3px' }}>
          {copy.maxMedisave} <strong>{maxMedisaveClaimable != null ? `$${maxMedisaveClaimable}` : copy.notAvailable}</strong>
        </div>
        <div style={{ fontSize: '9px', color: '#777', marginTop: '3px' }}>
          {copy.note}
        </div>
      </div>

      <div style={{ fontSize: '9px', marginBottom: '8px' }}>
        {statement}
      </div>

      <Line />

      <FlexRow>
        <strong>{copy.counsellingIn}</strong>
        {[copy.mandarin, copy.english, copy.malay, copy.tamil].map((lang, index) => (
          <CB
            key={lang}
            checked={index === (language === 'zh' ? 0 : language === 'ms' ? 2 : language === 'ta' ? 3 : 1)}
            label={lang}
          />
        ))}
      </FlexRow>

      <FlexRow>
        <strong>{copy.payment}</strong>
        {PAYMENT_OPTIONS.map(({ value, label }) => {
          const mode = paymentMode.toLowerCase()
          const checked = value === 'Medishield Life / Integrated Plan'
            ? mode.includes('medishield') || mode.includes('integrated') || paymentMode === 'MediShield'
            : value === 'Medisave (Self)'
              ? (mode.includes('medisave') && !mode.includes('nok')) || paymentMode === 'Medisave'
              : value.toLowerCase() === mode
          return <CB key={value} checked={checked} label={label[language] || label.en} />
        })}
      </FlexRow>

      <Line />

      <div style={{ fontSize: '10px' }}>
        <div style={{ marginBottom: '5px' }}>
          {copy.staff} <span style={{ display: 'inline-block', width: '80px', borderBottom: '1px solid #333' }}></span>
          &nbsp;&nbsp;{copy.date} <span style={{ display: 'inline-block', width: '50px', borderBottom: '1px solid #333' }}></span>
        </div>
        <div style={{ marginBottom: '5px' }}>
          {copy.patientRelative} <span style={{ display: 'inline-block', width: '80px', borderBottom: '1px solid #333' }}></span>
          &nbsp;&nbsp;{copy.date} <span style={{ display: 'inline-block', width: '50px', borderBottom: '1px solid #333' }}></span>
        </div>
        <div>
          {copy.relationship} <span style={{ display: 'inline-block', width: '110px', borderBottom: '1px solid #333' }}></span>
        </div>
      </div>
    </div>
  )
}
