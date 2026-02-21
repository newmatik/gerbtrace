import * as Sentry from '@sentry/nuxt'

type ReportErrorOptions = {
  title?: string
  description?: string
  context?: string
  toast?: boolean
  tags?: Record<string, string>
  extra?: Record<string, unknown>
}

const recentlyReported = new Map<string, number>()
const REPORT_DEDUP_MS = 1500

function toPlainObject(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(toPlainObject)

  const object = value as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(object)) {
    out[key] = toPlainObject(object[key])
  }
  return out
}

function safeStringify(value: unknown): string {
  const seen = new WeakSet<object>()
  try {
    return JSON.stringify(value, (_key, current) => {
      if (typeof current === 'bigint') return current.toString()
      if (typeof current === 'function') return `[Function ${current.name || 'anonymous'}]`
      if (current && typeof current === 'object') {
        if (seen.has(current)) return '[Circular]'
        seen.add(current)
      }
      return current
    }, 2)
  } catch {
    return String(value)
  }
}

function normalizeErrorData(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    const errorRecord = error as Error & { cause?: unknown }
    const base: Record<string, unknown> = {
      name: errorRecord.name,
      message: errorRecord.message,
      stack: errorRecord.stack,
    }
    if (errorRecord.cause !== undefined) {
      base.cause = toPlainObject(errorRecord.cause)
    }
    return base
  }

  if (typeof error === 'string') {
    return { message: error }
  }

  return { value: toPlainObject(error) }
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Fallback below.
  }

  try {
    if (typeof document === 'undefined') return false
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    document.body.appendChild(textarea)
    textarea.select()
    const copied = document.execCommand('copy')
    document.body.removeChild(textarea)
    return copied
  } catch {
    return false
  }
}

function toError(value: unknown): Error {
  if (value instanceof Error) return value
  if (typeof value === 'string') return new Error(value)
  if (value && typeof value === 'object' && 'message' in value) {
    return new Error(String((value as { message: unknown }).message))
  }
  return new Error('Unknown error')
}

function shouldSuppressToast(signature: string): boolean {
  const now = Date.now()
  const previous = recentlyReported.get(signature) ?? 0
  recentlyReported.set(signature, now)
  return now - previous < REPORT_DEDUP_MS
}

export function useErrorReporting() {
  const toast = useToast()

  async function reportError(error: unknown, options: ReportErrorOptions = {}) {
    const normalized = toError(error)
    const title = options.title ?? 'Something went wrong'
    const description = options.description ?? normalized.message
    const context = options.context ?? 'app'
    const signature = `${context}|${title}|${description}`
    const appVersion = useRuntimeConfig().public?.appVersion
    const route = useRoute()
    const payload = {
      occurredAt: new Date().toISOString(),
      title,
      description,
      context,
      appVersion,
      route: route?.fullPath,
      href: typeof window !== 'undefined' ? window.location.href : undefined,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      language: typeof navigator !== 'undefined' ? navigator.language : undefined,
      tags: options.tags ?? {},
      extra: toPlainObject(options.extra ?? {}),
      error: normalizeErrorData(error),
    }
    const copyText = safeStringify(payload)

    if (options.toast !== false && !shouldSuppressToast(signature)) {
      toast.add({
        title,
        description: description && description !== title ? description : undefined,
        color: 'error',
        actions: [
          {
            label: 'Copy details',
            color: 'neutral',
            variant: 'outline',
            size: 'xs',
            onClick: async () => {
              const copied = await copyToClipboard(copyText)
              toast.add({
                title: copied ? 'Copied error details' : 'Failed to copy error details',
                description: copied ? 'Diagnostic report copied to clipboard.' : 'Clipboard access is blocked. Please copy details from console output.',
                color: copied ? 'success' : 'warning',
              })
              if (!copied) {
                console.error('[error-reporting:copy-fallback]', copyText)
              }
            },
          },
        ],
      })
    }

    if (import.meta.dev) {
      console.error(`[${context}]`, error)
      console.error('[error-reporting:details]', payload)
      return
    }

    Sentry.captureException(normalized, {
      tags: options.tags,
      extra: {
        context,
        ...options.extra,
      },
    })
  }

  return { reportError }
}
