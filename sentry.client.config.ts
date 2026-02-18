import * as Sentry from '@sentry/nuxt'

const config = useRuntimeConfig().public.sentry as { dsn?: string; environment?: string } | undefined
if (config?.dsn) {
  Sentry.init({
    dsn: config.dsn,
    environment: config.environment ?? 'production',
    release: `gerbtrace@${useRuntimeConfig().public.appVersion}`,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    tracesSampleRate: 0.2,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1,
    beforeSend(event) {
      if (import.meta.client && typeof window !== 'undefined') {
        const isTauri = !!(window as unknown as { __TAURI__?: unknown }).__TAURI__
        event.tags = { ...event.tags, app: isTauri ? 'desktop' : 'web' }
      }
      return event
    },
  })
}
