<script setup lang="ts">
import type { TeamPlan } from '~/composables/useTeam'

useHead({
  title: 'Pricing — Gerbtrace PCB NPI Platform',
  meta: [
    { name: 'description', content: 'Gerbtrace pricing plans. Free Gerber viewer for everyone. Pro and Team plans for BOM management, AI enrichment, part search, panelization, and team collaboration.' },
    { property: 'og:title', content: 'Pricing — Gerbtrace PCB NPI Platform' },
    { property: 'og:description', content: 'Free Gerber viewer for everyone. Pro and Team plans for manufacturing data preparation, AI BOM enrichment, and team collaboration.' },
    { property: 'og:image', content: 'https://www.gerbtrace.com/images/docs/pcb-light.png' },
  ],
})

const { isAuthenticated } = useAuth()
const { currentTeam } = useTeam()

const currentPlan = computed<TeamPlan>(() => currentTeam.value?.plan ?? 'free')

const PLAN_RANK: Record<string, number> = { free: 0, pro: 1, team: 2, enterprise: 3 }

function planCta(plan: TeamPlan) {
  if (!isAuthenticated.value) return plan === 'free' ? 'Get started' : `Upgrade to ${plan.charAt(0).toUpperCase() + plan.slice(1)}`
  if (currentPlan.value === plan) return 'Current plan'
  if (PLAN_RANK[currentPlan.value] > PLAN_RANK[plan]) return 'Current plan includes this'
  return `Upgrade to ${plan.charAt(0).toUpperCase() + plan.slice(1)}`
}

function planCtaDisabled(plan: TeamPlan) {
  if (!isAuthenticated.value) return false
  return PLAN_RANK[currentPlan.value] >= PLAN_RANK[plan]
}

function planCtaTo(plan: TeamPlan) {
  if (!isAuthenticated.value) return '/auth/register'
  if (PLAN_RANK[currentPlan.value] >= PLAN_RANK[plan]) return undefined
  return '/team/settings?section=billing'
}

const features = [
  { name: 'Gerber viewer & compare', free: true, pro: true, team: true },
  { name: 'BOM management', free: true, pro: true, team: true },
  { name: 'Pick & Place visualization', free: true, pro: true, team: true },
  { name: 'Conversations & approvals', free: true, pro: true, team: true },
  { name: 'Team members', free: 'Up to 5', pro: 'Up to 15', team: 'Up to 100' },
  { name: 'Projects', free: 'Up to 20', pro: 'Unlimited', team: 'Unlimited' },
  { name: 'Spaces', free: '1', pro: 'Up to 3', team: 'Unlimited' },
  { name: 'Spark AI', free: false, pro: '25 runs/month', team: '150 runs/month' },
  { name: 'Elexess Price Search', free: false, pro: '1,000/month', team: '10,000/month' },
  { name: 'Guest role', free: false, pro: false, team: true },
  { name: 'Priority support', free: false, pro: false, team: true },
]

const faqs = [
  {
    q: 'Do I need a credit card to get started?',
    a: 'No. The Free plan is completely free with no credit card required. You only need payment details when upgrading to Pro or Team.',
  },
  {
    q: 'What happens when I hit a usage limit?',
    a: 'You will see a prompt to upgrade. Your existing data and projects are never affected — you simply cannot perform the limited action until the next billing cycle or until you upgrade.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. You can downgrade or cancel your subscription at any time from Team Settings. Your plan remains active until the end of the current billing period.',
  },
  {
    q: 'What is Spark AI?',
    a: 'Spark AI is included with Pro and Team plans. Each run enriches your full BOM with AI-generated descriptions, component types, manufacturer suggestions, and group assignments.',
  },
  {
    q: 'What is Elexess Price Search?',
    a: 'Elexess Price Search fetches live distributor pricing and availability directly into your BOM. It is included with Pro and Team plans, with monthly search limits based on your plan.',
  },
  {
    q: 'Do you offer annual billing?',
    a: 'Not yet, but we are working on it. Currently all plans are billed monthly.',
  },
]

useSchemaOrg([
  defineWebPage({ '@type': 'FAQPage' }),
  ...faqs.map(faq => defineQuestion({
    name: faq.q,
    acceptedAnswer: faq.a,
  })),
])
</script>

<template>
  <div class="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
    <AppHeader marketing />

    <main class="flex-1 py-16 px-4">
      <div class="max-w-5xl mx-auto">
        <div class="text-center mb-12">
          <h1 class="text-3xl font-bold tracking-tight sm:text-4xl">
            Plans for every team
          </h1>
          <p class="mt-3 text-lg text-[var(--ui-text-dimmed)]">
            Start for free, upgrade as your team grows.
          </p>
        </div>

        <!-- Plan cards -->
        <div class="grid gap-6 lg:grid-cols-3 mb-16">
          <!-- Free -->
          <div class="rounded-xl border border-[var(--ui-border)] p-6 flex flex-col">
            <div class="mb-6">
              <h2 class="text-xl font-semibold">Free</h2>
              <p class="text-sm text-[var(--ui-text-dimmed)] mt-1">
                For open-source and small teams.
              </p>
              <div class="mt-4">
                <span class="text-3xl font-bold">$0</span>
                <span class="text-[var(--ui-text-dimmed)]">/month</span>
              </div>
              <p class="text-xs text-[var(--ui-text-dimmed)] mt-1">Free forever. No credit card required.</p>
            </div>
            <ul class="flex-1 space-y-2 text-sm mb-6">
              <li class="flex items-center gap-2">
                <UIcon name="i-lucide-check" class="text-[var(--ui-text-dimmed)] shrink-0" />
                5 team members
              </li>
              <li class="flex items-center gap-2">
                <UIcon name="i-lucide-check" class="text-[var(--ui-text-dimmed)] shrink-0" />
                20 projects
              </li>
              <li class="flex items-center gap-2">
                <UIcon name="i-lucide-check" class="text-[var(--ui-text-dimmed)] shrink-0" />
                1 Space
              </li>
              <li class="flex items-center gap-2">
                <UIcon name="i-lucide-check" class="text-[var(--ui-text-dimmed)] shrink-0" />
                Full viewer, BOM & PnP
              </li>
            </ul>
            <UButton
              :to="planCtaTo('free')"
              block
              variant="outline"
              size="lg"
              :disabled="planCtaDisabled('free')"
            >
              {{ planCta('free') }}
            </UButton>
          </div>

          <!-- Pro -->
          <div class="rounded-xl border-2 border-[var(--ui-primary)] p-6 flex flex-col relative">
            <UBadge label="Most Popular" color="primary" variant="solid" class="absolute -top-3 left-1/2 -translate-x-1/2" />
            <div class="mb-6">
              <h2 class="text-xl font-semibold">Pro</h2>
              <p class="text-sm text-[var(--ui-text-dimmed)] mt-1">
                For professional teams.
              </p>
              <div class="mt-4">
                <span class="text-3xl font-bold">$25</span>
                <span class="text-[var(--ui-text-dimmed)]">/month</span>
              </div>
            </div>
            <ul class="flex-1 space-y-2 text-sm mb-6">
              <li class="flex items-center gap-2">
                <UIcon name="i-lucide-check" class="text-[var(--ui-primary)] shrink-0" />
                15 team members
              </li>
              <li class="flex items-center gap-2">
                <UIcon name="i-lucide-check" class="text-[var(--ui-primary)] shrink-0" />
                Unlimited projects
              </li>
              <li class="flex items-center gap-2">
                <UIcon name="i-lucide-check" class="text-[var(--ui-primary)] shrink-0" />
                3 Spaces
              </li>
              <li class="flex items-center gap-2">
                <UIcon name="i-lucide-sparkles" class="text-[var(--ui-primary)] shrink-0" />
                Spark AI (25 runs/month)
              </li>
              <li class="flex items-center gap-2">
                <UIcon name="i-lucide-search" class="text-[var(--ui-primary)] shrink-0" />
                1,000 Elexess searches/month
              </li>
            </ul>
            <UButton
              :to="planCtaTo('pro')"
              block
              color="primary"
              size="lg"
              :disabled="planCtaDisabled('pro')"
            >
              {{ planCta('pro') }}
            </UButton>
          </div>

          <!-- Team -->
          <div class="rounded-xl border border-[var(--ui-border)] p-6 flex flex-col">
            <div class="mb-6">
              <h2 class="text-xl font-semibold">Team</h2>
              <p class="text-sm text-[var(--ui-text-dimmed)] mt-1">
                For larger organizations.
              </p>
              <div class="mt-4">
                <span class="text-3xl font-bold">$149</span>
                <span class="text-[var(--ui-text-dimmed)]">/month</span>
              </div>
            </div>
            <ul class="flex-1 space-y-2 text-sm mb-6">
              <li class="flex items-center gap-2">
                <UIcon name="i-lucide-check" class="text-green-500 shrink-0" />
                100 team members
              </li>
              <li class="flex items-center gap-2">
                <UIcon name="i-lucide-check" class="text-green-500 shrink-0" />
                Unlimited projects & Spaces
              </li>
              <li class="flex items-center gap-2">
                <UIcon name="i-lucide-sparkles" class="text-green-500 shrink-0" />
                Spark AI (150 runs/month)
              </li>
              <li class="flex items-center gap-2">
                <UIcon name="i-lucide-search" class="text-green-500 shrink-0" />
                10,000 Elexess searches/month
              </li>
              <li class="flex items-center gap-2">
                <UIcon name="i-lucide-user-plus" class="text-green-500 shrink-0" />
                Guest role for external collaborators
              </li>
              <li class="flex items-center gap-2">
                <UIcon name="i-lucide-headset" class="text-green-500 shrink-0" />
                Priority support
              </li>
            </ul>
            <UButton
              :to="planCtaTo('team')"
              block
              :variant="planCtaDisabled('team') ? 'outline' : 'solid'"
              :color="planCtaDisabled('team') ? 'neutral' : 'success'"
              size="lg"
              :disabled="planCtaDisabled('team')"
            >
              {{ planCta('team') }}
            </UButton>
          </div>
        </div>

        <!-- Feature comparison table -->
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-[var(--ui-border)]">
                <th class="text-left py-3 pr-4 font-medium">Feature</th>
                <th class="text-center py-3 px-4 font-medium">Free</th>
                <th class="text-center py-3 px-4 font-medium">Pro</th>
                <th class="text-center py-3 px-4 font-medium">Team</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="feature in features"
                :key="feature.name"
                class="border-b border-[var(--ui-border)]"
              >
                <td class="py-3 pr-4">{{ feature.name }}</td>
                <td class="text-center py-3 px-4">
                  <template v-if="feature.free === true">
                    <UIcon name="i-lucide-check" class="text-green-500" />
                  </template>
                  <template v-else-if="feature.free === false">
                    <UIcon name="i-lucide-minus" class="text-[var(--ui-text-dimmed)]" />
                  </template>
                  <template v-else>{{ feature.free }}</template>
                </td>
                <td class="text-center py-3 px-4">
                  <template v-if="feature.pro === true">
                    <UIcon name="i-lucide-check" class="text-green-500" />
                  </template>
                  <template v-else-if="feature.pro === false">
                    <UIcon name="i-lucide-minus" class="text-[var(--ui-text-dimmed)]" />
                  </template>
                  <template v-else>{{ feature.pro }}</template>
                </td>
                <td class="text-center py-3 px-4">
                  <template v-if="feature.team === true">
                    <UIcon name="i-lucide-check" class="text-green-500" />
                  </template>
                  <template v-else-if="feature.team === false">
                    <UIcon name="i-lucide-minus" class="text-[var(--ui-text-dimmed)]" />
                  </template>
                  <template v-else>{{ feature.team }}</template>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Enterprise callout -->
        <div class="mt-12 text-center rounded-xl border border-[var(--ui-border)] p-8">
          <h3 class="text-lg font-semibold">Enterprise</h3>
          <p class="mt-2 text-[var(--ui-text-dimmed)]">
            Need unlimited members, SSO, SLAs, or custom billing? Get in touch for a tailored plan.
          </p>
          <UButton
            to="mailto:software@newmatik.com?subject=Enterprise%20Plan"
            variant="outline"
            class="mt-4"
          >
            Contact us
          </UButton>
        </div>

        <!-- FAQ -->
        <div class="mt-16 max-w-3xl mx-auto">
          <h2 class="text-2xl font-bold text-center mb-8">Frequently asked questions</h2>
          <div class="divide-y divide-[var(--ui-border)]">
            <div v-for="faq in faqs" :key="faq.q" class="py-5">
              <h3 class="text-sm font-semibold">{{ faq.q }}</h3>
              <p class="mt-2 text-sm text-[var(--ui-text-dimmed)] leading-relaxed">{{ faq.a }}</p>
            </div>
          </div>
        </div>
      </div>
    </main>

    <MarketingFooter />
  </div>
</template>
