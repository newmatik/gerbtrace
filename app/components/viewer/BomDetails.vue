<template>
  <div class="h-full flex flex-col overflow-hidden">
    <div v-if="!line" class="h-full flex items-center justify-center text-sm text-neutral-400">
      Select a BOM line to see details
    </div>

    <template v-else>
      <!-- Pinned header -->
      <div class="shrink-0 px-3 pt-3 space-y-2">
        <div class="flex items-start gap-2">
          <UInput
            :model-value="line.description"
            size="sm"
            :disabled="props.locked"
            placeholder="(no description)"
            :ui="fieldInputUi('description')"
            class="flex-1 min-w-0 [&_input]:text-sm [&_input]:font-semibold"
            @update:model-value="(v) => emitUpdate({ description: String(v ?? '') })"
          />
          <div class="flex items-center gap-2 shrink-0 pt-1">
            <span
              v-if="isLineChanged"
              class="text-[9px] px-1.5 py-0.5 rounded-full border shrink-0"
              :class="editedBadgeClass"
              title="This line differs from the original customer BOM"
            >
              Edited
            </span>
            <UBadge v-if="line.dnp" size="xs" variant="subtle" color="error">DNP</UBadge>
            <UButton size="xs" color="error" variant="ghost" icon="i-lucide-trash-2" title="Delete BOM line" :disabled="props.locked" @click="emit('removeLine', line.id)" />
          </div>
        </div>

        <!-- Spark: Description suggestion -->
        <div v-if="aiSuggestion?.description && aiSuggestion.description !== line.description" class="rounded-md border-l-2 border-violet-500 bg-violet-50/60 dark:bg-violet-900/15 border border-violet-200 dark:border-violet-800 px-2.5 py-1.5">
          <div class="flex items-start gap-1.5">
            <UIcon name="i-lucide-sparkles" class="text-[10px] text-violet-500 shrink-0 mt-0.5" />
            <div class="flex-1 min-w-0">
              <div class="text-[9px] font-medium text-violet-600 dark:text-violet-400 uppercase tracking-wider mb-0.5">Spark suggestion</div>
              <div class="text-xs text-violet-900 dark:text-violet-200">{{ aiSuggestion.description }}</div>
            </div>
            <div class="flex items-center gap-0.5 shrink-0">
              <UButton size="xs" color="secondary" variant="soft" icon="i-lucide-check" class="!p-0.5" title="Accept" :disabled="props.locked" @click="emit('acceptAiSuggestion', line.id, 'description')" />
              <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-x" class="!p-0.5" title="Dismiss" :disabled="props.locked" @click="emit('dismissAiSuggestion', line.id, 'description')" />
            </div>
          </div>
        </div>

        <!-- Spark: Accept/Dismiss all -->
        <div v-if="hasAnySuggestion" class="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border-l-2 border-violet-500 bg-violet-50 dark:bg-violet-900/10 border border-violet-200 dark:border-violet-800">
          <UIcon name="i-lucide-sparkles" class="text-sm text-violet-500 shrink-0" />
          <span class="text-[11px] font-medium text-violet-700 dark:text-violet-300 flex-1">Spark has suggestions for this line</span>
          <UButton size="xs" color="secondary" variant="soft" icon="i-lucide-check" title="Accept all suggestions" :disabled="props.locked" @click="emit('acceptAllAi', line.id)">
            Accept All
          </UButton>
          <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-x" title="Dismiss all suggestions" :disabled="props.locked" @click="emit('dismissAllAi', line.id)">
            Dismiss
          </UButton>
        </div>
      </div>

      <!-- Scrollable content -->
      <div class="flex-1 min-h-0 overflow-y-auto px-3 pb-3 pt-2 space-y-3">
        <div v-if="missingInPnP.length > 0" class="flex items-start gap-1.5 px-2 py-1.5 text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded border border-amber-200 dark:border-amber-800">
          <UIcon name="i-lucide-triangle-alert" class="text-xs shrink-0 mt-0.5" />
          <div>
            <span class="font-medium">Not found in Pick &amp; Place:</span>
            {{ missingInPnP.join(', ') }}
          </div>
        </div>

        <!-- Editable fields -->
      <fieldset class="border-0 m-0 p-0 min-w-0 space-y-2.5" :disabled="props.locked">
        <!-- Comment + Group row (2/3 + 1/3) -->
        <div class="grid grid-cols-3 gap-2">
          <div class="col-span-2 min-w-0">
            <div class="text-[10px] text-neutral-400 mb-1">Comment</div>
            <UInput
              :model-value="line.comment"
              size="sm"
              placeholder="(optional)"
              :ui="fieldInputUi('comment')"
              class="w-full"
              @update:model-value="(v) => emitUpdate({ comment: String(v ?? '') })"
            />
          </div>
          <div class="col-span-1 min-w-0">
            <div class="text-[10px] text-neutral-400 mb-1">Group</div>
            <USelect
              :model-value="line.groupId || GROUP_NONE"
              :items="groupItems"
              size="sm"
              :disabled="props.locked"
              class="w-full"
              @update:model-value="(v: any) => emit('assignGroup', line!.id, v === GROUP_NONE ? null : v)"
            />
          </div>
        </div>

        <!-- Spark: Group suggestion -->
        <div v-if="aiSuggestion?.group" class="rounded-md border-l-2 border-violet-500 bg-violet-50/60 dark:bg-violet-900/15 border border-violet-200 dark:border-violet-800 px-2.5 py-1.5">
          <div class="flex items-start gap-1.5">
            <UIcon name="i-lucide-sparkles" class="text-[10px] text-violet-500 shrink-0 mt-0.5" />
            <div class="flex-1 min-w-0">
              <div class="text-[9px] font-medium text-violet-600 dark:text-violet-400 uppercase tracking-wider mb-0.5">Suggested group</div>
              <div class="text-xs text-violet-900 dark:text-violet-200">{{ aiSuggestion.group }}</div>
            </div>
            <div class="flex items-center gap-0.5 shrink-0">
              <UButton size="xs" color="warning" variant="ghost" icon="i-lucide-flag" class="!p-0.5" title="Report inaccurate suggestion" @click="openSuggestionReport()" />
              <UButton size="xs" color="secondary" variant="soft" icon="i-lucide-check" class="!p-0.5" title="Accept" :disabled="props.locked" @click="emit('acceptAiGroup', line.id, aiSuggestion!.group!)" />
              <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-x" class="!p-0.5" title="Dismiss" :disabled="props.locked" @click="emit('dismissAiGroup', line.id)" />
            </div>
          </div>
        </div>

        <!-- References (full width, compact) -->
        <div>
          <div class="text-[10px] text-neutral-400 mb-1">References ({{ refList.length }})</div>

          <div
            class="rounded-md border border-neutral-200 dark:border-neutral-800 p-2"
            :class="fieldClass('references')"
            @click="focusRefInput"
          >
            <div v-if="refList.length === 0" class="text-[10px] text-neutral-400">
              Type a designator and press Enter
            </div>
            <div class="flex flex-wrap items-center gap-1.5">
              <UBadge
                v-for="r in refList"
                :key="r"
                size="xs"
                color="neutral"
                variant="subtle"
                class="gap-1 pr-1"
              >
                <span class="font-mono">{{ r }}</span>
                <UButton
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-x"
                  class="!p-0.5"
                  title="Remove"
                  @click="removeRef(r)"
                />
              </UBadge>
              <UInput
                ref="refInputEl"
                v-model="refInput"
                size="xs"
                autocomplete="off"
                placeholder="Add ref..."
                :disabled="props.locked"
                class="min-w-[120px] max-w-[180px]"
                @keydown="onRefInputKeydown"
                @blur="commitRefInput"
                @paste="handleRefPaste"
              />
            </div>
          </div>
        </div>

        <!-- One-line 4-column row: Type + Classification + Package + PnP Package -->
        <div class="grid grid-cols-4 gap-2">
          <div class="min-w-0">
            <div class="text-[10px] text-neutral-400 mb-1">Type</div>
            <USelect
              :model-value="line.type || 'SMD'"
              :items="bomLineTypeItems"
              size="sm"
              class="w-full"
              @update:model-value="(v: any) => emitUpdate({ type: v })"
            />
          </div>
          <div v-if="line.type === 'SMD' || aiSuggestion?.smdClassification != null" class="min-w-0">
            <div class="text-[10px] text-neutral-400 mb-1">SMD Classification</div>
            <USelect
              :model-value="line.smdClassification || SMD_CLASS_NONE"
              :items="smdClassItems"
              size="sm"
              class="w-full"
              @update:model-value="(v: any) => emitUpdate({ smdClassification: v === SMD_CLASS_NONE ? null : v })"
            />
          </div>
          <div v-else-if="line.type === 'THT' || aiSuggestion?.pinCount != null" class="min-w-0">
            <div class="text-[10px] text-neutral-400 mb-1">THT Classification</div>
            <UInput
              :model-value="line.pinCount != null ? String(line.pinCount) : ''"
              size="sm"
              type="number"
              min="1"
              placeholder="Pin count"
              class="w-full"
              @update:model-value="(v) => emitUpdate({ pinCount: v ? Number(v) : null })"
            />
          </div>
          <div v-else class="min-w-0">
            <div class="text-[10px] text-neutral-400 mb-1">Classification</div>
            <div class="h-8 flex items-center px-2 text-xs rounded-md border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 text-neutral-400">
              —
            </div>
          </div>
          <div class="min-w-0">
            <div class="text-[10px] text-neutral-400 mb-1">Package</div>
            <UInput
              :model-value="line.package"
              size="sm"
              placeholder="e.g. 0603"
              :ui="fieldInputUi('package')"
              @update:model-value="(v) => emitUpdate({ package: String(v ?? '') })"
            />
          </div>
          <div class="min-w-0">
            <div class="text-[10px] text-neutral-400 mb-1">PnP Package</div>
            <div class="h-8 flex items-center px-2 text-xs rounded-md border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50" :class="pnpPackage ? 'text-neutral-700 dark:text-neutral-300' : 'text-neutral-400'">
              {{ pnpPackage || '—' }}
            </div>
          </div>
        </div>

        <!-- Spark suggestions for Type / Classification / Pin Count -->
        <div v-if="aiSuggestion?.type || aiSuggestion?.smdClassification || aiSuggestion?.pinCount != null" class="grid gap-2" :class="(aiSuggestion?.type && (aiSuggestion?.smdClassification || aiSuggestion?.pinCount != null)) ? 'grid-cols-2' : 'grid-cols-1'">
          <div v-if="aiSuggestion?.type && aiSuggestion.type !== line.type" class="flex items-center gap-1.5 px-2 py-1 rounded border-l-2 border-violet-500 bg-violet-50/60 dark:bg-violet-900/15 border border-violet-200 dark:border-violet-800">
            <UIcon name="i-lucide-sparkles" class="text-[9px] text-violet-500 shrink-0" />
            <span class="text-[10px] text-violet-800 dark:text-violet-200 flex-1">{{ aiSuggestion.type }}</span>
            <UButton size="xs" color="secondary" variant="soft" icon="i-lucide-check" class="!p-0.5" title="Accept" :disabled="props.locked" @click="emit('acceptAiSuggestion', line.id, 'type')" />
            <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-x" class="!p-0.5" title="Dismiss" :disabled="props.locked" @click="emit('dismissAiSuggestion', line.id, 'type')" />
          </div>
          <div v-if="aiSuggestion?.smdClassification && aiSuggestion.smdClassification !== line.smdClassification" class="flex items-center gap-1.5 px-2 py-1 rounded border-l-2 border-violet-500 bg-violet-50/60 dark:bg-violet-900/15 border border-violet-200 dark:border-violet-800">
            <UIcon name="i-lucide-sparkles" class="text-[9px] text-violet-500 shrink-0" />
            <span class="text-[10px] text-violet-800 dark:text-violet-200 flex-1">{{ aiSuggestion.smdClassification }}</span>
            <UButton size="xs" color="secondary" variant="soft" icon="i-lucide-check" class="!p-0.5" title="Accept" :disabled="props.locked" @click="emit('acceptAiSuggestion', line.id, 'smdClassification')" />
            <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-x" class="!p-0.5" title="Dismiss" :disabled="props.locked" @click="emit('dismissAiSuggestion', line.id, 'smdClassification')" />
          </div>
          <div v-if="aiSuggestion?.pinCount != null && aiSuggestion.pinCount !== line.pinCount" class="flex items-center gap-1.5 px-2 py-1 rounded border-l-2 border-violet-500 bg-violet-50/60 dark:bg-violet-900/15 border border-violet-200 dark:border-violet-800">
            <UIcon name="i-lucide-sparkles" class="text-[9px] text-violet-500 shrink-0" />
            <span class="text-[10px] text-violet-800 dark:text-violet-200 flex-1">{{ aiSuggestion.pinCount }} pins</span>
            <UButton size="xs" color="secondary" variant="soft" icon="i-lucide-check" class="!p-0.5" title="Accept" :disabled="props.locked" @click="emit('acceptAiSuggestion', line.id, 'pinCount')" />
            <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-x" class="!p-0.5" title="Dismiss" :disabled="props.locked" @click="emit('dismissAiSuggestion', line.id, 'pinCount')" />
          </div>
        </div>

        <!-- One-line 4-column row: Qty + Customer item + Customer provided + DNP -->
        <div class="grid grid-cols-4 gap-2">
          <div class="min-w-0">
            <div class="text-[10px] text-neutral-400 mb-1">Qty / board</div>
            <UInput
              :model-value="String(line.quantity)"
              size="sm"
              type="number"
              min="0"
              :ui="fieldInputUi('quantity')"
              @update:model-value="(v) => emitUpdate({ quantity: Math.max(0, Number(v ?? 0) || 0) })"
            />
          </div>
          <div class="min-w-0">
            <div class="text-[10px] text-neutral-400 mb-1">Customer item</div>
            <UInput
              :model-value="line.customerItemNo"
              size="sm"
              placeholder="(optional)"
              :ui="fieldInputUi('customerItemNo')"
              @update:model-value="(v) => emitUpdate({ customerItemNo: String(v ?? '') })"
            />
          </div>
          <div class="min-w-0">
            <div class="text-[10px] text-neutral-400 mb-1">Customer provided</div>
            <div class="h-8 rounded-md border border-neutral-200 dark:border-neutral-800 px-2 flex items-center">
              <USwitch
                :model-value="line.customerProvided"
                size="xs"
                @update:model-value="(v: boolean) => emitUpdate({ customerProvided: v })"
              />
            </div>
          </div>
          <div class="min-w-0">
            <div class="text-[10px] text-neutral-400 mb-1">DNP</div>
            <div class="h-8 rounded-md border border-neutral-200 dark:border-neutral-800 px-2 flex items-center">
              <USwitch
                :model-value="line.dnp"
                size="xs"
                @update:model-value="(v: boolean) => emitUpdate({ dnp: v })"
              />
            </div>
          </div>
        </div>
      </fieldset>

      <div v-if="extraEntries.length > 0" class="rounded-lg border border-neutral-200 dark:border-neutral-800 p-2.5 space-y-1.5">
        <button class="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors" @click="extraExpanded = !extraExpanded">
          <UIcon :name="extraExpanded ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'" class="text-[10px]" />
          Additional Data
          <UBadge size="xs" color="neutral" variant="subtle" class="ml-1">{{ extraEntries.length }}</UBadge>
        </button>
        <div v-if="extraExpanded" class="space-y-1">
          <div v-for="[key, value] in extraEntries" :key="key" class="flex items-baseline gap-2">
            <span class="text-[10px] text-neutral-400 shrink-0">{{ key }}</span>
            <span class="text-xs text-neutral-700 dark:text-neutral-200 break-words min-w-0">{{ value }}</span>
          </div>
        </div>
      </div>

      <fieldset class="space-y-2 border-0 m-0 p-0 min-w-0" :class="manufacturersClass" :disabled="props.locked">
        <div class="flex items-center justify-between">
          <div class="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Manufacturers</div>
          <UButton
            v-if="hasCredentials && hasAnyMpn"
            size="xs"
            color="neutral"
            variant="outline"
            class="!px-1.5 !py-0.5 text-[10px]"
            :icon="isFetchingAnyForLine ? 'i-lucide-loader-2' : 'i-lucide-refresh-cw'"
            :loading="isFetchingAnyForLine"
            @click="refreshAllForLine"
          >
            Fetch Prices
          </UButton>
        </div>

        <div v-if="line.manufacturers.length === 0 && !(aiSuggestion?.manufacturers?.length)" class="text-xs text-neutral-400 py-3 text-center">
          No manufacturers added.
        </div>

        <div v-else class="space-y-2">
          <div
            v-for="(mfr, idx) in line.manufacturers"
            :key="idx"
            class="rounded border p-2 space-y-1.5"
            :class="[
              isManufacturerNew(mfr)
                ? editedCardClass
                : 'border-neutral-100 dark:border-neutral-800',
              { 'opacity-60': line.dnp },
            ]"
          >
            <div class="flex items-start gap-2">
              <div class="flex-1 min-w-0 grid grid-cols-2 gap-2">
                <UInput
                  :model-value="mfr.manufacturer"
                  size="sm"
                  placeholder="Manufacturer"
                  class="min-w-0 text-sm font-medium"
                  @update:model-value="(v) => updateManufacturer(idx, { manufacturer: String(v ?? '') })"
                />
                <UInput
                  :model-value="mfr.manufacturerPart"
                  size="sm"
                  placeholder="Manufacturer Part"
                  class="min-w-0 font-mono text-sm"
                  @update:model-value="(v) => updateManufacturer(idx, { manufacturerPart: String(v ?? '') })"
                />
              </div>

              <div class="flex items-center gap-1 shrink-0 pt-0.5">
                <UIcon
                  v-if="getQueueStatus(mfr.manufacturerPart) === 'fetching'"
                  name="i-lucide-loader-2"
                  class="text-[10px] text-blue-500 animate-spin shrink-0"
                />
                <UIcon
                  v-else-if="getQueueStatus(mfr.manufacturerPart) === 'error'"
                  name="i-lucide-x-circle"
                  class="text-[10px] text-red-500 shrink-0"
                  title="Pricing fetch failed"
                />
                <UButton
                  v-if="hasCredentials"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-refresh-cw"
                  :disabled="getQueueStatus(mfr.manufacturerPart) === 'fetching'"
                  title="Refresh pricing for this part"
                  @click="emit('fetchSinglePricing', mfr.manufacturerPart)"
                />
                <UButton
                  size="xs"
                  color="error"
                  variant="ghost"
                  icon="i-lucide-trash-2"
                  title="Remove manufacturer"
                  @click="emit('removeManufacturer', line.id, idx)"
                />
              </div>
            </div>
            <div v-if="mfr.manufacturerPart && pricingCache[mfr.manufacturerPart]" class="text-[10px] text-neutral-400 -mt-1">
              {{ formatAge(pricingCache[mfr.manufacturerPart]?.fetchedAt) }} ago
            </div>

            <template v-if="mfr.manufacturerPart">
              <template v-for="offers in [getSupplierOffers(mfr.manufacturerPart, line.quantity * boardQuantity)]" :key="mfr.manufacturerPart">
                <template v-if="offers.length > 0">
                  <button
                    class="flex items-center gap-1 text-[10px] text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
                    @click="togglePriceTable(mfr.manufacturerPart)"
                  >
                    <UIcon
                      :name="expandedPriceTables.has(mfr.manufacturerPart) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
                      class="text-[10px]"
                    />
                    {{ offers.length }} suppliers
                  </button>
                  <div v-if="expandedPriceTables.has(mfr.manufacturerPart)" class="rounded border border-neutral-100 dark:border-neutral-800 overflow-hidden">
                    <div class="grid grid-cols-[1fr_60px_60px_60px_70px_70px] gap-1 px-2 py-0.5 bg-neutral-50 dark:bg-neutral-800/80 text-[9px] text-neutral-400 uppercase tracking-wide font-medium">
                      <span>Supplier</span>
                      <span class="text-right">Stock</span>
                      <span class="text-right">MOQ</span>
                      <span class="text-right">Break</span>
                      <span class="text-right">Unit</span>
                      <span class="text-right">Total</span>
                    </div>
                    <div
                      v-for="(offer, oi) in offers"
                      :key="oi"
                      class="grid grid-cols-[1fr_60px_60px_60px_70px_70px] gap-1 px-2 py-0.5 text-[10px] border-t border-neutral-50 dark:border-neutral-800/50"
                      :class="{
                        'bg-green-50/30 dark:bg-green-900/5': offer.stock >= line.quantity * boardQuantity && oi === 0,
                        'opacity-40': offer.stock < line.quantity * boardQuantity,
                      }"
                    >
                      <span class="text-neutral-600 dark:text-neutral-300 truncate" :title="offer.supplier + (offer.country ? ` (${offer.country})` : '')">
                        {{ offer.supplier }}
                      </span>
                      <span class="text-right tabular-nums" :class="offer.stock >= line.quantity * boardQuantity ? 'text-neutral-600 dark:text-neutral-300' : 'text-red-400'">
                        {{ formatNumber(offer.stock) }}
                      </span>
                      <span class="text-right tabular-nums text-neutral-500">
                        {{ formatNumber(offer.moq) }}
                      </span>
                      <span class="text-right tabular-nums text-neutral-500">
                        {{ formatNumber(offer.breakQty) }}
                      </span>
                      <template v-for="display in [getDisplayOffer(offer)]" :key="`${offer.supplier}-${oi}-${display.currency}`">
                        <span class="text-right tabular-nums font-medium" :class="offer.stock >= line.quantity * boardQuantity && oi === 0 ? 'text-green-600 dark:text-green-400' : 'text-neutral-600 dark:text-neutral-300'">
                          {{ formatCurrency(display.unitPrice, display.currency) }}
                        </span>
                        <span class="text-right tabular-nums text-neutral-500">
                          {{ formatCurrency(display.lineValue, display.currency) }}
                        </span>
                      </template>
                    </div>
                  </div>
                </template>
                <div v-else-if="!pricingCache[mfr.manufacturerPart] && !getQueueStatus(mfr.manufacturerPart)" class="text-[10px] text-neutral-400 italic pl-1">
                  No pricing data
                </div>
              </template>
            </template>
          </div>
        </div>

        <!-- Spark: Suggested manufacturers -->
        <div v-if="aiSuggestion?.manufacturers?.length" class="space-y-2">
          <div
            v-for="(mfr, idx) in aiSuggestion.manufacturers"
            :key="`ai-${idx}`"
            class="rounded border-l-2 border-violet-500 bg-violet-50/60 dark:bg-violet-900/15 border border-violet-200 dark:border-violet-800 p-2"
          >
            <div class="flex items-start gap-2">
              <UIcon name="i-lucide-sparkles" class="text-[10px] text-violet-500 shrink-0 mt-1.5" />
              <div class="flex-1 min-w-0">
                <div class="text-[9px] font-medium text-violet-600 dark:text-violet-400 uppercase tracking-wider mb-1">Suggested manufacturer</div>
                <div class="grid grid-cols-2 gap-2 text-xs">
                  <span class="text-violet-900 dark:text-violet-200 font-medium">{{ mfr.manufacturer }}</span>
                  <span class="text-violet-900 dark:text-violet-200 font-mono">{{ mfr.manufacturerPart }}</span>
                </div>
              </div>
              <div class="flex items-center gap-0.5 shrink-0">
                <UButton size="xs" color="secondary" variant="soft" icon="i-lucide-check" class="!p-0.5" title="Accept" :disabled="props.locked" @click="emit('acceptAiManufacturer', line.id, mfr)" />
                <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-x" class="!p-0.5" title="Dismiss" :disabled="props.locked" @click="emit('dismissAiManufacturer', line.id, mfr)" />
              </div>
            </div>
          </div>
        </div>

        <div
          v-if="inlineAddOpen"
          class="rounded border border-neutral-100 dark:border-neutral-800 p-2 space-y-1.5"
          @click.stop
        >
          <div class="flex items-start gap-2">
            <div class="flex-1 min-w-0 grid grid-cols-2 gap-2">
              <UInput
                v-model="inlineAddMfr"
                size="sm"
                placeholder="Manufacturer"
                class="min-w-0 text-sm font-medium"
                @keydown.enter="confirmInlineAdd"
              />
              <UInput
                v-model="inlineAddMpn"
                size="sm"
                placeholder="Manufacturer Part"
                class="min-w-0 font-mono text-sm"
                @keydown.enter="confirmInlineAdd"
              />
            </div>
            <div class="flex items-center gap-1 shrink-0 pt-0.5">
              <UButton size="xs" color="primary" variant="soft" icon="i-lucide-check" @click="confirmInlineAdd" />
              <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-x" @click="cancelInlineAdd" />
            </div>
          </div>
        </div>
        <UButton v-else size="xs" color="primary" variant="link" icon="i-lucide-plus" @click="inlineAddOpen = true">
          Add manufacturer
        </UButton>
      </fieldset>

      </div>
    </template>
  </div>

  <UModal v-model:open="reportModalOpen" :ui="{ content: 'sm:max-w-lg' }">
    <template #content>
      <div class="p-4 space-y-3">
        <h3 class="text-sm font-semibold">Report incorrect Spark suggestion</h3>
        <p class="text-xs text-neutral-500 dark:text-neutral-400">
          Tell us why this suggestion is wrong. We will send your note and the related suggestion payload to Sentry User Feedback.
        </p>
        <div v-if="line && aiSuggestion?.group" class="rounded border border-neutral-200 dark:border-neutral-800 px-2 py-1.5 text-[11px] text-neutral-600 dark:text-neutral-300">
          <div><span class="font-medium">Ref:</span> {{ line.references || line.id }}</div>
          <div><span class="font-medium">Suggested group:</span> {{ aiSuggestion.group }}</div>
        </div>
        <UTextarea
          v-model="reportReason"
          :rows="4"
          autoresize
          placeholder="Example: This is an SMD resettable fuse (1812) from Pick & Place F1, so THT group is wrong."
          :disabled="reportSubmitting"
          :ui="{ root: 'w-full' }"
        />
        <div class="flex justify-end gap-2">
          <UButton size="sm" color="neutral" variant="ghost" :disabled="reportSubmitting" @click="reportModalOpen = false">
            Cancel
          </UButton>
          <UButton size="sm" color="warning" :loading="reportSubmitting" :disabled="!canSubmitSuggestionReport" @click="submitSuggestionReport">
            Send feedback
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import * as Sentry from '@sentry/nuxt'
import type { BomLine, BomPricingCache, BomManufacturer, AiSuggestion, BomGroup } from '~/utils/bom-types'
import { BOM_LINE_TYPES, SMD_CLASSIFICATIONS } from '~/utils/bom-types'
import type { ExchangeRateSnapshot, PricingQueueItem } from '~/composables/useElexessApi'
import { formatCurrency, normalizeCurrencyCode } from '~/utils/currency'

const props = defineProps<{
  line: BomLine | null
  customerBomLines: BomLine[]
  pricingCache: BomPricingCache
  hasCredentials: boolean
  isFetchingPricing: boolean
  pricingQueue: PricingQueueItem[]
  boardQuantity: number
  teamCurrency: 'USD' | 'EUR'
  exchangeRate: ExchangeRateSnapshot | null
  pnpDesignators: Set<string>
  pnpPackages: Map<string, string>
  locked?: boolean
  aiSuggestion?: AiSuggestion | null
  groups: BomGroup[]
}>()

const emit = defineEmits<{
  updateLine: [id: string, updates: Partial<BomLine>]
  removeLine: [id: string]
  removeManufacturer: [lineId: string, index: number]
  addManufacturer: [lineId: string, mfr: { manufacturer: string; manufacturerPart: string }]
  fetchSinglePricing: [partNumber: string]
  acceptAiSuggestion: [lineId: string, field: string]
  dismissAiSuggestion: [lineId: string, field: string]
  acceptAllAi: [lineId: string]
  dismissAllAi: [lineId: string]
  acceptAiManufacturer: [lineId: string, mfr: { manufacturer: string; manufacturerPart: string }]
  dismissAiManufacturer: [lineId: string, mfr: { manufacturer: string; manufacturerPart: string }]
  acceptAiGroup: [lineId: string, groupName: string]
  dismissAiGroup: [lineId: string]
  assignGroup: [lineId: string, groupId: string | null]
}>()

const bomLineTypeItems = [...BOM_LINE_TYPES]
const SMD_CLASS_NONE = '__none__'
const smdClassItems = [
  { label: '(none)', value: SMD_CLASS_NONE },
  ...SMD_CLASSIFICATIONS.map(c => ({ label: c, value: c })),
]

const GROUP_NONE = '__none__'
const groupItems = computed(() => [
  { label: '(none)', value: GROUP_NONE },
  ...props.groups.map(g => ({ label: g.name, value: g.id })),
])

const pnpPackage = computed(() => {
  if (!props.line || props.pnpPackages.size === 0) return ''
  const refs = parseRefs(props.line.references)
  for (const r of refs) {
    const pkg = props.pnpPackages.get(r)
    if (pkg) return pkg
  }
  return ''
})

const toast = useToast()
const route = useRoute()
const { profile } = useCurrentUser()

const reportModalOpen = ref(false)
const reportReason = ref('')
const reportSubmitting = ref(false)

const canSubmitSuggestionReport = computed(() => {
  return reportReason.value.trim().length > 0 && !!props.line && !!props.aiSuggestion?.group
})

function openSuggestionReport() {
  reportReason.value = ''
  reportModalOpen.value = true
}

function safeSerialize(value: unknown): string {
  const seen = new WeakSet<object>()
  try {
    return JSON.stringify(value, (_key, current) => {
      if (typeof current === 'bigint') return current.toString()
      if (current && typeof current === 'object') {
        if (seen.has(current)) return '[Circular]'
        seen.add(current)
      }
      return current
    }, 2)
  } catch {
    return String(value)
  }
}

async function submitSuggestionReport() {
  if (!canSubmitSuggestionReport.value || !props.line || !props.aiSuggestion?.group) return
  reportSubmitting.value = true
  try {
    const payload = {
      type: 'spark_suggestion_inaccuracy',
      occurredAt: new Date().toISOString(),
      route: route.fullPath,
      href: typeof window !== 'undefined' ? window.location.href : undefined,
      appVersion: useRuntimeConfig().public?.appVersion,
      userComment: reportReason.value.trim(),
      line: {
        id: props.line.id,
        references: props.line.references,
        description: props.line.description,
        type: props.line.type,
        package: props.line.package,
        pnpPackage: pnpPackage.value || null,
        groupId: props.line.groupId ?? null,
      },
      aiSuggestion: {
        group: props.aiSuggestion.group,
        fullSuggestion: props.aiSuggestion,
      },
      availableGroups: props.groups.map(g => ({ id: g.id, name: g.name })),
    }

    const message = [
      `Spark suggestion reported inaccurate for line ${props.line.references || props.line.id}`,
      `Suggested group: ${props.aiSuggestion.group}`,
      `User feedback: ${reportReason.value.trim()}`,
      '',
      'Payload:',
      safeSerialize(payload),
    ].join('\n')

    await Sentry.captureFeedback({
      message,
      name: profile.value?.name ?? undefined,
      email: profile.value?.email ?? undefined,
    })

    Sentry.captureMessage('User Feedback: Spark suggestion inaccurate', {
      level: 'warning',
      tags: {
        feedback_type: 'spark_suggestion_inaccuracy',
        area: 'bom',
      },
      extra: payload,
    })

    toast.add({
      title: 'Feedback sent',
      description: 'Thanks. This Spark suggestion was reported to improve future prompts.',
      color: 'success',
    })
    reportModalOpen.value = false
    reportReason.value = ''
  } catch (error) {
    console.error('[Spark feedback] Failed to submit suggestion feedback', error)
    toast.add({
      title: 'Failed to send feedback',
      description: 'Please try again in a moment.',
      color: 'error',
    })
  } finally {
    reportSubmitting.value = false
  }
}

const hasAnySuggestion = computed(() => {
  const s = props.aiSuggestion
  if (!s) return false
  return !!(
    (s.description && s.description !== props.line?.description)
    || (s.type && s.type !== props.line?.type)
    || (s.pinCount != null && s.pinCount !== props.line?.pinCount)
    || (s.smdClassification && s.smdClassification !== props.line?.smdClassification)
    || (s.manufacturers && s.manufacturers.length > 0)
    || s.group
  )
})

const extraExpanded = ref(true)
const extraEntries = computed<[string, string][]>(() => {
  const extra = props.line?.extra
  if (!extra) return []
  return Object.entries(extra).filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '')
})

const expandedPriceTables = ref(new Set<string>())
function togglePriceTable(mpn: string) {
  const next = new Set(expandedPriceTables.value)
  if (next.has(mpn)) next.delete(mpn)
  else next.add(mpn)
  expandedPriceTables.value = next
}

function formatNumber(n: number): string {
  return n.toLocaleString()
}

function parseRefs(refs: string): string[] {
  if (!refs) return []
  return refs.split(/[,;\s]+/).map(r => r.trim()).filter(Boolean)
}

const missingInPnP = computed(() => {
  if (!props.line) return []
  if (props.line.dnp || props.pnpDesignators.size === 0) return []
  return parseRefs(props.line.references).filter(r => !props.pnpDesignators.has(r))
})

function refsKey(refs: string): string {
  return parseRefs(refs).map(r => r.toUpperCase()).sort().join(',')
}

function manufacturerKey(m: BomManufacturer): string {
  return `${String(m.manufacturer ?? '').trim().toLowerCase()}|${String(m.manufacturerPart ?? '').trim().toLowerCase()}`
}

const customerBaselineByLineId = computed(() => {
  const byId = new Map(props.customerBomLines.map(l => [l.id, l]))
  const byRefs = new Map<string, BomLine>()
  for (const l of props.customerBomLines) {
    const k = refsKey(l.references)
    if (k && !byRefs.has(k)) byRefs.set(k, l)
  }

  const map = new Map<string, BomLine | null>()
  const line = props.line
  if (!line) return map
  const direct = byId.get(line.id)
  if (direct) {
    map.set(line.id, direct)
    return map
  }
  const rk = refsKey(line.references)
  map.set(line.id, rk ? (byRefs.get(rk) ?? null) : null)
  return map
})

const baselineLine = computed(() => {
  const line = props.line
  if (!line) return null
  return customerBaselineByLineId.value.get(line.id) ?? null
})

const isLineChanged = computed(() => {
  const line = props.line
  const base = baselineLine.value
  if (!line) return false
  if (!base) return true

  const typeMatches = base.type === 'Other' || line.type === base.type

  const fieldsEqual =
    String(line.description ?? '').trim() === String(base.description ?? '').trim()
    && String(line.comment ?? '').trim() === String(base.comment ?? '').trim()
    && String(line.package ?? '').trim() === String(base.package ?? '').trim()
    && refsKey(line.references) === refsKey(base.references)
    && typeMatches
    && line.quantity === base.quantity
    && !!line.dnp === !!base.dnp
    && !!line.customerProvided === !!base.customerProvided
    && String(line.customerItemNo ?? '').trim() === String(base.customerItemNo ?? '').trim()

  if (!fieldsEqual) return true

  const a = (line.manufacturers ?? []).map(manufacturerKey).sort()
  const b = (base.manufacturers ?? []).map(manufacturerKey).sort()
  if (a.length !== b.length) return true
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return true
  }
  return false
})

function emitUpdate(updates: Partial<BomLine>) {
  if (props.locked) return
  if (!props.line) return
  emit('updateLine', props.line.id, updates)
}

type FieldKey = 'description' | 'comment' | 'package' | 'references' | 'customerItemNo' | 'quantity'
function isFieldChanged(key: FieldKey): boolean {
  const line = props.line
  const base = baselineLine.value
  if (!line) return false
  if (!base) return true
  switch (key) {
    case 'description': return String(line.description ?? '').trim() !== String(base.description ?? '').trim()
    case 'comment': return String(line.comment ?? '').trim() !== String(base.comment ?? '').trim()
    case 'package': return String(line.package ?? '').trim() !== String(base.package ?? '').trim()
    case 'references': return refsKey(line.references) !== refsKey(base.references)
    case 'customerItemNo': return String(line.customerItemNo ?? '').trim() !== String(base.customerItemNo ?? '').trim()
    case 'quantity': return Number(line.quantity ?? 0) !== Number(base.quantity ?? 0)
  }
}
function fieldClass(key: FieldKey) {
  return isFieldChanged(key) ? editedCardClass : ''
}
function fieldInputUi(key: FieldKey) {
  return isFieldChanged(key) ? editedInputUi : undefined
}

const editedCardClass = 'border-amber-300/70 dark:border-amber-700/40 bg-amber-50/30 dark:bg-amber-900/10'
const editedInputUi = { base: 'ring-amber-300/70 dark:ring-amber-700/40 bg-amber-50/30 dark:bg-amber-900/10' }
const editedBadgeClass = 'border-yellow-300/70 dark:border-yellow-700/50 text-yellow-700 dark:text-yellow-300 bg-yellow-50/70 dark:bg-yellow-900/20'

const baselineManufacturerKeys = computed(() => {
  const base = baselineLine.value
  if (!base) return new Set<string>()
  return new Set((base.manufacturers ?? []).map(manufacturerKey))
})

function isManufacturerNew(mfr: BomManufacturer): boolean {
  if (!baselineLine.value) return true
  return !baselineManufacturerKeys.value.has(manufacturerKey(mfr))
}

const manufacturersClass = computed(() => {
  return ''
})

// Queue helpers
function getQueueStatus(partNumber: string): PricingQueueItem['status'] | null {
  const item = props.pricingQueue.find(i => i.partNumber === partNumber)
  return item?.status ?? null
}

const hasAnyMpn = computed(() => {
  const line = props.line
  if (!line) return false
  return line.manufacturers.some(m => !!m.manufacturerPart)
})

const isFetchingAnyForLine = computed(() => {
  const line = props.line
  if (!line) return false
  return line.manufacturers.some(m => m.manufacturerPart && getQueueStatus(m.manufacturerPart) === 'fetching')
})

function refreshAllForLine() {
  if (props.locked || !props.line) return
  for (const mfr of props.line.manufacturers) {
    if (mfr.manufacturerPart) {
      emit('fetchSinglePricing', mfr.manufacturerPart)
    }
  }
}

// Pricing helpers (copied from BomPanel)
interface SupplierOffer {
  supplier: string
  country: string
  stock: number
  moq: number
  breakQty: number
  leadtime: number | null
  unitPrice: number
  currency: string
  lineValue: number
}

interface DisplayOffer {
  unitPrice: number
  lineValue: number
  currency: string
}

interface PriceBreak {
  quantity?: number
  price?: number
  currency?: string
}

function pickTierPrice(pricebreaks: PriceBreak[], totalQty: number): { price: number; currency: string; quantity: number } | null {
  if (!pricebreaks || pricebreaks.length === 0) return null
  const eligible = pricebreaks
    .map(tier => ({
      quantity: Number(tier.quantity),
      price: Number(tier.price),
      currency: tier.currency || 'EUR',
    }))
    .filter(tier =>
      Number.isFinite(tier.quantity)
      && tier.quantity > 0
      && tier.quantity <= totalQty
      && Number.isFinite(tier.price)
      && tier.price >= 0,
    )
  if (!eligible.length) return null
  const best = eligible.sort((a, b) => a.quantity - b.quantity)[eligible.length - 1]
  return { price: best.price, currency: best.currency, quantity: best.quantity }
}

function conversionRate(from: string, to: string): number | null {
  const snapshot = props.exchangeRate
  if (!snapshot) return null
  const source = normalizeCurrencyCode(snapshot.sourceCurrency)
  const target = normalizeCurrencyCode(snapshot.targetCurrency)
  if (!source || !target) return null
  const rate = Number(snapshot.rate)
  if (!Number.isFinite(rate) || rate <= 0) return null
  if (source === from && target === to) return rate
  if (source === to && target === from) return 1 / rate
  return null
}

function convertAmount(value: number, fromCurrency: string, toCurrency: 'USD' | 'EUR'): number | null {
  if (!Number.isFinite(value)) return null
  const from = normalizeCurrencyCode(fromCurrency)
  const to = toCurrency.toUpperCase()
  if (!from) return null
  if (from === to) return value
  const rate = conversionRate(from, to)
  if (rate == null) return null
  return value * rate
}

function comparableUnitPrice(offer: SupplierOffer): number {
  const converted = convertAmount(offer.unitPrice, offer.currency, props.teamCurrency)
  return converted ?? offer.unitPrice
}

function getSupplierOffers(mpn: string, totalQty: number): SupplierOffer[] {
  const entry = props.pricingCache[mpn]
  if (!entry?.data) return []
  const results = entry.data?.results
  if (!Array.isArray(results) || results.length === 0) return []
  const candidates: SupplierOffer[] = []
  const seenSuppliers = new Set<string>()
  for (const r of results) {
    if (!r.pricebreaks || r.pricebreaks.length === 0) continue
    const moq = Math.max(0, Number(r.moq ?? 0) || 0)
    if (moq > totalQty) continue
    const tier = pickTierPrice(r.pricebreaks, totalQty)
    if (!tier) continue
    candidates.push({
      supplier: r.supplier || 'Unknown',
      country: r.country || '',
      stock: r.current_stock ?? 0,
      moq,
      breakQty: tier.quantity,
      leadtime: r.current_leadtime ?? null,
      unitPrice: tier.price,
      currency: tier.currency,
      lineValue: tier.price * totalQty,
    })
  }
  const offers: SupplierOffer[] = []
  for (const offer of candidates.sort((a, b) => comparableUnitPrice(a) - comparableUnitPrice(b))) {
    const key = offer.supplier
    if (seenSuppliers.has(key)) continue
    seenSuppliers.add(key)
    offers.push(offer)
  }
  return offers.sort((a, b) => comparableUnitPrice(a) - comparableUnitPrice(b))
}

function getDisplayOffer(offer: SupplierOffer): DisplayOffer {
  const unitPrice = convertAmount(offer.unitPrice, offer.currency, props.teamCurrency)
  const lineValue = convertAmount(offer.lineValue, offer.currency, props.teamCurrency)
  if (unitPrice == null || lineValue == null) {
    return { unitPrice: offer.unitPrice, lineValue: offer.lineValue, currency: offer.currency }
  }
  return { unitPrice, lineValue, currency: props.teamCurrency }
}

function formatAge(ts: any): string {
  try {
    const t = typeof ts === 'string' ? Date.parse(ts) : Number(ts)
    if (!Number.isFinite(t)) return ''
    const s = Math.max(0, (Date.now() - t) / 1000)
    if (s < 60) return `${Math.round(s)}s`
    if (s < 3600) return `${Math.round(s / 60)}m`
    return `${Math.round(s / 3600)}h`
  } catch {
    return ''
  }
}

// References editor
const refList = computed(() => {
  const line = props.line
  if (!line) return []
  return parseRefs(line.references).map(r => r.toUpperCase())
})

function setRefs(next: string[]) {
  const uniq = Array.from(new Set(next.map(r => r.trim()).filter(Boolean)))
  emitUpdate({ references: uniq.join(', ') })
}

function removeRef(ref: string) {
  if (props.locked) return
  setRefs(refList.value.filter(r => r !== ref))
}

const refInput = ref('')
const refInputEl = ref<{ inputRef?: { focus?: () => void } } | null>(null)

function focusRefInput() {
  if (props.locked) return
  refInputEl.value?.inputRef?.focus?.()
}

function commitRefInput() {
  if (props.locked) return
  const next = parseRefs(refInput.value).map(r => r.toUpperCase())
  if (next.length > 0) setRefs([...refList.value, ...next])
  refInput.value = ''
}

function onRefInputKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ',' || event.key === ' ' || event.key === 'Tab') {
    event.preventDefault()
    commitRefInput()
  }
}

function handleRefPaste(event: ClipboardEvent) {
  if (props.locked) return
  const text = event.clipboardData?.getData('text/plain') ?? ''
  if (!text) return
  const next = parseRefs(text).map(r => r.toUpperCase())
  if (next.length === 0) return
  event.preventDefault()
  setRefs([...refList.value, ...next])
  refInput.value = ''
}

function updateManufacturer(index: number, updates: Partial<BomManufacturer>) {
  if (props.locked) return
  const line = props.line
  if (!line) return
  const next = [...(line.manufacturers ?? [])]
  const current = next[index]
  if (!current) return
  next[index] = {
    manufacturer: updates.manufacturer ?? current.manufacturer,
    manufacturerPart: updates.manufacturerPart ?? current.manufacturerPart,
  }
  emitUpdate({ manufacturers: next })
}

// Inline add manufacturer
const inlineAddOpen = ref(false)
const inlineAddMfr = ref('')
const inlineAddMpn = ref('')

function cancelInlineAdd() {
  inlineAddOpen.value = false
  inlineAddMfr.value = ''
  inlineAddMpn.value = ''
}

function confirmInlineAdd() {
  if (props.locked) return
  const line = props.line
  if (!line) return
  const mfr = inlineAddMfr.value.trim()
  const mpn = inlineAddMpn.value.trim()
  if (!mfr && !mpn) return
  emit('addManufacturer', line.id, { manufacturer: mfr, manufacturerPart: mpn })
  cancelInlineAdd()
}
</script>

