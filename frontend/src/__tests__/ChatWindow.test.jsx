import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ChatWindow from '../components/ChatWindow'

// ─── Module mocks ─────────────────────────────────────────────────────────────

// Mock every API client function that ChatWindow imports. Missing mocks would cause
// `await undefined(...)` to throw inside handleSingpassLogin, pushing the UI into the
// new-patient registration branch instead of the existing-patient ask_update branch.
vi.mock('../api/client', () => ({
  sendChatMessage: vi.fn(),
  sendChatMessageStream: vi.fn(),
  submitAcknowledgement: vi.fn(),
  calculateBill: vi.fn(),
  getPatient: vi.fn(),
  getEpicRecord: vi.fn(),
  createPatient: vi.fn(),
  getLatestAcknowledgement: vi.fn(),
}))

// Isolate ChatWindow from SingpassLoginButton's internal 600ms timer.
// The real component calls onLogin(uppercased_username); tests use 'P001' here so
// handleSingpassLogin receives a valid id string rather than a React event object.
vi.mock('../components/SingpassLoginButton', () => ({
  default: ({ onLogin }) => (
    <button onClick={() => onLogin('P001')}>Singpass Login</button>
  ),
}))

import {
  sendChatMessage,
  sendChatMessageStream,
  submitAcknowledgement,
  calculateBill,
  getPatient,
  getEpicRecord,
  createPatient,
  getLatestAcknowledgement,
} from '../api/client'

// Canonical "existing patient" responses used by the pre/post-op flows so that
// handleSingpassLogin lands in the existing-patient branch (ask_update / postop_doc).
const MOCK_PATIENT_RESPONSE = {
  data: { patient_id: 'P001', patient_name: 'Tan Ah Kow', patient_dob: '1952-08-12', phone_number: '+6591234567' },
}
const MOCK_EPIC_RECORD_RESPONSE = {
  data: {
    patient_id: 'P001',
    record_name: 'Tan Ah Kow',
    record_diagnosis: 'H35.31',
    record_eyes: 'OD',
    record_medication: 'Faricimab (Vabysmo)',
    record_number_of_injections: 3,
    record_validity_of_consent: true,
    record_last3mths_admission: false,
    record_stroke_heartAtt_last6mths: false,
    record_taking_antibiotics: false,
    record_pregnant: false,
    record_id: 'REC-P001-001',
    issued: '2020-01-01T00:00:00',
  },
}

const MOCK_ACK_RESPONSE = {
  data: {
    record: {
      record_name: 'Test Patient',
      record_diagnosis: 'H35.31',
      record_eyes: 'OD',
      record_number_of_injections: 1,
      issued: new Date().toISOString(),
    },
    payment: {
      payment_estCostPerInjection: 123,
      payment_mode: 'Medisave',
    },
  },
}

// ─── Welcome state ────────────────────────────────────────────────────────────

describe('ChatWindow — welcome state', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('renders the quick-reply option pills on load (incl. Appointment, no Return Menu)', () => {
    render(<ChatWindow />)
    expect(screen.getByRole('button', { name: 'General Enquiry' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Fill up IVT Pre-Procedure Acknowledgement Form' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'View Post-IVT Advice Form' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Book Appointment' })).toBeInTheDocument()
    // Return Menu is redundant on the first welcome bubble — you're already at the menu.
    expect(screen.queryByRole('button', { name: 'Return Menu' })).not.toBeInTheDocument()
  })

  it('shows "General Enquiry" as the input placeholder in welcome mode', () => {
    render(<ChatWindow />)
    expect(screen.getByPlaceholderText('General Enquiry')).toBeInTheDocument()
  })

  it('input is enabled in welcome mode', () => {
    render(<ChatWindow />)
    expect(screen.getByRole('textbox')).not.toBeDisabled()
  })
})

// ─── General Enquiry ──────────────────────────────────────────────────────────

describe('ChatWindow — General Enquiry flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sendChatMessageStream.mockImplementation(async (_messages, { onChunk } = {}) => {
      if (onChunk) {
        onChunk('A cataract clouds the eye lens.')
      }
      return 'A cataract clouds the eye lens.'
    })
    sendChatMessage.mockResolvedValue({ data: { reply: 'A cataract clouds the eye lens.' } })
  })

  it('clicking General Enquiry shows the bot confirmation message', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'General Enquiry' }))
    expect(screen.getByText(/general enquiries about eye/i)).toBeInTheDocument()
  })

  it('placeholder changes to "Write your message" in general enquiry mode', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'General Enquiry' }))
    expect(screen.getByPlaceholderText('Write your message')).toBeInTheDocument()
  })

  it('user message appears in the chat after pressing Enter', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'General Enquiry' }))
    await userEvent.type(screen.getByRole('textbox'), 'What is a cataract?')
    await userEvent.keyboard('{Enter}')
    expect(screen.getByText('What is a cataract?')).toBeInTheDocument()
  })

  it('bot reply is appended after sendChatMessage resolves', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'General Enquiry' }))
    await userEvent.type(screen.getByRole('textbox'), 'What is AMD?')
    await userEvent.keyboard('{Enter}')
    await waitFor(() => {
      expect(screen.getByText('A cataract clouds the eye lens.')).toBeInTheDocument()
    })
  })

  it('sendChatMessageStream is called with a messages array containing the user message', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'General Enquiry' }))
    await userEvent.type(screen.getByRole('textbox'), 'What is AMD?')
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(sendChatMessageStream).toHaveBeenCalled())
    const [messages] = sendChatMessageStream.mock.calls[0]
    expect(messages.some(m => m.role === 'user' && m.content === 'What is AMD?')).toBe(true)
  })

  it('shows error message in chat when sendChatMessage rejects', async () => {
    sendChatMessageStream.mockRejectedValueOnce(new Error('Stream failed'))
    sendChatMessage.mockRejectedValueOnce(new Error('Network error'))
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'General Enquiry' }))
    await userEvent.type(screen.getByRole('textbox'), 'test question')
    await userEvent.keyboard('{Enter}')
    await waitFor(() => {
      expect(screen.getByText(/encountered an error/i)).toBeInTheDocument()
    })
  })

  it('input is cleared after sending a message', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'General Enquiry' }))
    const input = screen.getByRole('textbox')
    await userEvent.type(input, 'Hello')
    await userEvent.keyboard('{Enter}')
    expect(input).toHaveValue('')
  })
})

// ─── Pre-Procedure ────────────────────────────────────────────────────────────

describe('ChatWindow — Pre-Procedure flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    submitAcknowledgement.mockResolvedValue(MOCK_ACK_RESPONSE)
    // Existing patient: getPatient + getEpicRecord both resolve → flow enters ask_update
    getPatient.mockResolvedValue(MOCK_PATIENT_RESPONSE)
    getEpicRecord.mockResolvedValue(MOCK_EPIC_RECORD_RESPONSE)
      calculateBill.mockResolvedValue({
        data: {
          record_class: 'PTE',
          performer: 'Doctor',
          injections: 1,
          estimated_cost_min: 430,
          estimated_cost_max: 480,
          max_medisave_claimable: 250,
        },
      })
    // No prior submission — getLatestAcknowledgement rejects so the post-op merge skips it
    getLatestAcknowledgement.mockRejectedValue(new Error('no record'))
  })

  it('clicking Fill up IVT Pre-Procedure Acknowledgement Form shows the Singpass login button', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'Fill up IVT Pre-Procedure Acknowledgement Form' }))
    expect(screen.getByRole('button', { name: /singpass login/i })).toBeInTheDocument()
  })

  it('input is disabled while waiting for Singpass login', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'Fill up IVT Pre-Procedure Acknowledgement Form' }))
    expect(screen.getByRole('textbox')).toBeDisabled()
  })

  it('Yes/No chips appear after Singpass login completes', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'Fill up IVT Pre-Procedure Acknowledgement Form' }))
    await userEvent.click(screen.getByRole('button', { name: /singpass login/i }))
    expect(screen.getByRole('button', { name: 'Yes' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'No' })).toBeInTheDocument()
  })

  it('Yes/No chips also appear for the next question after the first is answered', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'Fill up IVT Pre-Procedure Acknowledgement Form' }))
    await userEvent.click(screen.getByRole('button', { name: /singpass login/i }))
    // Existing patient → ask_update; click Yes to advance into the question flow.
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }))
    await userEvent.click(screen.getByRole('button', { name: 'No' })) // q_stroke
    expect(screen.getByRole('button', { name: 'Yes' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'No' })).toBeInTheDocument()
  })

  it('asks performer after scheme and before showing eye chips', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'Fill up IVT Pre-Procedure Acknowledgement Form' }))
    await userEvent.click(screen.getByRole('button', { name: /singpass login/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Yes' })) // ask_update
    await userEvent.click(screen.getByRole('button', { name: 'No' }))  // q_stroke
    await userEvent.click(screen.getByRole('button', { name: 'No' }))  // q_admission
    await userEvent.click(screen.getByRole('button', { name: 'No' }))  // q_antibiotics
    await userEvent.click(screen.getByRole('button', { name: 'No' }))  // q_pregnant
    expect(screen.getByText(/Would you like to proceed with financial counselling now/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Yes' })) // q_financial_counselling
    expect(screen.getByText(/Are you seeking treatment under Private or Subsidised scheme/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Private' })) // q_scheme
    expect(screen.getByText(/Would you like your procedure to be performed by Doctor or Nurse/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Doctor' })) // q_performer
    expect(screen.getByRole('button', { name: 'Right' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Left' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Both' })).toBeInTheDocument()
  })

  it('maps the four acknowledgement-form answers onto the patient record', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'Fill up IVT Pre-Procedure Acknowledgement Form' }))
    await userEvent.click(screen.getByRole('button', { name: /singpass login/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }))   // ask_update
    await userEvent.click(screen.getByRole('button', { name: 'No' }))    // q_stroke = false
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }))   // q_admission = true
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }))   // q_antibiotics = true
    await userEvent.click(screen.getByRole('button', { name: 'No' }))    // q_pregnant = false
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }))   // q_financial_counselling
    await userEvent.click(screen.getByRole('button', { name: 'Private' })) // q_scheme
    await userEvent.click(screen.getByRole('button', { name: 'Doctor' })) // q_performer
    await userEvent.click(screen.getByRole('button', { name: 'Right' })) // q_eye
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }))   // cost_confirm
    await userEvent.click(screen.getByRole('button', { name: 'Medisave (Self)' })) // payment_mode → submit
    await waitFor(() => expect(submitAcknowledgement).toHaveBeenCalledOnce())
    const [payload] = submitAcknowledgement.mock.calls[0]
    expect(payload.patient_record.record_stroke_heartAtt_last6mths).toBe(false)
    expect(payload.patient_record.record_last3mths_admission).toBe(true)
    expect(payload.patient_record.record_taking_antibiotics).toBe(true)
    expect(payload.patient_record.record_pregnant).toBe(false)
    expect(payload.patient_record.record_class).toBe('PTE')
    expect(payload.patient_record.record_performer).toBe('Doctor')
  })

  it('record_eyes is OD when user selects Right', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'Fill up IVT Pre-Procedure Acknowledgement Form' }))
    await userEvent.click(screen.getByRole('button', { name: /singpass login/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }))   // ask_update
    await userEvent.click(screen.getByRole('button', { name: 'No' }))    // q_stroke
    await userEvent.click(screen.getByRole('button', { name: 'No' }))    // q_admission
    await userEvent.click(screen.getByRole('button', { name: 'No' }))    // q_antibiotics
    await userEvent.click(screen.getByRole('button', { name: 'No' }))    // q_pregnant
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }))   // q_financial_counselling
    await userEvent.click(screen.getByRole('button', { name: 'Private' })) // q_scheme
    await userEvent.click(screen.getByRole('button', { name: 'Doctor' })) // q_performer
    await userEvent.click(screen.getByRole('button', { name: 'Right' })) // q_eye
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }))   // cost_confirm
    await userEvent.click(screen.getByRole('button', { name: 'Medisave (Self)' })) // payment_mode → submit
    await waitFor(() => expect(submitAcknowledgement).toHaveBeenCalledOnce())
    const [payload] = submitAcknowledgement.mock.calls[0]
    expect(payload.patient_record.record_eyes).toBe('OD')
    expect(payload.patient_record.record_number_of_injections).toBe(1)
  })

  it('record_eyes is OS when user selects Left', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'Fill up IVT Pre-Procedure Acknowledgement Form' }))
    await userEvent.click(screen.getByRole('button', { name: /singpass login/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }))   // ask_update
    await userEvent.click(screen.getByRole('button', { name: 'No' }))    // q_stroke
    await userEvent.click(screen.getByRole('button', { name: 'No' }))    // q_admission
    await userEvent.click(screen.getByRole('button', { name: 'No' }))    // q_antibiotics
    await userEvent.click(screen.getByRole('button', { name: 'No' }))    // q_pregnant
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }))   // q_financial_counselling
    await userEvent.click(screen.getByRole('button', { name: 'Private' })) // q_scheme
    await userEvent.click(screen.getByRole('button', { name: 'Doctor' })) // q_performer
    await userEvent.click(screen.getByRole('button', { name: 'Left' }))  // q_eye
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }))   // cost_confirm
    await userEvent.click(screen.getByRole('button', { name: 'Medisave (Self)' })) // payment_mode → submit
    await waitFor(() => expect(submitAcknowledgement).toHaveBeenCalledOnce())
    const [payload] = submitAcknowledgement.mock.calls[0]
    expect(payload.patient_record.record_eyes).toBe('OS')
    expect(payload.patient_record.record_number_of_injections).toBe(1)
  })

  it('record_eyes is OU when user selects Both', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'Fill up IVT Pre-Procedure Acknowledgement Form' }))
    await userEvent.click(screen.getByRole('button', { name: /singpass login/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }))   // ask_update
    await userEvent.click(screen.getByRole('button', { name: 'No' }))    // q_stroke
    await userEvent.click(screen.getByRole('button', { name: 'No' }))    // q_admission
    await userEvent.click(screen.getByRole('button', { name: 'No' }))    // q_antibiotics
    await userEvent.click(screen.getByRole('button', { name: 'No' }))    // q_pregnant
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }))   // q_financial_counselling
    await userEvent.click(screen.getByRole('button', { name: 'Private' })) // q_scheme
    await userEvent.click(screen.getByRole('button', { name: 'Doctor' })) // q_performer
    await userEvent.click(screen.getByRole('button', { name: 'Both' }))  // q_eye
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }))   // cost_confirm
    await userEvent.click(screen.getByRole('button', { name: 'Medisave (Self)' })) // payment_mode → submit
    await waitFor(() => expect(submitAcknowledgement).toHaveBeenCalledOnce())
    const [payload] = submitAcknowledgement.mock.calls[0]
    expect(payload.patient_record.record_eyes).toBe('OU')
    expect(payload.patient_record.record_number_of_injections).toBe(2)
  })

  it('renders the acknowledgement doc with the four questions after submission', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'Fill up IVT Pre-Procedure Acknowledgement Form' }))
    await userEvent.click(screen.getByRole('button', { name: /singpass login/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }))   // ask_update
    await userEvent.click(screen.getByRole('button', { name: 'No' }))    // q_stroke
    await userEvent.click(screen.getByRole('button', { name: 'No' }))    // q_admission
    await userEvent.click(screen.getByRole('button', { name: 'No' }))    // q_antibiotics
    await userEvent.click(screen.getByRole('button', { name: 'No' }))    // q_pregnant
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }))   // q_financial_counselling
    await userEvent.click(screen.getByRole('button', { name: 'Private' })) // q_scheme
    await userEvent.click(screen.getByRole('button', { name: 'Doctor' })) // q_performer
    await userEvent.click(screen.getByRole('button', { name: 'Right' })) // q_eye
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }))   // cost_confirm
    await userEvent.click(screen.getByRole('button', { name: 'Medisave (Self)' })) // payment_mode → submit
    await waitFor(() => {
      expect(screen.getByText('Pre-Procedure Acknowledgement Form')).toBeInTheDocument()
    })
    // "* Circle as appropriate" is unique to the doc (the question text also appears in
    // the chat bubbles), confirming the acknowledgement form itself rendered.
    expect(screen.getByText(/Circle as appropriate/i)).toBeInTheDocument()
  })

  it('shows financial counselling confirmation after the form and before the eye question', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'Fill up IVT Pre-Procedure Acknowledgement Form' }))
    await userEvent.click(screen.getByRole('button', { name: /singpass login/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }))   // ask_update
    await userEvent.click(screen.getByRole('button', { name: 'No' }))    // q_stroke
    await userEvent.click(screen.getByRole('button', { name: 'No' }))    // q_admission
    await userEvent.click(screen.getByRole('button', { name: 'No' }))    // q_antibiotics
    await userEvent.click(screen.getByRole('button', { name: 'No' }))    // q_pregnant → shows the form
    // The form is displayed now, and financial-counselling confirmation is asked before eye chips.
    expect(await screen.findByText(/Circle as appropriate/i)).toBeInTheDocument()
    expect(screen.getByText(/Would you like to proceed with financial counselling now/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }))
    expect(screen.getByText(/Are you seeking treatment under Private or Subsidised scheme/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Private' }))
    expect(screen.getByText(/Would you like your procedure to be performed by Doctor or Nurse/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Doctor' }))
    expect(screen.getByRole('button', { name: 'Right' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Left' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Both' })).toBeInTheDocument()
  })

  it('saves the acknowledgement and shows the doc even when the cost is declined', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'Fill up IVT Pre-Procedure Acknowledgement Form' }))
    await userEvent.click(screen.getByRole('button', { name: /singpass login/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }))   // ask_update
    await userEvent.click(screen.getByRole('button', { name: 'No' }))    // q_stroke
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }))   // q_admission = true
    await userEvent.click(screen.getByRole('button', { name: 'No' }))    // q_antibiotics
    await userEvent.click(screen.getByRole('button', { name: 'No' }))    // q_pregnant
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }))   // q_financial_counselling
    await userEvent.click(screen.getByRole('button', { name: 'Private' })) // q_scheme
    await userEvent.click(screen.getByRole('button', { name: 'Doctor' })) // q_performer
    await userEvent.click(screen.getByRole('button', { name: 'Right' })) // q_eye
    await userEvent.click(screen.getByRole('button', { name: 'No' }))    // cost_confirm = declined
    // The record is still persisted even though the patient declined the cost.
    await waitFor(() => expect(submitAcknowledgement).toHaveBeenCalledOnce())
    const [payload] = submitAcknowledgement.mock.calls[0]
    expect(payload.patient_record.record_last3mths_admission).toBe(true)
    expect(await screen.findByText('Pre-Procedure Acknowledgement Form')).toBeInTheDocument()
    // No financial doc on the decline path.
    expect(screen.queryByText(/Financial Counselling & Advice/)).not.toBeInTheDocument()
  })

  it('renders FinancialCounsellingDoc after submitAcknowledgement resolves', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'Fill up IVT Pre-Procedure Acknowledgement Form' }))
    await userEvent.click(screen.getByRole('button', { name: /singpass login/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }))   // ask_update
    await userEvent.click(screen.getByRole('button', { name: 'No' }))    // q_stroke
    await userEvent.click(screen.getByRole('button', { name: 'No' }))    // q_admission
    await userEvent.click(screen.getByRole('button', { name: 'No' }))    // q_antibiotics
    await userEvent.click(screen.getByRole('button', { name: 'No' }))    // q_pregnant
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }))   // q_financial_counselling
    await userEvent.click(screen.getByRole('button', { name: 'Private' })) // q_scheme
    await userEvent.click(screen.getByRole('button', { name: 'Doctor' })) // q_performer
    await userEvent.click(screen.getByRole('button', { name: 'Right' })) // q_eye
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }))   // cost_confirm
    await userEvent.click(screen.getByRole('button', { name: 'Medisave (Self)' })) // payment_mode → submit
    await waitFor(() => {
      expect(screen.getAllByText(/Financial Counselling & Advice/).length).toBeGreaterThan(0)
    })
  })

  it('renders FinancialCounsellingDoc even when submitAcknowledgement rejects (fallback)', async () => {
    submitAcknowledgement.mockRejectedValueOnce(new Error('Backend down'))
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'Fill up IVT Pre-Procedure Acknowledgement Form' }))
    await userEvent.click(screen.getByRole('button', { name: /singpass login/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }))   // ask_update
    await userEvent.click(screen.getByRole('button', { name: 'No' }))    // q_stroke
    await userEvent.click(screen.getByRole('button', { name: 'No' }))    // q_admission
    await userEvent.click(screen.getByRole('button', { name: 'No' }))    // q_antibiotics
    await userEvent.click(screen.getByRole('button', { name: 'No' }))    // q_pregnant
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }))   // q_financial_counselling
    await userEvent.click(screen.getByRole('button', { name: 'Private' })) // q_scheme
    await userEvent.click(screen.getByRole('button', { name: 'Doctor' })) // q_performer
    await userEvent.click(screen.getByRole('button', { name: 'Right' })) // q_eye
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }))   // cost_confirm
    await userEvent.click(screen.getByRole('button', { name: 'Medisave (Self)' })) // payment_mode → submit (rejects)
    await waitFor(() => {
      expect(screen.getAllByText(/Financial Counselling & Advice/).length).toBeGreaterThan(0)
    })
  })

  it('input is disabled after the pre-procedure flow is complete', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'Fill up IVT Pre-Procedure Acknowledgement Form' }))
    await userEvent.click(screen.getByRole('button', { name: /singpass login/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }))   // ask_update
    await userEvent.click(screen.getByRole('button', { name: 'No' }))    // q_stroke
    await userEvent.click(screen.getByRole('button', { name: 'No' }))    // q_admission
    await userEvent.click(screen.getByRole('button', { name: 'No' }))    // q_antibiotics
    await userEvent.click(screen.getByRole('button', { name: 'No' }))    // q_pregnant
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }))   // q_financial_counselling
    await userEvent.click(screen.getByRole('button', { name: 'Private' })) // q_scheme
    await userEvent.click(screen.getByRole('button', { name: 'Doctor' })) // q_performer
    await userEvent.click(screen.getByRole('button', { name: 'Right' })) // q_eye
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }))   // cost_confirm
    await userEvent.click(screen.getByRole('button', { name: 'Medisave (Self)' })) // payment_mode → submit
    await waitFor(() => expect(submitAcknowledgement).toHaveBeenCalled())
    expect(screen.getByRole('textbox')).toBeDisabled()
  })
})

// ─── Pre-Procedure input validation ──────────────────────────────────────────

describe('ChatWindow — Pre-Procedure input validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    submitAcknowledgement.mockResolvedValue(MOCK_ACK_RESPONSE)
    getPatient.mockResolvedValue(MOCK_PATIENT_RESPONSE)
    getEpicRecord.mockResolvedValue(MOCK_EPIC_RECORD_RESPONSE)
    calculateBill.mockResolvedValue({
      data: {
        record_class: 'PTE',
        performer: 'Doctor',
        injections: 1,
        estimated_cost_min: 430,
        estimated_cost_max: 480,
        max_medisave_claimable: 250,
      },
    })
    getLatestAcknowledgement.mockRejectedValue(new Error('no record'))
  })

  // Ordered acknowledgement-form questions; each is answered 'No' to reach a later one.
  const QUESTION_ORDER = ['q_stroke', 'q_admission', 'q_antibiotics', 'q_pregnant', 'q_financial_counselling', 'q_scheme', 'q_performer', 'q_eye']

  async function reachStep(step) {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'Fill up IVT Pre-Procedure Acknowledgement Form' }))
    await userEvent.click(screen.getByRole('button', { name: /singpass login/i }))
    // Existing patient → ask_update; click Yes to enter the question flow (starts at q_stroke).
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }))
    // Answer each step before `step`; q_eye requires accepting financial counselling first.
    for (const priorStep of QUESTION_ORDER.slice(0, QUESTION_ORDER.indexOf(step))) {
      if (priorStep === 'q_financial_counselling') {
        await userEvent.click(screen.getByRole('button', { name: 'Yes' }))
      } else if (priorStep === 'q_scheme') {
        await userEvent.click(screen.getByRole('button', { name: 'Private' }))
      } else if (priorStep === 'q_performer') {
        await userEvent.click(screen.getByRole('button', { name: 'Doctor' }))
      } else {
        await userEvent.click(screen.getByRole('button', { name: 'No' }))
      }
    }
  }

  it('re-asks Q1 when free-text answer is unrecognised', async () => {
    await reachStep('q_admission')
    await userEvent.type(screen.getByRole('textbox'), 'maybe')
    await userEvent.keyboard('{Enter}')
    expect(screen.getByText(/Sorry, I didn't understand that/i)).toBeInTheDocument()
    expect(screen.getByText(/Please answer Yes or No/i)).toBeInTheDocument()
  })

  it('stays on q_admission step after invalid answer (Yes/No chips still shown)', async () => {
    await reachStep('q_admission')
    await userEvent.type(screen.getByRole('textbox'), 'maybe')
    await userEvent.keyboard('{Enter}')
    expect(screen.getByRole('button', { name: 'Yes' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'No' })).toBeInTheDocument()
  })

  it('proceeds after a valid typed answer following an invalid one (q_admission)', async () => {
    await reachStep('q_admission')
    await userEvent.type(screen.getByRole('textbox'), 'maybe')
    await userEvent.keyboard('{Enter}')
    await userEvent.type(screen.getByRole('textbox'), 'no')
    await userEvent.keyboard('{Enter}')
    // Advanced to the next medical question — Yes/No chips still present
    expect(screen.getByRole('button', { name: 'Yes' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'No' })).toBeInTheDocument()
  })

  it('re-asks Q2 when free-text answer is unrecognised', async () => {
    await reachStep('q_stroke')
    await userEvent.type(screen.getByRole('textbox'), 'maybe')
    await userEvent.keyboard('{Enter}')
    expect(screen.getByText(/Sorry, I didn't understand that/i)).toBeInTheDocument()
    expect(screen.getByText(/Please answer Yes or No/i)).toBeInTheDocument()
  })

  it('stays on q_stroke step after invalid answer (Yes/No chips still shown)', async () => {
    await reachStep('q_stroke')
    await userEvent.type(screen.getByRole('textbox'), 'maybe')
    await userEvent.keyboard('{Enter}')
    expect(screen.getByRole('button', { name: 'Yes' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'No' })).toBeInTheDocument()
  })

  it('re-asks Q3 when free-text answer is unrecognised', async () => {
    await reachStep('q_eye')
    await userEvent.type(screen.getByRole('textbox'), 'dunno')
    await userEvent.keyboard('{Enter}')
    expect(screen.getByText(/Sorry, I didn't understand that/i)).toBeInTheDocument()
    expect(screen.getByText(/Please answer Right, Left, or Both/i)).toBeInTheDocument()
  })

  it('stays on q_eye step after invalid answer (Right/Left/Both chips still shown)', async () => {
    await reachStep('q_eye')
    await userEvent.type(screen.getByRole('textbox'), 'dunno')
    await userEvent.keyboard('{Enter}')
    expect(screen.getByRole('button', { name: 'Right' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Left' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Both' })).toBeInTheDocument()
  })

  it('proceeds after a valid typed answer following an invalid one (q_eye)', async () => {
    await reachStep('q_eye')
    await userEvent.type(screen.getByRole('textbox'), 'dunno')
    await userEvent.keyboard('{Enter}')
    await userEvent.type(screen.getByRole('textbox'), 'right eye')
    await userEvent.keyboard('{Enter}')
    // q_eye → cost_confirm → payment_mode → submit (added in the cost+payment-mode flow)
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }))   // cost_confirm
    await userEvent.click(screen.getByRole('button', { name: 'Medisave (Self)' })) // payment_mode → submit
    await waitFor(() => expect(submitAcknowledgement).toHaveBeenCalledOnce())
    const [payload] = submitAcknowledgement.mock.calls[0]
    expect(payload.patient_record.record_eyes).toBe('OD')
  })
})

// ─── Post-Operation Checklist ─────────────────────────────────────────────────

describe('ChatWindow — Post-Operation Checklist flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getPatient.mockResolvedValue(MOCK_PATIENT_RESPONSE)
    getEpicRecord.mockResolvedValue(MOCK_EPIC_RECORD_RESPONSE)
    getLatestAcknowledgement.mockRejectedValue(new Error('no record'))
  })

  it('shows the Singpass login button when View Post-IVT Advice Form is clicked', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'View Post-IVT Advice Form' }))
    expect(screen.getByRole('button', { name: /singpass login/i })).toBeInTheDocument()
  })

  it('shows the login prompt message before Singpass login', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'View Post-IVT Advice Form' }))
    expect(screen.getByText(/To proceed with the checklist/i)).toBeInTheDocument()
  })

  it('input is disabled while waiting for Singpass login', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'View Post-IVT Advice Form' }))
    expect(screen.getByRole('textbox')).toBeDisabled()
  })

  it('does not show the checklist before login', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'View Post-IVT Advice Form' }))
    expect(screen.queryByText(/Post Intravitreal Injection/i)).not.toBeInTheDocument()
  })

  it('renders PostIvtAdviceDoc after Singpass login', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'View Post-IVT Advice Form' }))
    await userEvent.click(screen.getByRole('button', { name: /singpass login/i }))
    expect(screen.getByText(/Post Intravitreal Injection/i)).toBeInTheDocument()
  })

  it('shows a welcome-back message after login', async () => {
    // For an existing patient the post-op flow greets "Welcome back, {name}. Here is your post-operation checklist."
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'View Post-IVT Advice Form' }))
    await userEvent.click(screen.getByRole('button', { name: /singpass login/i }))
    expect(screen.getByText(/Welcome back, Tan Ah Kow/i)).toBeInTheDocument()
  })

  it('input is disabled after the checklist is shown', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'View Post-IVT Advice Form' }))
    await userEvent.click(screen.getByRole('button', { name: /singpass login/i }))
    expect(screen.getByRole('textbox')).toBeDisabled()
  })

  it('does not call any backend API for the post-op checklist', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'View Post-IVT Advice Form' }))
    await userEvent.click(screen.getByRole('button', { name: /singpass login/i }))
    expect(submitAcknowledgement).not.toHaveBeenCalled()
    expect(sendChatMessage).not.toHaveBeenCalled()
  })
})

// ─── Return Menu ──────────────────────────────────────────────────────────────

describe('ChatWindow — Return Menu', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('clicking Return Menu appends a new welcome bubble with quick-reply pills', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'General Enquiry' }))
    // In general_enquiry mode the welcome pill (in the thread) and the suggestion-bar
    // chip both read "Return Menu"; click the active chip (the last one).
    const returnMenuButtons = screen.getAllByRole('button', { name: 'Return Menu' })
    await userEvent.click(returnMenuButtons.at(-1))
    // Two welcome bubbles are now in the thread → at least 2 "General Enquiry" buttons
    expect(screen.getAllByRole('button', { name: 'General Enquiry' }).length).toBeGreaterThanOrEqual(2)
  })

  it('clicking Appointment from the main menu shows date/time calendar inputs', async () => {
    render(<ChatWindow />)
    // Appointment lives only in the main welcome menu, not the completion bar.
    await userEvent.click(screen.getByRole('button', { name: 'Book Appointment' }))
    expect(screen.getByText(/preferred appointment date and time/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Preferred date')).toBeInTheDocument()
    expect(screen.getByLabelText('Preferred time')).toBeInTheDocument()
  })

  it('submitting appointment date/time posts confirmation in chat', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'Book Appointment' }))

    fireEvent.change(screen.getByLabelText('Preferred date'), { target: { value: '2026-08-03' } })
    fireEvent.change(screen.getByLabelText('Preferred time'), { target: { value: '09:30' } })
    await userEvent.click(screen.getByRole('button', { name: 'Confirm appointment slot' }))

    expect(screen.getByText(/Preferred appointment slot/i)).toBeInTheDocument()
    expect(screen.getByText(/has been received/i)).toBeInTheDocument()
  })

  it('does not add Appointment to the flow-completion bar (Return Menu only)', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'General Enquiry' }))
    // The completion bar shows Return Menu; the only Appointment button is the
    // historical one still in the welcome bubble, so there is exactly one.
    expect(screen.getByRole('button', { name: 'Return Menu' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Book Appointment' })).toHaveLength(1)
  })
})


