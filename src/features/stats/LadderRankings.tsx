import { ErrorBanner, Spinner } from '@/components/Feedback'
import { RANKING_TYPE_LABELS, usePlayerLadderRankings } from '@/lib/queries/ladders'
import { RatingChart } from './RatingChart'

/** The player's standing in each ladder they're a member of, with a rating-over-time line per
 * ladder. Loads independently of the rest of the stats page, so a slow ladder replay doesn't hold
 * up the win/loss record above it. */
export function LadderRankings({ userId }: { userId: string }) {
  const { data, isLoading, isError, refetch } = usePlayerLadderRankings(userId)

  if (isLoading) return <Spinner label="Loading ladder rankings…" />
  if (isError) return <ErrorBanner message="Couldn't load ladder rankings." onRetry={() => refetch()} />
  if (!data || data.length === 0) return null

  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold tracking-wide text-paper/60 uppercase">Ladder rankings</h2>
      <ul className="flex flex-col gap-3">
        {data.map((l) => (
          <li key={l.ladderId} className="rounded-lg border border-veil-strong bg-veil px-3 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-paper">{l.ladderName}</p>
                <p className="text-xs text-paper/50">
                  {RANKING_TYPE_LABELS[l.rankingType]} · {l.standing.rating}
                  {l.archived ? ' · Archived' : ''}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-2xl leading-none font-bold text-gold">
                  #{l.rank}
                  <span className="text-sm font-normal text-paper/60"> of {l.fieldSize}</span>
                </p>
                {l.tiedWith > 0 && <p className="mt-1 text-xs text-paper/50">tied with {l.tiedWith}</p>}
              </div>
            </div>
            <p className="mt-1 text-sm text-paper/60">
              {l.standing.wins}W {l.standing.losses}L {l.standing.draws}D · {l.standing.gamesPlayed} games
            </p>
            {l.history.length > 0 ? (
              <div className="mt-2">
                <RatingChart history={l.history} startingRating={l.startingRating} ladderName={l.ladderName} />
              </div>
            ) : (
              <p className="mt-2 text-xs text-paper/50">No rated games in this ladder yet.</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
