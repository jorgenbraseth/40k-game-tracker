import { useState, type PointerEvent } from 'react'
import type { RankPoint } from '@/lib/ladderRank'

const WIDTH = 320
const HEIGHT = 140
const PAD = { top: 10, right: 10, bottom: 18, left: 28 }
const PLOT_W = WIDTH - PAD.left - PAD.right
const PLOT_H = HEIGHT - PAD.top - PAD.bottom

const dateFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

/** Up to ~6 whole-number ranks from 1 to `max`, always including both ends. */
function rankTicks(max: number): number[] {
  if (max <= 6) return Array.from({ length: max }, (_, i) => i + 1)
  const step = Math.ceil((max - 1) / 4)
  const ticks: number[] = []
  for (let r = 1; r < max; r += step) ticks.push(r)
  if (max - ticks[ticks.length - 1] < step) ticks.pop()
  ticks.push(max)
  return ticks
}

/**
 * A player's rank in one ladder over time -- one point per ladder game from their first game on,
 * evenly spaced (game nights bunch games together, so a time axis would squash most of the line
 * into a few columns). Rank 1 sits at the top. Filled dots mark games the player played
 * themselves; the line also moves between them when someone else's result overtakes them.
 * Hover/drag reads out the point under the pointer below the chart (the latest one otherwise).
 */
export function RankChart({ history, ladderName }: { history: RankPoint[]; ladderName: string }) {
  const [active, setActive] = useState<number | null>(null)

  const maxRank = Math.max(2, ...history.map((p) => p.fieldSize))
  const x = (i: number) => PAD.left + (history.length === 1 ? PLOT_W / 2 : (i / (history.length - 1)) * PLOT_W)
  const y = (rank: number) => PAD.top + ((rank - 1) / (maxRank - 1)) * PLOT_H
  const path = history.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.rank).toFixed(1)}`).join(' ')

  const onPointer = (e: PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    const viewX = ((e.clientX - box.left) / box.width) * WIDTH
    const i = history.length === 1 ? 0 : Math.round(((viewX - PAD.left) / PLOT_W) * (history.length - 1))
    setActive(Math.min(history.length - 1, Math.max(0, i)))
  }

  const first = history[0]
  const last = history[history.length - 1]
  const point = active === null ? null : history[active]
  const shown = point ?? last

  return (
    <div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full touch-pan-y select-none"
        role="img"
        aria-label={`Rank in ${ladderName} over ${history.length} games: from #${first.rank} to #${last.rank} of ${last.fieldSize}.`}
        onPointerMove={onPointer}
        onPointerDown={onPointer}
        onPointerLeave={() => setActive(null)}
      >
        {rankTicks(maxRank).map((r) => (
          <g key={r}>
            <line
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={y(r)}
              y2={y(r)}
              className="stroke-paper/10"
              strokeWidth={1}
            />
            <text x={PAD.left - 6} y={y(r)} dy="0.32em" textAnchor="end" className="fill-paper/50 text-[9px]">
              #{r}
            </text>
          </g>
        ))}
        <text x={PAD.left} y={HEIGHT - 4} className="fill-paper/50 text-[9px]">
          {dateFormat.format(new Date(first.playedAt))}
        </text>
        {history.length > 1 && (
          <text x={WIDTH - PAD.right} y={HEIGHT - 4} textAnchor="end" className="fill-paper/50 text-[9px]">
            {dateFormat.format(new Date(last.playedAt))}
          </text>
        )}

        {point && active !== null && (
          <line
            x1={x(active)}
            x2={x(active)}
            y1={PAD.top}
            y2={PAD.top + PLOT_H}
            className="stroke-paper/30"
            strokeWidth={1}
          />
        )}
        <path d={path} fill="none" className="stroke-gold" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {history.map((p, i) =>
          p.playedInGame || i === active ? (
            <circle
              key={i}
              cx={x(i)}
              cy={y(p.rank)}
              r={i === active ? 4.5 : 3}
              className={p.playedInGame ? 'fill-gold stroke-veil' : 'fill-veil stroke-gold'}
              strokeWidth={p.playedInGame ? 1.5 : 2}
            />
          ) : null,
        )}
      </svg>

      <p className="text-xs text-paper/60" aria-live="polite">
        <span className="font-semibold text-paper">
          #{shown.rank} of {shown.fieldSize}
        </span>{' '}
        · {shown.rating} · {dateFormat.format(new Date(shown.playedAt))}
        {shown.playedInGame ? '' : ' · after others’ game'}
        {point ? '' : ' (latest)'}
      </p>
    </div>
  )
}
