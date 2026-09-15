import { Button } from '@/components/Button'
import { Select } from '@/components/Select'
import { TextField } from '@/components/TextField'
import type { Database } from '@/lib/database.types'
import type { GameDetail } from '@/lib/queries/games'
import { useLadderMembers } from '@/lib/queries/ladders'

type PlayerEntry = GameDetail['players'][number]
type SecondaryMode = Database['public']['Tables']['game_players']['Row']['secondary_mode']

/**
 * A single seat's own setup: who this seat *is* (Faction, Force Disposition, which of Fixed or
 * Tactical they're playing Secondary Missions as, Army name -- plus, first, a "Player" picker
 * when `me` is an unclaimed seat on a ladder-tagged game, letting the bookkeeper attribute it to
 * a real ladder member so that player's result counts in standings even though they never signed
 * in). Shared between the waiting room and the in-game "edit your setup" sheet, since a wrong
 * pick here should always be correctable, not just before the game starts.
 *
 * Terrain layout, Attacker/Defender, and turn order are *not* here -- none of them are a single
 * seat's own property, they're shared decisions about the game as a whole, so they live in their
 * own GameConfigPicker instead. Fixed/Tactical, unlike those, *is* each seat's own independent
 * choice (not a shared roll-off outcome), so it belongs here alongside Faction/Force Disposition.
 */
export function PlayerSetupFields({
  me,
  factions,
  forceDispositions,
  onUpdateSetup,
  ladderId,
}: {
  me: PlayerEntry
  factions: Array<{ id: string; name: string }>
  forceDispositions: Array<{ id: string; name: string }>
  onUpdateSetup: (patch: {
    factionId?: string | null
    armyName?: string | null
    forceDispositionId?: string | null
    representsUserId?: string | null
    secondaryMode?: SecondaryMode
  }) => void
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

      <div>
        <span className="mb-1.5 block text-sm font-medium text-paper/80">Secondaries</span>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={me.player.secondary_mode === 'fixed' ? 'primary' : 'secondary'}
            onClick={() => onUpdateSetup({ secondaryMode: 'fixed' as SecondaryMode })}
          >
            Fixed
          </Button>
          <Button
            type="button"
            variant={me.player.secondary_mode === 'tactical' ? 'primary' : 'secondary'}
            onClick={() => onUpdateSetup({ secondaryMode: 'tactical' as SecondaryMode })}
          >
            Tactical
          </Button>
        </div>
        <p className="mt-1.5 text-xs text-paper/50">
          A few secondary cards score differently as a Fixed pick than as a Tactical draw -- this
          seat has to pick one or the other before the game can start, same as faction and Force
          Disposition, so the round screen always knows which scoring actually applies.
        </p>
      </div>

      <TextField
        label="Army name"
        defaultValue={me.player.army_name ?? ''}
        onBlur={(e) => onUpdateSetup({ armyName: e.target.value || null })}
      />
    </div>
  )
}
