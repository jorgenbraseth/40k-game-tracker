import { Button } from '@/components/Button'
import { Select } from '@/components/Select'
import type { Database } from '@/lib/database.types'
import type { GameDetail } from '@/lib/queries/games'
import { playerLabel } from '@/lib/queries/games'
import { LayoutVariantPicker } from './LayoutVariantPicker'

type PlayerEntry = GameDetail['players'][number]
type LayoutVariant = Database['public']['Tables']['games']['Row']['layout_variant']
type LayoutMission = Parameters<typeof LayoutVariantPicker>[0]['mission']

/**
 * The shared, game-level decisions -- terrain layout, Attacker/Defender, and turn order -- none
 * of which belong to one seat's own setup, so they live here instead of in PlayerSetupFields.
 * Attacker/Defender and turn order are each a single decision between the two seats, not an
 * independent choice per player -- asking "who is Attacker?" once, by name, reads more naturally
 * than showing the same toggle on both players' own setup forms (and matches how the roll-off
 * actually works: one winner, decided once, not agreed to twice).
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
  layoutMission,
  layoutVariant,
  onSetLayoutVariant,
  ladderId,
  ladderOptions,
  onSetLadder,
}: {
  me: PlayerEntry
  opponent: PlayerEntry
  onSetRole: (role: 'attacker' | 'defender' | null) => void
  onSetTurnOrder: (turnOrder: 'first' | 'second' | null) => void
  layoutMission?: LayoutMission
  layoutVariant?: LayoutVariant
  onSetLayoutVariant?: (variant: LayoutVariant) => void
  /** Which ladder (if any) this game's currently tagged to. */
  ladderId?: string | null
  /** Ladders this viewer can pick from -- the ones they're a member of, non-archived, plus the
   * currently-tagged one even if it's since been left or archived, so a stale selection never
   * just vanishes from the dropdown. */
  ladderOptions?: { id: string; name: string }[]
  onSetLadder?: (ladderId: string | null) => void
}) {
  const myLabel = playerLabel(me, 'You')
  const opponentLabel = playerLabel(opponent, 'Player 2')

  return (
    <div className="flex flex-col gap-4">
      {onSetLadder && (
        <Select
          label="Ladder game? (optional)"
          value={ladderId ?? ''}
          onChange={(e) => onSetLadder(e.target.value || null)}
        >
          <option value="">Not a ladder game</option>
          {(ladderOptions ?? []).map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </Select>
      )}

      {onSetLayoutVariant && (
        <div>
          <LayoutVariantPicker mission={layoutMission} value={layoutVariant ?? null} onChange={onSetLayoutVariant} />
          {layoutMission && !layoutVariant && (
            <p className="mt-1.5 text-xs text-paper/50">
              Pick a layout before starting -- like everything else here, it stays changeable any time.
            </p>
          )}
        </div>
      )}

      <div>
        <p className="mb-1 text-sm font-medium text-paper/80">Attacker</p>
        <p className="mb-1.5 text-xs text-paper/50">The Defender deploys first, then the Attacker.</p>
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
