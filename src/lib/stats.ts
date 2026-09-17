import type { CompletedGameRow } from '@/lib/queries/history'

export interface WinLossRecord {
  wins: number
  losses: number
  draws: number
  games: number
  winRate: number
}

export interface GroupedRecord extends WinLossRecord {
  key: string
}

function emptyRecord(): WinLossRecord {
  return { wins: 0, losses: 0, draws: 0, games: 0, winRate: 0 }
}

function tally(record: WinLossRecord, result: CompletedGameRow['result']) {
  record.games += 1
  if (result === 'win') record.wins += 1
  else if (result === 'loss') record.losses += 1
  else record.draws += 1
  record.winRate = record.games === 0 ? 0 : record.wins / record.games
}

export interface StatsSummary {
  overall: WinLossRecord
  byFaction: GroupedRecord[]
  byDisposition: GroupedRecord[]
  byOpponent: GroupedRecord[]
}

/** Pure aggregation over a user's completed games -- no I/O, easy to unit test. */
export function computeStats(rows: CompletedGameRow[]): StatsSummary {
  const overall = emptyRecord()
  const byFactionMap = new Map<string, WinLossRecord>()
  const byDispositionMap = new Map<string, WinLossRecord>()
  const byOpponentMap = new Map<string, WinLossRecord>()

  const bump = (map: Map<string, WinLossRecord>, key: string, result: CompletedGameRow['result']) => {
    const record = map.get(key) ?? emptyRecord()
    tally(record, result)
    map.set(key, record)
  }

  for (const row of rows) {
    if (row.result === 'abandoned') continue // no win/loss/draw to record
    tally(overall, row.result)
    bump(byFactionMap, row.myFactionName ?? 'Unknown faction', row.result)
    bump(byDispositionMap, row.myForceDispositionName ?? 'Unknown disposition', row.result)
    bump(byOpponentMap, row.opponentName, row.result)
  }

  const toSorted = (map: Map<string, WinLossRecord>): GroupedRecord[] =>
    [...map.entries()]
      .map(([key, record]) => ({ key, ...record }))
      .sort((a, b) => b.games - a.games || a.key.localeCompare(b.key))

  return {
    overall,
    byFaction: toSorted(byFactionMap),
    byDisposition: toSorted(byDispositionMap),
    byOpponent: toSorted(byOpponentMap),
  }
}
