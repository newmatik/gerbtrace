import type { Format, ZeroSuppression } from './types'

export const PI = Math.PI
export const TWO_PI = 2 * PI
export const HALF_PI = PI / 2

export function parseCoordinate(
  raw: string | undefined,
  defaultValue: number,
  format: Format,
  zeroSuppression: ZeroSuppression,
): number {
  if (raw === undefined || raw === '') return defaultValue

  // If the coordinate contains a decimal point, parse directly
  if (raw.includes('.') || raw === '0') {
    return Number(raw)
  }

  const [intPlaces, decPlaces] = format
  const totalDigits = intPlaces + decPlaces

  // Handle sign
  let sign = 1
  let digits = raw
  if (digits.startsWith('+') || digits.startsWith('-')) {
    sign = digits.startsWith('-') ? -1 : 1
    digits = digits.slice(1)
  }

  // Pad based on zero suppression
  if (zeroSuppression === 'trailing') {
    digits = digits.padEnd(totalDigits, '0')
  } else {
    // Leading zero suppression (default)
    digits = digits.padStart(totalDigits, '0')
  }

  const intPart = digits.slice(0, intPlaces)
  const decPart = digits.slice(intPlaces)

  return sign * Number(`${intPart}.${decPart}`)
}

export function degreesToRadians(degrees: number): number {
  return (degrees * PI) / 180
}

export function limitAngle(theta: number): number {
  while (theta < 0) theta += TWO_PI
  while (theta > TWO_PI) theta -= TWO_PI
  return theta
}

export function positionsEqual(a: [number, number], b: [number, number]): boolean {
  return Math.abs(a[0] - b[0]) < 1e-8 && Math.abs(a[1] - b[1]) < 1e-8
}

export function distance(a: [number, number], b: [number, number]): number {
  const dx = a[0] - b[0]
  const dy = a[1] - b[1]
  return Math.sqrt(dx * dx + dy * dy)
}

export function rotatePoint(
  x: number,
  y: number,
  degrees: number,
  cx: number = 0,
  cy: number = 0,
): [number, number] {
  const rad = degreesToRadians(degrees)
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const dx = x - cx
  const dy = y - cy
  return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos]
}
