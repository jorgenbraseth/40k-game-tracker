import { useState, type PointerEvent } from 'react'
import type { RatingPoint } from '@/lib/ladderRank'

const WIDTH = 320
const HEIGHT = 140
const PAD = { top: 10, right: 10, bottom: 18, left: 34 }
const PLOT_W = WIDTH - PAD.left - PAD.right
const PLOT_H = HEIGHT - PAD.top - PAD.bottom

const dateFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
const RESULT_LABELS: Record<RatingPoint['result'], string> = { win: 'Win', draw: 'Draw', loss: 'Loss' }

/** A rating axis covering every point and the starting rating, on round 10/20/25/50/100… steps,
 * aiming for ~4 gridlines. */
function ratingScale(values: number[]): { min: number; max: number; ticks: number[] } {
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const span = Math.max(hi - lo, 20)
  const raw = span / 4
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? 10 * magnitude
  const min = Math.floor(lo / step) * step
  const max = Math.max(Math.ceil(hi / step) * step, min + step)
  const ticks: number[] = []
  for (let t = min; t <= max + step / 2; t += step) ticks.push(t)
  return { min, max, ticks }
}

/**
 * A player's rating in one ladder over time -- one point per game they played there, evenly
 * spaced (game nights bunch games together, so a time axis would squash most of the line into a
 * few columns). A dashed line marks the starting rating everyone begins at. Hover/drag reads out
 * the point under the pointer below the chart (the latest one otherwise).
 */
export function RatingChart({
  history,
  startingRating,
  ladderName,
}: {
  history: RatingPoint[]
  startingRating: number
  ladderName: string
}) {
  const [active, setActive] = useState<number | null>(null)

  const scale = ratingScale([startingRating, ...history.map((p) => p.rating)])
  const x = (i: number) => PAD.left + (history.length === 1 ? PLOT_W / 2 : (i / (history.length - 1)) * PLOT_W)
  const y = (rating: number) => PAD.top + ((scale.max - rating) / (scale.max - scale.min)) * PLOT_H
  const path = history.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.rating).toFixed(1)}`).join(' ')

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
        aria-label={`Rating in ${ladderName} over ${history.length} games: from ${startingRating} to ${last.rating}.`}
        onPointerMove={onPointer}
        onPointerDown={onPointer}
        onPointerLeave={() => setActive(null)}
      >
        {scale.ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(t)} y2={y(t)} className="stroke-paper/10" strokeWidth={1} />
            <text x={PAD.left - 6} y={y(t)} dy="0.32em" textAnchor="end" className="fill-paper/50 text-[9px]">
              {t}
            </text>
          </g>
        ))}
        <line
          x1={PAD.left}
          x2={WIDTH - PAD.right}
          y1={y(startingRating)}
          y2={y(startingRating)}
          className="stroke-paper/35"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
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
        {history.map((p, i) => (
          <circle
            key={i}
            cx={x(i)}
            cy={y(p.rating)}
            r={i === active ? 4.5 : 3}
            className="fill-gold stroke-veil"
            strokeWidth={1.5}
          />
        ))}
      </svg>

      <p className="text-xs text-paper/60" aria-live="polite">
        <span className="font-semibold text-paper">{shown.rating}</span> ({shown.change >= 0 ? '+' : '−'}
        {Math.abs(shown.change)}) · {RESULT_LABELS[shown.result]} · {dateFormat.format(new Date(shown.playedAt))}
        {point ? '' : ' (latest)'}
      </p>
    </div>
  )
}
