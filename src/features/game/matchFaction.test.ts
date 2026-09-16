import { describe, expect, it } from 'vitest'
import { matchFaction } from './matchFaction'

const factions = [
  { id: '1', name: 'Space Marines' },
  { id: '2', name: "T'au Empire" },
  { id: '3', name: 'Adepta Sororitas' },
]

describe('matchFaction', () => {
  it('matches case-insensitively', () => {
    expect(matchFaction(factions, 'space marines')?.id).toBe('1')
  })

  it('matches a curly apostrophe against a straight one', () => {
    expect(matchFaction(factions, 'T’au Empire')?.id).toBe('2')
  })

  it('trims incidental whitespace', () => {
    expect(matchFaction(factions, '  Adepta Sororitas  ')?.id).toBe('3')
  })

  it('returns undefined for a faction not in the list', () => {
    expect(matchFaction(factions, 'Necrons')).toBeUndefined()
  })
})
