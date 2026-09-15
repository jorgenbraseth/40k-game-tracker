import { describe, expect, it } from 'vitest'
import { resolveMissionId } from './missionResolution'

const missions = [
  { id: 'a-vs-b', force_disposition_id: 'a', opponent_force_disposition_id: 'b' },
  { id: 'b-vs-a', force_disposition_id: 'b', opponent_force_disposition_id: 'a' },
  { id: 'a-vs-a', force_disposition_id: 'a', opponent_force_disposition_id: 'a' },
]

describe('resolveMissionId', () => {
  it('returns null until both Force Dispositions are known', () => {
    expect(resolveMissionId(missions, null, 'b')).toBeNull()
    expect(resolveMissionId(missions, 'a', null)).toBeNull()
    expect(resolveMissionId(missions, null, null)).toBeNull()
  })

  it('is keyed by (mine, opponent) -- asymmetric, matches resolve_game_mission()', () => {
    expect(resolveMissionId(missions, 'a', 'b')).toBe('a-vs-b')
    expect(resolveMissionId(missions, 'b', 'a')).toBe('b-vs-a')
  })

  it('handles a mirrored pairing (both sides the same Force Disposition)', () => {
    expect(resolveMissionId(missions, 'a', 'a')).toBe('a-vs-a')
  })

  it('returns null for a pairing with no matching mission', () => {
    expect(resolveMissionId(missions, 'b', 'b')).toBeNull()
  })
})
