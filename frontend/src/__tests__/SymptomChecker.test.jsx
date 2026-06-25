import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SymptomChecker from '../components/SymptomChecker'

const mocks = vi.hoisted(() => ({
  assessSymptoms: vi.fn(),
}))

vi.mock('../api/client', () => ({
  assessSymptoms: mocks.assessSymptoms,
}))

describe('SymptomChecker', () => {
  beforeEach(() => {
    mocks.assessSymptoms.mockReset()
  })

  it('does not call API when required fields are blank', async () => {
    render(<SymptomChecker />)

    await userEvent.click(screen.getByRole('button', { name: 'Check Symptoms' }))

    expect(mocks.assessSymptoms).not.toHaveBeenCalled()
  })

  it('submits symptoms and renders advice', async () => {
    mocks.assessSymptoms.mockResolvedValue({
      data: { severity: 'mild', advice: 'Monitor symptoms and rest.' },
    })

    render(<SymptomChecker />)

    await userEvent.type(screen.getByPlaceholderText('e.g. P001'), 'P001')
    await userEvent.type(screen.getByPlaceholderText('e.g. I have mild discomfort and tearing in my eye'), 'mild discomfort')
    await userEvent.click(screen.getByRole('button', { name: 'Check Symptoms' }))

    await waitFor(() => {
      expect(mocks.assessSymptoms).toHaveBeenCalledWith('P001', 'mild discomfort')
    })

    expect(screen.getByText('mild symptoms')).toBeInTheDocument()
    expect(screen.getByText('Monitor symptoms and rest.')).toBeInTheDocument()
  })

  it('shows an error when assessment fails', async () => {
    mocks.assessSymptoms.mockRejectedValue(new Error('network'))

    render(<SymptomChecker />)

    await userEvent.type(screen.getByPlaceholderText('e.g. P001'), 'P001')
    await userEvent.type(screen.getByPlaceholderText('e.g. I have mild discomfort and tearing in my eye'), 'severe pain')
    await userEvent.click(screen.getByRole('button', { name: 'Check Symptoms' }))

    await waitFor(() => {
      expect(screen.getByText('Failed to assess symptoms. Please try again.')).toBeInTheDocument()
    })
  })
})
