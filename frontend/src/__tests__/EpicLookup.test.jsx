import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import EpicLookup from '../components/EpicLookup'

const getEpicPatient = vi.fn()
const getEpicRecord = vi.fn()

vi.mock('../api/client', () => ({
  getEpicPatient,
  getEpicRecord,
}))

describe('EpicLookup', () => {
  beforeEach(() => {
    getEpicPatient.mockReset()
    getEpicRecord.mockReset()
  })

  it('fetches and renders patient and record details', async () => {
    getEpicPatient.mockResolvedValue({
      data: {
        resourceType: 'Patient',
        patient_id: 'P001',
        patient_name: 'Tan Ah Kow',
        patient_dob: '1952-08-12',
        phone_number: '+6591234567',
      },
    })
    getEpicRecord.mockResolvedValue({
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
      expect(getEpicPatient).toHaveBeenCalledWith('P001')
      expect(getEpicRecord).toHaveBeenCalledWith('P001')
    })

    expect(screen.getByText(/FHIR Patient/)).toBeInTheDocument()
    expect(screen.getByText('Tan Ah Kow')).toBeInTheDocument()
    expect(screen.getByText(/Right Eye/)).toBeInTheDocument()
  })

  it('shows error message when lookup fails', async () => {
    getEpicPatient.mockRejectedValue(new Error('not found'))
    getEpicRecord.mockRejectedValue(new Error('not found'))

    render(<EpicLookup />)

    await userEvent.type(screen.getByPlaceholderText('Enter Patient ID (e.g. P001)'), 'P404')
    await userEvent.click(screen.getByRole('button', { name: 'Lookup' }))

    await waitFor(() => {
      expect(screen.getByText('Patient not found or EPIC service unavailable.')).toBeInTheDocument()
    })
  })
})
