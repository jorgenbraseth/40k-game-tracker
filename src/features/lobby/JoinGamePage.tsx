import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/Button'
import { ErrorBanner, Spinner } from '@/components/Feedback'
import { TextField } from '@/components/TextField'
import { useFindGameByCode, useJoinGame } from '@/lib/queries/games'

export function JoinGamePage() {
  const navigate = useNavigate()
  const { code: codeParam } = useParams<{ code?: string }>()
  const joinGame = useJoinGame()
  const findGame = useFindGameByCode()
  const [code, setCode] = useState('')
  const attemptedCode = useRef<string | null>(null)

  // A shared invite link (/game/join/:code) auto-joins on arrival instead of asking the viewer
  // to retype the code they already have -- the manual form below still exists for someone typing
  // a code by hand.
  useEffect(() => {
    if (!codeParam || attemptedCode.current === codeParam) return
    attemptedCode.current = codeParam
    joinGame.mutate(
      { code: codeParam },
      { onSuccess: (gameId) => navigate(`/game/${gameId}`, { replace: true }) },
    )
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [codeParam])

  if (codeParam) {
    if (joinGame.isError) {
      return (
        <div className="flex flex-col items-center gap-4 py-12">
          <ErrorBanner message={joinGame.error instanceof Error ? joinGame.error.message : 'Could not join game.'} />
        </div>
      )
    }
    return <Spinner label="Joining game…" />
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    findGame.reset()
    try {
      const gameId = await joinGame.mutateAsync({ code })
      navigate(`/game/${gameId}`)
    } catch {
      // error surfaced below via joinGame.error
    }
  }

  const onWatch = async () => {
    joinGame.reset()
    try {
      const gameId = await findGame.mutateAsync(code)
      navigate(`/game/${gameId}`)
    } catch {
      // error surfaced below via findGame.error
    }
  }

  const error = joinGame.error ?? findGame.error

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-paper">Join a game</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <TextField
          label="Game code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={6}
          autoCapitalize="characters"
          autoCorrect="off"
          placeholder="ABC123"
          className="text-center text-2xl tracking-[0.3em]"
          required
        />
        {error && (
          <p className="text-sm text-danger">{error instanceof Error ? error.message : 'Could not join game.'}</p>
        )}
        <Button type="submit" disabled={joinGame.isPending || findGame.isPending || code.length < 6} fullWidth>
          {joinGame.isPending ? 'Joining…' : 'Join game'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={joinGame.isPending || findGame.isPending || code.length < 6}
          onClick={onWatch}
          fullWidth
        >
          {findGame.isPending ? 'Opening…' : 'Watch as spectator'}
        </Button>
        <p className="text-center text-xs text-paper/40">
          Watching doesn't take a seat -- you see the live score but can't change anything.
        </p>
      </form>
    </div>
  )
}
