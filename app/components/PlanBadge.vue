<script setup lang="ts">
import type { TeamPlan } from '~/composables/useTeam'

const props = defineProps<{ plan: TeamPlan; size?: 'sm' | 'md' }>()

const config = computed(() => {
  const map: Record<TeamPlan, { label: string; color: 'neutral' | 'primary' | 'success' | 'warning' }> = {
    free: { label: 'Free', color: 'neutral' },
    pro: { label: 'Pro', color: 'primary' },
    team: { label: 'Team', color: 'success' },
    enterprise: { label: 'Enterprise', color: 'warning' },
  }
  return map[props.plan]
})
</script>

<template>
  <UBadge
    :label="config.label"
    :color="config.color"
    variant="subtle"
    :size="size ?? 'sm'"
  />
</template>
