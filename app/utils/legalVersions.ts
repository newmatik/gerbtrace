export const CURRENT_LEGAL_VERSIONS = {
  terms: '2026-02-25',
  privacy: '2026-02-25',
} as const

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function parseDateVersion(version: string): number | null {
  if (!ISO_DATE_PATTERN.test(version)) {
    return null
  }

  const ts = Date.parse(`${version}T00:00:00.000Z`)
  return Number.isNaN(ts) ? null : ts
}

function parseNumericVersion(version: string): number[] | null {
  const normalized = version.trim().replace(/^v/i, '')
  if (!/^\d+(?:[.-]\d+)*$/.test(normalized)) {
    return null
  }
  return normalized.split(/[.-]/).map(Number)
}

export function isConsentVersionAtLeast(userVersion: string, requiredVersion: string): boolean {
  const userDate = parseDateVersion(userVersion)
  const requiredDate = parseDateVersion(requiredVersion)
  if (userDate !== null && requiredDate !== null) {
    return userDate >= requiredDate
  }

  const userNumeric = parseNumericVersion(userVersion)
  const requiredNumeric = parseNumericVersion(requiredVersion)
  if (userNumeric && requiredNumeric) {
    const maxLen = Math.max(userNumeric.length, requiredNumeric.length)
    for (let i = 0; i < maxLen; i += 1) {
      const a = userNumeric[i] ?? 0
      const b = requiredNumeric[i] ?? 0
      if (a !== b) {
        return a > b
      }
    }
    return true
  }

  return userVersion === requiredVersion
}
