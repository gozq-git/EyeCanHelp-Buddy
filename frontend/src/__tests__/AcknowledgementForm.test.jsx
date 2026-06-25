import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AcknowledgementForm from '../components/AcknowledgementForm'

const mocks = vi.hoisted(() => ({
  submitAcknowledgement: vi.fn(),
}))

vi.mock('../api/client', () => ({
  submitAcknowledgement: mocks.submitAcknowledgement,
}))

describe('AcknowledgementForm', () => {
  beforeEach(() => {
    mocks.submitAcknowledgement.mockReset()
  })

  it('submits transformed payload and shows confirmation', async () => {
    mocks.submitAcknowledgement.mockResolvedValue({
      data: { record_id: 'REC-P001-010', issued: '2026-06-25T00:00:00Z' },
    })

    render(<AcknowledgementForm />)

    await userEvent.type(screen.getByPlaceholderText('e.g. P001'), 'P001')
    await userEvent.type(screen.getAllByPlaceholderText('Full name')[0], 'Tan Ah Kow')
    await userEvent.type(screen.getAllByPlaceholderText('e.g. H35.31')[0], 'H35.31')
    await userEvent.clear(screen.getByRole('spinbutton'))
    await userEvent.type(screen.getByRole('spinbutton'), '3')
    await userEvent.click(screen.getByLabelText('Consent is valid'))

    await userEvent.type(screen.getByPlaceholderText('e.g. PAY001'), 'PAY001')
    await userEvent.type(screen.getAllByPlaceholderText('Full name')[1], 'Tan Ah Kow')
    await userEvent.type(screen.getAllByPlaceholderText('e.g. H35.31')[1], 'H35.31')
    await userEvent.type(screen.getAllByPlaceholderText('0.00')[0], '2150')
    await userEvent.type(screen.getAllByPlaceholderText('0.00')[1], '120.5')

    await userEvent.click(screen.getByRole('button', { name: 'Submit Acknowledgement' }))

    await waitFor(() => {
      expect(mocks.submitAcknowledgement).toHaveBeenCalledOnce()
      const payload = mocks.submitAcknowledgement.mock.calls[0][0]
      expect(payload.patient_record.record_number_of_injections).toBe(3)
      expect(payload.payment.payment_maxMedisave).toBe(2150)
      expect(payload.payment.payment_estCostPerInjection).toBe(120.5)
    })

    expect(screen.getByText('Acknowledgement Submitted')).toBeInTheDocument()
    expect(screen.getByText(/REC-P001-010/)).toBeInTheDocument()
  })

  it('shows API failure message', async () => {
    mocks.submitAcknowledgement.mockRejectedValue(new Error('bad request'))

    render(<AcknowledgementForm />)
    await userEvent.type(screen.getByPlaceholderText('e.g. P001'), 'P001')
    await userEvent.click(screen.getByRole('button', { name: 'Submit Acknowledgement' }))

    await waitFor(() => {
      expect(screen.getByText('Submission failed. Please check all fields and try again.')).toBeInTheDocument()
    })
  })
})
