import { describe, expect, it } from 'vitest'
import { parseArmyListText } from './parseArmyListText'

const factions = [
  { id: 'f1', name: 'Space Marines' },
  { id: 'f2', name: 'Chaos Daemons' },
  { id: 'f3', name: 'Necrons' },
]

const forceDispositions = [
  { id: 'd1', name: 'Take and Hold' },
  { id: 'd2', name: 'Purge the Foe' },
  { id: 'd3', name: 'Reconnaissance' },
  { id: 'd4', name: 'Disruption' },
  { id: 'd5', name: 'Priority Assets' },
]

// A real NewRecruit text export, pasted verbatim.
const REAL_EXPORT = `Take and hold (2,005 Points)

Chaos Daemons
Plague Legion and Warptide (3 Detachment Points)
Take and Hold
Strike Force (2,000 Points)

CHARACTERS

Bloodthirster (320 Points)
  • 1x Great axe of Khorne
  • 1x Hellfire breath

Great Unclean One (280 Points)
  • 1x Bileblade
  • 1x Bilesword
  • 1x Putrid vomit
  • Enhancements: Maggot Maws

BATTLELINE

Plaguebearers (115 Points)
  • 1x Plagueridden
     ◦ 1x Plaguesword
  • 9x Plaguebearer
     ◦ 9x Plaguesword
  • 1x Daemonic Icon
  • 1x Instrument of Chaos

OTHER DATASHEETS

Beasts of Nurgle (80 Points)
  • 1x Putrid appendages

Exported with New Recruit v36.2, Data Version: v2`

describe('parseArmyListText', () => {
  it('extracts both faction and Force Disposition from a real NewRecruit export', () => {
    const result = parseArmyListText(REAL_EXPORT, factions, forceDispositions)
    expect(result.factionId).toBe('f2')
    expect(result.forceDispositionId).toBe('d1')
  })

  it("doesn't confuse the list's own title line with the Force Disposition line", () => {
    // The title line "Take and hold (2,005 Points)" is never an exact match for "Take and Hold"
    // even case-insensitively -- only the bare disposition line further down is.
    const noDispositionLine = REAL_EXPORT.split('\n')
      .filter((line) => line.trim() !== 'Take and Hold')
      .join('\n')
    const result = parseArmyListText(noDispositionLine, factions, forceDispositions)
    expect(result.forceDispositionId).toBeNull()
    expect(result.factionId).toBe('f2')
  })

  it('returns nulls for text with no recognizable faction or disposition line', () => {
    const result = parseArmyListText('Just some random notes about my hobby project.', factions, forceDispositions)
    expect(result.factionId).toBeNull()
    expect(result.forceDispositionId).toBeNull()
  })

  it('matches case-insensitively', () => {
    const result = parseArmyListText('necrons\n\nreconnaissance', factions, forceDispositions)
    expect(result.factionId).toBe('f3')
    expect(result.forceDispositionId).toBe('d3')
  })

  it('handles empty input without throwing', () => {
    expect(parseArmyListText('', factions, forceDispositions)).toEqual({
      factionId: null,
      forceDispositionId: null,
    })
  })
})
