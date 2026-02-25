<script setup lang="ts">
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
        <p class="lead">Last updated: February 21, 2026</p>

        <p>
          These terms govern your use of <a href="https://www.gerbtrace.com">gerbtrace.com</a> and the Gerbtrace desktop
          application (together, the "Service"), operated by <strong>Newmatik</strong> ("we", "us", "our").
          By using the Service you agree to these terms.
        </p>

        <h2>1. Accounts</h2>
        <p>
          You may use the Gerber viewer and compare tools without an account. Some features — including team collaboration,
          AI enrichment, and part search — require a registered account. You are responsible for keeping your login credentials secure.
        </p>

        <h2>2. Free and paid plans</h2>
        <p>
          The Service offers a free tier and paid plans (Pro, Team, Enterprise). Plan features and pricing are described on
          the <NuxtLink to="/pricing">Pricing</NuxtLink> page and may change with reasonable notice. Paid subscriptions are billed
          monthly via Stripe. You may cancel at any time; access continues until the end of the billing period.
        </p>

        <h2>3. Your data</h2>
        <p>
          You retain all rights to the design files, BOMs, and other data you upload. We do not claim ownership of your content.
          We access your data only to provide the Service and as described in our <NuxtLink to="/privacy">Privacy Policy</NuxtLink>.
        </p>

        <h2>4. Acceptable use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Use the Service for any unlawful purpose.</li>
          <li>Attempt to gain unauthorized access to other users' accounts or data.</li>
          <li>Reverse-engineer, decompile, or scrape the Service beyond what the applicable license allows.</li>
          <li>Resell access to the Service without our written permission.</li>
          <li>Upload malicious files or attempt to compromise the Service's infrastructure.</li>
        </ul>

        <h2>5. Intellectual property</h2>
        <p>
          The Gerbtrace name, logo, and branding are the property of Newmatik. The Gerbtrace source code is
          available under the Business Source License 1.1 (BUSL-1.1) as described on our
          <NuxtLink to="/licensing">Licensing</NuxtLink> page.
          The Service itself (hosted platform, API, and proprietary features) remains our property.
        </p>

        <h2>6. Availability and warranties</h2>
        <p>
          The Service is provided "as is" without warranty of any kind. We strive for high availability but do not guarantee
          uninterrupted access. We are not liable for data loss — you are responsible for maintaining your own backups of design files.
        </p>

        <h2>7. Limitation of liability</h2>
        <p>
          To the maximum extent permitted by law, Newmatik shall not be liable for any indirect, incidental, special,
          consequential, or punitive damages arising from your use of the Service. Our total liability for any claim
          shall not exceed the amount you paid us in the twelve months preceding the claim.
        </p>

        <h2>8. Termination</h2>
        <p>
          You may delete your account at any time. We may suspend or terminate accounts that violate these terms.
          Upon termination, your data will be deleted in accordance with our <NuxtLink to="/privacy">Privacy Policy</NuxtLink>.
        </p>

        <h2>9. Changes to these terms</h2>
        <p>
          We may update these terms from time to time. Material changes will be communicated via email or an in-app notice
          at least 14 days before they take effect. Continued use of the Service after changes constitutes acceptance.
        </p>

        <h2>10. Governing law</h2>
        <p>
          These terms are governed by the laws of Germany. Any disputes shall be resolved in the courts of Germany.
        </p>

        <h2>11. Contact</h2>
        <p>
          Questions about these terms? Contact us at
          <a href="mailto:software@newmatik.com">software@newmatik.com</a>.
        </p>
      </article>
    </main>

    <MarketingFooter />
  </div>
</template>
