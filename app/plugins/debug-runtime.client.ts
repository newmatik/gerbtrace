export default defineNuxtPlugin(() => {
  const runId = `run-${Date.now()}`
  // #region agent log
  fetch('http://127.0.0.1:7453/ingest/5870fb78-28fc-4f6a-a0a8-cbd461ff0af2', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '40e20a' }, body: JSON.stringify({ sessionId: '40e20a', runId, hypothesisId: 'H1', location: 'debug-runtime.client.ts:4', message: 'runtime bundle marker', data: { href: window.location.href, marker: 'bundle-debug-40e20a-v1' }, timestamp: Date.now() }) }).catch(() => {})
  // #endregion
  // #region agent log
  fetch('http://127.0.0.1:7453/ingest/5870fb78-28fc-4f6a-a0a8-cbd461ff0af2', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '40e20a' }, body: JSON.stringify({ sessionId: '40e20a', runId, hypothesisId: 'H5', location: 'debug-runtime.client.ts:7', message: 'runtime cache context', data: { hasServiceWorker: 'serviceWorker' in navigator, userAgent: navigator.userAgent.slice(0, 120) }, timestamp: Date.now() }) }).catch(() => {})
  // #endregion
})
