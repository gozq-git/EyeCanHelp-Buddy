import { render, screen, waitFor, fireEvent, act, within } from '@testing-library/react'
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
  enqueueAppointmentNotification: vi.fn(),
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
  enqueueAppointmentNotification,
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

  it('renders the quick-reply option pills on load (Appointment hidden, no Return Menu)', () => {
    render(<ChatWindow />)
    expect(screen.getByRole('button', { name: 'General Enquiry' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Fill up IVT Pre-Procedure Acknowledgement Form' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'View Post-IVT Advice Form' })).toBeInTheDocument()
    // Book Appointment is flagged `hidden` in QUICK_REPLY_OPTIONS; the flow it
    // opens is still implemented, just unreachable from the menu.
    expect(screen.queryByRole('button', { name: 'Book Appointment' })).not.toBeInTheDocument()
    // Return Menu is redundant on the first welcome bubble — you're already at the menu.
    expect(screen.queryByRole('button', { name: 'Return Menu' })).not.toBeInTheDocument()
  })

  it('shows the localized welcome placeholder in welcome mode', () => {
    render(<ChatWindow />)
    expect(screen.getByPlaceholderText('Write your message…')).toBeInTheDocument()
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

  it('placeholder stays localized in general enquiry mode', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'General Enquiry' }))
    expect(screen.getByPlaceholderText('Write your message…')).toBeInTheDocument()
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

  it('masks sensitive chat input before display and before API payload', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'General Enquiry' }))
    await userEvent.type(screen.getByRole('textbox'), 'Call +6591234567 on 25-03-1965')
    await userEvent.keyboard('{Enter}')

    expect(screen.getByText('Call +65******67 on 2*-0*-19**')).toBeInTheDocument()

    await waitFor(() => expect(sendChatMessageStream).toHaveBeenCalled())
    const [messages] = sendChatMessageStream.mock.calls[0]
    expect(messages.some(m => m.role === 'user' && m.content === 'Call +65******67 on 2*-0*-19**')).toBe(true)
  })

  it('shows fallback error message in chat when sendChatMessage rejects', async () => {
    sendChatMessageStream.mockRejectedValueOnce(new Error('Stream failed'))
    sendChatMessage.mockRejectedValueOnce(new Error('Network error'))
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'General Enquiry' }))
    await userEvent.type(screen.getByRole('textbox'), 'test question')
    await userEvent.keyboard('{Enter}')
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument()
    })
  })

  it('shows backend blocked message from stream 400 response', async () => {
    const blockedError = new Error('Please remove sensitive medical details.')
    blockedError.status = 400
    sendChatMessageStream.mockRejectedValueOnce(blockedError)

    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'General Enquiry' }))
    await userEvent.type(screen.getByRole('textbox'), 'offensive text')
    await userEvent.keyboard('{Enter}')

    await waitFor(() => {
      expect(screen.getByText('Please remove sensitive medical details.')).toBeInTheDocument()
    })
    expect(sendChatMessage).not.toHaveBeenCalled()
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
    expect(screen.getByText(/Are you under Private or Subsidised scheme/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Private' })) // q_scheme
    expect(screen.getByText(/Is your procedure to be performed by Doctor or Nurse/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Doctor' })) // q_performer
    expect(screen.getByRole('button', { name: 'Right' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Left' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Both' })).not.toBeInTheDocument()
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
    expect(screen.getByText(/Are you under Private or Subsidised scheme/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Private' }))
    expect(screen.getByText(/Is your procedure to be performed by Doctor or Nurse/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Doctor' }))
    expect(screen.getByRole('button', { name: 'Right' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Left' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Both' })).not.toBeInTheDocument()
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
    expect(screen.getByText(/Please answer Right or Left/i)).toBeInTheDocument()
  })

  it('stays on q_eye step after invalid answer (Right/Left chips still shown)', async () => {
    await reachStep('q_eye')
    await userEvent.type(screen.getByRole('textbox'), 'dunno')
    await userEvent.keyboard('{Enter}')
    expect(screen.getByRole('button', { name: 'Right' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Left' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Both' })).not.toBeInTheDocument()
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
  beforeEach(() => {
    vi.clearAllMocks()
    enqueueAppointmentNotification.mockResolvedValue({
      data: { status: 'accepted', queue_message_id: 'msg-1', correlation_id: 'corr-1' },
    })
  })

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

  // The Return Menu chip must be reachable from every pre-procedure prompt, so a user
  // who picks the wrong flow is never stuck. The first welcome bubble omits its own
  // Return Menu pill, so inside pre_procedure the only match is the suggestion-bar chip.
  it('offers Return Menu at the Singpass login prompt', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'Fill up IVT Pre-Procedure Acknowledgement Form' }))

    expect(screen.getByRole('button', { name: /singpass login/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Return Menu' })).toBeInTheDocument()
  })

  it('offers Return Menu at every new-patient registration question', async () => {
    // Both lookups reject → handleSingpassLogin takes the new-patient registration branch.
    getPatient.mockRejectedValue(new Error('missing'))
    getEpicRecord.mockRejectedValue(new Error('missing'))

    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'Fill up IVT Pre-Procedure Acknowledgement Form' }))
    await userEvent.click(screen.getByRole('button', { name: /singpass login/i }))

    // Name — these run while preProcStep is still 'login', which the old step
    // enumeration skipped entirely.
    expect(await screen.findByText(/What is your full name\?/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Return Menu' })).toBeInTheDocument()

    // Date of birth
    await userEvent.type(screen.getByRole('textbox'), 'Tan Ah Kow')
    await userEvent.keyboard('{Enter}')
    expect(await screen.findByText(/What is your date of birth\?/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Return Menu' })).toBeInTheDocument()

    // Phone number
    await userEvent.type(screen.getByRole('textbox'), '01-01-1990')
    await userEvent.keyboard('{Enter}')
    expect(await screen.findByText(/What is your phone number\?/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Return Menu' })).toBeInTheDocument()
  })

  it('returns to the main menu from a registration question', async () => {
    getPatient.mockRejectedValue(new Error('missing'))
    getEpicRecord.mockRejectedValue(new Error('missing'))

    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'Fill up IVT Pre-Procedure Acknowledgement Form' }))
    await userEvent.click(screen.getByRole('button', { name: /singpass login/i }))
    expect(await screen.findByText(/What is your full name\?/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Return Menu' }))

    // A second welcome bubble is appended, and the abandoned registration is cleared.
    expect(screen.getAllByRole('button', { name: 'General Enquiry' }).length).toBeGreaterThanOrEqual(2)
    expect(createPatient).not.toHaveBeenCalled()
  })

  // The three appointment-flow tests below are skipped, not deleted: the flow is
  // still fully implemented, but its only entry point (the 'Book Appointment'
  // menu pill) is flagged `hidden` in QUICK_REPLY_OPTIONS, so it can no longer
  // be driven through the UI. Un-hide that option to re-enable these.
  it.skip('clicking Appointment from the main menu asks for Singpass login first, then shows weekday and period inputs', async () => {
    render(<ChatWindow />)
    getPatient.mockResolvedValue(MOCK_PATIENT_RESPONSE)
    getEpicRecord.mockResolvedValue(MOCK_EPIC_RECORD_RESPONSE)

    // Appointment lives only in the main welcome menu, not the completion bar.
    await userEvent.click(screen.getByRole('button', { name: 'Book Appointment' }))
    expect(screen.getByRole('button', { name: /singpass login/i })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /singpass login/i }))
    expect(screen.getByText(/preferred appointment day/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Preferred day')).toBeInTheDocument()
    expect(screen.getByLabelText('Preferred period')).toBeInTheDocument()
  })

  // Skipped: entry point hidden (see note above); flow code retained.
  it.skip('submitting appointment day/period posts confirmation in chat', async () => {
    render(<ChatWindow />)
    getPatient.mockResolvedValue(MOCK_PATIENT_RESPONSE)
    getEpicRecord.mockResolvedValue(MOCK_EPIC_RECORD_RESPONSE)

    await userEvent.click(screen.getByRole('button', { name: 'Book Appointment' }))
    await userEvent.click(screen.getByRole('button', { name: /singpass login/i }))

    fireEvent.change(screen.getByLabelText('Preferred day'), { target: { value: 'Monday' } })
    fireEvent.change(screen.getByLabelText('Preferred period'), { target: { value: 'AM' } })
    await userEvent.click(screen.getByRole('button', { name: 'Confirm appointment slot' }))

    await waitFor(() => expect(enqueueAppointmentNotification).toHaveBeenCalledOnce())
    expect(enqueueAppointmentNotification).toHaveBeenCalledWith({
      patient_id: 'P001',
      patient_name: 'Tan Ah Kow',
      preferred_day: 'Monday',
      preferred_period: 'AM',
      appointment_timezone: 'Asia/Singapore',
      clinic_name: 'TTSH Eye Clinic',
      requested_by: 'chatbot',
    })

    expect(screen.getByText(/Preferred appointment slot: Monday AM/i)).toBeInTheDocument()
    expect(screen.getByText(/has been received/i)).toBeInTheDocument()
  })

  // Skipped: entry point hidden (see note above); flow code retained.
  it.skip('shows an error message when appointment notification enqueue fails', async () => {
    enqueueAppointmentNotification.mockRejectedValueOnce(new Error('Queue unavailable'))
    render(<ChatWindow />)
    getPatient.mockResolvedValue(MOCK_PATIENT_RESPONSE)
    getEpicRecord.mockResolvedValue(MOCK_EPIC_RECORD_RESPONSE)

    await userEvent.click(screen.getByRole('button', { name: 'Book Appointment' }))
    await userEvent.click(screen.getByRole('button', { name: /singpass login/i }))

    fireEvent.change(screen.getByLabelText('Preferred day'), { target: { value: 'Tuesday' } })
    fireEvent.change(screen.getByLabelText('Preferred period'), { target: { value: 'PM' } })
    await userEvent.click(screen.getByRole('button', { name: 'Confirm appointment slot' }))

    await waitFor(() => {
      expect(screen.getByText(/could not submit your appointment request right now/i)).toBeInTheDocument()
    })
  })

  it('does not add Appointment to the flow-completion bar (Return Menu only)', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'General Enquiry' }))
    // The completion bar shows Return Menu. Appointment appears nowhere at all
    // now that its menu option is flagged `hidden`.
    expect(screen.getByRole('button', { name: 'Return Menu' })).toBeInTheDocument()
    expect(screen.queryAllByRole('button', { name: 'Book Appointment' })).toHaveLength(0)
  })
})

describe('ChatWindow — multilingual non-general flows', () => {
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

  it('uses localized selection labels while preserving canonical English payload values', async () => {
    render(<ChatWindow language="zh" />)
    await userEvent.click(screen.getByRole('button', { name: '填写 IVT 术前确认表' }))
    await userEvent.click(screen.getByRole('button', { name: /singpass login/i }))

    await userEvent.click(screen.getByRole('button', { name: '是' }))
    await userEvent.click(screen.getByRole('button', { name: '否' }))
    await userEvent.click(screen.getByRole('button', { name: '否' }))
    await userEvent.click(screen.getByRole('button', { name: '否' }))
    await userEvent.click(screen.getByRole('button', { name: '否' }))
    await userEvent.click(screen.getByRole('button', { name: '是' }))
    await userEvent.click(screen.getByRole('button', { name: '私人' }))
    await userEvent.click(screen.getByRole('button', { name: '医生' }))
    await userEvent.click(screen.getByRole('button', { name: '右眼' }))
    await userEvent.click(screen.getByRole('button', { name: '是' }))
    await userEvent.click(screen.getByRole('button', { name: 'Medisave（本人）' }))

    await waitFor(() => expect(submitAcknowledgement).toHaveBeenCalledOnce())
    const [payload] = submitAcknowledgement.mock.calls[0]
    expect(payload.patient_record.record_class).toBe('PTE')
    expect(payload.patient_record.record_performer).toBe('Doctor')
    expect(payload.patient_record.record_eyes).toBe('OD')
    expect(payload.payment.payment_mode).toBe('Medisave (Self)')
  })

  it('rejects non-English patient names during registration', async () => {
    getPatient.mockRejectedValueOnce(new Error('missing'))
    getEpicRecord.mockRejectedValueOnce(new Error('missing'))

    render(<ChatWindow language="zh" />)
    await userEvent.click(screen.getByRole('button', { name: '填写 IVT 术前确认表' }))
    await userEvent.click(screen.getByRole('button', { name: /singpass login/i }))

    await userEvent.type(screen.getByRole('textbox'), '张三')
    await userEvent.keyboard('{Enter}')

    expect(screen.getByText(/请输入英文姓名/i)).toBeInTheDocument()
    expect(createPatient).not.toHaveBeenCalled()
  })
})


// ─── API failure paths ────────────────────────────────────────────────────────

// Every `catch` in ChatWindow is a "backend is down" path a real user can hit, and
// the other suites only ever mock resolutions. These drive each rejection and assert
// the user-visible fallback rather than the internals.

describe('ChatWindow — API failure paths', () => {
  // Walks an existing patient from the menu to the given pre-procedure step.
  const answerThrough = async (...labels) => {
    for (const label of labels) {
      await userEvent.click(screen.getByRole('button', { name: label }))
    }
  }

  const startPreProc = async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'Fill up IVT Pre-Procedure Acknowledgement Form' }))
    await userEvent.click(screen.getByRole('button', { name: /singpass login/i }))
  }

  beforeEach(() => {
    vi.clearAllMocks()
    getPatient.mockResolvedValue(MOCK_PATIENT_RESPONSE)
    getEpicRecord.mockResolvedValue(MOCK_EPIC_RECORD_RESPONSE)
    submitAcknowledgement.mockResolvedValue(MOCK_ACK_RESPONSE)
    getLatestAcknowledgement.mockRejectedValue(new Error('no record'))
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
  })

  it('falls back to the EPIC record when the patient lookup fails', async () => {
    // getPatient rejects, getEpicRecord resolves → still an existing patient,
    // named from the EPIC record rather than the DB row.
    getPatient.mockRejectedValue(new Error('db down'))

    await startPreProc()

    expect(await screen.findByText(/Welcome back, Tan Ah Kow/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Yes' })).toBeInTheDocument()
    expect(createPatient).not.toHaveBeenCalled()
  })

  it('continues into the form when the patient has no EPIC record', async () => {
    // In the DB but EPIC lookup fails — the flow synthesises a minimal record
    // instead of dropping the user into registration.
    getEpicRecord.mockRejectedValue(new Error('no epic record'))

    await startPreProc()

    expect(await screen.findByText(/Welcome back, Tan Ah Kow/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Yes' })).toBeInTheDocument()
  })

  it('shows a save error when profile creation fails', async () => {
    getPatient.mockRejectedValue(new Error('missing'))
    getEpicRecord.mockRejectedValue(new Error('missing'))
    createPatient.mockRejectedValue(new Error('write failed'))

    await startPreProc()

    await userEvent.type(screen.getByRole('textbox'), 'Tan Ah Kow')
    await userEvent.keyboard('{Enter}')
    await userEvent.type(screen.getByRole('textbox'), '01-01-1990')
    await userEvent.keyboard('{Enter}')
    await userEvent.type(screen.getByRole('textbox'), '91234567')
    await userEvent.keyboard('{Enter}')

    await waitFor(() => expect(createPatient).toHaveBeenCalledOnce())
    expect(await screen.findByText(/there was an error saving your profile/i)).toBeInTheDocument()
    // Registration failed, so the flow must not claim the profile was created.
    expect(screen.queryByText(/Your profile has been created/i)).not.toBeInTheDocument()
  })

  it('falls back to EPIC data when the saved acknowledgement cannot be fetched', async () => {
    // ask_update → No re-displays the last submission; with the fetch failing it
    // renders from the EPIC record instead of erroring.
    await startPreProc()
    await answerThrough('No')

    expect(await screen.findByText(/Here is your existing form/i)).toBeInTheDocument()
    expect(await screen.findByText('Pre-Procedure Acknowledgement Form')).toBeInTheDocument()
    expect(screen.getByText(/Financial Counselling & Advice/i)).toBeInTheDocument()
  })

  it('keeps the user on the eye question when billing rates are unavailable', async () => {
    calculateBill.mockRejectedValue(new Error('pricing not configured'))

    await startPreProc()
    await answerThrough('Yes', 'No', 'No', 'No', 'No', 'Yes', 'Private', 'Doctor', 'Right')

    expect(await screen.findByText(/could not retrieve billing rates/i)).toBeInTheDocument()
    // Still on q_eye — the chips remain so the answer can be retried.
    expect(screen.getByRole('button', { name: 'Right' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Left' })).toBeInTheDocument()
    expect(submitAcknowledgement).not.toHaveBeenCalled()
  })

  it('keeps the user on the eye question when billing returns a malformed quote', async () => {
    // A 200 with non-numeric bounds is as unusable as a rejection — it must not reach
    // the cost confirmation with NaN in the copy.
    calculateBill.mockResolvedValue({ data: { estimated_cost_min: null, estimated_cost_max: 'n/a' } })

    await startPreProc()
    await answerThrough('Yes', 'No', 'No', 'No', 'No', 'Yes', 'Private', 'Doctor', 'Right')

    expect(await screen.findByText(/could not retrieve billing rates/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Right' })).toBeInTheDocument()
    expect(submitAcknowledgement).not.toHaveBeenCalled()
  })

  it('still confirms the acknowledgement when declining counselling and the save fails', async () => {
    submitAcknowledgement.mockRejectedValue(new Error('save failed'))

    await startPreProc()
    await answerThrough('Yes', 'No', 'No', 'No', 'No', 'No')

    await waitFor(() => expect(submitAcknowledgement).toHaveBeenCalledOnce())
    expect(await screen.findByText(/No problem\. I've saved your acknowledgement/i)).toBeInTheDocument()
  })

  it('still confirms the acknowledgement when declining the cost and the save fails', async () => {
    submitAcknowledgement.mockRejectedValue(new Error('save failed'))

    await startPreProc()
    await answerThrough('Yes', 'No', 'No', 'No', 'No', 'Yes', 'Private', 'Doctor', 'Right')
    await answerThrough('No') // cost_confirm

    await waitFor(() => expect(submitAcknowledgement).toHaveBeenCalledOnce())
    expect(await screen.findByText(/Understood\. I've saved your acknowledgement/i)).toBeInTheDocument()
  })

  it('renders the financial document from local answers when the final save fails', async () => {
    submitAcknowledgement.mockRejectedValue(new Error('save failed'))

    await startPreProc()
    await answerThrough('Yes', 'No', 'No', 'No', 'No', 'Yes', 'Private', 'Doctor', 'Right', 'Yes')
    await answerThrough('Medisave (Self)') // payment_mode → submit

    await waitFor(() => expect(submitAcknowledgement).toHaveBeenCalledOnce())
    // The doc is still shown, built from the local answers rather than the response.
    // Asserted on labels the document alone renders — the intro copy ("Here is your
    // Financial Counselling & Advice Form.") repeats the heading text in a chat bubble.
    expect(await screen.findByText(/MCR:/)).toBeInTheDocument()
    expect(screen.getByText('Site:')).toBeInTheDocument()
  })
})

// ─── Switching flows while already signed in ─────────────────────────────────

// Return Menu deliberately keeps the Singpass login in memory, so picking a second
// flow reuses it instead of asking the user to sign in again. Every suite above
// completes at most one flow per render, so none of that reuse was exercised.

describe('ChatWindow — switching flows while already signed in', () => {
  const singpassButtons = () => screen.getAllByRole('button', { name: /singpass login/i })

  // Returns to the menu and picks another flow. The thread keeps every welcome bubble
  // it has shown, so the freshest copy of a menu pill is the last match.
  const returnToMenuAndPick = async (label) => {
    await userEvent.click(screen.getAllByRole('button', { name: 'Return Menu' }).at(-1))
    await userEvent.click(screen.getAllByRole('button', { name: label }).at(-1))
  }

  const signInVia = async (label) => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: label }))
    await userEvent.click(screen.getByRole('button', { name: /singpass login/i }))
  }

  beforeEach(() => {
    vi.clearAllMocks()
    getPatient.mockResolvedValue(MOCK_PATIENT_RESPONSE)
    getEpicRecord.mockResolvedValue(MOCK_EPIC_RECORD_RESPONSE)
    getLatestAcknowledgement.mockRejectedValue(new Error('no record'))
  })

  it('goes straight to the post-op checklist without a second Singpass login', async () => {
    getLatestAcknowledgement.mockResolvedValue({ data: { record_eyes: 'OS', issued: '2024-05-01T00:00:00' } })

    await signInVia('Fill up IVT Pre-Procedure Acknowledgement Form')
    await returnToMenuAndPick('View Post-IVT Advice Form')

    expect(await screen.findByText(/Welcome back, Tan Ah Kow\. Here is your post-operation checklist/i)).toBeInTheDocument()
    expect(getLatestAcknowledgement).toHaveBeenCalledWith('P001')
    // Only the pre-procedure prompt's login button is in the thread — no new one.
    expect(singpassButtons()).toHaveLength(1)
  })

  it('shows the post-op checklist even when no prior acknowledgement exists', async () => {
    await signInVia('Fill up IVT Pre-Procedure Acknowledgement Form')
    await returnToMenuAndPick('View Post-IVT Advice Form')

    expect(await screen.findByText(/Welcome back, Tan Ah Kow\. Here is your post-operation checklist/i)).toBeInTheDocument()
    expect(singpassButtons()).toHaveLength(1)
  })

  it('goes straight to the update question when picking the pre-procedure form second', async () => {
    await signInVia('View Post-IVT Advice Form')
    await returnToMenuAndPick('Fill up IVT Pre-Procedure Acknowledgement Form')

    expect(await screen.findByText(/Welcome back, Tan Ah Kow\. We will now proceed with the form/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Yes' })).toBeInTheDocument()
    expect(singpassButtons()).toHaveLength(1)
  })

  it('re-resolves the patient identity after an abandoned registration', async () => {
    // Both lookups fail on the first login, so the user lands in registration with an
    // id but no name or record. Abandoning it and picking a flow has to look both up
    // again rather than carry the blank state forward.
    getPatient.mockRejectedValueOnce(new Error('missing'))
    getEpicRecord.mockRejectedValueOnce(new Error('missing'))

    await signInVia('Fill up IVT Pre-Procedure Acknowledgement Form')
    expect(await screen.findByText(/What is your full name\?/)).toBeInTheDocument()

    await returnToMenuAndPick('Fill up IVT Pre-Procedure Acknowledgement Form')

    expect(await screen.findByText(/Welcome back, Tan Ah Kow\. We will now proceed with the form/i)).toBeInTheDocument()
    expect(getPatient).toHaveBeenCalledTimes(2)
    expect(getEpicRecord).toHaveBeenCalledTimes(2)
    expect(createPatient).not.toHaveBeenCalled()
  })

  it('falls back to the patient id as the name when both lookups keep failing', async () => {
    getPatient.mockRejectedValue(new Error('db down'))
    getEpicRecord.mockRejectedValue(new Error('db down'))

    await signInVia('Fill up IVT Pre-Procedure Acknowledgement Form')
    expect(await screen.findByText(/What is your full name\?/)).toBeInTheDocument()

    await returnToMenuAndPick('Fill up IVT Pre-Procedure Acknowledgement Form')

    expect(await screen.findByText(/Welcome back, P001\. We will now proceed with the form/i)).toBeInTheDocument()
  })
})

// ─── Streaming reply lifecycle ────────────────────────────────────────────────

// The General Enquiry suite only drives the single-chunk happy path. These cover the
// rest of handleSend's stream handling: chunk accumulation, heartbeats, abort, and
// the non-streaming retry.

describe('ChatWindow — streaming reply lifecycle', () => {
  const ask = async (question = 'What is AMD?') => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'General Enquiry' }))
    await userEvent.type(screen.getByRole('textbox'), question)
    await userEvent.keyboard('{Enter}')
  }

  // Emits the given chunks, then fails the stream — the shape of a dropped connection
  // after a partial answer has already been rendered.
  const streamThenFail = (chunk, error) => {
    sendChatMessageStream.mockImplementation(async (_history, { onChunk }) => {
      onChunk(chunk)
      throw error
    })
  }

  beforeEach(() => { vi.clearAllMocks() })

  it('appends later chunks to the bubble the first chunk created', async () => {
    sendChatMessageStream.mockImplementation(async (_history, { onChunk }) => {
      onChunk('Macular ')
      onChunk('degeneration ')
      onChunk('affects central vision.')
      return 'ignored when chunks arrived'
    })

    await ask()

    expect(await screen.findByText('Macular degeneration affects central vision.')).toBeInTheDocument()
    expect(screen.queryByText('ignored when chunks arrived')).not.toBeInTheDocument()
  })

  it('uses the returned text when the stream never emits a chunk', async () => {
    sendChatMessageStream.mockResolvedValue('Buffered reply.')

    await ask()

    expect(await screen.findByText('Buffered reply.')).toBeInTheDocument()
  })

  it('shows a placeholder line when the stream returns nothing at all', async () => {
    sendChatMessageStream.mockResolvedValue('')

    await ask()

    expect(await screen.findByText(/No response returned from coordinator runtime/i)).toBeInTheDocument()
  })

  it('grows the thinking indicator with each heartbeat while the stream is open', async () => {
    let release
    sendChatMessageStream.mockImplementation(async (_history, { onHeartbeat }) => {
      onHeartbeat()
      onHeartbeat()
      await new Promise(resolve => { release = resolve })
      return 'Done waiting.'
    })

    await ask()

    // One dot per heartbeat, so a slow coordinator still looks alive.
    expect(await screen.findByText('Thinking..')).toBeInTheDocument()

    await act(async () => { release() })
    expect(await screen.findByText('Done waiting.')).toBeInTheDocument()
    expect(screen.queryByText('Thinking..')).not.toBeInTheDocument()
  })

  it('drops the partial bubble when the stream is aborted', async () => {
    // Unmounting mid-stream aborts the controller; the half-written answer must go
    // with it rather than being left in the thread as a truncated reply.
    streamThenFail('Partial answer', Object.assign(new Error('aborted'), { name: 'AbortError' }))

    await ask()

    await waitFor(() => expect(screen.queryByText('Partial answer')).not.toBeInTheDocument())
    expect(sendChatMessage).not.toHaveBeenCalled()
  })

  it('replaces a partial bubble with the guardrail detail on a 400', async () => {
    streamThenFail('Partial answer', Object.assign(new Error('Streaming request failed: 400'), {
      status: 400,
      response: { data: { detail: 'Your message was blocked by the content guardrail.' } },
    }))

    await ask()

    expect(await screen.findByText(/blocked by the content guardrail/i)).toBeInTheDocument()
    expect(screen.queryByText('Partial answer')).not.toBeInTheDocument()
    // A guardrail refusal is a real answer, so retrying without the stream is pointless.
    expect(sendChatMessage).not.toHaveBeenCalled()
  })

  it('replaces the partial bubble with the non-streaming reply when the stream drops', async () => {
    streamThenFail('Partial answer', new Error('connection reset'))
    sendChatMessage.mockResolvedValue({ data: { reply: 'Full reply from the fallback.' } })

    await ask()

    expect(await screen.findByText('Full reply from the fallback.')).toBeInTheDocument()
    expect(screen.queryByText('Partial answer')).not.toBeInTheDocument()
  })

  it('uses the non-streaming reply when the stream fails before any chunk', async () => {
    sendChatMessageStream.mockRejectedValue(new Error('connection reset'))
    sendChatMessage.mockResolvedValue({ data: { reply: 'Fallback reply.' } })

    await ask()

    expect(await screen.findByText('Fallback reply.')).toBeInTheDocument()
  })

  it('drops the partial bubble and shows the default error when both requests fail', async () => {
    streamThenFail('Partial answer', new Error('connection reset'))
    // A status-only transport message is not worth showing, so the default copy wins.
    sendChatMessage.mockRejectedValue(new Error('Streaming request failed: 503'))

    await ask()

    expect(await screen.findByText('Sorry, I encountered an error. Please try again.')).toBeInTheDocument()
    expect(screen.queryByText('Partial answer')).not.toBeInTheDocument()
  })
})

// ─── Pre-procedure re-prompts ─────────────────────────────────────────────────

// Every question re-asks itself rather than advancing on an answer it can't parse.
// The validation suite above covers three of those steps; these cover the rest, so a
// new step can't silently skip its guard.

describe('ChatWindow — pre-procedure re-prompts on unrecognised answers', () => {
  const answerThrough = async (...labels) => {
    for (const label of labels) {
      await userEvent.click(screen.getByRole('button', { name: label }))
    }
  }

  const startPreProc = async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'Fill up IVT Pre-Procedure Acknowledgement Form' }))
    await userEvent.click(screen.getByRole('button', { name: /singpass login/i }))
  }

  const typeAnswer = async (text) => {
    await userEvent.type(screen.getByRole('textbox'), text)
    await userEvent.keyboard('{Enter}')
  }

  // A re-prompt repeats the question, so the question text appears twice in the thread.
  const timesAsked = (pattern) => screen.getAllByText(pattern).length

  beforeEach(() => {
    vi.clearAllMocks()
    getPatient.mockResolvedValue(MOCK_PATIENT_RESPONSE)
    getEpicRecord.mockResolvedValue(MOCK_EPIC_RECORD_RESPONSE)
    submitAcknowledgement.mockResolvedValue(MOCK_ACK_RESPONSE)
    getLatestAcknowledgement.mockRejectedValue(new Error('no record'))
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
  })

  it('re-asks whether to update the profile', async () => {
    await startPreProc()
    await typeAnswer('maybe later')

    expect(timesAsked(/Would you like to update your information\?/)).toBe(2)
    expect(screen.getByRole('button', { name: 'Yes' })).toBeInTheDocument()
  })

  it('re-asks the antibiotics question', async () => {
    await startPreProc()
    await answerThrough('Yes', 'No', 'No')
    await typeAnswer('maybe')

    expect(timesAsked(/Are you on antibiotics\?/)).toBe(2)
  })

  it('re-asks the pregnancy question', async () => {
    await startPreProc()
    await answerThrough('Yes', 'No', 'No', 'No')
    await typeAnswer('maybe')

    expect(timesAsked(/Are you pregnant\?/)).toBe(2)
  })

  it('re-asks the financial counselling question', async () => {
    await startPreProc()
    await answerThrough('Yes', 'No', 'No', 'No', 'No')
    await typeAnswer('maybe')

    expect(timesAsked(/Would you like to proceed with financial counselling now\?/)).toBe(2)
    expect(submitAcknowledgement).not.toHaveBeenCalled()
  })

  it('re-asks the scheme question', async () => {
    await startPreProc()
    await answerThrough('Yes', 'No', 'No', 'No', 'No', 'Yes')
    await typeAnswer('gold class')

    expect(timesAsked(/Are you under Private or Subsidised scheme\?/)).toBe(2)
  })

  it('re-asks the performer question, then advances on the Nurse chip', async () => {
    await startPreProc()
    // Subsidised and Nurse are the chips the happy-path suites never click.
    await answerThrough('Yes', 'No', 'No', 'No', 'No', 'Yes', 'Subsidised')
    await typeAnswer('my optician')

    expect(timesAsked(/Is your procedure to be performed by Doctor or Nurse\?/)).toBe(2)

    await answerThrough('Nurse')
    expect(screen.getByRole('button', { name: 'Right' })).toBeInTheDocument()

    await answerThrough('Left', 'Yes', 'Medisave (Self)')
    await waitFor(() => expect(submitAcknowledgement).toHaveBeenCalledOnce())
    const [payload] = submitAcknowledgement.mock.calls[0]
    expect(payload.patient_record.record_class).toBe('SUB')
    expect(payload.patient_record.record_performer).toBe('Nurse')
  })

  it('re-asks the cost confirmation', async () => {
    await startPreProc()
    await answerThrough('Yes', 'No', 'No', 'No', 'No', 'Yes', 'Private', 'Doctor', 'Right')
    expect(await screen.findByText(/total cost of the procedure will be/i)).toBeInTheDocument()

    await typeAnswer('maybe')

    expect(timesAsked(/total cost of the procedure will be/i)).toBe(2)
    expect(submitAcknowledgement).not.toHaveBeenCalled()
  })

  it('re-asks the payment mode', async () => {
    await startPreProc()
    await answerThrough('Yes', 'No', 'No', 'No', 'No', 'Yes', 'Private', 'Doctor', 'Right', 'Yes')
    await typeAnswer('bank transfer')

    expect(await screen.findByText(/Please choose one:/i)).toBeInTheDocument()
    expect(submitAcknowledgement).not.toHaveBeenCalled()
  })
})

// ─── New-patient registration ─────────────────────────────────────────────────

describe('ChatWindow — new-patient registration', () => {
  const startRegistration = async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'Fill up IVT Pre-Procedure Acknowledgement Form' }))
    await userEvent.click(screen.getByRole('button', { name: /singpass login/i }))
    expect(await screen.findByText(/What is your full name\?/)).toBeInTheDocument()
  }

  const typeAnswer = async (text) => {
    await userEvent.type(screen.getByRole('textbox'), text)
    await userEvent.keyboard('{Enter}')
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Neither lookup finds the id → handleSingpassLogin takes the registration branch.
    getPatient.mockRejectedValue(new Error('missing'))
    getEpicRecord.mockRejectedValue(new Error('missing'))
    createPatient.mockResolvedValue({ data: { patient_id: 'P001' } })
  })

  it('rejects a date of birth that is not DD-MM-YYYY', async () => {
    await startRegistration()
    await typeAnswer('Tan Ah Kow')
    await typeAnswer('1990/01/01')

    expect(await screen.findByText(/date of birth in DD-MM-YYYY format/i)).toBeInTheDocument()
    expect(screen.queryByText(/What is your phone number\?/)).not.toBeInTheDocument()
  })

  it('rejects a date of birth that is well-formed but impossible', async () => {
    await startRegistration()
    await typeAnswer('Tan Ah Kow')
    await typeAnswer('31-13-1990')

    expect(await screen.findByText(/That date doesn.t look right/i)).toBeInTheDocument()
    expect(screen.queryByText(/What is your phone number\?/)).not.toBeInTheDocument()
  })

  it('rejects a phone number that is not digits', async () => {
    await startRegistration()
    await typeAnswer('Tan Ah Kow')
    await typeAnswer('01-01-1990')
    await typeAnswer('call-me')

    expect(await screen.findByText(/valid phone number/i)).toBeInTheDocument()
    expect(createPatient).not.toHaveBeenCalled()
  })

  it('creates the profile and starts the questions once every answer is valid', async () => {
    await startRegistration()
    await typeAnswer('Tan Ah Kow')
    await typeAnswer('01-01-1990')
    await typeAnswer('91234567')

    await waitFor(() => expect(createPatient).toHaveBeenCalledOnce())
    // The user types DD-MM-YYYY; the backend is sent ISO.
    expect(createPatient).toHaveBeenCalledWith({
      patient_id: 'P001',
      patient_name: 'Tan Ah Kow',
      patient_dob: '1990-01-01',
      phone_number: '91234567',
    })
    expect(await screen.findByText(/Your profile has been created/i)).toBeInTheDocument()
    // Straight into the first acknowledgement question — no update prompt for a new profile.
    expect(screen.getByRole('button', { name: 'Yes' })).toBeInTheDocument()
    expect(screen.queryByText(/Would you like to update your information\?/)).not.toBeInTheDocument()
  })
})

// ─── Financial document fallbacks ─────────────────────────────────────────────

// The financial document is assembled from a `record ?? local answer ?? literal`
// chain per field. Every other suite mocks a complete submitAcknowledgement response,
// so only the first arm of each chain ran — a thin response would silently paper the
// document with defaults (Right eye, H35.31, 1 injection) and a patient would be shown
// a bill that doesn't match what they answered.

describe('ChatWindow — financial document fallbacks', () => {
  // Queries are scoped to the document itself: the chat thread above it repeats the
  // payment options as a bulleted prompt and again as the user's own reply, so an
  // unscoped getByText('Cash') matches three different nodes.
  const doc = () => screen.getByText(/Outpatient Procedures \(Intravitreal\)/i).parentElement

  // Mirrors FinancialCounsellingDoc.test.jsx: the checkbox is the input next to its label.
  const checkboxFor = (labelText) => within(doc()).getByText(labelText).parentElement.querySelector('input[type="checkbox"]')

  // The injection count appears twice — once next to the estimate, once inside the
  // counselling statement — so assert the statement, which carries the cost too.
  const counsellingStatement = (pattern) => within(doc()).getByText(pattern)

  const answerThrough = async (...labels) => {
    for (const label of labels) {
      await userEvent.click(screen.getByRole('button', { name: label }))
    }
  }

  // Private / Doctor / Right eye / Medisave (Self), all answered locally.
  const completePreProc = async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'Fill up IVT Pre-Procedure Acknowledgement Form' }))
    await userEvent.click(screen.getByRole('button', { name: /singpass login/i }))
    await answerThrough('Yes', 'No', 'No', 'No', 'No', 'Yes', 'Private', 'Doctor', 'Right', 'Yes')
    await answerThrough('Medisave (Self)')
    await waitFor(() => expect(submitAcknowledgement).toHaveBeenCalledOnce())
    expect(await screen.findByText(/MCR:/)).toBeInTheDocument()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    getPatient.mockResolvedValue(MOCK_PATIENT_RESPONSE)
    getEpicRecord.mockResolvedValue(MOCK_EPIC_RECORD_RESPONSE)
    getLatestAcknowledgement.mockRejectedValue(new Error('no record'))
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
  })

  it('builds the document from the local answers when the save returns no record or payment', async () => {
    // A 200 with an empty body — every field has to come from the answers and the
    // EPIC record rather than from the response.
    submitAcknowledgement.mockResolvedValue({ data: {} })

    await completePreProc()

    expect(checkboxFor('RIGHT')).toBeChecked()      // updated.record_eyes
    expect(checkboxFor('LEFT')).not.toBeChecked()
    expect(checkboxFor('PTE')).toBeChecked()        // updated.record_class
    expect(checkboxFor('SUB')).not.toBeChecked()
    expect(checkboxFor('1B SL700VX — Intravitreal Inj')).toBeChecked() // updated.record_performer
    expect(checkboxFor('Faricimab')).toBeChecked()  // epicRecord.record_medication
    expect(checkboxFor('AMD (Exudative) H12.3')).toBeChecked() // the H35.31 literal
    expect(checkboxFor('Medisave (Self)')).toBeChecked()       // the locally chosen mode
    expect(within(doc()).getByText('$430 - $480')).toBeInTheDocument()
    expect(within(doc()).getByText('$250')).toBeInTheDocument()  // updated.max_medisave_claimable
    expect(counsellingStatement(/estimated bill of \$430 - \$480 for 1 injection\(s\)/i)).toBeInTheDocument()
  })

  it('keeps the subsidised nurse-led answers when the save returns no record or payment', async () => {
    // The opposite answer on every field the chain falls back on, so a default
    // leaking through is visible rather than coincidentally correct.
    submitAcknowledgement.mockResolvedValue({ data: {} })

    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'Fill up IVT Pre-Procedure Acknowledgement Form' }))
    await userEvent.click(screen.getByRole('button', { name: /singpass login/i }))
    await answerThrough('Yes', 'No', 'No', 'No', 'No', 'Yes', 'Subsidised', 'Nurse', 'Left', 'Yes')
    await answerThrough('Cash')

    await waitFor(() => expect(submitAcknowledgement).toHaveBeenCalledOnce())
    expect(await screen.findByText(/MCR:/)).toBeInTheDocument()

    expect(checkboxFor('LEFT')).toBeChecked()
    expect(checkboxFor('RIGHT')).not.toBeChecked()
    expect(checkboxFor('SUB')).toBeChecked()
    expect(checkboxFor('PTE')).not.toBeChecked()
    expect(checkboxFor('1B SL700V1A — Nurse-Led Intravitreal Inj')).toBeChecked()
    expect(checkboxFor('1B SL700VX — Intravitreal Inj')).not.toBeChecked()
    expect(checkboxFor('Cash')).toBeChecked()
    expect(checkboxFor('Medisave (Self)')).not.toBeChecked()
  })

  it('falls back to the default medication when neither the response nor EPIC names one', async () => {
    // In the DB but not in EPIC, so the synthesised record carries only an id and name.
    getEpicRecord.mockRejectedValue(new Error('no epic record'))
    submitAcknowledgement.mockResolvedValue({ data: {} })

    await completePreProc()

    // The empty string must fall through to the document's own default so this form
    // still tallies with the Post-IVT advice sheet.
    expect(checkboxFor('Faricimab')).toBeChecked()
    expect(checkboxFor('Others')).not.toBeChecked()
  })

  it('prefers the saved record over the local answers when the response is complete', async () => {
    // The backend is authoritative: it may correct the eye, diagnosis, class,
    // performer and injection count recorded against the submission.
    submitAcknowledgement.mockResolvedValue({
      data: {
        record: {
          record_name: 'Tan Ah Kow',
          record_eyes: 'OS',
          record_diagnosis: 'H36.0',
          record_class: 'SUB',
          record_performer: 'Nurse',
          record_medication: 'Lucentis',
          record_number_of_injections: 3,
          issued: '2024-05-01T00:00:00',
        },
        payment: { payment_maxMedisave: 600, payment_mode: 'MAF' },
      },
    })

    await completePreProc()

    expect(checkboxFor('LEFT')).toBeChecked()       // OS, though the user picked Right
    expect(checkboxFor('SUB')).toBeChecked()        // though the user picked Private
    expect(checkboxFor('1B SL700V1A — Nurse-Led Intravitreal Inj')).toBeChecked()
    expect(checkboxFor('Lucentis')).toBeChecked()
    expect(checkboxFor('CSME H45.6')).toBeChecked()
    expect(checkboxFor('MAF')).toBeChecked()
    expect(within(doc()).getByText('$600')).toBeInTheDocument()
    expect(within(doc()).getByText('01 May 2024')).toBeInTheDocument()
    // The local estimate still drives the cost — the response carries no range.
    expect(counsellingStatement(/estimated bill of \$430 - \$480 for 3 injection\(s\)/i)).toBeInTheDocument()
  })
})

// ─── Saved acknowledgement reuse ──────────────────────────────────────────────

// The latest Mongo acknowledgement is the most recent decision, so it is layered over
// the EPIC seed wherever both exist. The suites above only ever reject that fetch.

describe('ChatWindow — saved acknowledgement reuse', () => {
  const SAVED_ACK = {
    data: {
      patient_id: 'P001',
      record_name: 'Tan Ah Kow',
      record_eyes: 'OS',
      record_diagnosis: 'H35.32',
      issued: '2024-05-01T00:00:00',
      record_stroke_heartAtt_last6mths: true,
      record_last3mths_admission: false,
      record_taking_antibiotics: true,
      record_pregnant: false,
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    getPatient.mockResolvedValue(MOCK_PATIENT_RESPONSE)
    getEpicRecord.mockResolvedValue(MOCK_EPIC_RECORD_RESPONSE)
    getLatestAcknowledgement.mockResolvedValue(SAVED_ACK)
    createPatient.mockResolvedValue({ data: { patient_id: 'P001' } })
  })

  it('re-displays the saved form when the user declines to update', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'Fill up IVT Pre-Procedure Acknowledgement Form' }))
    await userEvent.click(screen.getByRole('button', { name: /singpass login/i }))
    await userEvent.click(screen.getByRole('button', { name: 'No' })) // ask_update

    expect(await screen.findByText(/Here is your existing form/i)).toBeInTheDocument()
    expect(await screen.findByText('Pre-Procedure Acknowledgement Form')).toBeInTheDocument()
    expect(getLatestAcknowledgement).toHaveBeenCalledWith('P001')
    // Nothing is re-submitted — the saved record is only being shown back.
    expect(submitAcknowledgement).not.toHaveBeenCalled()
  })

  it('merges the saved acknowledgement over EPIC when signing in for post-op', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'View Post-IVT Advice Form' }))
    await userEvent.click(screen.getByRole('button', { name: /singpass login/i }))

    expect(await screen.findByText(/Welcome back, Tan Ah Kow\. Here is your post-operation checklist/i)).toBeInTheDocument()
    expect(getLatestAcknowledgement).toHaveBeenCalledWith('P001')
  })

  it('shows the post-op checklist straight after a new patient registers', async () => {
    getPatient.mockRejectedValue(new Error('missing'))
    getEpicRecord.mockRejectedValue(new Error('missing'))

    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'View Post-IVT Advice Form' }))
    await userEvent.click(screen.getByRole('button', { name: /singpass login/i }))

    expect(await screen.findByText(/What is your full name\?/)).toBeInTheDocument()
    await userEvent.type(screen.getByRole('textbox'), 'Tan Ah Kow')
    await userEvent.keyboard('{Enter}')
    await userEvent.type(screen.getByRole('textbox'), '01-01-1990')
    await userEvent.keyboard('{Enter}')
    await userEvent.type(screen.getByRole('textbox'), '91234567')
    await userEvent.keyboard('{Enter}')

    await waitFor(() => expect(createPatient).toHaveBeenCalledOnce())
    // Post-op mode skips the acknowledgement questions a new pre-procedure user gets.
    expect(await screen.findByText(/Here is your post-operation checklist/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Yes' })).not.toBeInTheDocument()
  })
})

// ─── Send guards ──────────────────────────────────────────────────────────────

describe('ChatWindow — message send guards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sendChatMessageStream.mockResolvedValue('Reply.')
  })

  it('ignores a whitespace-only message', async () => {
    render(<ChatWindow />)
    await userEvent.type(screen.getByRole('textbox'), '   ')
    await userEvent.keyboard('{Enter}')

    expect(sendChatMessageStream).not.toHaveBeenCalled()
    expect(sendChatMessage).not.toHaveBeenCalled()
  })

  it('typing from the welcome screen drops the user into general enquiry', async () => {
    // No menu pill clicked first — the message itself picks the mode, and is masked
    // the same way it would be inside general_enquiry.
    render(<ChatWindow />)
    await userEvent.type(screen.getByRole('textbox'), 'My NRIC is S1234567D, what is AMD?')
    await userEvent.keyboard('{Enter}')

    await waitFor(() => expect(sendChatMessageStream).toHaveBeenCalledOnce())
    const [history] = sendChatMessageStream.mock.calls[0]
    expect(history.at(-1).content).not.toContain('S1234567D')
    expect(await screen.findByText('Reply.')).toBeInTheDocument()
    // Now in general_enquiry, so the Return Menu chip is available.
    expect(screen.getByRole('button', { name: 'Return Menu' })).toBeInTheDocument()
  })
})

// ─── Header controls ──────────────────────────────────────────────────────────

describe('ChatWindow — header controls', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('the scroll-to-top control scrolls the thread back to the first message', async () => {
    render(<ChatWindow />)
    window.HTMLElement.prototype.scrollIntoView.mockClear()

    await userEvent.click(screen.getByTitle('Scroll to top'))

    expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalled()
  })

  it('the back control calls onBack', async () => {
    const onBack = vi.fn()
    render(<ChatWindow onBack={onBack} />)

    await userEvent.click(screen.getByTitle('Back'))

    expect(onBack).toHaveBeenCalledOnce()
  })
})


