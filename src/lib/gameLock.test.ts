import { describe, expect, it } from 'vitest'
import type { Database } from '@/lib/database.types'
import { isGameLocked, needsVerification } from './gameLock'

type GamePlayerRow = Database['public']['Tables']['game_players']['Row']
type VerificationRow = Database['public']['Tables']['game_player_verifications']['Row']

function player(overrides: Partial<GamePlayerRow>): GamePlayerRow {
  return {
    id: crypto.randomUUID(),
    game_id: crypto.randomUUID(),
    user_id: null,
    seat: 1,
    faction_id: null,
    army_name: null,
    army_list_url: null,
    force_disposition_id: null,
    mission_id: null,
    role: null,
    turn_order: null,
    represents_user_id: null,
    painted_bonus: false,
    secondary_mode: null,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

function verification(gamePlayerId: string): VerificationRow {
  return {
    game_player_id: gamePlayerId,
    game_id: crypto.randomUUID(),
    verified_by: crypto.randomUUID(),
    verified_at: new Date().toISOString(),
  }
}

describe('needsVerification', () => {
  it('is false for an in-progress game even with an owned seat', () => {
    const p = player({ user_id: 'u1' })
    expect(needsVerification({ player: p }, 'active', [])).toBe(false)
  })

  it('is false for a seat nobody owns (unclaimed and unattributed)', () => {
    const p = player({ user_id: null, represents_user_id: null })
    expect(needsVerification({ player: p }, 'complete', [])).toBe(false)
  })

  it('is true for a finished game, a claimed seat, and no verification yet (issue #72)', () => {
    const p = player({ user_id: 'u1' })
    expect(needsVerification({ player: p }, 'complete', [])).toBe(true)
  })

  it('is true for a finished game, a represented-but-unclaimed seat, and no verification yet', () => {
    const p = player({ user_id: null, represents_user_id: 'u2' })
    expect(needsVerification({ player: p }, 'abandoned', [])).toBe(true)
  })

  it('is false once that seat has a verification row', () => {
    const p = player({ user_id: 'u1' })
    expect(needsVerification({ player: p }, 'complete', [verification(p.id)])).toBe(false)
  })
})

describe('isGameLocked', () => {
  it('is false for an empty player list', () => {
    expect(isGameLocked([], [])).toBe(false)
  })

  it('is false when only one of two seats is verified', () => {
    const p1 = player({ user_id: 'u1', seat: 1 })
    const p2 = player({ user_id: 'u2', seat: 2 })
    expect(isGameLocked([{ player: p1 }, { player: p2 }], [verification(p1.id)])).toBe(false)
  })

  it('is true once every seat has a verification row', () => {
    const p1 = player({ user_id: 'u1', seat: 1 })
    const p2 = player({ user_id: null, represents_user_id: 'u2', seat: 2 })
    expect(isGameLocked([{ player: p1 }, { player: p2 }], [verification(p1.id), verification(p2.id)])).toBe(true)
  })
})
