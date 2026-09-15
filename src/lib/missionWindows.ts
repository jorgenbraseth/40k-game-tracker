const ORDINALS: Record<string, number> = { First: 1, Second: 2, Third: 3, Fourth: 4, Fifth: 5 }

export interface WindowRounds {
  /** Battle rounds (1-5) this window is live in; empty when it's end-of-battle-only. */
  rounds: number[]
  /** Only scorable once the game reaches the End of Game screen, not during any battle round. */
  endOfBattle: boolean
}

/**
 * Parses a mission_objective_line's window_label ("Second Battle Round Onwards", "First and
 * Second Battle Round", "End of the Battle", ...) into which battle rounds it can actually be
 * scored in -- so the round overview only shows scoring that's live for the round being viewed,
 * matching the real rule that (for example) "2nd Battle Round onwards" scoring can't be done in
 * the 1st battle round. Falls open (every round) on a label it doesn't recognise, so a future
 * mission pack with new wording never silently hides scoring instead of just not filtering it.
 */
export function windowRounds(windowLabel: string): WindowRounds {
  if (windowLabel === 'End of the Battle') return { rounds: [], endOfBattle: true }
  if (windowLabel === 'Any Battle Round') return { rounds: [1, 2, 3, 4, 5], endOfBattle: false }

  const onwards = windowLabel.match(/^(\w+) Battle Round Onwards$/)
  if (onwards && ORDINALS[onwards[1]]) {
    const start = ORDINALS[onwards[1]]
    return { rounds: [1, 2, 3, 4, 5].filter((r) => r >= start), endOfBattle: false }
  }

  const range = windowLabel.match(/^(\w+) (?:and|to) (\w+) Battle Rounds?$/)
  if (range && ORDINALS[range[1]] && ORDINALS[range[2]]) {
    const start = ORDINALS[range[1]]
    const end = ORDINALS[range[2]]
    return { rounds: [1, 2, 3, 4, 5].filter((r) => r >= start && r <= end), endOfBattle: false }
  }

  const single = windowLabel.match(/^(\w+) Battle Round$/)
  if (single && ORDINALS[single[1]]) {
    return { rounds: [ORDINALS[single[1]]], endOfBattle: false }
  }

  return { rounds: [1, 2, 3, 4, 5], endOfBattle: false }
}

/**
 * Whether a line's window is live for the round currently being viewed. `round` may be the End
 * of Game pseudo-round (`endOfGameRound`, one past the last real battle round) -- only
 * end-of-battle lines match that; every real battle round matches only its own window.
 */
export function windowAppliesToRound(windowLabel: string, round: number, endOfGameRound: number): boolean {
  const { rounds, endOfBattle } = windowRounds(windowLabel)
  return round === endOfGameRound ? endOfBattle : rounds.includes(round)
}
