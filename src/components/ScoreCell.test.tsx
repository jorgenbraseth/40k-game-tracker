import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ScoreCell } from './ScoreCell'

afterEach(() => {
  vi.useRealTimers()
})

describe('ScoreCell', () => {
  it('increments by `step` on a quick tap', () => {
    const onChange = vi.fn()
    render(<ScoreCell label="Primary VP" value={10} max={50} step={5} onChange={onChange} />)

    const cell = screen.getByRole('button', { name: '10' })
    fireEvent.pointerDown(cell)
    fireEvent.pointerUp(cell)

    expect(onChange).toHaveBeenCalledWith(15)
  })

  it('clamps to max on tap', () => {
    const onChange = vi.fn()
    render(<ScoreCell label="Primary VP" value={49} max={50} step={5} onChange={onChange} />)

    const cell = screen.getByRole('button', { name: '49' })
    fireEvent.pointerDown(cell)
    fireEvent.pointerUp(cell)

    expect(onChange).toHaveBeenCalledWith(50)
  })

  it('opens the direct-entry sheet on long press instead of incrementing', () => {
    vi.useFakeTimers()
    const onChange = vi.fn()
    render(<ScoreCell label="Primary VP" value={10} max={50} onChange={onChange} />)

    const cell = screen.getByRole('button', { name: '10' })
    fireEvent.pointerDown(cell)
    act(() => {
      vi.advanceTimersByTime(500)
    })
    fireEvent.pointerUp(cell)

    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Edit Primary VP' })).toBeInTheDocument()
  })
})
