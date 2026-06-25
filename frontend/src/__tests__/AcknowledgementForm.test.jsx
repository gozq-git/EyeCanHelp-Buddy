import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AcknowledgementForm from '../components/AcknowledgementForm'

const submitAcknowledgement = vi.fn()

vi.mock('../api/client', () => ({
  submitAcknowledgement,
}))

describe('AcknowledgementForm', () => {
  beforeEach(() => {
    submitAcknowledgement.mockReset()
  })

  it('submits transformed payload and shows confirmation', async () => {
    submitAcknowledgement.mockResolvedValue({
      data: { record_id: 'REC-P001-010', issued: '2026-06-25T00:00:00Z' },
    })

    render(<AcknowledgementForm />)

    await userEvent.type(screen.getByLabelText('Patient ID'), 'P001')
    await userEvent.type(screen.getByLabelText('Patient Name'), 'Tan Ah Kow')
    await userEvent.type(screen.getByLabelText('Diagnosis (ICD-10)'), 'H35.31')
    await userEvent.type(screen.getByLabelText('Number of Injections'), '3')
    await userEvent.click(screen.getByLabelText('Consent is valid'))

    await userEvent.type(screen.getByLabelText('Payment ID'), 'PAY001')
    await userEvent.type(screen.getAllByLabelText('Patient Name')[1], 'Tan Ah Kow')
    await userEvent.type(screen.getAllByLabelText('Diagnosis (ICD-10)')[1], 'H35.31')
    await userEvent.type(screen.getByLabelText('Max Medisave (SGD)'), '2150')
    await userEvent.type(screen.getByLabelText('Est. Cost per Injection (SGD)'), '120.5')

    await userEvent.click(screen.getByRole('button', { name: 'Submit Acknowledgement' }))

    await waitFor(() => {
      expect(submitAcknowledgement).toHaveBeenCalledOnce()
      const payload = submitAcknowledgement.mock.calls[0][0]
      expect(payload.patient_record.record_number_of_injections).toBe(3)
      expect(payload.payment.payment_maxMedisave).toBe(2150)
      expect(payload.payment.payment_estCostPerInjection).toBe(120.5)
    })

    expect(screen.getByText('Acknowledgement Submitted')).toBeInTheDocument()
    expect(screen.getByText(/REC-P001-010/)).toBeInTheDocument()
  })

  it('shows API failure message', async () => {
    submitAcknowledgement.mockRejectedValue(new Error('bad request'))

    render(<AcknowledgementForm />)
    await userEvent.type(screen.getByLabelText('Patient ID'), 'P001')
    await userEvent.click(screen.getByRole('button', { name: 'Submit Acknowledgement' }))

    await waitFor(() => {
      expect(screen.getByText('Submission failed. Please check all fields and try again.')).toBeInTheDocument()
    })
  })
})
