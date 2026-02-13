export function useFileComparison() {
  async function computeHash(content: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(content)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  async function areIdentical(contentA: string, contentB: string): Promise<boolean> {
    if (contentA.length !== contentB.length) return false
    return contentA === contentB
  }

  return { computeHash, areIdentical }
}
