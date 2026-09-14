import { Button } from '@/components/Button'
import { Select } from '@/components/Select'
import { TextField } from '@/components/TextField'
import type { GameDetail } from '@/lib/queries/games'

type PlayerEntry = GameDetail['players'][number]

/**
 * Force Disposition / Faction / Army name / Role -- shared between the
 * waiting room and the in-game "edit your setup" sheet, since a wrong
 * pick here should always be correctable, not just before the game starts.
 */
export function PlayerSetupFields({
  me,
  opponent,
  factions,
  forceDispositions,
  onUpdateSetup,
  onSetRole,
}: {
  me: PlayerEntry
  opponent: PlayerEntry | undefined
  factions: Array<{ id: string; name: string }>
  forceDispositions: Array<{ id: string; name: string }>
  onUpdateSetup: (patch: {
    factionId?: string | null
    armyName?: string | null
    forceDispositionId?: string | null
  }) => void
  onSetRole: (role: 'attacker' | 'defender' | null) => void
}) {
  return (
    <div className="flex flex-col gap-3">
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

      <div>
        <p className="mb-1 text-sm font-medium text-paper/80">Role</p>
        <p className="mb-1.5 text-xs text-paper/50">
          Attacker and Defender are decided by a roll-off after the Deployment card is drawn (winner picks). It sets
          which battlefield edge you deploy from and which Secondary Mission deck you draw from -- it doesn't change
          your Primary Mission.
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
    </div>
  )
}
