<template>
  <section class="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 h-full min-h-0 flex flex-col">
    <header class="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-3">
      <h2 class="text-sm font-semibold text-neutral-700 dark:text-neutral-200">
        Conversation
      </h2>
      <UButton size="xs" icon="i-lucide-refresh-cw" variant="ghost" color="neutral" @click="fetchMessages({ force: true })">
        Refresh
      </UButton>
    </header>

    <div
      ref="messagesContainer"
      class="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4 bg-neutral-50/60 dark:bg-neutral-950/40"
      @click="handleRefClick"
    >
      <article
        v-for="message in topLevelMessages"
        :key="message.id"
        class="group/message relative rounded-xl border shadow-sm p-3"
        :class="messageBorderClass(message)"
      >
        <div class="flex gap-3">
          <UAvatar
            :src="message.author_profile?.avatar_url || undefined"
            :alt="authorLabel(message)"
            :text="authorInitials(message)"
            size="md"
            class="shrink-0"
          />
          <div class="min-w-0 flex-1 space-y-2">
            <div class="flex items-center gap-2 text-xs text-neutral-500">
              <span class="font-semibold text-neutral-700 dark:text-neutral-200 truncate">
                {{ authorLabel(message) }}
              </span>
              <span class="shrink-0">{{ formatDate(message.created_at) }}</span>
              <span class="flex-1" />
              <span
                v-if="hasMessageActions(message)"
                class="flex items-center gap-1 opacity-0 transition-opacity group-hover/message:opacity-100 group-focus-within/message:opacity-100"
              >
                <UButton
                  v-if="canEditMessage(message)"
                  size="xs"
                  variant="ghost"
                  color="neutral"
                  icon="i-lucide-pencil"
                  class="!p-1.5 text-neutral-400 hover:text-neutral-700 dark:text-neutral-500 dark:hover:text-neutral-200"
                  @click="startEdit(message)"
                />
                <UButton
                  v-if="canDeleteMessage(message)"
                  size="xs"
                  variant="ghost"
                  color="neutral"
                  icon="i-lucide-trash-2"
                  class="!p-1.5 text-neutral-400 hover:text-error-500 dark:text-neutral-500 dark:hover:text-error-400"
                  :loading="deletingMessageId === message.id"
                  @click="confirmDelete(message)"
                />
              </span>
            </div>
            <div v-if="editingMessageId === message.id" class="space-y-2">
              <UTextarea v-model="editDrafts[message.id]" :rows="3" />
              <div class="flex items-center gap-2">
                <UButton size="xs" :loading="savingEditId === message.id" @click="saveEdit(message.id)">
                  Save
                </UButton>
                <UButton size="xs" variant="ghost" color="neutral" @click="cancelEdit(message.id)">
                  Cancel
                </UButton>
              </div>
            </div>
            <div v-else class="prose prose-sm dark:prose-invert max-w-none conversation-markdown" v-html="renderMessageBody(message.body)" />

            <div v-if="attachmentsFor(message.id).length > 0" class="flex flex-wrap gap-2 pt-1">
              <a
                v-for="attachment in attachmentsFor(message.id)"
                :key="attachment.id"
                :href="attachment.publicUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 dark:border-neutral-700 px-2 py-1 text-xs text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800"
              >
                <UIcon name="i-lucide-paperclip" class="size-3.5" />
                <span class="truncate max-w-[220px]">{{ attachment.file_name }}</span>
              </a>
            </div>
          </div>
        </div>

        <div class="mt-3 ml-11 border-l border-neutral-200 dark:border-neutral-700 pl-3 space-y-2">
          <div
            v-for="reply in repliesFor(message.id)"
            :key="reply.id"
            class="group/reply relative rounded-lg border p-2.5"
            :class="replyBorderClass(reply)"
          >
            <div class="flex items-center gap-2 text-[11px] text-neutral-500">
              <UAvatar
                :src="reply.author_profile?.avatar_url || undefined"
                :alt="authorLabel(reply)"
                :text="authorInitials(reply)"
                size="2xs"
                class="shrink-0"
              />
              <span class="font-semibold text-neutral-700 dark:text-neutral-200">{{ authorLabel(reply) }}</span>
              <span>{{ formatDate(reply.created_at) }}</span>
              <span class="flex-1" />
              <span
                v-if="hasMessageActions(reply)"
                class="flex items-center gap-1 opacity-0 transition-opacity group-hover/reply:opacity-100 group-focus-within/reply:opacity-100"
              >
                <UButton
                  v-if="canEditMessage(reply)"
                  size="xs"
                  variant="ghost"
                  color="neutral"
                  icon="i-lucide-pencil"
                  class="!p-1 text-neutral-400 hover:text-neutral-700 dark:text-neutral-500 dark:hover:text-neutral-200"
                  @click="startEdit(reply)"
                />
                <UButton
                  v-if="canDeleteMessage(reply)"
                  size="xs"
                  variant="ghost"
                  color="neutral"
                  icon="i-lucide-trash-2"
                  class="!p-1 text-neutral-400 hover:text-error-500 dark:text-neutral-500 dark:hover:text-error-400"
                  :loading="deletingMessageId === reply.id"
                  @click="confirmDelete(reply)"
                />
              </span>
            </div>
            <div v-if="editingMessageId === reply.id" class="space-y-2 mt-1">
              <UTextarea v-model="editDrafts[reply.id]" :rows="2" />
              <div class="flex items-center gap-2">
                <UButton size="xs" :loading="savingEditId === reply.id" @click="saveEdit(reply.id)">
                  Save
                </UButton>
                <UButton size="xs" variant="ghost" color="neutral" @click="cancelEdit(reply.id)">
                  Cancel
                </UButton>
              </div>
            </div>
            <div v-else class="mt-1 prose prose-sm dark:prose-invert max-w-none conversation-markdown" v-html="renderMessageBody(reply.body)" />

            <div v-if="attachmentsFor(reply.id).length > 0" class="flex flex-wrap gap-2 pt-1">
              <a
                v-for="attachment in attachmentsFor(reply.id)"
                :key="attachment.id"
                :href="attachment.publicUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 dark:border-neutral-700 px-2 py-1 text-xs text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800"
              >
                <UIcon name="i-lucide-paperclip" class="size-3.5" />
                <span class="truncate max-w-[220px]">{{ attachment.file_name }}</span>
              </a>
            </div>
          </div>

          <!-- Reply input -->
          <div class="flex items-start gap-2">
            <div class="flex-1 relative">
              <div
                :ref="el => setReplyInputRef(message.id, el as HTMLElement | null)"
                contenteditable="true"
                class="ce-input ce-reply-input"
                data-placeholder="Reply to this thread..."
                @input="onCeInput(`reply-${message.id}`)"
                @keydown="onReplyKeydown($event, message.id)"
                @keyup="onCeKeyup"
                @click="onCeClick"
                @focus="onCeFocus(`reply-${message.id}`, $event)"
                @blur="onCeBlur"
                @paste="onCePaste"
              />
            </div>
            <UButton
              size="sm"
              variant="soft"
              :disabled="!replyHasContent[message.id]"
              @click="submitReply(message.id)"
            >
              Reply
            </UButton>
          </div>
        </div>
      </article>

      <div v-if="!loading && topLevelMessages.length === 0" class="text-sm text-neutral-500 py-12 text-center">
        No conversation yet.
      </div>
    </div>

    <footer class="border-t border-neutral-200 dark:border-neutral-800 px-4 py-3">
      <div class="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-3 space-y-3">
        <div class="flex flex-wrap items-center gap-1.5">
          <span class="text-[11px] uppercase tracking-wide text-neutral-400 mr-1">Format</span>
          <UButton size="xs" variant="soft" color="neutral" @click="insertFormatting('**', '**')">
          Bold
          </UButton>
          <UButton size="xs" variant="soft" color="neutral" @click="insertFormatting('*', '*')">
          Italic
          </UButton>
          <UButton size="xs" variant="soft" color="neutral" @click="insertFormatting('++', '++')">
          Underline
          </UButton>
          <UButton size="xs" variant="soft" color="neutral" @click="insertFormatting('~~', '~~')">
          Strike
          </UButton>
          <UButton size="xs" variant="soft" color="neutral" @click="insertFormatting('`', '`')">
          Code
          </UButton>
          <UButton size="xs" variant="soft" color="neutral" @click="insertFormatting('[', '](https://)')">
          Link
          </UButton>
          <UButton size="xs" variant="soft" color="neutral" @click="insertListItem">
          List
          </UButton>
        </div>

        <div
          ref="composerEditable"
          contenteditable="true"
          class="ce-input ce-composer"
          data-placeholder="Write a message. Use @ to mention people, files, BOM lines, or components."
          @input="onCeInput('composer')"
          @keydown="onComposerKeydown"
          @keyup="onCeKeyup"
          @click="onCeClick"
          @focus="onCeFocus('composer', $event)"
          @blur="onCeBlur"
          @paste="onCePaste"
        />

        <div v-if="selectedAttachments.length > 0" class="flex flex-wrap gap-2">
          <span
            v-for="(file, idx) in selectedAttachments"
            :key="`${file.name}-${idx}`"
            class="inline-flex items-center gap-1 rounded-md border border-neutral-200 dark:border-neutral-700 px-2 py-1 text-xs"
          >
            <UIcon name="i-lucide-paperclip" class="size-3.5 text-neutral-500" />
            <span class="max-w-[220px] truncate">{{ file.name }}</span>
            <button class="text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-100" @click="removeSelectedAttachment(idx)">
              <UIcon name="i-lucide-x" class="size-3.5" />
            </button>
          </span>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <UButton size="xs" variant="soft" color="neutral" icon="i-lucide-paperclip" @click="openFilePicker">
              Attach files
            </UButton>
            <input
              ref="fileInputRef"
              type="file"
              class="hidden"
              multiple
              @change="onPickFiles"
            >
            <span class="text-xs text-neutral-500">Files stay in conversation only.</span>
          </div>
          <UButton
            :disabled="!composerHasContent"
            :loading="posting"
            size="sm"
            icon="i-lucide-send"
            @click="submitMessage"
          >
            Post message
          </UButton>
        </div>
      </div>
    </footer>
    <!-- Shared autocomplete dropdown (teleported to avoid overflow clipping) -->
    <Teleport to="body">
      <div
        v-if="autocompleteOpen && flatSuggestions.length > 0"
        ref="autocompleteDropdown"
        class="fixed z-[100] rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-lg max-h-72 overflow-y-auto"
        :style="dropdownStyle"
      >
        <template v-for="(entry, entryIdx) in flatSuggestionsWithHeaders" :key="entry.key">
          <div
            v-if="entry.kind === 'header'"
            class="px-2.5 pt-2.5 pb-1 text-[10px] uppercase tracking-wider font-semibold text-neutral-400 dark:text-neutral-500 select-none"
            :class="{ 'pt-1.5': entryIdx === 0 }"
          >
            {{ entry.label }}
          </div>
          <button
            v-else-if="entry.kind === 'person'"
            class="w-full px-2.5 py-1.5 text-left flex items-center gap-2 hover:bg-neutral-50 dark:hover:bg-neutral-800"
            :class="entry.flatIndex === autocompleteActiveIndex ? 'bg-primary-50 dark:bg-primary-900/30' : ''"
            @mousedown.prevent="selectSuggestion(entry.flatIndex)"
          >
            <UAvatar :src="entry.person!.avatar_url || undefined" :text="mentionInitials(entry.person!)" size="xs" />
            <div class="min-w-0 flex-1">
              <p class="text-xs font-medium text-neutral-800 dark:text-neutral-100 truncate">{{ entry.person!.name || entry.person!.email }}</p>
              <p class="text-[11px] text-neutral-500 truncate">@{{ entry.person!.handle }}</p>
            </div>
          </button>
          <button
            v-else-if="entry.kind === 'reference'"
            class="w-full px-2.5 py-1.5 text-left flex items-center gap-2 hover:bg-neutral-50 dark:hover:bg-neutral-800"
            :class="entry.flatIndex === autocompleteActiveIndex ? 'bg-primary-50 dark:bg-primary-900/30' : ''"
            @mousedown.prevent="selectSuggestion(entry.flatIndex)"
          >
            <span class="size-6 rounded bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shrink-0">
              <UIcon :name="entry.refItem!.icon" class="size-3.5 text-neutral-500 dark:text-neutral-400" />
            </span>
            <div class="min-w-0 flex-1">
              <p class="text-xs font-medium text-neutral-800 dark:text-neutral-100 truncate">{{ entry.refItem!.label }}</p>
              <p v-if="entry.refItem!.sublabel" class="text-[11px] text-neutral-500 truncate">{{ entry.refItem!.sublabel }}</p>
            </div>
          </button>
        </template>
      </div>
    </Teleport>
  </section>
</template>

<script setup lang="ts">
import { renderConversationMarkdown } from '~/utils/conversation-markdown'
import {
  serializeReference,
  resolveReference as resolveRef,
  REFERENCE_CATEGORY_LABELS,
  type ConversationReferenceItem,
  type ConversationReference,
  type ReferenceType,
} from '~/utils/conversation-references'

const props = defineProps<{
  projectId: string | null
  referenceItems?: ConversationReferenceItem[]
}>()

const emit = defineEmits<{
  'navigate-reference': [type: string, id: string]
}>()

const { currentTeamId } = useTeam()
const { isAdmin } = useTeam()
const { user } = useAuth()
const { members, fetchMembers } = useTeamMembers()
const toast = useToast()

const {
  topLevelMessages,
  repliesFor,
  postMessage,
  updateMessage,
  deleteMessage,
  fetchMessages,
  loading,
  attachmentsFor,
} = useProjectConversation(toRef(props, 'projectId'), currentTeamId)

const posting = ref(false)
const selectedAttachments = ref<File[]>([])
const fileInputRef = ref<HTMLInputElement | null>(null)
const composerEditable = ref<HTMLElement | null>(null)
const messagesContainer = ref<HTMLElement | null>(null)
const autocompleteDropdown = ref<HTMLElement | null>(null)
const editingMessageId = ref<string | null>(null)
const editDrafts = ref<Record<string, string>>({})
const savingEditId = ref<string | null>(null)
const deletingMessageId = ref<string | null>(null)
const composerHasContent = ref(false)
const replyHasContent = reactive<Record<string, boolean>>({})

// Autocomplete shared state
const autocompleteOpen = ref(false)
const autocompleteQuery = ref('')
const autocompleteActiveIndex = ref(0)
const activeInputId = ref<string | null>(null)
const activeInputEl = ref<HTMLElement | null>(null)
const autocompleteReplaceCtx = ref<{ textNode: Text; start: number; end: number } | null>(null)
const dropdownStyle = ref<Record<string, string>>({ display: 'none' })

// Reply input refs
const replyInputRefs = new Map<string, HTMLElement>()
function setReplyInputRef(messageId: string, el: HTMLElement | null) {
  if (el) replyInputRefs.set(messageId, el)
  else replyInputRefs.delete(messageId)
}

interface MentionItem {
  id: string
  name: string | null
  email: string
  avatar_url: string | null
  handle: string
}

type SuggestionItem =
  | { kind: 'person'; category: 'people'; person: MentionItem }
  | { kind: 'reference'; category: ReferenceType; item: ConversationReferenceItem }

const mentionDirectory = computed<MentionItem[]>(() => {
  const seen = new Set<string>()
  const list: MentionItem[] = []
  for (const member of members.value) {
    const profile = member.profile
    if (!profile) continue
    const nameHandle = (profile.name ?? '').trim().toLowerCase().replace(/\s+/g, '.')
    const emailHandle = (profile.email ?? '').trim().toLowerCase().split('@')[0]
    for (const handle of [nameHandle, emailHandle]) {
      if (!handle || seen.has(`${profile.id}:${handle}`)) continue
      seen.add(`${profile.id}:${handle}`)
      list.push({
        id: profile.id,
        name: profile.name ?? null,
        email: profile.email,
        avatar_url: profile.avatar_url ?? null,
        handle,
      })
    }
  }
  return list
})

const mentionByHandle = computed(() => {
  const map = new Map<string, MentionItem>()
  for (const item of mentionDirectory.value) {
    if (!map.has(item.handle)) map.set(item.handle, item)
  }
  return map
})

const referenceItemsMap = computed(() => {
  const map = new Map<string, ConversationReferenceItem>()
  for (const item of props.referenceItems ?? []) {
    map.set(`${item.type}:${item.id}`, item)
  }
  return map
})

const flatSuggestions = computed<SuggestionItem[]>(() => {
  const query = autocompleteQuery.value.toLowerCase()
  const results: SuggestionItem[] = []

  const filteredPeople = mentionDirectory.value
    .filter(item =>
      !query
      || item.handle.includes(query)
      || (item.name ?? '').toLowerCase().includes(query)
      || item.email.toLowerCase().includes(query),
    )
    .slice(0, 6)

  for (const person of filteredPeople) {
    results.push({ kind: 'person', category: 'people', person })
  }

  const refItems = props.referenceItems ?? []
  const categories: ReferenceType[] = ['file', 'bom', 'pnp', 'doc']
  for (const cat of categories) {
    const catItems = refItems
      .filter(item =>
        item.type === cat
        && (!query
          || item.label.toLowerCase().includes(query)
          || (item.sublabel ?? '').toLowerCase().includes(query)),
      )
      .slice(0, 8)
    for (const item of catItems) {
      results.push({ kind: 'reference', category: cat, item })
    }
  }

  return results
})

interface DisplayEntry {
  key: string
  kind: 'header' | 'person' | 'reference'
  label?: string
  person?: MentionItem
  refItem?: ConversationReferenceItem
  flatIndex: number
}

const flatSuggestionsWithHeaders = computed<DisplayEntry[]>(() => {
  const entries: DisplayEntry[] = []
  let lastCategory: string | null = null
  let flatIdx = 0

  for (const suggestion of flatSuggestions.value) {
    const cat = suggestion.category
    if (cat !== lastCategory) {
      const label = cat === 'people' ? 'People' : REFERENCE_CATEGORY_LABELS[cat as ReferenceType] ?? cat
      entries.push({ key: `header-${cat}`, kind: 'header', label, flatIndex: -1 })
      lastCategory = cat
    }
    if (suggestion.kind === 'person') {
      entries.push({ key: `person-${suggestion.person.id}-${suggestion.person.handle}`, kind: 'person', person: suggestion.person, flatIndex: flatIdx })
    }
    else {
      entries.push({ key: `ref-${suggestion.item.type}-${suggestion.item.id}`, kind: 'reference', refItem: suggestion.item, flatIndex: flatIdx })
    }
    flatIdx++
  }

  return entries
})

// ── Contenteditable helpers ──

function createRefChipEl(type: ReferenceType, id: string, label: string, icon: string): HTMLElement {
  const chip = document.createElement('span')
  chip.contentEditable = 'false'
  chip.className = 'ce-ref-chip'
  chip.dataset.refType = type
  chip.dataset.refId = id
  chip.dataset.refLabel = label

  const iconEl = document.createElement('span')
  iconEl.className = `${icon} size-3 shrink-0`
  chip.appendChild(iconEl)

  const labelEl = document.createElement('span')
  labelEl.className = 'truncate max-w-[240px]'
  labelEl.textContent = label
  chip.appendChild(labelEl)

  return chip
}

function extractRawText(container: HTMLElement): string {
  let text = ''
  for (const node of container.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent || ''
    }
    else if (node instanceof HTMLElement) {
      if (node.dataset.refType && node.dataset.refId && node.dataset.refLabel) {
        text += serializeReference(
          node.dataset.refType as ReferenceType,
          node.dataset.refId,
          node.dataset.refLabel,
        )
      }
      else if (node.tagName === 'BR') {
        text += '\n'
      }
      else {
        if ((node.tagName === 'DIV' || node.tagName === 'P') && text.length > 0 && !text.endsWith('\n')) {
          text += '\n'
        }
        text += extractRawText(node)
      }
    }
  }
  return text
}

function ceHasContent(el: HTMLElement | null | undefined): boolean {
  if (!el) return false
  return (el.textContent?.trim().length ?? 0) > 0 || !!el.querySelector('[data-ref-type]')
}

function cleanEmptyEditable(el: HTMLElement) {
  if (el.innerHTML === '<br>' || el.innerHTML === '<div><br></div>') {
    el.innerHTML = ''
  }
}

// ── Contenteditable events ──

function onCeInput(inputId: string) {
  const el = inputId === 'composer' ? composerEditable.value : replyInputRefs.get(inputId.replace('reply-', ''))
  if (!el) return
  cleanEmptyEditable(el)
  if (inputId === 'composer') {
    composerHasContent.value = ceHasContent(el)
  }
  else {
    const msgId = inputId.replace('reply-', '')
    replyHasContent[msgId] = ceHasContent(el)
  }
  detectAutocompleteContext()
}

function onCeKeyup() {
  detectAutocompleteContext()
}

function onCeClick() {
  detectAutocompleteContext()
}

function onCeFocus(inputId: string, _event: FocusEvent) {
  activeInputId.value = inputId
  const el = inputId === 'composer' ? composerEditable.value : replyInputRefs.get(inputId.replace('reply-', ''))
  activeInputEl.value = el ?? null
}

function onCeBlur() {
  // Delay so mousedown on dropdown fires first
  setTimeout(() => {
    if (!activeInputEl.value?.contains(document.activeElement)) {
      autocompleteOpen.value = false
    }
  }, 150)
}

function onCePaste(event: ClipboardEvent) {
  event.preventDefault()
  const text = event.clipboardData?.getData('text/plain') || ''
  document.execCommand('insertText', false, text)
}

function onComposerKeydown(event: KeyboardEvent) {
  if (autocompleteOpen.value && flatSuggestions.value.length > 0) {
    if (['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(event.key)) {
      handleAutocompleteKeydown(event)
      return
    }
  }
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    document.execCommand('insertLineBreak')
  }
}

function onReplyKeydown(event: KeyboardEvent, messageId: string) {
  if (autocompleteOpen.value && flatSuggestions.value.length > 0) {
    if (['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(event.key)) {
      handleAutocompleteKeydown(event)
      return
    }
  }
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    submitReply(messageId)
  }
}

// ── Autocomplete ──

function detectAutocompleteContext() {
  const el = activeInputEl.value
  if (!el) return

  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0 || !el.contains(sel.anchorNode)) {
    autocompleteOpen.value = false
    autocompleteReplaceCtx.value = null
    return
  }

  const anchorNode = sel.anchorNode
  if (!anchorNode || anchorNode.nodeType !== Node.TEXT_NODE) {
    autocompleteOpen.value = false
    autocompleteReplaceCtx.value = null
    return
  }

  const text = anchorNode.textContent || ''
  const cursorOffset = sel.anchorOffset
  const before = text.slice(0, cursorOffset)

  const match = before.match(/(^|[\s(])@([a-zA-Z0-9._\-]*)$/)
  if (!match) {
    autocompleteOpen.value = false
    autocompleteReplaceCtx.value = null
    return
  }

  const token = match[2] ?? ''
  autocompleteQuery.value = token
  autocompleteOpen.value = true
  autocompleteActiveIndex.value = 0
  autocompleteReplaceCtx.value = {
    textNode: anchorNode as Text,
    start: cursorOffset - token.length - 1,
    end: cursorOffset,
  }
  updateDropdownPosition()
}

function updateDropdownPosition() {
  const el = activeInputEl.value
  if (!el) {
    dropdownStyle.value = { display: 'none' }
    return
  }
  const rect = el.getBoundingClientRect()
  dropdownStyle.value = {
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    bottom: `${window.innerHeight - rect.top + 4}px`,
  }
}

function handleAutocompleteKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    autocompleteActiveIndex.value = (autocompleteActiveIndex.value + 1) % flatSuggestions.value.length
    scrollActiveIntoView()
    return
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault()
    autocompleteActiveIndex.value = autocompleteActiveIndex.value === 0
      ? flatSuggestions.value.length - 1
      : autocompleteActiveIndex.value - 1
    scrollActiveIntoView()
    return
  }
  if (event.key === 'Enter' || event.key === 'Tab') {
    event.preventDefault()
    selectSuggestion(autocompleteActiveIndex.value)
    return
  }
  if (event.key === 'Escape') {
    autocompleteOpen.value = false
  }
}

function scrollActiveIntoView() {
  nextTick(() => {
    const container = autocompleteDropdown.value
    if (!container) return
    const active = container.querySelector('[class*="bg-primary"]') as HTMLElement | null
    active?.scrollIntoView({ block: 'nearest' })
  })
}

function selectSuggestion(flatIndex: number) {
  const suggestion = flatSuggestions.value[flatIndex]
  if (!suggestion) return

  const ctx = autocompleteReplaceCtx.value
  if (!ctx) return

  const textNode = ctx.textNode
  const text = textNode.textContent || ''
  const before = text.slice(0, ctx.start)
  const after = text.slice(ctx.end)

  if (suggestion.kind === 'person') {
    const handle = suggestion.person.handle
    textNode.textContent = `${before}@${handle} ${after}`
    const sel = window.getSelection()
    const newOffset = Math.min(before.length + handle.length + 2, textNode.textContent!.length)
    sel?.collapse(textNode, newOffset)
  }
  else {
    const { type, id, label, icon } = suggestion.item
    textNode.textContent = before
    const chip = createRefChipEl(type, id, label, icon)
    const afterNode = document.createTextNode(`\u00A0${after.trimStart()}`)
    const parent = textNode.parentNode
    if (parent) {
      const nextSib = textNode.nextSibling
      if (nextSib) {
        parent.insertBefore(chip, nextSib)
        parent.insertBefore(afterNode, chip.nextSibling)
      }
      else {
        parent.appendChild(chip)
        parent.appendChild(afterNode)
      }
    }
    const sel = window.getSelection()
    sel?.collapse(afterNode, 1)
  }

  autocompleteOpen.value = false
  autocompleteReplaceCtx.value = null

  const inputId = activeInputId.value
  if (inputId) onCeInput(inputId)
}

// ── Message rendering and actions ──

type AuthorCategory = 'self' | 'guest' | 'staff'

function authorCategory(message: { author_id: string | null }): AuthorCategory {
  if (message.author_id && user.value?.id === message.author_id) return 'self'
  const member = members.value.find(m => m.user_id === message.author_id)
  if (member?.role === 'guest') return 'guest'
  return 'staff'
}

function messageBorderClass(message: { author_id: string | null }) {
  const cat = authorCategory(message)
  if (cat === 'self') return 'border-primary/20 bg-primary/[0.03] dark:bg-primary/[0.04]'
  if (cat === 'guest') return 'border-amber-400/20 bg-amber-50/30 dark:bg-amber-900/[0.06]'
  return 'border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900'
}

function replyBorderClass(message: { author_id: string | null }) {
  const cat = authorCategory(message)
  if (cat === 'self') return 'border-primary/15 bg-primary/[0.04] dark:bg-primary/[0.05]'
  if (cat === 'guest') return 'border-amber-400/15 bg-amber-50/20 dark:bg-amber-900/[0.05]'
  return 'border-neutral-200/70 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/40'
}

function authorLabel(message: {
  author_profile?: { name: string | null; email: string } | null
  message_type: 'comment' | 'system'
}) {
  if (message.message_type === 'system') return 'Workflow'
  return message.author_profile?.name ?? message.author_profile?.email ?? 'Unknown user'
}

function authorInitials(message: {
  author_profile?: { name: string | null; email: string } | null
  message_type: 'comment' | 'system'
}) {
  const label = authorLabel(message)
  if (label === 'Workflow') return 'WF'
  const normalized = label.split(/[.\s_@-]+/).filter(Boolean).slice(0, 2)
  if (normalized.length === 0) return 'U'
  return normalized.map(chunk => chunk[0]!.toUpperCase()).join('')
}

function formatDate(value: string) {
  return new Date(value).toLocaleString()
}

function renderMessageBody(body: string) {
  return renderConversationMarkdown(body, {
    resolveMention: (handle) => {
      const match = mentionByHandle.value.get(handle)
      if (!match) return null
      return {
        handle: match.handle,
        label: match.name ?? match.email,
        avatarUrl: match.avatar_url,
      }
    },
    resolveReference: (ref: ConversationReference) => {
      if (!props.referenceItems || props.referenceItems.length === 0) return null
      const key = `${ref.type}:${ref.id}`
      const match = referenceItemsMap.value.get(key)
      if (match) {
        return {
          type: ref.type,
          id: ref.id,
          label: match.label,
          icon: match.icon,
          exists: true,
        }
      }
      return resolveRef(ref, props.referenceItems)
    },
  })
}

function handleRefClick(event: MouseEvent) {
  const target = (event.target as HTMLElement).closest?.('[data-ref-type]') as HTMLElement | null
  if (!target) return
  if (target.closest('[contenteditable]')) return
  const type = target.dataset.refType
  const id = target.dataset.refId
  if (type && id) {
    emit('navigate-reference', type, id)
  }
}

// ── Formatting toolbar ──

function insertFormatting(before: string, after: string) {
  const el = composerEditable.value
  if (!el) return
  el.focus()
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return
  const range = sel.getRangeAt(0)
  const selectedText = range.toString() || 'text'
  range.deleteContents()
  const replacement = `${before}${selectedText}${after}`
  const textNode = document.createTextNode(replacement)
  range.insertNode(textNode)
  range.setStartAfter(textNode)
  range.setEndAfter(textNode)
  sel.removeAllRanges()
  sel.addRange(range)
  onCeInput('composer')
}

function insertListItem() {
  const el = composerEditable.value
  if (!el) return
  el.focus()
  const text = extractRawText(el)
  const insert = text.endsWith('\n') || text.length === 0 ? '- item' : '\n- item'
  document.execCommand('insertText', false, insert)
  onCeInput('composer')
}

// ── File attachments ──

function openFilePicker() {
  fileInputRef.value?.click()
}

function onPickFiles(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  for (const file of files) {
    if (file.size > 10 * 1024 * 1024) {
      toast.add({ title: `${file.name} exceeds 10 MB limit`, color: 'warning' })
      continue
    }
    selectedAttachments.value.push(file)
  }
  input.value = ''
}

function removeSelectedAttachment(index: number) {
  selectedAttachments.value.splice(index, 1)
}

// ── Submit ──

async function submitMessage() {
  const el = composerEditable.value
  if (!el) return
  const body = extractRawText(el).trim()
  if (!body) return
  posting.value = true
  try {
    const { error, warnings } = await postMessage(body, null, selectedAttachments.value)
    if (error) {
      toast.add({ title: 'Failed to post message', description: error.message, color: 'error' })
      return
    }
    if (warnings.length > 0) {
      toast.add({ title: 'Posted with attachment warnings', description: warnings[0], color: 'warning' })
    }
    el.innerHTML = ''
    composerHasContent.value = false
    selectedAttachments.value = []
  }
  finally {
    posting.value = false
  }
}

async function submitReply(parentId: string) {
  const el = replyInputRefs.get(parentId)
  if (!el) return
  const body = extractRawText(el).trim()
  if (!body) return
  const { error } = await postMessage(body, parentId)
  if (error) {
    toast.add({ title: 'Failed to post reply', description: error.message, color: 'error' })
    return
  }
  el.innerHTML = ''
  replyHasContent[parentId] = false
}

// ── Edit / delete ──

function canEditMessage(message: {
  id: string
  author_id: string | null
  message_type: 'comment' | 'system'
}) {
  if (message.message_type !== 'comment') return false
  return !!user.value?.id && message.author_id === user.value.id
}

function canDeleteMessage(message: {
  id: string
  author_id: string | null
  message_type: 'comment' | 'system'
}) {
  if (message.message_type !== 'comment') return false
  if (isAdmin.value) return true
  return !!user.value?.id && message.author_id === user.value.id
}

function hasMessageActions(message: {
  id: string
  author_id: string | null
  message_type: 'comment' | 'system'
}) {
  return canEditMessage(message) || canDeleteMessage(message)
}

function startEdit(message: { id: string; body: string }) {
  editingMessageId.value = message.id
  editDrafts.value[message.id] = message.body
}

function cancelEdit(messageId: string) {
  if (editingMessageId.value === messageId) {
    editingMessageId.value = null
  }
}

async function saveEdit(messageId: string) {
  const nextBody = editDrafts.value[messageId]?.trim()
  if (!nextBody) return
  savingEditId.value = messageId
  try {
    const { error } = await updateMessage(messageId, nextBody)
    if (error) {
      toast.add({ title: 'Failed to update message', description: error.message, color: 'error' })
      return
    }
    editingMessageId.value = null
  }
  finally {
    savingEditId.value = null
  }
}

async function confirmDelete(message: { id: string }) {
  const ok = confirm('Delete this message? Replies will also be deleted.')
  if (!ok) return
  deletingMessageId.value = message.id
  try {
    const { error } = await deleteMessage(message.id)
    if (error) {
      toast.add({ title: 'Failed to delete message', description: error.message, color: 'error' })
    }
  }
  finally {
    deletingMessageId.value = null
  }
}

function mentionInitials(item: MentionItem) {
  const source = item.name?.trim() || item.email
  const parts = source.split(/[.\s_@-]+/).filter(Boolean).slice(0, 2)
  if (parts.length === 0) return 'U'
  return parts.map(part => part[0]!.toUpperCase()).join('')
}

onMounted(async () => {
  await fetchMembers()
})
</script>

<style scoped>
.conversation-markdown :deep(p) {
  margin: 0;
}

.conversation-markdown :deep(p + p) {
  margin-top: 0.5rem;
}

.conversation-markdown :deep(.conversation-ref) {
  cursor: pointer;
}

/* Contenteditable base styles */
.ce-input {
  outline: none;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: break-word;
  font-size: 0.875rem;
  line-height: 1.5;
  border-radius: 0.5rem;
  border: 1px solid rgb(229 231 235); /* neutral-200 */
  background: white;
  color: rgb(38 38 38); /* neutral-800 */
  transition: border-color 0.15s, box-shadow 0.15s;
}

:root.dark .ce-input,
.dark .ce-input {
  border-color: rgb(64 64 64); /* neutral-700 */
  background: rgb(23 23 23); /* neutral-900 */
  color: rgb(245 245 245); /* neutral-100 */
}

.ce-input:focus {
  border-color: var(--color-primary-500, #3b82f6);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.25);
}

.ce-input:empty::before {
  content: attr(data-placeholder);
  color: rgb(163 163 163); /* neutral-400 */
  pointer-events: none;
  position: absolute;
}

:root.dark .ce-input:empty::before,
.dark .ce-input:empty::before {
  color: rgb(115 115 115); /* neutral-500 */
}

.ce-composer {
  min-height: 72px;
  max-height: 200px;
  overflow-y: auto;
  padding: 0.5rem 0.75rem;
  position: relative;
}

.ce-reply-input {
  min-height: 32px;
  max-height: 80px;
  overflow-y: auto;
  padding: 0.25rem 0.625rem;
  position: relative;
}

/* Reference chip inside contenteditable */
.ce-input :deep(.ce-ref-chip) {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  border-radius: 9999px;
  border: 1px solid rgba(59, 130, 246, 0.3);
  background: rgba(59, 130, 246, 0.08);
  color: rgb(29 78 216); /* blue-700 */
  padding: 0.125rem 0.5rem;
  font-size: 0.75rem;
  line-height: 1.25rem;
  vertical-align: baseline;
  user-select: all;
  cursor: default;
  white-space: nowrap;
  max-width: 280px;
}

:root.dark .ce-input :deep(.ce-ref-chip),
.dark .ce-input :deep(.ce-ref-chip) {
  border-color: rgba(96, 165, 250, 0.35);
  background: rgba(59, 130, 246, 0.12);
  color: rgb(191 219 254); /* blue-200 */
}
</style>
