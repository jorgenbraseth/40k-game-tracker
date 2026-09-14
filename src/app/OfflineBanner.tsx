import { useOnlineStatus } from '@/lib/useOnlineStatus'

export function OfflineBanner() {
  const online = useOnlineStatus()
  if (online) return null

  return (
    <div className="bg-red-900 px-4 py-1.5 text-center text-xs font-medium text-paper">
      You're offline. Scores will sync once you're back online.
    </div>
  )
}
