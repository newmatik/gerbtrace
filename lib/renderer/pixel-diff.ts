/**
 * Pixel-level diff engine for Gerber layer comparison.
 *
 * Compares two rendered Canvas layers pixel by pixel:
 * - Red: only in canvas A (removed)
 * - Green: only in canvas B (added)
 * - Gray: present in both (identical)
 */

export function computePixelDiff(
  canvasA: HTMLCanvasElement,
  canvasB: HTMLCanvasElement,
): ImageData {
  const w = canvasA.width
  const h = canvasA.height

  const ctxA = canvasA.getContext('2d')!
  const ctxB = canvasB.getContext('2d')!

  const dataA = ctxA.getImageData(0, 0, w, h)
  const dataB = ctxB.getImageData(0, 0, w, h)
  const diff = new ImageData(w, h)

  const pixA = dataA.data
  const pixB = dataB.data
  const out = diff.data

  for (let i = 0; i < pixA.length; i += 4) {
    const a = pixA[i + 3] > 0
    const b = pixB[i + 3] > 0

    if (a && b) {
      // Present in both → gray
      out[i] = 180
      out[i + 1] = 180
      out[i + 2] = 180
      out[i + 3] = 255
    } else if (a) {
      // Only in A → red (removed)
      out[i] = 255
      out[i + 1] = 60
      out[i + 2] = 60
      out[i + 3] = 255
    } else if (b) {
      // Only in B → green (added)
      out[i] = 60
      out[i + 1] = 200
      out[i + 2] = 60
      out[i + 3] = 255
    }
    // else: transparent (no content in either)
  }

  return diff
}
