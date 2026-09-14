import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Stepper } from './Stepper'

describe('Stepper', () => {
  it('renders one button per round and marks the current one selected', () => {
    render(<Stepper total={5} current={3} onChange={() => {}} />)
    const buttons = screen.getAllByRole('tab')
    expect(buttons).toHaveLength(5)
    expect(screen.getByRole('tab', { name: '3' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: '1' })).toHaveAttribute('aria-selected', 'false')
  })

  it('calls onChange with the clicked round', async () => {
    const onChange = vi.fn()
    render(<Stepper total={5} current={1} onChange={onChange} />)
    await userEvent.click(screen.getByRole('tab', { name: '4' }))
    expect(onChange).toHaveBeenCalledWith(4)
  })
})
