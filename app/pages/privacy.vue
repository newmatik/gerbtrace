<script setup lang="ts">
useHead({
  title: 'Privacy Policy — Gerbtrace',
  meta: [
    { name: 'description', content: 'Gerbtrace privacy policy. Learn how we collect, use, and protect your data.' },
    { property: 'og:title', content: 'Privacy Policy — Gerbtrace' },
    { property: 'og:description', content: 'Gerbtrace privacy policy. Learn how we collect, use, and protect your data.' },
  ],
})
</script>

<template>
  <div class="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
    <AppHeader marketing />

    <main class="flex-1 py-16 px-4">
      <article class="max-w-3xl mx-auto prose prose-neutral dark:prose-invert prose-sm">
        <h1>Privacy Policy</h1>
        <p class="lead">Last updated: February 21, 2026</p>

        <p>
          Gerbtrace is operated by <strong>Newmatik</strong> ("we", "us", "our").
          This policy explains what data we collect when you use <a href="https://www.gerbtrace.com">gerbtrace.com</a>
          and the Gerbtrace desktop application (together, the "Service"), and how we handle it.
        </p>

        <h2>1. Data we collect</h2>

        <h3>Account data</h3>
        <p>
          When you create an account we store your email address, display name, and avatar (if provided).
          Authentication is handled by <a href="https://supabase.com" target="_blank" rel="noopener">Supabase</a>;
          if you sign in via a third-party provider (Microsoft, GitHub) we receive only the profile fields you authorize.
        </p>

        <h3>Project data</h3>
        <p>
          Gerber files, BOMs, pick-and-place files, and other design data you upload are stored in your browser's local storage
          or, for team features, in our cloud database. We do not access, analyze, or share your design files for any purpose other
          than providing the Service to you.
        </p>

        <h3>Usage data</h3>
        <p>
          We collect anonymous usage analytics and error reports via <a href="https://sentry.io" target="_blank" rel="noopener">Sentry</a>
          to monitor performance and fix bugs. This includes page views, browser type, operating system, and error stack traces.
          No personally identifiable information is included in error reports.
        </p>

        <h3>Payment data</h3>
        <p>
          Payments are processed by <a href="https://stripe.com" target="_blank" rel="noopener">Stripe</a>.
          We never see or store your full credit card number. Stripe's privacy policy applies to payment processing.
        </p>

        <h2>2. How we use your data</h2>
        <ul>
          <li>To provide, maintain, and improve the Service.</li>
          <li>To authenticate you and manage your account and team.</li>
          <li>To process payments for Pro and Team plans.</li>
          <li>To send transactional emails (account confirmation, password reset, team invitations).</li>
          <li>To diagnose and fix technical problems.</li>
        </ul>
        <p>We do <strong>not</strong> sell, rent, or share your personal data with third parties for marketing purposes.</p>

        <h2>3. Data storage and security</h2>
        <p>
          Account and team data are stored in Supabase Cloud (EU region, <code>eu-central-1</code>).
          All data is encrypted in transit (TLS) and at rest. We follow industry-standard security practices
          including role-based access control, secret management, and regular dependency updates.
        </p>

        <h2>4. Data retention</h2>
        <p>
          We retain your account data for as long as your account is active. If you delete your account,
          we remove your personal data within 30 days. Anonymous usage analytics are retained indefinitely.
        </p>

        <h2>5. Your rights</h2>
        <p>
          Under applicable data protection law (including GDPR), you have the right to access, correct, delete,
          or export your personal data. To exercise these rights, contact us at
          <a href="mailto:software@newmatik.com">software@newmatik.com</a>.
        </p>

        <h2>6. Cookies</h2>
        <p>
          We use essential cookies for authentication sessions. We do not use advertising or tracking cookies.
        </p>

        <h2>7. Third-party services</h2>
        <ul>
          <li><strong>Supabase</strong> — authentication and database hosting</li>
          <li><strong>Stripe</strong> — payment processing</li>
          <li><strong>Sentry</strong> — error monitoring</li>
          <li><strong>Cloudflare</strong> — web hosting and CDN</li>
          <li><strong>GitHub</strong> — OAuth authentication and desktop release distribution</li>
        </ul>

        <h2>8. Changes to this policy</h2>
        <p>
          We may update this policy from time to time. Significant changes will be communicated via email or an in-app notice.
          Continued use of the Service after changes constitutes acceptance.
        </p>

        <h2>9. Contact</h2>
        <p>
          For privacy-related questions, contact us at
          <a href="mailto:software@newmatik.com">software@newmatik.com</a>.
        </p>
      </article>
    </main>

    <MarketingFooter />
  </div>
</template>
