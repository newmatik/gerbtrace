<template>
  <div class="space-y-4">
    <fieldset class="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <legend class="px-1 text-xs font-semibold text-primary/80">Source Attribution</legend>

      <template v-if="hasVisibleAttributionData">
        <p v-if="provenance?.sourceFootprint" class="text-xs text-neutral-700 dark:text-neutral-300">
          <strong>Original footprint:</strong> {{ provenance.sourceFootprint }}
        </p>
        <p v-if="provenance?.sourceFile" class="text-xs text-neutral-700 dark:text-neutral-300 break-all">
          <strong>Source file:</strong> {{ provenance.sourceFile }}
        </p>
        <p v-if="provenance?.sourceLibrary" class="text-xs text-neutral-700 dark:text-neutral-300">
          <strong>Source library:</strong> {{ provenance.sourceLibrary }}
        </p>
        <p v-if="provenance?.sourceType" class="text-xs text-neutral-700 dark:text-neutral-300">
          <strong>Source type:</strong> {{ provenance.sourceType }}
        </p>
        <p v-if="provenance?.owner" class="text-xs text-neutral-700 dark:text-neutral-300">
          <strong>Imported by:</strong> {{ provenance.owner }}
        </p>
        <p
          v-if="libraryAttribution?.upstreamOwner || libraryAttribution?.upstreamRepo"
          class="text-xs text-neutral-700 dark:text-neutral-300"
        >
          <strong>Upstream:</strong> {{ libraryAttribution?.upstreamOwner }}/{{ libraryAttribution?.upstreamRepo }}
        </p>
        <a
          v-if="libraryAttribution?.upstreamUrl"
          :href="libraryAttribution.upstreamUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex text-xs text-primary-600 dark:text-primary-400 underline"
        >
          Open upstream library
        </a>
        <p v-if="libraryAttribution?.notice" class="text-[11px] text-neutral-500 dark:text-neutral-400">
          {{ libraryAttribution.notice }}
        </p>
      </template>

      <p v-else class="text-xs text-neutral-500 dark:text-neutral-400">
        No attribution metadata available for this package.
      </p>
    </fieldset>
  </div>
</template>

<script setup lang="ts">
interface PackageProvenanceInfo {
  owner?: string
  sourceLibrary?: string
  sourceType?: string
  sourceFile?: string
  sourceFootprint?: string
}

interface PackageLibraryAttribution {
  upstreamOwner?: string
  upstreamRepo?: string
  upstreamUrl?: string
  notice?: string
}

const props = defineProps<{
  provenance?: PackageProvenanceInfo
  libraryAttribution?: PackageLibraryAttribution
}>()

const hasVisibleAttributionData = computed(() => {
  return Boolean(
    props.provenance?.sourceFootprint
    || props.provenance?.sourceFile
    || props.provenance?.sourceLibrary
    || props.provenance?.sourceType
    || props.provenance?.owner
    || props.libraryAttribution?.upstreamOwner
    || props.libraryAttribution?.upstreamRepo
    || props.libraryAttribution?.upstreamUrl
    || props.libraryAttribution?.notice,
  )
})
</script>
