<template>
  <UModal v-model:open="open" :ui="{ content: 'sm:max-w-lg' }">
    <template #content>
      <div class="p-6 space-y-5">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-base font-semibold text-neutral-900 dark:text-white">
              Report a bug
            </h3>
            <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
              Describe what went wrong. Your report is sent to our issue tracker.
            </p>
          </div>
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
          <div class="flex flex-col items-center gap-3 py-6">
            <UIcon name="i-lucide-check-circle" class="text-3xl text-green-500" />
            <p class="text-sm text-neutral-600 dark:text-neutral-400">
              Thanks for your report. We'll look into it.
            </p>
            <UButton size="sm" color="primary" @click="open = false">
              Close
            </UButton>
          </div>
        </template>

        <template v-else>
          <UTextarea
            v-model="description"
            placeholder="What happened? Steps to reproduce, error messages, etc."
            :rows="5"
            autoresize
            :disabled="sending"
            :ui="{ root: 'w-full' }"
            @paste="onPaste"
          />

          <!-- Attachments drop zone -->
          <div
            class="relative rounded-lg border-2 border-dashed transition-colors"
            :class="[
              dragging
                ? 'border-primary bg-primary/5'
                : attachments.length
                  ? 'border-neutral-300 dark:border-neutral-600'
                  : 'border-neutral-300 dark:border-neutral-700',
            ]"
            @dragenter.prevent="dragging = true"
            @dragover.prevent="dragging = true"
            @dragleave.prevent="dragging = false"
            @drop.prevent="onDrop"
          >
            <div
              v-if="attachments.length === 0"
              class="flex flex-col items-center gap-1.5 py-5 cursor-pointer"
              @click="fileInputRef?.click()"
            >
              <UIcon name="i-lucide-image-plus" class="text-xl text-neutral-400" />
              <p class="text-sm text-neutral-500 dark:text-neutral-400">
                Drop files, paste screenshots, or <span class="text-primary font-medium">browse</span>
              </p>
              <p class="text-xs text-neutral-400">
                Images, logs, or any file up to 10 MB each
              </p>
            </div>

            <div v-else class="p-3 space-y-2">
              <div
                v-for="(file, idx) in attachments"
                :key="idx"
                class="flex items-center gap-2 rounded-md bg-neutral-50 dark:bg-neutral-800 px-3 py-2"
              >
                <img
                  v-if="file.preview"
                  :src="file.preview"
                  class="size-10 rounded object-cover shrink-0"
                >
                <UIcon
                  v-else
                  name="i-lucide-file"
                  class="text-lg text-neutral-400 shrink-0"
                />
                <div class="flex-1 min-w-0">
                  <p class="text-sm truncate text-neutral-700 dark:text-neutral-300">
                    {{ file.name }}
                  </p>
                  <p class="text-xs text-neutral-400">
                    {{ formatFileSize(file.size) }}
                  </p>
                </div>
                <UButton
                  size="xs"
                  variant="ghost"
                  color="neutral"
                  icon="i-lucide-x"
                  :disabled="sending"
                  @click="removeAttachment(idx)"
                />
              </div>

              <button
                class="flex items-center gap-1.5 text-sm text-primary hover:underline"
                :disabled="sending"
                @click="fileInputRef?.click()"
              >
                <UIcon name="i-lucide-plus" class="text-xs" />
                Add more files
              </button>
            </div>
          </div>

          <input
            ref="fileInputRef"
            type="file"
            multiple
            accept="image/*,.txt,.log,.json,.csv,.zip"
            class="hidden"
            @change="onFileInput"
          >

          <!-- Email field only for anonymous users -->
          <UFormField v-if="!isAuthenticated" label="Email (optional)">
            <UInput
              v-model="email"
              type="email"
              placeholder="you@example.com"
              :disabled="sending"
            />
          </UFormField>

          <div class="flex justify-end gap-2 pt-1">
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
              :disabled="!canSubmit"
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

interface Attachment {
  name: string
  size: number
  type: string
  data: Uint8Array
  preview?: string
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

const open = defineModel<boolean>('open', { default: false })

const { isAuthenticated } = useAuth()
const { profile } = useCurrentUser()

const description = ref('')
const email = ref('')
const sending = ref(false)
const sent = ref(false)
const dragging = ref(false)
const attachments = ref<Attachment[]>([])
const fileInputRef = ref<HTMLInputElement | null>(null)

const canSubmit = computed(() => normalizeText(description.value).length > 0)

function normalizeText(value: unknown): string {
  if (value == null) return ''
  return String(value).trim()
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function addFiles(files: FileList | File[]) {
  for (const file of Array.from(files)) {
    if (file.size > MAX_FILE_SIZE) continue
    const data = new Uint8Array(await file.arrayBuffer())
    const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
    attachments.value.push({ name: file.name, size: file.size, type: file.type, data, preview })
  }
}

function removeAttachment(idx: number) {
  const removed = attachments.value.splice(idx, 1)
  removed.forEach((a) => { if (a.preview) URL.revokeObjectURL(a.preview) })
}

function onDrop(e: DragEvent) {
  dragging.value = false
  if (e.dataTransfer?.files.length) addFiles(e.dataTransfer.files)
}

function onPaste(e: ClipboardEvent) {
  const items = e.clipboardData?.items
  if (!items) return
  const files: File[] = []
  for (const item of Array.from(items)) {
    const file = item.getAsFile()
    if (file) files.push(file)
  }
  if (files.length) addFiles(files)
}

function onFileInput(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files?.length) addFiles(input.files)
  input.value = ''
}

async function submit() {
  const desc = normalizeText(description.value)
  if (!desc) return
  sending.value = true
  try {
    const userEmail = isAuthenticated.value
      ? profile.value?.email
      : normalizeText(email.value) || undefined
    const userName = isAuthenticated.value
      ? profile.value?.name ?? undefined
      : undefined

    await Sentry.captureFeedback(
      {
        message: desc,
        ...(userName && { name: userName }),
        ...(userEmail && { email: userEmail }),
      },
      {
        includeReplay: true,
        attachments: attachments.value.map(att => ({
          filename: att.name,
          data: att.data,
          contentType: att.type || 'application/octet-stream',
        })),
      },
    )

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
    dragging.value = false
    attachments.value.forEach((a) => { if (a.preview) URL.revokeObjectURL(a.preview) })
    attachments.value = []
  }
})
</script>
