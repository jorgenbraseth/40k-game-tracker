import { useOnlineStatus } from '@/lib/useOnlineStatus'

export function OfflineBanner() {
  const online = useOnlineStatus()
  if (online) return null

  return (
    <div className="bg-danger px-4 py-1.5 text-center text-xs font-medium text-onfill">
      You're offline. Your taps are saved on this screen and will send once you're back online.
    </div>
  )
}
