import { useToasts } from '@/lib/toast'

/** Mounted once near the app root -- renders whatever showToast() queued, anywhere in the app. */
export function Toaster() {
  const toasts = useToasts()
  if (toasts.length === 0) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="alert"
          className="max-w-sm rounded-lg bg-danger/95 px-4 py-2.5 text-center text-sm text-onfill shadow-lg"
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}
