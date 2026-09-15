import { Button } from '@/components/Button'
import { Select } from '@/components/Select'
import { TextField } from '@/components/TextField'
import type { Database } from '@/lib/database.types'
import type { GameDetail } from '@/lib/queries/games'
import { LayoutVariantPicker } from './LayoutVariantPicker'

type PlayerEntry = GameDetail['players'][number]
type LayoutVariant = Database['public']['Tables']['games']['Row']['layout_variant']
type LayoutMission = Parameters<typeof LayoutVariantPicker>[0]['mission']

/**
 * Force Disposition / Faction / Army name / Role -- shared between the
 * waiting room and the in-game "edit your setup" sheet, since a wrong
 * pick here should always be correctable, not just before the game starts.
 * The terrain layout picker lives at the bottom of this same form (when
 * the layout* props are passed) since it's chosen alongside Attacker/
 * Defender, once the mission -- and so the Force Disposition pairing
 * that determines the 3 layout options -- is known.
 */
export function PlayerSetupFields({
  me,
  opponent,
  factions,
  forceDispositions,
  onUpdateSetup,
  onSetRole,
  layoutMission,
  layoutVariant,
  onSetLayoutVariant,
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
  layoutMission?: LayoutMission
  layoutVariant?: LayoutVariant
  onSetLayoutVariant?: (variant: LayoutVariant) => void
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
    </div>
  )
}
