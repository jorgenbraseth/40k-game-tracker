import { describe, expect, it } from 'vitest'
import type { CompletedGameRow } from '@/lib/queries/history'
import { computeStats } from './stats'

function row(overrides: Partial<CompletedGameRow>): CompletedGameRow {
  return {
    gameId: crypto.randomUUID(),
    endedAt: new Date().toISOString(),
    missionName: 'Scorched Earth',
    opponentMissionName: 'Terraform',
    deploymentName: 'Hammer and Anvil',
    pointsLimit: 2000,
    mySeat: 1,
    myFactionName: 'Space Marines',
    myArmyName: null,
    myTotalVp: 80,
    opponentName: 'Rival',
    opponentFactionName: 'Orks',
    opponentTotalVp: 60,
    result: 'win',
    ...overrides,
  }
}

describe('computeStats', () => {
  it('returns a zeroed summary for no games', () => {
    const stats = computeStats([])
    expect(stats.overall).toEqual({ wins: 0, losses: 0, draws: 0, games: 0, winRate: 0 })
    expect(stats.byFaction).toEqual([])
  })

  it('tallies wins, losses and draws into the overall record', () => {
    const stats = computeStats([
      row({ result: 'win' }),
      row({ result: 'loss' }),
      row({ result: 'draw' }),
      row({ result: 'win' }),
    ])
    expect(stats.overall).toMatchObject({ wins: 2, losses: 1, draws: 1, games: 4 })
    expect(stats.overall.winRate).toBeCloseTo(0.5)
  })

  it('groups by faction, mission and opponent independently', () => {
    const stats = computeStats([
      row({ myFactionName: 'Orks', missionName: 'Terraform', opponentName: 'Alex', result: 'win' }),
      row({ myFactionName: 'Orks', missionName: 'Terraform', opponentName: 'Alex', result: 'loss' }),
      row({ myFactionName: 'Necrons', missionName: 'Scorched Earth', opponentName: 'Sam', result: 'win' }),
    ])

    expect(stats.byFaction).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'Orks', games: 2, wins: 1, losses: 1 }),
        expect.objectContaining({ key: 'Necrons', games: 1, wins: 1 }),
      ]),
    )
    expect(stats.byMission.find((m) => m.key === 'Terraform')).toMatchObject({ games: 2 })
    expect(stats.byOpponent.find((o) => o.key === 'Alex')).toMatchObject({ games: 2, wins: 1, losses: 1 })
  })

  it('falls back to "Unknown faction" when no faction was picked', () => {
    const stats = computeStats([row({ myFactionName: null })])
    expect(stats.byFaction[0]?.key).toBe('Unknown faction')
  })

  it('sorts groups by games played, descending', () => {
    const stats = computeStats([
      row({ myFactionName: 'A' }),
      row({ myFactionName: 'B' }),
      row({ myFactionName: 'B' }),
    ])
    expect(stats.byFaction[0]?.key).toBe('B')
    expect(stats.byFaction[0]?.games).toBe(2)
  })
})
