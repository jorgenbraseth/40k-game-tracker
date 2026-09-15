export const ELO_STARTING_RATING = 1500
export const ELO_K_FACTOR = 32

export interface EloGame {
  /** Sort key for chronological replay, e.g. an ISO timestamp. Elo is a path-dependent,
   * sequential rating -- the order games happened in changes the result -- so this must be a
   * stable ordering across the whole history, not just "when this query happened to return it". */
  playedAt: string
  playerAId: string
  playerBId: string
  /** From player A's perspective: 1 = A won, 0 = A lost, 0.5 = draw. */
  scoreForA: 0 | 0.5 | 1
}

function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400))
}

/**
 * Replays a set of games in chronological order and returns each player's resulting Elo rating.
 * Always call this with a player's *entire* game history, never just the newest game against a
 * previously-stored rating -- Elo's sequential nature means an edited or cancelled game only gets
 * reflected correctly by replaying from scratch, not by patching a stored number. That's cheap at
 * the game volumes this app deals with, so ratings are never stored, only ever computed live.
 */
export function computeEloRatings(
  games: EloGame[],
  options: { kFactor?: number; startingRating?: number } = {},
): Map<string, number> {
  const kFactor = options.kFactor ?? ELO_K_FACTOR
  const startingRating = options.startingRating ?? ELO_STARTING_RATING
  const ratings = new Map<string, number>()
  const getRating = (id: string) => ratings.get(id) ?? startingRating

  const sorted = [...games].sort((a, b) => new Date(a.playedAt).getTime() - new Date(b.playedAt).getTime())
  for (const game of sorted) {
    const ratingA = getRating(game.playerAId)
    const ratingB = getRating(game.playerBId)
    const expectedA = expectedScore(ratingA, ratingB)
    const expectedB = 1 - expectedA
    const scoreForB = 1 - game.scoreForA
    ratings.set(game.playerAId, ratingA + kFactor * (game.scoreForA - expectedA))
    ratings.set(game.playerBId, ratingB + kFactor * (scoreForB - expectedB))
  }
  return ratings
}
