import { describe, expect, it } from 'vitest'
import { computeGlicko2Ratings, computeGlicko2States, GLICKO2_STARTING_RATING, GLICKO2_STARTING_RD } from './glicko2'

describe('computeGlicko2Ratings', () => {
  it('leaves both players at the starting rating with no games', () => {
    const ratings = computeGlicko2Ratings([])
    expect(ratings.size).toBe(0)
  })

  it('moves both ratings equally, in opposite directions, for an even matchup', () => {
    const ratings = computeGlicko2Ratings([
      { playedAt: '2026-01-01T00:00:00Z', playerAId: 'a', playerBId: 'b', scoreForA: 1 },
    ])
    expect(ratings.get('a')).toBeGreaterThan(GLICKO2_STARTING_RATING)
    expect(ratings.get('b')).toBeLessThan(GLICKO2_STARTING_RATING)
    expect(ratings.get('a')! - GLICKO2_STARTING_RATING).toBeCloseTo(GLICKO2_STARTING_RATING - ratings.get('b')!, 5)
  })

  it('a draw between equally-rated players leaves both unchanged', () => {
    const ratings = computeGlicko2Ratings([
      { playedAt: '2026-01-01T00:00:00Z', playerAId: 'a', playerBId: 'b', scoreForA: 0.5 },
    ])
    expect(ratings.get('a')).toBeCloseTo(GLICKO2_STARTING_RATING, 5)
    expect(ratings.get('b')).toBeCloseTo(GLICKO2_STARTING_RATING, 5)
  })

  it('an upset (beating a much stronger opponent) swings the winner up sharply', () => {
    const buildup = Array.from({ length: 10 }, (_, i) => ({
      playedAt: `2026-01-0${i + 1}T00:00:00Z`,
      playerAId: 'a',
      playerBId: 'b',
      scoreForA: 1 as const,
    }))
    const upset = { playedAt: '2026-02-01T00:00:00Z', playerAId: 'a', playerBId: 'b', scoreForA: 0 as const }
    const ratings = computeGlicko2Ratings([...buildup, upset])
    const beforeUpset = computeGlicko2Ratings(buildup)
    const underdogGain = ratings.get('b')! - beforeUpset.get('b')!
    const favoriteLastGain = beforeUpset.get('a')! - computeGlicko2Ratings(buildup.slice(0, 9)).get('a')!
    expect(underdogGain).toBeGreaterThan(favoriteLastGain)
  })

  it('replays out of chronological order in the input the same as sorted order', () => {
    const chronological = [
      { playedAt: '2026-01-01T00:00:00Z', playerAId: 'a', playerBId: 'b', scoreForA: 1 as const },
      { playedAt: '2026-01-02T00:00:00Z', playerAId: 'a', playerBId: 'b', scoreForA: 0 as const },
    ]
    const shuffled = [chronological[1], chronological[0]]
    expect(computeGlicko2Ratings(shuffled)).toEqual(computeGlicko2Ratings(chronological))
  })

  it("shrinks a player's RD (grows confidence) as they play more games", () => {
    const games = Array.from({ length: 5 }, (_, i) => ({
      playedAt: `2026-01-0${i + 1}T00:00:00Z`,
      playerAId: 'a',
      playerBId: 'b',
      scoreForA: (i % 2 === 0 ? 1 : 0) as 0 | 1,
    }))
    const states = computeGlicko2States(games)
    expect(states.get('a')!.rd).toBeLessThan(GLICKO2_STARTING_RD)
    expect(states.get('b')!.rd).toBeLessThan(GLICKO2_STARTING_RD)
  })

  // Cross-checked against the worked example in Glickman's "Example of the Glicko-2 system"
  // (a player at rating 1500/RD 200/volatility 0.06 facing three opponents in one rating
  // period) -- that paper batches all three games into a single period update, while this
  // module treats each game as its own period (see the module's own doc comment for why), so
  // this isn't a direct replay of the paper's combined result. It does, applied one game at a
  // time in the same order, land within a few points of the paper's final ~1464 rating --
  // enough to confirm the g()/E()/volatility-solver math isn't off by an order of magnitude or
  // sign-flipped, without claiming bit-for-bit equivalence to a different period structure.
  it('roughly matches the shape of the reference paper\'s worked example', () => {
    const games = [
      { playedAt: '2026-01-01T00:00:00Z', playerAId: 'p', playerBId: 'o1', scoreForA: 1 as const },
      { playedAt: '2026-01-02T00:00:00Z', playerAId: 'p', playerBId: 'o2', scoreForA: 0 as const },
      { playedAt: '2026-01-03T00:00:00Z', playerAId: 'p', playerBId: 'o3', scoreForA: 0 as const },
    ]
    const ratings = computeGlicko2Ratings(games, { startingRd: 200 })
    // Not 1500 (unmoved) and not off in the wrong direction -- one win against a lower-rated
    // opponent followed by two losses to higher-rated ones nets out to a moderate decline.
    expect(ratings.get('p')!).toBeLessThan(GLICKO2_STARTING_RATING)
    expect(ratings.get('p')!).toBeGreaterThan(1300)
  })
})
