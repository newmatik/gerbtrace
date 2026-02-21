import { referenceIcon, type ConversationReference, type ReferenceResolveResult, type ReferenceType } from './conversation-references'

interface MentionRenderData {
  handle: string
  label: string
  avatarUrl?: string | null
}

export interface RenderConversationMarkdownOptions {
  resolveMention?: (handle: string) => MentionRenderData | null
  resolveReference?: (ref: ConversationReference) => ReferenceResolveResult | null
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function applyInlineFormatting(input: string): string {
  return input
    .replace(/`([^`]+)`/g, '<code class="rounded bg-neutral-100 dark:bg-neutral-800 px-1 py-0.5 text-[0.92em]">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
    .replace(/\+\+([^+]+)\+\+/g, '<u>$1</u>')
    .replace(/~~([^~]+)~~/g, '<s>$1</s>')
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary-500 hover:underline">$1</a>',
    )
}

function replaceMentions(input: string, options?: RenderConversationMarkdownOptions): string {
  if (!options?.resolveMention) return input
  const mentions: string[] = []
  const withPlaceholders = input.replace(/(^|[\s(])@([a-zA-Z0-9._-]+)/g, (full, lead: string, rawHandle: string) => {
    const mention = options.resolveMention?.(rawHandle.toLowerCase())
    if (!mention) return full
    const safeHandle = escapeHtml(mention.handle)
    const safeLabel = escapeHtml(mention.label)
    const safeAvatar = mention.avatarUrl ? escapeHtml(mention.avatarUrl) : ''
    const avatarHtml = safeAvatar
      ? `<img src="${safeAvatar}" alt="${safeLabel}" class="size-4 rounded-full object-cover shrink-0">`
      : '<span class="size-4 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-200 text-[9px] font-semibold inline-flex items-center justify-center shrink-0">@</span>'

    const badge = `<span class="inline-flex items-center gap-1 rounded-full border border-primary-200/70 dark:border-primary-700/60 bg-primary-50 dark:bg-primary-900/20 px-1.5 py-0.5 text-xs text-primary-700 dark:text-primary-200 align-middle">${avatarHtml}<span>@${safeHandle}</span></span>`
    const idx = mentions.push(badge) - 1
    return `${lead}__MENTION_${idx}__`
  })

  return withPlaceholders.replace(/__MENTION_(\d+)__/g, (_, idx) => mentions[Number(idx)] || '')
}

const ESCAPED_REFERENCE_REGEX = /\{\{ref:(\w+):([^:}]+):([^}]+)\}\}/g

function replaceReferences(input: string, options?: RenderConversationMarkdownOptions): string {
  const refs: string[] = []

  const withPlaceholders = input.replace(ESCAPED_REFERENCE_REGEX, (_full, rawType: string, rawId: string, rawLabel: string) => {
    const type = rawType as ReferenceType
    const id = unescapeHtml(rawId)
    const fallbackLabel = unescapeHtml(rawLabel)

    const ref: ConversationReference = { type, id, fallbackLabel }
    const resolved = options?.resolveReference?.(ref)

    const label = resolved ? escapeHtml(resolved.label) : escapeHtml(fallbackLabel)
    const icon = resolved?.icon ?? referenceIcon(type)

    let chip: string
    if (resolved && resolved.exists) {
      chip = `<span class="conversation-ref inline-flex items-center gap-1 rounded-full border border-primary-200/70 dark:border-primary-700/60 bg-primary-50 dark:bg-primary-900/20 px-1.5 py-0.5 text-xs text-primary-700 dark:text-primary-200 align-middle cursor-pointer hover:bg-primary-100 dark:hover:bg-primary-800/30 transition-colors" data-ref-type="${escapeHtml(type)}" data-ref-id="${escapeHtml(id)}"><span class="${escapeHtml(icon)} size-3.5 shrink-0"></span><span>${label}</span></span>`
    }
    else if (resolved && !resolved.exists) {
      chip = `<span class="inline-flex items-center gap-1 rounded-full border border-red-200/70 dark:border-red-700/60 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 text-xs text-red-500 dark:text-red-400 align-middle line-through decoration-red-400/50"><span class="${escapeHtml(icon)} size-3.5 shrink-0"></span><span>${label}</span><span class="text-[10px] no-underline">(deleted)</span></span>`
    }
    else {
      chip = `<span class="inline-flex items-center gap-1 rounded-full border border-neutral-200/70 dark:border-neutral-700/60 bg-neutral-50 dark:bg-neutral-800/40 px-1.5 py-0.5 text-xs text-neutral-600 dark:text-neutral-300 align-middle"><span class="${escapeHtml(icon)} size-3.5 shrink-0"></span><span>${escapeHtml(fallbackLabel)}</span></span>`
    }

    const idx = refs.push(chip) - 1
    return `__REF_${idx}__`
  })

  return withPlaceholders.replace(/__REF_(\d+)__/g, (_, idx) => refs[Number(idx)] || '')
}

function unescapeHtml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '\'')
}

export function renderConversationMarkdown(value: string, options?: RenderConversationMarkdownOptions): string {
  const escaped = escapeHtml(value)
  const lines = escaped.split('\n')
  const chunks: string[] = []
  let listBuffer: string[] = []

  const flushList = () => {
    if (listBuffer.length === 0) return
    chunks.push(`<ul class="list-disc ml-5 space-y-1">${listBuffer.join('')}</ul>`)
    listBuffer = []
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()
    const listMatch = line.match(/^\s*[-*]\s+(.+)$/)
    if (listMatch) {
      const withRefs = replaceReferences(listMatch[1], options)
      listBuffer.push(`<li>${applyInlineFormatting(withRefs)}</li>`)
      continue
    }

    flushList()
    if (line.trim().length === 0) {
      chunks.push('<div class="h-2"></div>')
      continue
    }
    const withRefs = replaceReferences(line, options)
    const withMentions = replaceMentions(withRefs, options)
    chunks.push(`<p>${applyInlineFormatting(withMentions)}</p>`)
  }

  flushList()
  return chunks.join('')
}
