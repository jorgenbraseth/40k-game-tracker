import { useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ErrorBanner, Spinner } from '@/components/Feedback'
import { useJoinLadderByInviteCode } from '@/lib/queries/ladders'
import { showToast } from '@/lib/toast'

/** Landing target for a shared ladder invite link (/ladders/join/:code) -- joins automatically on
 * arrival (the viewer is already signed in by the time they get here, ProtectedRoute bounces
 * anyone who isn't through sign-in first and back) and lands on the Ladders page, same as if
 * they'd typed the code into the join sheet themselves. */
export function LadderJoinPage() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const join = useJoinLadderByInviteCode()
  const attemptedCode = useRef<string | null>(null)

  useEffect(() => {
    if (!code || attemptedCode.current === code) return
    attemptedCode.current = code
    join.mutate(code, {
      onSuccess: () => {
        showToast('Joined the ladder!')
        navigate('/ladders', { replace: true })
      },
    })
    // Re-run only when the code in the URL changes -- join/navigate are stable, and
    // `attemptedCode` already guards against firing the mutation twice for the same code.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  if (join.isError) {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <ErrorBanner message={join.error instanceof Error ? join.error.message : "That invite link doesn't work."} />
      </div>
    )
  }

  return <Spinner label="Joining ladder…" />
}
