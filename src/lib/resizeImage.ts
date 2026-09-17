const AVATAR_SIDE = 256
const TARGET_BYTES = 200_000
const MIN_QUALITY = 0.5
const QUALITY_STEP = 0.1
/** Anything larger than this is almost certainly not a phone photo someone meant to use as an
 * avatar -- reject it before even trying to decode it, rather than hanging the tab on a huge
 * decode for no reason. */
const MAX_SOURCE_BYTES = 20_000_000

export class UnsupportedImageError extends Error {}

/** Center-crops to a square, downsamples to a small fixed size, and compresses -- the actual size
 * cap this app relies on (issue #73's "pixel dimensions" + "byte size" requirements); the storage
 * bucket's own file_size_limit (20260401000000_player_avatars.sql) is only a backstop for
 * whatever gets past this. Quality steps down until it's under the target or hits a floor, since a
 * 256px avatar compresses well enough in practice that the floor is rarely actually reached. */
export async function resizeImageToAvatar(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new UnsupportedImageError('That file is not an image.')
  if (file.size > MAX_SOURCE_BYTES) throw new UnsupportedImageError('That image is too large.')

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new UnsupportedImageError("Couldn't read that image.")
  }

  const side = Math.min(bitmap.width, bitmap.height)
  const sx = (bitmap.width - side) / 2
  const sy = (bitmap.height - side) / 2

  const canvas = document.createElement('canvas')
  canvas.width = AVATAR_SIDE
  canvas.height = AVATAR_SIDE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new UnsupportedImageError("This browser can't process images.")
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, AVATAR_SIDE, AVATAR_SIDE)
  bitmap.close()

  let quality = 0.85
  let blob = await canvasToBlob(canvas, quality)
  while (blob.size > TARGET_BYTES && quality > MIN_QUALITY) {
    quality -= QUALITY_STEP
    blob = await canvasToBlob(canvas, quality)
  }
  return blob
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new UnsupportedImageError("Couldn't process that image."))),
      'image/webp',
      quality,
    )
  })
}
