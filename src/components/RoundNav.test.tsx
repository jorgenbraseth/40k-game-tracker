import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RoundNav } from './RoundNav'

describe('RoundNav', () => {
  it('shows the label and steps to the previous/next round', async () => {
    const onChange = vi.fn()
    render(<RoundNav round={3} last={6} label="Round 3" onChange={onChange} />)
    expect(screen.getByText('Round 3')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Previous round' }))
    expect(onChange).toHaveBeenLastCalledWith(2)
    await userEvent.click(screen.getByRole('button', { name: 'Next round' }))
    expect(onChange).toHaveBeenLastCalledWith(4)
  })

  it('disables stepping past either end', () => {
    const { rerender } = render(<RoundNav round={1} last={6} label="Round 1" onChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'Previous round' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next round' })).toBeEnabled()
    rerender(<RoundNav round={6} last={6} label="End" onChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'Next round' })).toBeDisabled()
  })
})
