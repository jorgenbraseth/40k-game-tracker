import { describe, expect, it } from 'vitest'
import { windowAppliesToRound, windowRounds } from './missionWindows'

describe('windowRounds', () => {
  it('treats "Any Battle Round" as every round, not end-of-battle', () => {
    expect(windowRounds('Any Battle Round')).toEqual({ rounds: [1, 2, 3, 4, 5], endOfBattle: false })
  })

  it('treats "End of the Battle" as end-of-battle only, no battle rounds', () => {
    expect(windowRounds('End of the Battle')).toEqual({ rounds: [], endOfBattle: true })
  })

  it('parses a single named round', () => {
    expect(windowRounds('First Battle Round')).toEqual({ rounds: [1], endOfBattle: false })
    expect(windowRounds('Fifth Battle Round')).toEqual({ rounds: [5], endOfBattle: false })
  })

  it('parses "X Battle Round Onwards"', () => {
    expect(windowRounds('Second Battle Round Onwards')).toEqual({ rounds: [2, 3, 4, 5], endOfBattle: false })
    expect(windowRounds('Fourth Battle Round Onwards')).toEqual({ rounds: [4, 5], endOfBattle: false })
  })

  it('parses "X and Y Battle Round(s)"', () => {
    expect(windowRounds('First and Second Battle Round')).toEqual({ rounds: [1, 2], endOfBattle: false })
    expect(windowRounds('Second and Third Battle Round')).toEqual({ rounds: [2, 3], endOfBattle: false })
  })

  it('parses "X to Y Battle Round"', () => {
    expect(windowRounds('Second to Fourth Battle Round')).toEqual({ rounds: [2, 3, 4], endOfBattle: false })
  })

  it('fails open (every round) on an unrecognised label', () => {
    expect(windowRounds('Some Future Wording')).toEqual({ rounds: [1, 2, 3, 4, 5], endOfBattle: false })
  })
})

describe('windowAppliesToRound', () => {
  const endOfGameRound = 6

  it('does not show "2nd Battle Round onwards" scoring in round 1', () => {
    expect(windowAppliesToRound('Second Battle Round Onwards', 1, endOfGameRound)).toBe(false)
  })

  it('shows "2nd Battle Round onwards" scoring from round 2 on', () => {
    expect(windowAppliesToRound('Second Battle Round Onwards', 2, endOfGameRound)).toBe(true)
    expect(windowAppliesToRound('Second Battle Round Onwards', 5, endOfGameRound)).toBe(true)
  })

  it('only shows "End of the Battle" lines on the End of Game round', () => {
    expect(windowAppliesToRound('End of the Battle', 5, endOfGameRound)).toBe(false)
    expect(windowAppliesToRound('End of the Battle', endOfGameRound, endOfGameRound)).toBe(true)
  })

  it('never shows an ordinary battle-round window on the End of Game round', () => {
    expect(windowAppliesToRound('Any Battle Round', endOfGameRound, endOfGameRound)).toBe(false)
  })
})
