<template>
  <div class="min-h-screen flex flex-col">
    <AppHeader />
    <main class="flex-1 flex items-center justify-center px-4 py-10">
      <div class="w-full max-w-lg">
        <!-- Header -->
        <div class="text-center mb-8">
          <div class="flex justify-center mb-4">
            <div class="size-14 rounded-xl bg-primary/10 flex items-center justify-center">
              <UIcon name="i-lucide-users" class="size-7 text-primary" />
            </div>
          </div>
          <h1 class="text-2xl font-bold mb-2">Create a Team</h1>
          <p class="text-sm text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto">
            Collaborate on Gerber projects and share packages with your colleagues.
          </p>
        </div>

        <!-- Form card -->
        <div class="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6">
          <form @submit.prevent="handleCreate" class="space-y-5">
            <UFormField label="Team Name" required>
              <UInput
                v-model="teamName"
                placeholder="e.g. Newmatik Engineering"
                size="lg"
                maxlength="15"
                autofocus
                required
                class="w-full"
              />
            </UFormField>

            <UFormField label="Subdomain" required>
              <UInput
                v-model="slug"
                placeholder="e.g. newmatik"
                size="lg"
                required
                class="w-full"
              >
                <template #trailing>
                  <span class="text-xs text-neutral-400 whitespace-nowrap">.gerbtrace.com</span>
                </template>
              </UInput>
              <template #help>
                <div class="flex items-center gap-1.5 mt-1">
                  <template v-if="slugError">
                    <UIcon name="i-lucide-x-circle" class="size-3.5 text-red-500 shrink-0" />
                    <span class="text-red-500 text-xs">{{ slugError }}</span>
                  </template>
                  <template v-else-if="slugAvailable === true">
                    <UIcon name="i-lucide-check-circle" class="size-3.5 text-green-500 shrink-0" />
                    <span class="text-green-500 text-xs">{{ slug }}.gerbtrace.com is available</span>
                  </template>
                  <template v-else-if="slugChecking">
                    <UIcon name="i-lucide-loader" class="size-3.5 text-neutral-400 animate-spin shrink-0" />
                    <span class="text-neutral-400 text-xs">Checking availability...</span>
                  </template>
                  <template v-else-if="slug.length >= 3">
                    <span class="text-neutral-400 text-xs">Your team URL will be {{ slug }}.gerbtrace.com</span>
                  </template>
                </div>
              </template>
            </UFormField>

            <div class="border-t border-neutral-200 dark:border-neutral-800 pt-5">
              <UFormField label="Auto-Join Domain">
                <UInput
                  v-model="autoJoinDomain"
                  placeholder="e.g. newmatik.com"
                  size="lg"
                  class="w-full"
                />
                <template #help>
                  <span class="text-xs text-neutral-400">
                    Optional. Anyone with an email from this domain can automatically join your team as a viewer.
                  </span>
                </template>
              </UFormField>
            </div>

            <p v-if="errorMessage" class="text-sm text-red-600 dark:text-red-400 text-center">
              {{ errorMessage }}
            </p>

            <div class="flex gap-3 pt-2">
              <UButton
                variant="outline"
                color="neutral"
                size="lg"
                to="/"
                class="flex-1"
              >
                Cancel
              </UButton>
              <UButton
                type="submit"
                size="lg"
                icon="i-lucide-plus"
                :loading="creating"
                :disabled="!canCreate"
                class="flex-1"
              >
                Create Team
              </UButton>
            </div>
          </form>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
const router = useRouter()
const { createTeam, checkSlugAvailable } = useTeam()
const { isAuthenticated } = useAuth()

// Redirect if not authenticated
watch(isAuthenticated, (authed) => {
  if (!authed) router.replace('/auth/login')
}, { immediate: true })

const teamName = ref('')
const slug = ref('')
const autoJoinDomain = ref('')
const creating = ref(false)
const errorMessage = ref('')
const slugAvailable = ref<boolean | null>(null)
const slugChecking = ref(false)
const slugError = ref('')

const canCreate = computed(() => {
  const nameLength = teamName.value.trim().length
  return nameLength > 0
    && nameLength <= 15
    && slug.value.trim().length >= 3
    && !slugError.value
    && slugAvailable.value === true
    && !creating.value
})

// Auto-generate slug from team name
let lastAutoSlug = ''
watch(teamName, (name) => {
  if (!slug.value || slug.value === lastAutoSlug) {
    const generated = slugFromName(name)
    slug.value = generated
    lastAutoSlug = generated
  }
})

function slugFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
}

// Validate and check slug availability (debounced)
let slugTimeout: ReturnType<typeof setTimeout> | null = null
watch(slug, (val) => {
  slugAvailable.value = null
  slugError.value = ''

  const s = val.trim().toLowerCase()
  if (s.length < 3) {
    slugError.value = 'Must be at least 3 characters'
    return
  }
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(s)) {
    slugError.value = 'Only lowercase letters, numbers, and hyphens'
    return
  }

  if (slugTimeout) clearTimeout(slugTimeout)
  slugTimeout = setTimeout(async () => {
    slugChecking.value = true
    try {
      slugAvailable.value = await checkSlugAvailable(s)
      if (!slugAvailable.value) {
        slugError.value = 'This subdomain is reserved or already taken'
      }
    } finally {
      slugChecking.value = false
    }
  }, 400)
})

async function handleCreate() {
  errorMessage.value = ''
  creating.value = true

  try {
    if (teamName.value.trim().length > 15) {
      errorMessage.value = 'Team name must be 15 characters or fewer'
      return
    }
    const { teamId, error } = await createTeam(
      teamName.value.trim(),
      slug.value.trim().toLowerCase(),
      autoJoinDomain.value.trim() || undefined,
    )

    if (error) {
      errorMessage.value = typeof error === 'string' ? error : (error as any).message ?? 'Failed to create team'
    } else {
      router.replace('/')
    }
  } finally {
    creating.value = false
  }
}
</script>
