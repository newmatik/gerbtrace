import * as Sentry from '@sentry/nuxt'

const dsn = process.env.SENTRY_DSN
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? (process.env.NODE_ENV === 'production' ? 'production' : 'development'),
    release: process.env.SENTRY_RELEASE ?? undefined,
    tracesSampleRate: 0.2,
  })
}
