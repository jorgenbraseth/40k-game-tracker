import { computeEloRatings, type EloGame } from '@/lib/elo'
import { computeGlicko2Ratings } from '@/lib/glicko2'

export type RatingSystem = 'elo' | 'glicko2'

/** One point on a player's rating-over-time line: their rating right after one of their own
 * ladder games. */
export interface RatingPoint {
  playedAt: string
  /** Rounded, as shown in standings. */
  rating: number
  /** Change from their rating going into this game (from the starting rating for their first). */
  change: number
  result: 'win' | 'draw' | 'loss'
}

/** Competition rank of `userId` among `ratings` (rounded, as displayed). */
export function rankOf(userId: string, ratings: ReadonlyMap<string, number>): number {
  const own = Math.round(ratings.get(userId) ?? 0)
  let higher = 0
  for (const [id, rating] of ratings) if (id !== userId && Math.round(rating) > own) higher += 1
  return higher + 1
}

/**
 * Replays a ladder's rated games once and records `userId`'s rating after each game they played
 * in -- a rating only moves on the player's own results, so other people's games add nothing to
 * the line. The last point always matches the rating shown in standings.
 */
export function computeRatingHistory(input: {
  games: EloGame[]
  rankingType: RatingSystem
  userId: string
  startingRating: number
}): RatingPoint[] {
  const { games, rankingType, userId, startingRating } = input
  const history: RatingPoint[] = []
  let previous = startingRating

  const onGame = (game: EloGame, ratings: ReadonlyMap<string, number>) => {
    const isA = game.playerAId === userId
    if (!isA && game.playerBId !== userId) return
    const score = isA ? game.scoreForA : 1 - game.scoreForA
    const rating = Math.round(ratings.get(userId) ?? startingRating)
    history.push({
      playedAt: game.playedAt,
      rating,
      change: rating - Math.round(previous),
      result: score === 1 ? 'win' : score === 0 ? 'loss' : 'draw',
    })
    previous = rating
  }

  if (rankingType === 'glicko2') computeGlicko2Ratings(games, { onGame })
  else computeEloRatings(games, { onGame })
  return history
}
