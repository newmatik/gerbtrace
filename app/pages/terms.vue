<script setup lang="ts">
import { CURRENT_LEGAL_VERSIONS } from '~/utils/legalVersions'

definePageMeta({
  alias: ['/de/agb'],
})

useHead({
  title: 'Terms of Service — Gerbtrace',
  meta: [
    { name: 'description', content: 'Gerbtrace terms of service. Rules and conditions for using the Gerbtrace platform.' },
    { property: 'og:title', content: 'Terms of Service — Gerbtrace' },
    { property: 'og:description', content: 'Gerbtrace terms of service. Rules and conditions for using the Gerbtrace platform.' },
  ],
})
</script>

<template>
  <div class="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
    <AppHeader marketing />

    <main class="flex-1 py-16 px-4">
      <article class="max-w-3xl mx-auto prose prose-neutral dark:prose-invert prose-sm">
        <h1>Terms of Service</h1>
        <p class="lead">Last updated: {{ CURRENT_LEGAL_VERSIONS.terms }}</p>

        <h2>1. Scope and Provider</h2>
        <p>
          These General Terms and Conditions ("Terms") govern your use of
          <a href="https://www.gerbtrace.com">gerbtrace.com</a> and the Gerbtrace desktop application
          (together, the "Service"), operated by:
        </p>
        <p>
          <strong>Newmatik GmbH</strong><br>
          Am Markt 1, 55619 Hennweiler, Germany<br>
          Commercial Register: HRB 3460, Amtsgericht Bad Kreuznach<br>
          Email: <a href="mailto:software@newmatik.com">software@newmatik.com</a>
        </p>
        <p>
          By creating an account or using paid features of the Service, you agree to these Terms.
          Conflicting terms of the user are not recognized unless we expressly agree to them in writing.
        </p>

        <h2>2. Registration and Accounts</h2>
        <p>
          You may use the Gerber viewer and compare tools without an account. Features including team collaboration,
          AI enrichment, component pricing, and advanced project management require a registered account.
        </p>
        <ul>
          <li>You must be at least 16 years of age to create an account.</li>
          <li>You must provide accurate and complete registration information.</li>
          <li>You are responsible for keeping your login credentials secure and for all activity under your account.</li>
          <li>You must notify us immediately of any unauthorized use of your account.</li>
        </ul>

        <h2>3. Service Description</h2>
        <p>
          Gerbtrace is a PCB NPI (New Product Introduction) and manufacturing data preparation platform.
          The Service includes:
        </p>
        <ul>
          <li>Gerber and drill file viewing, comparison, and analysis</li>
          <li>BOM (Bill of Materials) management and enrichment</li>
          <li>Pick-and-place file visualization</li>
          <li>Panelization and paste configuration tools</li>
          <li>Team collaboration with role-based access</li>
          <li>AI-powered BOM enrichment (Spark AI)</li>
          <li>Component pricing and availability lookups</li>
        </ul>
        <p>
          Feature availability depends on your plan tier. We may modify, add, or remove features
          with reasonable notice.
        </p>

        <h2>4. AI Features (Spark AI)</h2>
        <p>
          The Service offers an optional AI-powered BOM enrichment feature ("Spark AI") that uses
          third-party AI technology provided by Anthropic (Claude). When you use Spark AI:
        </p>
        <ul>
          <li>BOM and pick-and-place component data (descriptions, packages, quantities, manufacturer part numbers) is sent to the AI provider for processing.</li>
          <li>AI output (suggested descriptions, classifications, manufacturers, groupings) is provided <strong>"as is"</strong> with no warranty on accuracy or completeness.</li>
          <li>You are solely responsible for reviewing and verifying all AI-generated suggestions before relying on them.</li>
          <li>AI usage is subject to your plan's monthly usage limits. Unused allowances do not carry over.</li>
        </ul>
        <p>
          No personally identifiable information is sent to the AI provider. See our
          <NuxtLink to="/privacy">Privacy Policy</NuxtLink> for details on data processing.
        </p>

        <h2>5. Free and Paid Plans</h2>
        <p>
          The Service offers a free tier and paid plans (Pro, Team, Enterprise). Plan features and pricing
          are described on the <NuxtLink to="/pricing">Pricing</NuxtLink> page and may change with reasonable notice.
        </p>
        <ul>
          <li>Paid subscriptions are billed monthly via <a href="https://stripe.com" target="_blank" rel="noopener">Stripe</a>.</li>
          <li>You may cancel your subscription at any time. Access to paid features continues until the end of the current billing period.</li>
          <li>We do not provide refunds for partial billing periods.</li>
          <li>If payment fails, your subscription may be downgraded to the free tier after a grace period.</li>
        </ul>

        <h2>6. Your Data and Intellectual Property</h2>
        <p>
          You retain all rights to the design files, BOMs, pick-and-place data, and other content you upload.
          We do not claim ownership of your content. We access your data only to provide the Service and as
          described in our <NuxtLink to="/privacy">Privacy Policy</NuxtLink>.
        </p>
        <p>
          You may export your personal data at any time from your profile page in accordance with
          Art. 20 GDPR (right to data portability).
        </p>

        <h2>7. Acceptable Use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Use the Service for any unlawful purpose.</li>
          <li>Attempt to gain unauthorized access to other users' accounts or data.</li>
          <li>Reverse-engineer, decompile, or scrape the Service beyond what applicable open-source licenses allow.</li>
          <li>Resell access to the Service without our written permission.</li>
          <li>Upload malicious files or attempt to compromise the Service's infrastructure.</li>
          <li>Use the Service in a manner that imposes an unreasonable load on our infrastructure.</li>
        </ul>

        <h2>8. Availability and Service Level</h2>
        <p>
          The Service is provided "as is" without warranty of any kind, express or implied. We strive for high
          availability but do not guarantee uninterrupted or error-free access. Planned maintenance will be
          announced in advance where practicable.
        </p>
        <p>
          We are not liable for data loss. You are responsible for maintaining your own backups of design files
          and other data you upload to the Service.
        </p>

        <h2>9. Limitation of Liability</h2>
        <p>
          To the maximum extent permitted by applicable law:
        </p>
        <ul>
          <li>Newmatik GmbH shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Service.</li>
          <li>Our total liability for any claim shall not exceed the amount you paid us in the twelve months preceding the claim.</li>
          <li>For free-tier users, our total liability is limited to EUR 100.</li>
        </ul>
        <p>
          These limitations do not apply to liability for intent (Vorsatz), gross negligence (grobe Fahrlässigkeit),
          injury to life, body, or health, or any other liability that cannot be excluded or limited under German law.
        </p>

        <h2>10. Intellectual Property</h2>
        <p>
          The Gerbtrace name, logo, and branding are the property of Newmatik GmbH. The Gerbtrace source code is
          available under the Business Source License 1.1 (BUSL-1.1) as described in the
          <a href="https://github.com/newmatik/gerbtrace" target="_blank" rel="noopener">project repository</a>.
          The Service itself (hosted platform, APIs, and proprietary features) remains our property.
        </p>

        <h2>11. Term and Termination</h2>
        <ul>
          <li>You may delete your account at any time from your profile page.</li>
          <li>We may suspend or terminate accounts that violate these Terms with immediate effect.</li>
          <li>Upon termination, your personal data will be deleted in accordance with our <NuxtLink to="/privacy">Privacy Policy</NuxtLink>.</li>
          <li>Active paid subscriptions will be cancelled upon account deletion. No refund is provided for the remaining billing period.</li>
        </ul>

        <h2>12. Data Processing</h2>
        <p>
          Our handling of personal data is described in the <NuxtLink to="/privacy">Privacy Policy</NuxtLink>.
          By using the Service, you acknowledge that you have read and understood the Privacy Policy.
        </p>
        <p>
          Team and Enterprise customers who require a formal Data Processing Agreement (DPA) under Art. 28 GDPR
          can review our standard DPA at <NuxtLink to="/dpa">gerbtrace.com/dpa</NuxtLink> or contact us at
          <a href="mailto:software@newmatik.com">software@newmatik.com</a>.
        </p>

        <h2>13. Changes to These Terms</h2>
        <p>
          We may update these Terms from time to time. Material changes will be communicated via email or an
          in-app notice at least 14 days before they take effect. Where required, we will ask for your renewed
          consent. Continued use of the Service after the notice period constitutes acceptance of the updated Terms.
        </p>

        <h2>14. Severability</h2>
        <p>
          If any provision of these Terms is held to be invalid or unenforceable, the remaining provisions shall
          remain in full force and effect. The invalid provision shall be replaced by a valid provision that most
          closely reflects the economic purpose of the original provision.
        </p>

        <h2>15. Governing Law and Jurisdiction</h2>
        <p>
          These Terms are governed by the laws of the Federal Republic of Germany, excluding the UN Convention on
          Contracts for the International Sale of Goods (CISG). For disputes with merchants (Kaufleute), legal
          entities under public law, or special funds under public law, the exclusive place of jurisdiction is
          Bad Kreuznach, Germany.
        </p>

        <h2>16. Contact</h2>
        <p>
          Questions about these Terms? Contact us at
          <a href="mailto:software@newmatik.com">software@newmatik.com</a>.
        </p>
      </article>
    </main>

    <MarketingFooter />
  </div>
</template>
