import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import EpicLookup from '../components/EpicLookup'

const mocks = vi.hoisted(() => ({
  getEpicPatient: vi.fn(),
  getEpicRecord: vi.fn(),
}))

vi.mock('../api/client', () => ({
  getEpicPatient: mocks.getEpicPatient,
  getEpicRecord: mocks.getEpicRecord,
}))

describe('EpicLookup', () => {
  beforeEach(() => {
    mocks.getEpicPatient.mockReset()
    mocks.getEpicRecord.mockReset()
  })

  it('fetches and renders patient and record details', async () => {
    mocks.getEpicPatient.mockResolvedValue({
      data: {
        resourceType: 'Patient',
        patient_id: 'P001',
        patient_name: 'Tan Ah Kow',
        patient_dob: '1952-08-12',
        phone_number: '+6591234567',
      },
    })
    mocks.getEpicRecord.mockResolvedValue({
      data: {
        resourceType: 'DiagnosticReport',
        record_diagnosis: 'H35.31',
        record_eyes: 'OD',
        record_number_of_injections: 3,
        validity_of_consent: true,
        last3mths_admission: false,
        stroke_heartAtt_last6mths: false,
        taking_antibiotics: true,
        pregnant: false,
      },
    })

    render(<EpicLookup />)

    await userEvent.type(screen.getByPlaceholderText('Enter Patient ID (e.g. P001)'), 'P001')
    await userEvent.click(screen.getByRole('button', { name: 'Lookup' }))

    await waitFor(() => {
      expect(mocks.getEpicPatient).toHaveBeenCalledWith('P001')
      expect(mocks.getEpicRecord).toHaveBeenCalledWith('P001')
    })

    expect(screen.getByText(/FHIR Patient/)).toBeInTheDocument()
    expect(screen.getByText('Tan Ah Kow')).toBeInTheDocument()
    expect(screen.getByText(/Right Eye/)).toBeInTheDocument()
  })

  it('shows error message when lookup fails', async () => {
    mocks.getEpicPatient.mockRejectedValue(new Error('not found'))
    mocks.getEpicRecord.mockRejectedValue(new Error('not found'))

    render(<EpicLookup />)

    await userEvent.type(screen.getByPlaceholderText('Enter Patient ID (e.g. P001)'), 'P404')
    await userEvent.click(screen.getByRole('button', { name: 'Lookup' }))

    await waitFor(() => {
      expect(screen.getByText('Patient not found or EPIC service unavailable.')).toBeInTheDocument()
    })
  })
})
