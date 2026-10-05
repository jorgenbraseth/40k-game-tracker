import { describe, expect, it } from 'vitest'
import { computeEloRatings, ELO_STARTING_RATING, type EloGame } from './elo'
import { computeRatingHistory, rankOf } from './ladderRank'

const game = (day: number, a: string, b: string, scoreForA: 0 | 0.5 | 1): EloGame => ({
  playedAt: `2026-01-${String(day).padStart(2, '0')}T00:00:00Z`,
  playerAId: a,
  playerBId: b,
  scoreForA,
})

describe('rankOf', () => {
  it('uses competition ranking, sharing a rank on a tie', () => {
    const ratings = new Map([
      ['a', 1600],
      ['b', 1500],
      ['c', 1500.2],
      ['d', 1400],
    ])
    expect(rankOf('a', ratings)).toBe(1)
    expect(rankOf('b', ratings)).toBe(2)
    expect(rankOf('c', ratings)).toBe(2)
    expect(rankOf('d', ratings)).toBe(4)
  })
})

describe('computeRatingHistory', () => {
  const base = { rankingType: 'elo' as const, startingRating: ELO_STARTING_RATING }

  it('records a point for each of the player’s own games only', () => {
    const games = [game(1, 'b', 'c', 1), game(2, 'a', 'b', 0), game(3, 'c', 'd', 1), game(4, 'd', 'a', 0.5)]
    const history = computeRatingHistory({ ...base, games, userId: 'a' })
    expect(history.map((p) => p.playedAt)).toEqual([games[1].playedAt, games[3].playedAt])
    expect(history.map((p) => p.result)).toEqual(['loss', 'draw'])
  })

  it('tracks the change per game, ending on the final standings rating', () => {
    const games = [game(1, 'a', 'b', 1), game(2, 'c', 'a', 1)]
    const history = computeRatingHistory({ ...base, games, userId: 'a' })
    expect(history[0].change).toBeGreaterThan(0)
    expect(history[0].rating).toBe(ELO_STARTING_RATING + history[0].change)
    expect(history[1].result).toBe('loss')
    expect(history[1].change).toBeLessThan(0)
    expect(history[1].rating).toBe(history[0].rating + history[1].change)
    expect(history[1].rating).toBe(Math.round(computeEloRatings(games).get('a')!))
  })

  it('works for Glicko-2 ladders too', () => {
    const history = computeRatingHistory({ ...base, rankingType: 'glicko2', games: [game(1, 'a', 'b', 0)], userId: 'a' })
    expect(history).toHaveLength(1)
    expect(history[0].rating).toBeLessThan(ELO_STARTING_RATING)
  })

  it('is empty for a player with no games', () => {
    expect(computeRatingHistory({ ...base, games: [game(1, 'b', 'c', 1)], userId: 'a' })).toEqual([])
  })
})
