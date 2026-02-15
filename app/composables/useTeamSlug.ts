/**
 * Extract team slug from the current hostname's subdomain.
 *
 * Examples:
 *   newmatik.gerbtrace.com -> "newmatik"
 *   gerbtrace.com          -> null
 *   www.gerbtrace.com      -> null
 *   localhost              -> null
 */

const RESERVED_SUBDOMAINS = new Set([
  'www', 'app', 'api', 'admin', 'auth', 'team', 'teams',
  'static', 'assets', 'cdn', 'mail', 'email', 'smtp',
  'ftp', 'ssh', 'git', 'ns1', 'ns2', 'dns',
  'blog', 'docs', 'help', 'support', 'status',
  'billing', 'dashboard', 'console', 'login', 'signup',
  'register', 'account', 'settings', 'profile',
])

export function useTeamSlug() {
  const slug = computed<string | null>(() => {
    if (!import.meta.client) return null

    const hostname = window.location.hostname
    // localhost or IP -> no subdomain
    if (hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
      return null
    }

    const parts = hostname.split('.')
    // Need at least 3 parts: subdomain.domain.tld
    if (parts.length < 3) return null

    const subdomain = parts[0]!.toLowerCase()
    if (RESERVED_SUBDOMAINS.has(subdomain)) return null

    return subdomain
  })

  return { slug }
}
