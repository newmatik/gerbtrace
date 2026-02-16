export interface AlignmentPoint {
  x: number
  y: number
}

export interface GerberOffset {
  x: number
  y: number
}

/**
 * Manages per-packet reference points for aligning two Gerber packages
 * that have different coordinate origins.
 *
 * When both reference points are set, each packet is shifted so
 * its reference point maps to the Gerber origin (0, 0). This makes
 * both packets share the same effective coordinate system.
 */
export function useCompareAlignment() {
  const refA = ref<AlignmentPoint | null>(null)
  const refB = ref<AlignmentPoint | null>(null)

  /** Which packet is currently in "pick reference point" mode (null = not picking) */
  const pickingPacket = ref<1 | 2 | null>(null)

  /** True when both reference points are set and alignment is active */
  const isAligned = computed(() => refA.value !== null && refB.value !== null)

  /** Gerber-space offset to apply to packet A rendering */
  const offsetA = computed<GerberOffset>(() => {
    if (!isAligned.value || !refA.value) return { x: 0, y: 0 }
    return { x: -refA.value.x, y: -refA.value.y }
  })

  /** Gerber-space offset to apply to packet B rendering */
  const offsetB = computed<GerberOffset>(() => {
    if (!isAligned.value || !refB.value) return { x: 0, y: 0 }
    return { x: -refB.value.x, y: -refB.value.y }
  })

  function setRef(packet: 1 | 2, point: AlignmentPoint) {
    if (packet === 1) refA.value = point
    else refB.value = point
    pickingPacket.value = null
  }

  function startPicking(packet: 1 | 2) {
    pickingPacket.value = packet
  }

  function cancelPicking() {
    pickingPacket.value = null
  }

  function clearAlignment() {
    refA.value = null
    refB.value = null
    pickingPacket.value = null
  }

  /**
   * Shift a bounding box by a Gerber-space offset.
   * Used to compute aligned shared bounds for rendering.
   */
  function shiftBounds(
    bounds: [number, number, number, number],
    offset: GerberOffset,
  ): [number, number, number, number] {
    return [
      bounds[0] + offset.x,
      bounds[1] + offset.y,
      bounds[2] + offset.x,
      bounds[3] + offset.y,
    ]
  }

  return {
    refA,
    refB,
    pickingPacket,
    isAligned,
    offsetA,
    offsetB,
    setRef,
    startPicking,
    cancelPicking,
    clearAlignment,
    shiftBounds,
  }
}
