import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SymptomChecker from '../components/SymptomChecker'

const assessSymptoms = vi.fn()

vi.mock('../api/client', () => ({
  assessSymptoms,
}))

describe('SymptomChecker', () => {
  beforeEach(() => {
    assessSymptoms.mockReset()
  })

  it('does not call API when required fields are blank', async () => {
    render(<SymptomChecker />)

    await userEvent.click(screen.getByRole('button', { name: 'Check Symptoms' }))

    expect(assessSymptoms).not.toHaveBeenCalled()
  })

  it('submits symptoms and renders advice', async () => {
    assessSymptoms.mockResolvedValue({
      data: { severity: 'mild', advice: 'Monitor symptoms and rest.' },
    })

    render(<SymptomChecker />)

    await userEvent.type(screen.getByLabelText('Patient ID'), 'P001')
    await userEvent.type(screen.getByLabelText('Describe your symptoms'), 'mild discomfort')
    await userEvent.click(screen.getByRole('button', { name: 'Check Symptoms' }))

    await waitFor(() => {
      expect(assessSymptoms).toHaveBeenCalledWith('P001', 'mild discomfort')
    })

    expect(screen.getByText('mild symptoms')).toBeInTheDocument()
    expect(screen.getByText('Monitor symptoms and rest.')).toBeInTheDocument()
  })

  it('shows an error when assessment fails', async () => {
    assessSymptoms.mockRejectedValue(new Error('network'))

    render(<SymptomChecker />)

    await userEvent.type(screen.getByLabelText('Patient ID'), 'P001')
    await userEvent.type(screen.getByLabelText('Describe your symptoms'), 'severe pain')
    await userEvent.click(screen.getByRole('button', { name: 'Check Symptoms' }))

    await waitFor(() => {
      expect(screen.getByText('Failed to assess symptoms. Please try again.')).toBeInTheDocument()
    })
  })
})
