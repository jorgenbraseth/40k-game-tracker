import { describe, expect, it } from 'vitest'
import { ELO_STARTING_RATING, type EloGame } from './elo'
import { computeRankHistory, rankOf } from './ladderRank'

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

describe('computeRankHistory', () => {
  const base = { rankingType: 'elo' as const, startingRating: ELO_STARTING_RATING }

  it('starts at the player’s first game and includes later games by others', () => {
    const games = [game(1, 'b', 'c', 1), game(2, 'a', 'b', 0), game(3, 'c', 'd', 1)]
    const history = computeRankHistory({ ...base, games, userId: 'a', fieldUserIds: ['a', 'b', 'c', 'd'] })
    expect(history.map((p) => p.playedAt)).toEqual([games[1].playedAt, games[2].playedAt])
    expect(history.map((p) => p.playedInGame)).toEqual([true, false])
    expect(history.every((p) => p.fieldSize === 4)).toBe(true)
  })

  it('tracks rank moving as results come in, ending on the current standings rank', () => {
    const games = [game(1, 'a', 'b', 1), game(2, 'c', 'a', 1), game(3, 'c', 'b', 1)]
    const history = computeRankHistory({ ...base, games, userId: 'a', fieldUserIds: ['a', 'b', 'c'] })
    // Won game 1 -> top; lost to c -> c overtakes (b still lower); c beats b -> a stays 2nd.
    expect(history.map((p) => p.rank)).toEqual([1, 2, 2])
  })

  it('works for Glicko-2 ladders too', () => {
    const games = [game(1, 'a', 'b', 0)]
    const history = computeRankHistory({
      ...base,
      rankingType: 'glicko2',
      games,
      userId: 'a',
      fieldUserIds: ['a', 'b', 'c'],
    })
    expect(history).toHaveLength(1)
    expect(history[0].rank).toBe(3)
  })

  it('is empty for a player with no games', () => {
    expect(computeRankHistory({ ...base, games: [game(1, 'b', 'c', 1)], userId: 'a', fieldUserIds: ['a'] })).toEqual([])
  })
})
