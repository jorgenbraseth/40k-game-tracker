import { Select } from '@/components/Select'
import { TextField } from '@/components/TextField'
import type { GameDetail } from '@/lib/queries/games'
import { useLadderMembers } from '@/lib/queries/ladders'

type PlayerEntry = GameDetail['players'][number]

/**
 * A single seat's own setup: who this seat *is* (Faction, Force Disposition, Army name -- plus,
 * first, a "Player" picker when `me` is an unclaimed seat on a ladder-tagged game, letting the
 * bookkeeper attribute it to a real ladder member so that player's result counts in standings
 * even though they never signed in). Shared between the waiting room and the in-game "edit your
 * setup" sheet, since a wrong pick here should always be correctable, not just before the game
 * starts.
 *
 * Terrain layout, Attacker/Defender, and turn order are *not* here -- none of them are a single
 * seat's own property, they're shared decisions about the game as a whole, so they live in their
 * own GameConfigPicker instead.
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

      <TextField
        label="Army name"
        defaultValue={me.player.army_name ?? ''}
        onBlur={(e) => onUpdateSetup({ armyName: e.target.value || null })}
      />
    </div>
  )
}
