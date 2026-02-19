export default defineNuxtConfig({
  ssr: false,
  devtools: { enabled: false },

  runtimeConfig: {
    public: {
      appVersion: '1.1.1',
      supabaseUrl: process.env.SUPABASE_URL || 'http://localhost:54321',
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
      elexessUrl: process.env.ELEXESS_URL || 'https://api.dev.elexess.com/api',
      sentry: {
        dsn: process.env.SENTRY_DSN || '',
        environment: process.env.SENTRY_ENVIRONMENT || (process.env.NODE_ENV === 'production' ? 'production' : 'development'),
      },
    },
  },

  modules: ['@nuxt/ui', '@nuxt/content', '@sentry/nuxt/module'],

  sentry: {
    org: 'newmatik',
    project: 'gerbtrace',
    authToken: process.env.SENTRY_AUTH_TOKEN,
    sourcemaps: {
      filesToDeleteAfterUpload: ['.*/**/*.map'],
    },
  },

  sourcemap: { client: 'hidden', server: false },

  vite: {
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/jszip')) return 'vendor-jszip'
            if (id.includes('/lib/gerber/')) return 'gerber-core'
            if (id.includes('/lib/renderer/')) return 'render-core'
            if (id.includes('node_modules/xlsx')) return 'vendor-xlsx'
          },
        },
      },
    },
  },

  icon: {
    clientBundle: {
      scan: {
        globInclude: ['app/**/*.vue', 'app/**/*.ts', 'node_modules/@nuxt/ui/dist/**'],
        globExclude: ['node_modules/@nuxt/ui/dist/**/node_modules/**'],
      },
    },
  },

  css: ['~/assets/css/main.css'],

  components: [
    {
      path: '~/components',
      pathPrefix: false,
    },
  ],

  alias: {
    '@lib': new URL('./lib', import.meta.url).pathname,
  },

  app: {
    baseURL: '/',
    head: {
      title: 'Gerbtrace — Gerber Viewer & Comparator',
      meta: [
        { name: 'description', content: 'View and compare Gerber PCB files in the browser. Open source tool by Newmatik GmbH.' },
        { name: 'theme-color', content: '#3B8EF0' },
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico', sizes: '16x16 32x32 48x48' },
        { rel: 'icon', type: 'image/png', href: '/favicon-light-32x32.png', sizes: '32x32', media: '(prefers-color-scheme: light)' },
        { rel: 'icon', type: 'image/png', href: '/favicon-light-16x16.png', sizes: '16x16', media: '(prefers-color-scheme: light)' },
        { rel: 'icon', type: 'image/png', href: '/favicon-dark-32x32.png', sizes: '32x32', media: '(prefers-color-scheme: dark)' },
        { rel: 'icon', type: 'image/png', href: '/favicon-dark-16x16.png', sizes: '16x16', media: '(prefers-color-scheme: dark)' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png', sizes: '180x180' },
        { rel: 'manifest', href: '/site.webmanifest' },
      ],
    },
  },

  compatibilityDate: '2025-01-01',
})
