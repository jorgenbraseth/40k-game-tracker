import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/Button'
import { TextField } from '@/components/TextField'
import { useJoinGame } from '@/lib/queries/games'

export function JoinGamePage() {
  const navigate = useNavigate()
  const joinGame = useJoinGame()
  const [code, setCode] = useState('')

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const gameId = await joinGame.mutateAsync({ code })
      navigate(`/game/${gameId}`)
    } catch {
      // error surfaced below via joinGame.error
    }
  }

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
        {joinGame.isError && (
          <p className="text-sm text-danger">
            {joinGame.error instanceof Error ? joinGame.error.message : 'Could not join game.'}
          </p>
        )}
        <Button type="submit" disabled={joinGame.isPending || code.length < 6} fullWidth>
          {joinGame.isPending ? 'Joining…' : 'Join game'}
        </Button>
      </form>
    </div>
  )
}
