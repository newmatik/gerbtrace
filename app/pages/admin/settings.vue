<script setup lang="ts">
const { query, action } = useAdminApi()
const loading = ref(true)
const error = ref<string | null>(null)
const saving = ref(false)
const successMessage = ref('')

const sparkApiKey = ref('')
const sparkModel = ref('')
const elexessUsername = ref('')
const elexessPassword = ref('')
const hasExistingSparkKey = ref(false)
const hasExistingElexessPassword = ref(false)

const sparkModelOptions = [
  { label: 'Claude Sonnet 4 (recommended)', value: 'claude-sonnet-4-20250514' },
  { label: 'Claude Sonnet 3.5', value: 'claude-3-5-sonnet-20241022' },
  { label: 'Claude Haiku 3.5', value: 'claude-3-5-haiku-20241022' },
]

async function fetchConfig() {
  loading.value = true
  try {
    const data = await query('platform_config')
    sparkApiKey.value = ''
    sparkModel.value = data.spark_model || 'claude-sonnet-4-20250514'
    elexessUsername.value = data.elexess_username || ''
    elexessPassword.value = ''
    hasExistingSparkKey.value = !!data.spark_api_key
    hasExistingElexessPassword.value = !!data.elexess_password
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

onMounted(fetchConfig)

const validatingSparkKey = ref(false)
const sparkKeyValid = ref<boolean | null>(null)

async function testSparkKey() {
  const key = sparkApiKey.value.trim()
  if (!key) return
  validatingSparkKey.value = true
  sparkKeyValid.value = null
  try {
    const result = await $fetch<{ valid: boolean }>('/api/ai/validate-key', {
      method: 'POST',
      body: { apiKey: key },
    })
    sparkKeyValid.value = result.valid
  } catch {
    sparkKeyValid.value = false
  } finally {
    validatingSparkKey.value = false
  }
}

const validatingElexess = ref(false)
const elexessValid = ref<boolean | null>(null)

async function testElexess() {
  if (!elexessUsername.value.trim() || !elexessPassword.value.trim()) return
  validatingElexess.value = true
  elexessValid.value = null
  try {
    const result = await $fetch<{ valid: boolean }>('/api/elexess/validate-credentials', {
      method: 'POST',
      body: { username: elexessUsername.value, password: elexessPassword.value },
    })
    elexessValid.value = result.valid
  } catch {
    elexessValid.value = false
  } finally {
    validatingElexess.value = false
  }
}

async function handleSave() {
  saving.value = true
  successMessage.value = ''
  error.value = null
  try {
    const updates: Record<string, unknown> = {}
    if (sparkApiKey.value.trim()) updates.spark_api_key = sparkApiKey.value.trim()
    if (sparkModel.value) updates.spark_model = sparkModel.value
    if (elexessUsername.value.trim()) updates.elexess_username = elexessUsername.value.trim()
    if (elexessPassword.value.trim()) updates.elexess_password = elexessPassword.value.trim()

    await action({ action: 'update_platform_config', ...updates })
    successMessage.value = 'Platform configuration saved!'
    setTimeout(() => { successMessage.value = '' }, 3000)
    await fetchConfig()
  } catch (e: any) {
    error.value = e.message ?? 'Failed to save'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AdminLayout>
    <h2 class="text-lg font-semibold mb-6">Platform Settings</h2>

    <div v-if="loading" class="text-[var(--ui-text-dimmed)]">Loading...</div>
    <div v-else-if="error && !saving" class="text-red-500 mb-4">{{ error }}</div>
    <template v-else>
      <form @submit.prevent="handleSave" class="space-y-6 max-w-2xl">
        <!-- Spark AI (Anthropic) -->
        <div class="rounded-lg border border-[var(--ui-border)] p-4 space-y-4">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-sparkles" class="text-lg text-violet-500" />
            <h3 class="text-sm font-semibold">Spark AI</h3>
            <UBadge size="xs" variant="subtle" color="secondary">Anthropic</UBadge>
          </div>

          <UFormField label="API Key">
            <UInput
              v-model="sparkApiKey"
              type="password"
              size="md"
              :placeholder="hasExistingSparkKey ? 'Key configured (enter new to replace)' : 'sk-ant-...'"
            />
          </UFormField>

          <div class="flex items-center gap-3">
            <UButton
              type="button"
              size="sm"
              color="neutral"
              variant="outline"
              :loading="validatingSparkKey"
              :disabled="!sparkApiKey.trim()"
              @click="testSparkKey"
            >
              Test Connection
            </UButton>
            <span v-if="sparkKeyValid === true" class="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
              <UIcon name="i-lucide-check-circle" class="text-xs" /> Connected
            </span>
            <span v-else-if="sparkKeyValid === false" class="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
              <UIcon name="i-lucide-x-circle" class="text-xs" /> Invalid key
            </span>
          </div>

          <UFormField label="Model">
            <USelect v-model="sparkModel" :items="sparkModelOptions" />
          </UFormField>
        </div>

        <!-- Elexess -->
        <div class="rounded-lg border border-[var(--ui-border)] p-4 space-y-4">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-plug-zap" class="text-lg text-sky-500" />
            <h3 class="text-sm font-semibold">Elexess</h3>
          </div>

          <div class="grid gap-3 md:grid-cols-2">
            <UFormField label="Username">
              <UInput
                v-model="elexessUsername"
                size="md"
                placeholder="Elexess API username"
              />
            </UFormField>

            <UFormField label="Password">
              <UInput
                v-model="elexessPassword"
                type="password"
                size="md"
                :placeholder="hasExistingElexessPassword ? 'Password configured (enter new to replace)' : 'Elexess API password'"
              />
            </UFormField>
          </div>

          <div class="flex items-center gap-3">
            <UButton
              type="button"
              size="sm"
              color="neutral"
              variant="outline"
              :loading="validatingElexess"
              :disabled="!elexessUsername.trim() || !elexessPassword.trim()"
              @click="testElexess"
            >
              Test Connection
            </UButton>
            <span v-if="elexessValid === true" class="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
              <UIcon name="i-lucide-check-circle" class="text-xs" /> Connected
            </span>
            <span v-else-if="elexessValid === false" class="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
              <UIcon name="i-lucide-x-circle" class="text-xs" /> Connection failed
            </span>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <UButton type="submit" :loading="saving">Save Configuration</UButton>
          <p v-if="successMessage" class="text-sm text-green-600 dark:text-green-400">{{ successMessage }}</p>
        </div>
      </form>
    </template>
  </AdminLayout>
</template>
