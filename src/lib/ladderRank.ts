import { computeEloRatings, type EloGame } from '@/lib/elo'
import { computeGlicko2Ratings } from '@/lib/glicko2'

export type RatingSystem = 'elo' | 'glicko2'

/** One point on a player's rank-over-time line: where they stood in their ladder right after a
 * given ladder game was applied. */
export interface RankPoint {
  playedAt: string
  /** 1 = top. Competition ranking ("1, 2, 2, 4") on the rounded rating shown in standings, so
   * players tied on rating share a rank rather than being split by name. */
  rank: number
  fieldSize: number
  rating: number
  /** Whether the player themselves played in this game -- their rank also moves when others play
   * (someone overtakes them), so not every point is one of their own results. */
  playedInGame: boolean
}

/** Competition rank of `userId` among `ratings` (rounded, as displayed). */
export function rankOf(userId: string, ratings: ReadonlyMap<string, number>): number {
  const own = Math.round(ratings.get(userId) ?? 0)
  let higher = 0
  for (const [id, rating] of ratings) if (id !== userId && Math.round(rating) > own) higher += 1
  return higher + 1
}

/**
 * Replays a ladder's rated games once and records `userId`'s rank after every game from their
 * own first game onwards (before that they'd just be tied with everyone at the starting rating,
 * which says nothing). `fieldUserIds` is everyone ranked on the ladder today -- the same set the
 * standings table shows -- and anyone not yet rated sits at `startingRating`, exactly as the
 * standings table treats a member with no games, so the line's last point always matches the
 * rank shown in standings.
 */
export function computeRankHistory(input: {
  games: EloGame[]
  rankingType: RatingSystem
  userId: string
  fieldUserIds: string[]
  startingRating: number
}): RankPoint[] {
  const { games, rankingType, userId, startingRating } = input
  const field = new Set([...input.fieldUserIds, userId])
  const history: RankPoint[] = []
  let started = false

  const onGame = (game: EloGame, ratings: ReadonlyMap<string, number>) => {
    const playedInGame = game.playerAId === userId || game.playerBId === userId
    if (playedInGame) started = true
    if (!started) return
    const current = new Map<string, number>()
    for (const id of field) current.set(id, ratings.get(id) ?? startingRating)
    for (const [id, rating] of ratings) current.set(id, rating)
    history.push({
      playedAt: game.playedAt,
      rank: rankOf(userId, current),
      fieldSize: current.size,
      rating: Math.round(current.get(userId) ?? startingRating),
      playedInGame,
    })
  }

  if (rankingType === 'glicko2') computeGlicko2Ratings(games, { onGame })
  else computeEloRatings(games, { onGame })
  return history
}
