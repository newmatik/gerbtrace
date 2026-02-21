export default defineNuxtPlugin(() => {
  if (typeof window === 'undefined') return

  const ALLOWED = [
    'gerbtrace.com',
    'www.gerbtrace.com',
    'localhost',
    '127.0.0.1',
    'tauri.localhost',
  ]

  const host = window.location.hostname
  if (ALLOWED.includes(host) || host.endsWith('.newmatik.com')) return
  if (sessionStorage.getItem('_t')) return

  sessionStorage.setItem('_t', '1')

  const payload = JSON.stringify({
    h: host,
    p: window.location.pathname,
    r: document.referrer,
    t: Date.now(),
  })

  const endpoint = 'https://gqrnlnlfidighosujpdb.supabase.co/functions/v1/telemetry'

  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, payload)
    } else {
      fetch(endpoint, { method: 'POST', body: payload, keepalive: true }).catch(() => {})
    }
  } catch {}
})
