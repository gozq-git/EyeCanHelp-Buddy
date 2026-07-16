import { render, screen, within } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import AcknowledgementDoc from '../components/AcknowledgementDoc'

// Finds the row <div> that contains the given question text, so we can assert which of
// its "Yes"/"No" options is circled (rendered bold via fontWeight: 700).
function rowFor(questionText) {
  return screen.getByText(questionText).closest('div')
}

function isMarked(el) {
  // The chosen option is underlined; the other is not.
  return el.style.textDecoration.includes('underline')
}

describe('AcknowledgementDoc', () => {
  it('renders the acknowledgement-form title and all four questions', () => {
    render(<AcknowledgementDoc />)
    expect(screen.getByText('Pre-Procedure Acknowledgement Form')).toBeInTheDocument()
    expect(screen.getByText(/recent stroke or heart attack in the past 6 months/i)).toBeInTheDocument()
    expect(screen.getByText(/hospitalised in the past 3 months/i)).toBeInTheDocument()
    expect(screen.getByText(/on antibiotics/i)).toBeInTheDocument()
    expect(screen.getByText(/pregnant/i)).toBeInTheDocument()
  })

  it('underlines "Yes" for a true answer and "No" for a false answer', () => {
    render(<AcknowledgementDoc formData={{
      strokeHeartAtt: true,
      hospitalised: false,
      antibiotics: true,
      pregnant: false,
    }} />)

    const stroke = rowFor(/recent stroke or heart attack/i)
    expect(isMarked(within(stroke).getByText('Yes'))).toBe(true)
    expect(isMarked(within(stroke).getByText('No'))).toBe(false)

    const hospitalised = rowFor(/hospitalised in the past 3 months/i)
    expect(isMarked(within(hospitalised).getByText('No'))).toBe(true)
    expect(isMarked(within(hospitalised).getByText('Yes'))).toBe(false)

    const antibiotics = rowFor(/on antibiotics/i)
    expect(isMarked(within(antibiotics).getByText('Yes'))).toBe(true)

    const pregnant = rowFor(/pregnant/i)
    expect(isMarked(within(pregnant).getByText('No'))).toBe(true)
  })

  it('displays the patient name from formData', () => {
    render(<AcknowledgementDoc formData={{ patientName: 'Tan Ah Kow' }} />)
    // Name appears in both the sticker box and the signature grid.
    expect(screen.getAllByText(/Tan Ah Kow/).length).toBeGreaterThanOrEqual(1)
  })

  it('shows the login id as the NRIC (in the ID field and the NRIC signature cell)', () => {
    render(<AcknowledgementDoc formData={{ nric: 'P001' }} />)
    // Appears in the sticker "ID:" line and the NRIC signature cell.
    expect(screen.getAllByText(/P001/).length).toBeGreaterThanOrEqual(2)
  })

  it('renders the TTS letterhead and signature grid labels', () => {
    render(<AcknowledgementDoc />)
    expect(screen.getByAltText('ttsh_logo')).toBeInTheDocument()
    expect(screen.getByText(/Patient.s sticker/)).toBeInTheDocument()
    expect(screen.getByText('Signature of Attending Nurse')).toBeInTheDocument()
    expect(screen.getByText('MEC-MEY-388-01')).toBeInTheDocument()
  })
})
