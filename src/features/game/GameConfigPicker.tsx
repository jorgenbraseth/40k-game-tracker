import { Button } from '@/components/Button'
import type { GameDetail } from '@/lib/queries/games'
import { playerLabel } from '@/lib/queries/games'

type PlayerEntry = GameDetail['players'][number]

/**
 * Attacker/Defender and turn order are each a single shared decision between the two seats, not
 * an independent choice per player -- asking "who is Attacker?" once, by name, reads more
 * naturally than showing the same Attacker/Defender toggle on both players' own setup forms (and
 * matches how the roll-off actually works: one winner, decided once, not agreed to twice).
 *
 * `me`/`opponent` are from the *viewer's own* perspective, so their own button reads "You" -- but
 * the picker reflects whichever seat actually holds each role/turn order, regardless of who set
 * it, so it looks the same and stays in sync for both players' own devices.
 */
export function GameConfigPicker({
  me,
  opponent,
  onSetRole,
  onSetTurnOrder,
}: {
  me: PlayerEntry
  opponent: PlayerEntry
  onSetRole: (role: 'attacker' | 'defender' | null) => void
  onSetTurnOrder: (turnOrder: 'first' | 'second' | null) => void
}) {
  const myLabel = playerLabel(me, 'You')
  const opponentLabel = playerLabel(opponent, 'Player 2')

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-1 text-sm font-medium text-paper/80">Attacker</p>
        <p className="mb-1.5 text-xs text-paper/50">
          Roll off after the Deployment card is drawn -- <strong className="text-paper/70">the winner decides who
          is Attacker and who is Defender</strong>, not the roll itself. It sets which battlefield edge each of you
          deploys from and which Secondary Mission deck you draw from -- it doesn't change either side's Primary
          Mission.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={me.player.role === 'attacker' ? 'primary' : 'secondary'}
            onClick={() => onSetRole(me.player.role === 'attacker' ? null : 'attacker')}
          >
            {myLabel}
          </Button>
          <Button
            type="button"
            variant={opponent.player.role === 'attacker' ? 'primary' : 'secondary'}
            onClick={() => onSetRole(me.player.role === 'defender' ? null : 'defender')}
          >
            {opponentLabel}
          </Button>
        </div>
      </div>

      <div>
        <p className="mb-1 text-sm font-medium text-paper/80">Went first</p>
        <p className="mb-1.5 text-xs text-paper/50">
          A separate roll-off decides who takes the first turn -- <strong className="text-paper/70">the
          winner goes first every battle round</strong> for the rest of the game (the "top of round" player;
          the other is "bottom of round"). Whoever went first shows first on the live Scoreboard.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={me.player.turn_order === 'first' ? 'primary' : 'secondary'}
            onClick={() => onSetTurnOrder(me.player.turn_order === 'first' ? null : 'first')}
          >
            {myLabel}
          </Button>
          <Button
            type="button"
            variant={opponent.player.turn_order === 'first' ? 'primary' : 'secondary'}
            onClick={() => onSetTurnOrder(me.player.turn_order === 'second' ? null : 'second')}
          >
            {opponentLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
