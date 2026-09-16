/**
 * Glicko-2 (Glickman, "Example of the Glicko-2 system"): a confidence-aware alternative to Elo
 * (see elo.ts) -- alongside a rating, each player carries a Rating Deviation (RD, how confident
 * the system is in that rating) and a volatility (how erratically their results swing). A
 * new/inactive player's RD is high, so their rating moves a lot per game; an established player's
 * RD is low, so theirs moves less -- and notably, an established player who suddenly loses to a
 * weak opponent moves *more* than they would mid-streak, since volatility also factors in. This
 * fits irregular, bursty tabletop play noticeably better than Elo's implicit assumption of steady
 * play (see issue #26's research writeup for the fuller comparison).
 *
 * The reference algorithm updates a player once per "rating period" from *all* games played in
 * that period together. This app has no natural period boundary -- games arrive as a continuous,
 * irregularly-spaced stream -- so each game here is treated as its own single-game period,
 * applied sequentially in chronological order (same replay-from-scratch shape as computeEloRatings:
 * never stored, always recomputed live from a ladder's full history, so an edited or cancelled
 * game is correct again the instant standings are re-viewed).
 */

export const GLICKO2_STARTING_RATING = 1500
export const GLICKO2_STARTING_RD = 350
export const GLICKO2_STARTING_VOLATILITY = 0.06
/** System constant τ -- constrains how much volatility can change per period. 0.5 is the value
 * Glickman's own paper uses throughout its worked example, and a reasonable default absent a
 * specific reason to tune it (per issue #26, this was left as a "not decided here" detail). */
export const GLICKO2_TAU = 0.5

/** Glicko-1 <-> Glicko-2 scale factor (400 / ln(10)), from the reference paper. */
const SCALE = 173.7178

export interface Glicko2Game {
  /** Sort key for chronological replay -- see computeEloRatings' identical requirement, same
   * reasoning applies here (Glicko-2 is sequential/path-dependent too). */
  playedAt: string
  playerAId: string
  playerBId: string
  /** From player A's perspective: 1 = A won, 0 = A lost, 0.5 = draw. */
  scoreForA: 0 | 0.5 | 1
}

export interface Glicko2State {
  rating: number
  rd: number
  volatility: number
}

function toGlickoScale(rating: number, rd: number) {
  return { mu: (rating - GLICKO2_STARTING_RATING) / SCALE, phi: rd / SCALE }
}

function fromGlickoScale(mu: number, phi: number): { rating: number; rd: number } {
  return { rating: mu * SCALE + GLICKO2_STARTING_RATING, rd: phi * SCALE }
}

function g(phi: number): number {
  return 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI))
}

function expectedScore(mu: number, muOpponent: number, phiOpponent: number): number {
  return 1 / (1 + Math.exp(-g(phiOpponent) * (mu - muOpponent)))
}

/** Solves for the period's new volatility via the Illinois-algorithm root-find in step 5 of
 * Glickman's paper -- converges in a handful of iterations without needing a derivative. */
function solveNewVolatility(phi: number, v: number, delta: number, sigma: number, tau: number): number {
  const a = Math.log(sigma * sigma)
  const deltaSq = delta * delta
  const phiSq = phi * phi
  const tauSq = tau * tau

  const f = (x: number) => {
    const ex = Math.exp(x)
    return (ex * (deltaSq - phiSq - v - ex)) / (2 * (phiSq + v + ex) ** 2) - (x - a) / tauSq
  }

  let A = a
  let B: number
  if (deltaSq > phiSq + v) {
    B = Math.log(deltaSq - phiSq - v)
  } else {
    let k = 1
    while (f(a - k * tau) < 0) k += 1
    B = a - k * tau
  }

  let fA = f(A)
  let fB = f(B)
  const epsilon = 1e-6
  for (let i = 0; i < 100 && Math.abs(B - A) > epsilon; i++) {
    const C = A + ((A - B) * fA) / (fB - fA)
    const fC = f(C)
    if (fC * fB < 0) {
      A = B
      fA = fB
    } else {
      fA = fA / 2
    }
    B = C
    fB = fC
  }

  return Math.exp(A / 2)
}

function updateAfterGame(
  player: Glicko2State,
  opponent: Glicko2State,
  score: 0 | 0.5 | 1,
  tau: number,
): Glicko2State {
  const { mu, phi } = toGlickoScale(player.rating, player.rd)
  const { mu: muOpp, phi: phiOpp } = toGlickoScale(opponent.rating, opponent.rd)

  const gPhiOpp = g(phiOpp)
  const e = expectedScore(mu, muOpp, phiOpp)
  const v = 1 / (gPhiOpp * gPhiOpp * e * (1 - e))
  const delta = v * gPhiOpp * (score - e)

  const volatility = solveNewVolatility(phi, v, delta, player.volatility, tau)

  const phiStar = Math.sqrt(phi * phi + volatility * volatility)
  const phiPrime = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v)
  const muPrime = mu + phiPrime * phiPrime * gPhiOpp * (score - e)

  const { rating, rd } = fromGlickoScale(muPrime, phiPrime)
  return { rating, rd, volatility }
}

/**
 * Replays a set of games in chronological order and returns each player's resulting full
 * Glicko-2 state (rating, RD, volatility) -- see computeGlicko2Ratings for the common case of
 * just wanting the rating number, e.g. for a standings column.
 */
export function computeGlicko2States(
  games: Glicko2Game[],
  options: { startingRating?: number; startingRd?: number; startingVolatility?: number; tau?: number } = {},
): Map<string, Glicko2State> {
  const startingRating = options.startingRating ?? GLICKO2_STARTING_RATING
  const startingRd = options.startingRd ?? GLICKO2_STARTING_RD
  const startingVolatility = options.startingVolatility ?? GLICKO2_STARTING_VOLATILITY
  const tau = options.tau ?? GLICKO2_TAU

  const states = new Map<string, Glicko2State>()
  const getState = (id: string): Glicko2State =>
    states.get(id) ?? { rating: startingRating, rd: startingRd, volatility: startingVolatility }

  const sorted = [...games].sort((a, b) => new Date(a.playedAt).getTime() - new Date(b.playedAt).getTime())
  for (const game of sorted) {
    const a = getState(game.playerAId)
    const b = getState(game.playerBId)
    const scoreForB = (1 - game.scoreForA) as 0 | 0.5 | 1
    const nextA = updateAfterGame(a, b, game.scoreForA, tau)
    const nextB = updateAfterGame(b, a, scoreForB, tau)
    states.set(game.playerAId, nextA)
    states.set(game.playerBId, nextB)
  }

  return states
}

/** Just the rating number per player -- same return shape as computeEloRatings, so a standings
 * table's "Rating" column doesn't care which system a ladder is using. */
export function computeGlicko2Ratings(
  games: Glicko2Game[],
  options: { startingRating?: number; startingRd?: number; startingVolatility?: number; tau?: number } = {},
): Map<string, number> {
  const states = computeGlicko2States(games, options)
  const ratings = new Map<string, number>()
  for (const [id, state] of states) ratings.set(id, state.rating)
  return ratings
}
