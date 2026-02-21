<template>
  <UModal v-model:open="open">
    <template #content>
      <div class="p-6 space-y-5">
        <div class="flex items-center justify-between">
          <h3 class="text-base font-semibold text-neutral-900 dark:text-white">
            Upgrade to {{ targetPlan }}
          </h3>
          <UButton
            size="xs"
            variant="ghost"
            color="neutral"
            icon="i-lucide-x"
            @click="open = false"
          />
        </div>

        <div class="space-y-3">
          <p class="text-sm text-[var(--ui-text-dimmed)]">
            <span class="font-medium text-[var(--ui-text)]">{{ feature }}</span>
            is available on the {{ targetPlan }} plan{{ isHigherTier ? ' and above' : '' }}.
          </p>

          <div class="rounded-lg border border-[var(--ui-border)] p-4 space-y-2">
            <div class="flex items-baseline justify-between">
              <span class="text-sm font-semibold">{{ targetPlan }}</span>
              <span class="text-lg font-bold">
                ${{ targetPlan === 'Pro' ? '25' : '149' }}<span class="text-xs font-normal text-[var(--ui-text-dimmed)]">/mo</span>
              </span>
            </div>
            <ul class="space-y-1.5">
              <li v-for="h in highlights" :key="h" class="flex items-center gap-2 text-xs text-[var(--ui-text-dimmed)]">
                <UIcon name="i-lucide-check" class="text-green-500 shrink-0" />
                {{ h }}
              </li>
            </ul>
          </div>
        </div>

        <div class="flex items-center gap-2 justify-end">
          <UButton
            variant="ghost"
            color="neutral"
            size="sm"
            to="/pricing"
            @click="open = false"
          >
            View all plans
          </UButton>
          <UButton
            :color="targetPlan === 'Pro' ? 'primary' : 'success'"
            size="sm"
            :to="upgradeTo"
            @click="open = false"
          >
            {{ isAuthenticated ? `Upgrade to ${targetPlan}` : 'Get started' }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
const props = defineProps<{
  feature: string
  plan?: 'Pro' | 'Team'
}>()

const open = defineModel<boolean>('open', { default: false })

const { isAuthenticated } = useAuth()
const { suggestedUpgrade } = useTeamPlan()

const targetPlan = computed(() => props.plan ?? suggestedUpgrade.value ?? 'Pro')
const isHigherTier = computed(() => targetPlan.value === 'Pro')

const upgradeTo = computed(() =>
  isAuthenticated.value ? '/team/settings?section=billing' : '/auth/register',
)

const PRO_HIGHLIGHTS = [
  '15 team members',
  'Unlimited projects',
  'Spark AI (bring your own key)',
  '1,000 Elexess price searches/month',
]

const TEAM_HIGHLIGHTS = [
  '100 team members',
  'Unlimited projects & Spaces',
  '10,000 Elexess price searches/month',
  'Guest role for external collaborators',
  'Priority support',
]

const highlights = computed(() =>
  targetPlan.value === 'Team' ? TEAM_HIGHLIGHTS : PRO_HIGHLIGHTS,
)
</script>
