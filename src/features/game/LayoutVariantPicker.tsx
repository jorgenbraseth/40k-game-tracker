import { ImageOptionGrid } from '@/components/ImageOptionGrid'
import type { Database } from '@/lib/database.types'

type LayoutVariant = Database['public']['Tables']['games']['Row']['layout_variant']

interface MissionLayoutImages {
  layout_a_image_path: string | null
  layout_b_image_path: string | null
  layout_c_image_path: string | null
}

const LETTERS = ['A', 'B', 'C'] as const

/** Same grid shape as the real 3-option picker below (label + a row of aspect-[44/60] cells) --
 * shown while the mission hasn't resolved yet (still waiting on both Force Dispositions), so the
 * card it lives in doesn't visibly grow the moment it *does* resolve. */
function LayoutVariantSkeleton() {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-paper/80">Terrain layout</span>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {LETTERS.map((letter) => (
          <div
            key={letter}
            className="flex aspect-[44/60] w-full animate-pulse items-center justify-center rounded-lg border border-white/10 bg-white/5 text-xs text-paper/20"
          >
            Layout {letter}
          </div>
        ))}
      </div>
    </div>
  )
}

/** The 3 recommended terrain layouts for the resolved mission's Force Disposition pairing
 * (wahapedia keys these off the pairing, not the deployment -- see issue #20). Required before a
 * game can start (see WaitingRoom's canStart), but -- same as everything else -- stays editable
 * any time after that too, never re-locked once picked. Renders a same-sized skeleton instead of
 * nothing while `mission` isn't resolved yet, so this doesn't pop the surrounding card taller the
 * instant it is -- the resolution itself happens close to instantly once both Force Dispositions
 * are picked (see useUpdatePlayerSetup's optimistic mission prediction), but "both are picked" can
 * still be a while off if it's waiting on a real second player. */
export function LayoutVariantPicker({
  mission,
  value,
  onChange,
}: {
  mission: MissionLayoutImages | null | undefined
  value: LayoutVariant
  onChange: (variant: LayoutVariant) => void
}) {
  if (!mission) return <LayoutVariantSkeleton />

  const options = LETTERS.map((letter) => ({
    letter,
    imagePath: mission[`layout_${letter.toLowerCase()}_image_path` as keyof MissionLayoutImages],
  })).filter((o): o is { letter: (typeof LETTERS)[number]; imagePath: string } => Boolean(o.imagePath))

  // A resolved mission with no layout images at all is a data gap, not "not resolved yet" -- the
  // skeleton above would imply layouts are still coming, which they aren't, so this stays nothing.
  if (options.length === 0) return null

  return (
    <ImageOptionGrid
      label="Terrain layout"
      value={value ?? ''}
      onChange={(id) => onChange(id as LayoutVariant)}
      options={options.map((o) => ({ id: o.letter, label: `Layout ${o.letter}`, imagePath: o.imagePath }))}
    />
  )
}
