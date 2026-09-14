import type { ReactNode } from 'react'

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-paper/60">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-gold"
        role="status"
        aria-label={label}
      />
      <span className="text-sm">{label}</span>
    </div>
  )
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-red-500/30 bg-red-950/40 p-4 text-center text-sm text-red-200">
      <p>{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="min-h-9 rounded-lg bg-red-800/60 px-3 py-1.5 text-paper hover:bg-red-800"
        >
          Try again
        </button>
      )}
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-white/15 p-8 text-center">
      <p className="font-medium text-paper">{title}</p>
      {description && <p className="text-sm text-paper/60">{description}</p>}
      {action}
    </div>
  )
}
