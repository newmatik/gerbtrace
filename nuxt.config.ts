export default defineNuxtConfig({
  ssr: false,
  devtools: { enabled: false },

  runtimeConfig: {
    public: {
      appVersion: '1.0.12',
      supabaseUrl: process.env.SUPABASE_URL || 'http://localhost:54321',
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
      elexessUrl: process.env.ELEXESS_URL || 'https://api.dev.elexess.com/api',
    },
  },

  modules: ['@nuxt/ui'],

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
