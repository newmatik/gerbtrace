<script setup lang="ts">
import { CURRENT_LEGAL_VERSIONS } from '~/utils/legalVersions'

definePageMeta({
  alias: ['/de/datenschutz'],
})

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
        <p class="lead">Last updated: {{ CURRENT_LEGAL_VERSIONS.privacy }}</p>

        <h2>1. Data Controller</h2>
        <p>
          The controller responsible for data processing on this website is:
        </p>
        <p>
          <strong>Newmatik GmbH</strong><br>
          Am Markt 1<br>
          55619 Hennweiler, Germany<br>
          Email: <a href="mailto:software@newmatik.com">software@newmatik.com</a><br>
          Phone: <a href="tel:+4967521699800">+49 6752 16998-0</a>
        </p>
        <p>
          This policy explains what data we collect when you use
          <a href="https://www.gerbtrace.com">gerbtrace.com</a> and the Gerbtrace desktop application
          (together, the "Service"), and how we handle it.
        </p>

        <h2>2. Legal Basis for Processing</h2>
        <p>We process personal data on the following legal bases under Art. 6 GDPR:</p>
        <ul>
          <li><strong>Contract performance (Art. 6(1)(b))</strong> — account creation, project storage, payment processing, AI-powered BOM enrichment, component pricing lookups, and transactional emails necessary to provide the Service.</li>
          <li><strong>Consent (Art. 6(1)(a))</strong> — where you explicitly agree, such as accepting these terms during registration.</li>
          <li><strong>Legitimate interest (Art. 6(1)(f))</strong> — error monitoring, performance analysis, and security measures to maintain and improve the Service. Our legitimate interest is ensuring the reliability and security of the platform.</li>
        </ul>

        <h2>3. Data We Collect</h2>

        <h3>3.1 Account Data</h3>
        <p>
          When you create an account we store your email address, display name, and avatar (if provided).
          Authentication is handled by <a href="https://supabase.com" target="_blank" rel="noopener">Supabase</a>.
          If you sign in via a third-party provider (Microsoft, GitHub) we receive only the profile fields you authorize
          (typically name, email, and avatar).
        </p>

        <h3>3.2 Project Data</h3>
        <p>
          Gerber files, BOMs, pick-and-place files, and other design data you upload are stored in your browser's
          local storage (IndexedDB) for free-tier users or in our cloud database (Supabase Storage, EU region
          <code>eu-central-1</code>) for team features. We do not access, analyze, or share your design files
          for any purpose other than providing the Service to you.
        </p>

        <h3>3.3 Payment Data</h3>
        <p>
          Payments are processed by <a href="https://stripe.com" target="_blank" rel="noopener">Stripe</a>.
          We never see or store your full credit card number. We store only your Stripe customer ID and subscription
          status. Stripe's privacy policy applies to payment processing.
        </p>

        <h3>3.4 Consent Records</h3>
        <p>
          When you accept our Terms of Service and Privacy Policy, we record your consent including the version
          accepted, timestamp, IP address, and user agent. This data is retained for legal compliance purposes.
        </p>

        <h2>4. AI Processing (Spark AI)</h2>
        <p>
          Gerbtrace offers an optional AI-powered BOM enrichment feature called "Spark AI." When you explicitly
          trigger an AI enrichment run, the following <strong>non-personal</strong> data is sent to
          <a href="https://www.anthropic.com" target="_blank" rel="noopener">Anthropic</a> (Claude):
        </p>
        <ul>
          <li>BOM component data: descriptions, component types, packages, quantities, manufacturer part numbers</li>
          <li>Pick-and-place component data: designators, values, packages (up to 1,000 components)</li>
        </ul>
        <p>
          No personally identifiable information is sent to the AI provider. Each AI run is explicitly triggered
          by the user. Data is processed in the United States. Legal basis: contract performance (Art. 6(1)(b)).
          Anthropic's data processing practices are governed by their privacy policy.
        </p>

        <h2>5. Error Monitoring (Sentry)</h2>
        <p>
          We use <a href="https://sentry.io" target="_blank" rel="noopener">Sentry</a> for error monitoring
          and performance analysis:
        </p>
        <ul>
          <li><strong>Error reports</strong> — stack traces, browser type, operating system, and error context. Sampled at 20%.</li>
          <li><strong>Session replay</strong> — anonymized recordings of user sessions to help diagnose errors. All text is masked (<code>maskAllText</code>) and all media is blocked (<code>blockAllMedia</code>). Sampled at 10% generally and 100% when an error occurs.</li>
          <li><strong>Performance traces</strong> — page load and navigation timings. Sampled at 20%.</li>
        </ul>
        <p>
          No personally identifiable information is included in error reports unless you voluntarily submit a
          bug report with your email address. Data is processed in the United States. Legal basis: legitimate
          interest (Art. 6(1)(f)).
        </p>

        <h2>6. Component Pricing (Elexess)</h2>
        <p>
          When you use the BOM pricing feature, manufacturer part numbers from your BOM are sent to the
          Elexess API to retrieve component pricing and availability data. No personal data is transmitted.
          Legal basis: contract performance (Art. 6(1)(b)).
        </p>

        <h2>7. Telemetry</h2>
        <p>
          On non-production domains only, we collect basic telemetry: hostname, page path, referrer, and IP
          address. This data is stored in our database and used to understand usage patterns. It is not
          collected on <code>gerbtrace.com</code>, <code>localhost</code>, or <code>newmatik.com</code> subdomains.
          Legal basis: legitimate interest (Art. 6(1)(f)).
        </p>

        <h2>8. Email Delivery</h2>
        <p>
          Transactional emails (account confirmation, password reset, team invitations) are delivered via
          <a href="https://resend.com" target="_blank" rel="noopener">Resend</a>. Your email address is
          shared with Resend solely for the purpose of delivering these emails. Legal basis: contract performance
          (Art. 6(1)(b)).
        </p>

        <h2>9. How We Use Your Data</h2>
        <ul>
          <li>To provide, maintain, and improve the Service.</li>
          <li>To authenticate you and manage your account and team.</li>
          <li>To process payments for Pro and Team plans.</li>
          <li>To send transactional emails (account confirmation, password reset, team invitations).</li>
          <li>To provide AI-powered BOM enrichment when you request it.</li>
          <li>To look up component pricing and availability when you request it.</li>
          <li>To diagnose and fix technical problems.</li>
        </ul>
        <p>We do <strong>not</strong> sell, rent, or share your personal data with third parties for marketing purposes.</p>

        <h2>10. Cookies and Local Storage</h2>
        <p>We use the following client-side storage mechanisms:</p>
        <ul>
          <li><strong>Essential cookies</strong> — Supabase authentication session cookies. Required for the Service to function.</li>
          <li><strong>localStorage</strong> — team selection, viewer preferences, application settings, sidebar layout, cookie consent preference.</li>
          <li><strong>sessionStorage</strong> — telemetry deduplication flag, consent flow state.</li>
          <li><strong>IndexedDB</strong> — local project data for free-tier users (Gerber files, BOMs, documents) via the Dexie.js library.</li>
        </ul>
        <p>We do not use advertising or tracking cookies.</p>

        <h2>11. Data Storage and Security</h2>
        <p>
          Account and team data are stored in Supabase Cloud (EU region, <code>eu-central-1</code>).
          All data is encrypted in transit (TLS) and at rest. We follow industry-standard security practices
          including role-based access control, row-level security policies, secret management, and regular
          dependency updates.
        </p>

        <h2>12. Sub-processors</h2>
        <p>We use the following third-party services to provide the Service:</p>
        <table>
          <thead>
            <tr>
              <th>Service</th>
              <th>Purpose</th>
              <th>Data Shared</th>
              <th>Location</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Supabase</td>
              <td>Authentication, database, file storage</td>
              <td>Account data, project data, files</td>
              <td>EU (eu-central-1)</td>
            </tr>
            <tr>
              <td>Stripe</td>
              <td>Payment processing</td>
              <td>Payment details, subscription status</td>
              <td>US</td>
            </tr>
            <tr>
              <td>Sentry</td>
              <td>Error monitoring, session replay</td>
              <td>Error reports, masked session recordings</td>
              <td>US</td>
            </tr>
            <tr>
              <td>Cloudflare</td>
              <td>Web hosting, CDN, DNS</td>
              <td>HTTP requests, IP addresses</td>
              <td>Global</td>
            </tr>
            <tr>
              <td>Anthropic</td>
              <td>AI BOM enrichment (Spark AI)</td>
              <td>BOM/PnP component data (no PII)</td>
              <td>US</td>
            </tr>
            <tr>
              <td>Elexess</td>
              <td>Component pricing lookup</td>
              <td>Manufacturer part numbers</td>
              <td>EU (Germany)</td>
            </tr>
            <tr>
              <td>Resend</td>
              <td>Transactional email delivery</td>
              <td>Email addresses, email content</td>
              <td>US</td>
            </tr>
            <tr>
              <td>GitHub</td>
              <td>OAuth authentication, desktop releases</td>
              <td>OAuth profile data</td>
              <td>US</td>
            </tr>
            <tr>
              <td>Microsoft</td>
              <td>OAuth authentication (Entra ID)</td>
              <td>OAuth profile data</td>
              <td>US</td>
            </tr>
          </tbody>
        </table>

        <h2>13. International Data Transfers</h2>
        <p>
          Some of our sub-processors are located in the United States. These transfers are safeguarded by
          the EU-US Data Privacy Framework and/or Standard Contractual Clauses (SCCs) as adopted by the
          European Commission. You can request copies of the relevant safeguards by contacting us.
        </p>

        <h2>14. Data Retention</h2>
        <ul>
          <li><strong>Account data</strong> — retained while your account is active. Deleted within 30 days of account deletion.</li>
          <li><strong>Project data</strong> — retained while the associated team and project exist.</li>
          <li><strong>Payment records</strong> — retained for 10 years as required by German tax law (§ 147 AO).</li>
          <li><strong>Consent records</strong> — retained for the duration of the business relationship plus 3 years (statute of limitations).</li>
          <li><strong>Error logs (Sentry)</strong> — retained for 90 days.</li>
          <li><strong>Telemetry data</strong> — retained indefinitely in anonymized form.</li>
        </ul>

        <h2>15. Your Rights</h2>
        <p>
          Under the General Data Protection Regulation (GDPR), you have the following rights:
        </p>
        <ul>
          <li><strong>Right of access</strong> (Art. 15) — obtain a copy of your personal data.</li>
          <li><strong>Right to rectification</strong> (Art. 16) — correct inaccurate personal data.</li>
          <li><strong>Right to erasure</strong> (Art. 17) — request deletion of your personal data.</li>
          <li><strong>Right to restriction</strong> (Art. 18) — restrict processing of your personal data.</li>
          <li><strong>Right to data portability</strong> (Art. 20) — receive your data in a structured, machine-readable format. You can export your data from your profile page.</li>
          <li><strong>Right to object</strong> (Art. 21) — object to processing based on legitimate interest.</li>
          <li><strong>Right to withdraw consent</strong> (Art. 7(3)) — withdraw consent at any time without affecting the lawfulness of prior processing.</li>
        </ul>
        <p>
          To exercise any of these rights, contact us at
          <a href="mailto:software@newmatik.com">software@newmatik.com</a>.
        </p>

        <h2>16. Right to Lodge a Complaint</h2>
        <p>
          You have the right to lodge a complaint with a supervisory authority. The competent authority for
          our registered office is:
        </p>
        <p>
          Der Landesbeauftragte für den Datenschutz und die Informationsfreiheit Rheinland-Pfalz<br>
          Postfach 30 40<br>
          55020 Mainz, Germany<br>
          <a href="https://www.datenschutz.rlp.de" target="_blank" rel="noopener noreferrer">www.datenschutz.rlp.de</a>
        </p>

        <h2>17. Changes to This Policy</h2>
        <p>
          We may update this policy from time to time. Significant changes will be communicated via email or an
          in-app notice. Where required, we will ask for your renewed consent. Continued use of the Service after
          changes constitutes acceptance.
        </p>

        <h2>18. Contact</h2>
        <p>
          For privacy-related questions, contact us at
          <a href="mailto:software@newmatik.com">software@newmatik.com</a>.
        </p>
      </article>
    </main>

    <MarketingFooter />
  </div>
</template>
