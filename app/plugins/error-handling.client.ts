export default defineNuxtPlugin((nuxtApp) => {
  const { reportError } = useErrorReporting()

  nuxtApp.vueApp.config.errorHandler = (error, _instance, info) => {
    reportError(error, {
      title: 'Unexpected error',
      context: 'vue.errorHandler',
      extra: { info },
    })
  }

  window.addEventListener('error', (event) => {
    reportError(event.error ?? event.message, {
      title: 'Unexpected error',
      context: 'window.error',
      extra: {
        source: event.filename,
        line: event.lineno,
        column: event.colno,
      },
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    reportError(event.reason, {
      title: 'Unhandled promise rejection',
      context: 'window.unhandledrejection',
    })
  })
})
