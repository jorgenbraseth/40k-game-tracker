import { Button } from '@/components/Button'
import { Select } from '@/components/Select'
import { TextField } from '@/components/TextField'
import type { Database } from '@/lib/database.types'
import type { GameDetail } from '@/lib/queries/games'
import { useLadderMembers } from '@/lib/queries/ladders'
import { LayoutVariantPicker } from './LayoutVariantPicker'

type PlayerEntry = GameDetail['players'][number]
type LayoutVariant = Database['public']['Tables']['games']['Row']['layout_variant']
type LayoutMission = Parameters<typeof LayoutVariantPicker>[0]['mission']

/**
 * The full per-seat setup form -- shared between the waiting room and
 * the in-game "edit your setup" sheet, since a wrong pick here should
 * always be correctable, not just before the game starts. Two groups,
 * in order: who this seat *is* (Force Disposition, Faction, Army name --
 * plus, first, a "Player" picker when `me` is an unclaimed seat on a
 * ladder-tagged game, letting the bookkeeper attribute it to a real
 * ladder member so that player's result counts in standings even though
 * they never signed in); then the game configuration decided once both
 * seats are filled in (terrain layout -- shown once the mission's Force
 * Disposition pairing is known, via the layout* props -- then Attacker/
 * Defender, then who went first).
 */
export function PlayerSetupFields({
  me,
  opponent,
  factions,
  forceDispositions,
  onUpdateSetup,
  onSetRole,
  onSetTurnOrder,
  layoutMission,
  layoutVariant,
  onSetLayoutVariant,
  ladderId,
}: {
  me: PlayerEntry
  opponent: PlayerEntry | undefined
  factions: Array<{ id: string; name: string }>
  forceDispositions: Array<{ id: string; name: string }>
  onUpdateSetup: (patch: {
    factionId?: string | null
    armyName?: string | null
    forceDispositionId?: string | null
    representsUserId?: string | null
  }) => void
  onSetRole: (role: 'attacker' | 'defender' | null) => void
  onSetTurnOrder: (turnOrder: 'first' | 'second' | null) => void
  layoutMission?: LayoutMission
  layoutVariant?: LayoutVariant
  onSetLayoutVariant?: (variant: LayoutVariant) => void
  ladderId?: string | null
}) {
  const isUnclaimedSeat = !me.player.user_id
  const ladderMembers = useLadderMembers(isUnclaimedSeat && ladderId ? ladderId : undefined)

  return (
    <div className="flex flex-col gap-3">
      {isUnclaimedSeat && ladderId && (ladderMembers.data?.length ?? 0) > 0 && (
        <div>
          <Select
            label="Player"
            value={me.player.represents_user_id ?? ''}
            onChange={(e) => onUpdateSetup({ representsUserId: e.target.value || null })}
          >
            <option value="">Not sure yet</option>
            {ladderMembers.data?.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.displayName}
              </option>
            ))}
          </Select>
          <p className="mt-1.5 text-xs text-paper/50">
            Who on the ladder this seat is for -- so their result counts in standings even though
            you're entering it for them.
          </p>
        </div>
      )}

      <Select
        label="Force Disposition"
        value={me.player.force_disposition_id ?? ''}
        onChange={(e) => onUpdateSetup({ forceDispositionId: e.target.value || null })}
      >
        <option value="">Pick Force Disposition</option>
        {forceDispositions.map((fd) => (
          <option key={fd.id} value={fd.id}>
            {fd.name}
          </option>
        ))}
      </Select>

      <Select
        label="Faction"
        value={me.player.faction_id ?? ''}
        onChange={(e) => onUpdateSetup({ factionId: e.target.value || null })}
      >
        <option value="">Pick faction</option>
        {factions.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </Select>

      <TextField
        label="Army name"
        defaultValue={me.player.army_name ?? ''}
        onBlur={(e) => onUpdateSetup({ armyName: e.target.value || null })}
      />

      {layoutMission && onSetLayoutVariant && (
        <div>
          <LayoutVariantPicker
            mission={layoutMission}
            value={layoutVariant ?? null}
            onChange={onSetLayoutVariant}
          />
          {!layoutVariant && (
            <p className="mt-1.5 text-xs text-paper/50">
              Pick a layout before starting -- like everything else here, it stays changeable any time.
            </p>
          )}
        </div>
      )}

      <div>
        <p className="mb-1 text-sm font-medium text-paper/80">Role</p>
        <p className="mb-1.5 text-xs text-paper/50">
          Roll off after the Deployment card is drawn -- <strong className="text-paper/70">the winner decides who
          is Attacker and who is Defender</strong>, not the roll itself. It sets which battlefield edge you deploy
          from and which Secondary Mission deck you draw from -- it doesn't change your Primary Mission.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {(['attacker', 'defender'] as const).map((role) => {
            const takenByOpponent = opponent?.player.role === role
            const mine = me.player.role === role
            return (
              <Button
                key={role}
                type="button"
                variant={mine ? 'primary' : 'secondary'}
                disabled={takenByOpponent && !mine}
                onClick={() => onSetRole(mine ? null : role)}
                className="capitalize"
              >
                {role}
                {takenByOpponent && !mine ? ' (taken)' : ''}
              </Button>
            )
          })}
        </div>
      </div>

      <div>
        <p className="mb-1 text-sm font-medium text-paper/80">Turn order</p>
        <p className="mb-1.5 text-xs text-paper/50">
          A separate roll-off decides who takes the first turn -- <strong className="text-paper/70">the
          winner goes first every battle round</strong> for the rest of the game (the "top of round" player;
          the other is "bottom of round"). Whoever went first shows first on the live Scoreboard.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {(['first', 'second'] as const).map((turnOrder) => {
            const takenByOpponent = opponent?.player.turn_order === turnOrder
            const mine = me.player.turn_order === turnOrder
            return (
              <Button
                key={turnOrder}
                type="button"
                variant={mine ? 'primary' : 'secondary'}
                disabled={takenByOpponent && !mine}
                onClick={() => onSetTurnOrder(mine ? null : turnOrder)}
              >
                Went {turnOrder}
                {takenByOpponent && !mine ? ' (taken)' : ''}
              </Button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
