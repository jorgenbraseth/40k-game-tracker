import type { GroupedRecord } from '@/lib/stats'

export function RecordGroup({ title, records }: { title: string; records: GroupedRecord[] }) {
  if (records.length === 0) return null
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold tracking-wide text-paper/60 uppercase">{title}</h2>
      <ul className="flex flex-col gap-1.5">
        {records.map((r) => (
          <li
            key={r.key}
            className="flex items-center justify-between rounded-lg border border-veil-strong bg-veil px-3 py-2"
          >
            <span className="text-paper">{r.key}</span>
            <span className="text-sm text-paper/60">
              {r.wins}W {r.losses}L {r.draws}D ·{' '}
              <span className="font-medium text-paper">{Math.round(r.winRate * 100)}%</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
