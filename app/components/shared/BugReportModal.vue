<template>
  <UModal v-model:open="open">
    <template #content>
      <div class="p-5 space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold text-neutral-900 dark:text-white">
            Report a bug
          </h3>
          <UButton
            size="xs"
            variant="ghost"
            color="neutral"
            icon="i-lucide-x"
            :disabled="sending"
            @click="open = false"
          />
        </div>

        <template v-if="sent">
          <p class="text-sm text-neutral-600 dark:text-neutral-400">
            Thanks for your report. We'll look into it.
          </p>
          <div class="flex justify-end">
            <UButton size="sm" color="primary" @click="open = false">
              Close
            </UButton>
          </div>
        </template>

        <template v-else>
          <p class="text-sm text-neutral-600 dark:text-neutral-400">
            Describe what went wrong or what you expected. Your report will be sent to our issue tracker.
          </p>

          <UTextarea
            v-model="description"
            placeholder="What happened? Steps to reproduce, error messages, etc."
            :rows="4"
            autoresize
            :disabled="sending"
          />

          <UFormField label="Email (optional)">
            <UInput
              v-model="email"
              type="email"
              placeholder="you@example.com"
              :disabled="sending"
            />
          </UFormField>

          <div class="flex justify-end gap-2">
            <UButton
              size="sm"
              color="neutral"
              variant="ghost"
              :disabled="sending"
              @click="open = false"
            >
              Cancel
            </UButton>
            <UButton
              size="sm"
              color="primary"
              :loading="sending"
              :disabled="!description.trim()"
              @click="submit"
            >
              Send report
            </UButton>
          </div>
        </template>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import * as Sentry from '@sentry/nuxt'

const open = defineModel<boolean>('open', { default: false })

const description = ref('')
const email = ref('')
const sending = ref(false)
const sent = ref(false)

function submit() {
  const desc = description.value.trim()
  if (!desc) return
  sending.value = true
  try {
    if (email.value.trim()) {
      Sentry.setUser({ email: email.value.trim() })
    }
    Sentry.captureMessage('User bug report', {
      level: 'info',
      tags: { type: 'user_report' },
      extra: {
        description: desc,
        email: email.value.trim() || undefined,
      },
    })
    sent.value = true
  } finally {
    sending.value = false
  }
}

watch(open, (isOpen) => {
  if (!isOpen) {
    description.value = ''
    email.value = ''
    sent.value = false
  }
})
</script>
