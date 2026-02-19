export default defineNuxtRouteMiddleware(async (to) => {
  if (!import.meta.client || !to.path.startsWith('/docs')) return

  try {
    const { isTauri } = await import('@tauri-apps/api/core')
    if (!(await isTauri())) return
  } catch {
    return
  }

  const { openDocs } = useDocsLink()
  const docsPath = to.fullPath.slice('/docs'.length)
  await openDocs(docsPath)

  return navigateTo('/', { replace: true })
})
