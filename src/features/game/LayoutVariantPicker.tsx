import { ImageOptionGrid } from '@/components/ImageOptionGrid'
import type { Database } from '@/lib/database.types'

type LayoutVariant = Database['public']['Tables']['games']['Row']['layout_variant']

interface MissionLayoutImages {
  layout_a_image_path: string | null
  layout_b_image_path: string | null
  layout_c_image_path: string | null
}

const LETTERS = ['A', 'B', 'C'] as const

/** The 3 recommended terrain layouts for the resolved mission's Force Disposition pairing
 * (wahapedia keys these off the pairing, not the deployment -- see issue #20). Required before a
 * game can start (see WaitingRoom's canStart), but -- same as everything else -- stays editable
 * any time after that too, never re-locked once picked. */
export function LayoutVariantPicker({
  mission,
  value,
  onChange,
}: {
  mission: MissionLayoutImages | null | undefined
  value: LayoutVariant
  onChange: (variant: LayoutVariant) => void
}) {
  if (!mission) return null

  const options = LETTERS.map((letter) => ({
    letter,
    imagePath: mission[`layout_${letter.toLowerCase()}_image_path` as keyof MissionLayoutImages],
  })).filter((o): o is { letter: (typeof LETTERS)[number]; imagePath: string } => Boolean(o.imagePath))

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
