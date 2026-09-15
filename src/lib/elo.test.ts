import { describe, expect, it } from 'vitest'
import { computeEloRatings, ELO_STARTING_RATING } from './elo'

describe('computeEloRatings', () => {
  it('leaves both players at the starting rating with no games', () => {
    const ratings = computeEloRatings([])
    expect(ratings.size).toBe(0)
  })

  it('moves both ratings equally, in opposite directions, for an even matchup', () => {
    const ratings = computeEloRatings([
      { playedAt: '2026-01-01T00:00:00Z', playerAId: 'a', playerBId: 'b', scoreForA: 1 },
    ])
    expect(ratings.get('a')).toBeGreaterThan(ELO_STARTING_RATING)
    expect(ratings.get('b')).toBeLessThan(ELO_STARTING_RATING)
    expect(ratings.get('a')! - ELO_STARTING_RATING).toBeCloseTo(ELO_STARTING_RATING - ratings.get('b')!)
  })

  it('a draw between equally-rated players leaves both unchanged', () => {
    const ratings = computeEloRatings([
      { playedAt: '2026-01-01T00:00:00Z', playerAId: 'a', playerBId: 'b', scoreForA: 0.5 },
    ])
    expect(ratings.get('a')).toBeCloseTo(ELO_STARTING_RATING)
    expect(ratings.get('b')).toBeCloseTo(ELO_STARTING_RATING)
  })

  it('gains less for beating a much weaker opponent than an evenly-matched one', () => {
    // Get 'a' well above 'b' first with a string of wins for 'a'.
    const games = Array.from({ length: 10 }, (_, i) => ({
      playedAt: `2026-01-0${i + 1}T00:00:00Z`,
      playerAId: 'a',
      playerBId: 'b',
      scoreForA: 1 as const,
    }))
    const establishedRatings = computeEloRatings(games)
    const ratingGapBefore = establishedRatings.get('a')! - establishedRatings.get('b')!
    expect(ratingGapBefore).toBeGreaterThan(0)

    // One more win for the now much-stronger 'a' should gain fewer points than the first win did.
    const firstWinGain = computeEloRatings([games[0]]).get('a')! - ELO_STARTING_RATING
    const laterWinGain = establishedRatings.get('a')! - computeEloRatings(games.slice(0, 9)).get('a')!
    expect(laterWinGain).toBeLessThan(firstWinGain)
  })

  it('an upset (beating a much stronger opponent) swings the winner up sharply', () => {
    // Build a big rating gap the same way, then have the underdog win.
    const buildup = Array.from({ length: 10 }, (_, i) => ({
      playedAt: `2026-01-0${i + 1}T00:00:00Z`,
      playerAId: 'a',
      playerBId: 'b',
      scoreForA: 1 as const,
    }))
    const upset = { playedAt: '2026-02-01T00:00:00Z', playerAId: 'a', playerBId: 'b', scoreForA: 0 as const }
    const ratings = computeEloRatings([...buildup, upset])
    const beforeUpset = computeEloRatings(buildup)
    // 'b' (the underdog) gains more from this single upset win than 'a' gained from any single
    // win while already far ahead.
    const underdogGain = ratings.get('b')! - beforeUpset.get('b')!
    const favoriteLastGain = beforeUpset.get('a')! - computeEloRatings(buildup.slice(0, 9)).get('a')!
    expect(underdogGain).toBeGreaterThan(favoriteLastGain)
  })

  it('replays out of chronological order in the input the same as sorted order', () => {
    const chronological = [
      { playedAt: '2026-01-01T00:00:00Z', playerAId: 'a', playerBId: 'b', scoreForA: 1 as const },
      { playedAt: '2026-01-02T00:00:00Z', playerAId: 'a', playerBId: 'b', scoreForA: 0 as const },
    ]
    const shuffled = [chronological[1], chronological[0]]
    expect(computeEloRatings(shuffled)).toEqual(computeEloRatings(chronological))
  })
})
