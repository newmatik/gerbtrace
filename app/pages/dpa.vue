<script setup lang="ts">
import { CURRENT_LEGAL_VERSIONS } from '~/utils/legalVersions'

definePageMeta({
  alias: ['/de/avv'],
})

useHead({
  title: 'Data Processing Agreement — Gerbtrace',
  meta: [
    { name: 'description', content: 'Gerbtrace Data Processing Agreement (DPA) for team and enterprise customers under GDPR Art. 28.' },
    { property: 'og:title', content: 'Data Processing Agreement — Gerbtrace' },
    { property: 'og:description', content: 'Standard Data Processing Agreement for Gerbtrace customers who process personal data through the platform.' },
  ],
})
</script>

<template>
  <div class="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
    <AppHeader marketing />

    <main class="flex-1 py-16 px-4">
      <article class="max-w-3xl mx-auto prose prose-neutral dark:prose-invert prose-sm">
        <h1>Data Processing Agreement</h1>
        <p class="lead">Last updated: {{ CURRENT_LEGAL_VERSIONS.privacy }}</p>

        <p>
          This Data Processing Agreement ("DPA") supplements the
          <NuxtLink to="/terms">Terms of Service</NuxtLink> between the customer ("Controller")
          and <strong>Newmatik GmbH</strong>, Am Markt 1, 55619 Hennweiler, Germany ("Processor")
          and governs the processing of personal data by the Processor on behalf of the Controller
          in accordance with Art. 28 GDPR.
        </p>

        <h2>1. Subject Matter and Duration</h2>
        <p>
          The Processor provides the Gerbtrace platform (the "Service") to the Controller. In the course
          of providing the Service, the Processor processes personal data on behalf of the Controller.
          This DPA applies for the duration of the service agreement between the parties.
        </p>

        <h2>2. Nature and Purpose of Processing</h2>
        <p>
          The Processor processes personal data to provide the Controller with:
        </p>
        <ul>
          <li>Cloud storage and management of PCB design data, BOMs, and pick-and-place files</li>
          <li>Team collaboration features including project management and conversations</li>
          <li>AI-powered BOM enrichment (Spark AI) when triggered by the Controller's users</li>
          <li>Component pricing and availability lookups</li>
          <li>User authentication and access management</li>
        </ul>

        <h2>3. Types of Personal Data</h2>
        <p>The following categories of personal data may be processed:</p>
        <ul>
          <li>Names and email addresses of the Controller's team members</li>
          <li>User profile data (display name, avatar)</li>
          <li>Team membership and role assignments</li>
          <li>Project metadata and collaboration data (conversations, comments, mentions)</li>
          <li>Usage data and consent records</li>
        </ul>

        <h2>4. Categories of Data Subjects</h2>
        <ul>
          <li>The Controller's employees and contractors who use the Service</li>
          <li>External collaborators invited to the Controller's teams or spaces</li>
        </ul>

        <h2>5. Controller Obligations</h2>
        <p>The Controller shall:</p>
        <ul>
          <li>Ensure that the processing of personal data through the Service is lawful under applicable data protection law.</li>
          <li>Provide documented instructions to the Processor regarding the processing of personal data.</li>
          <li>Inform the Processor without undue delay if instructions may violate applicable data protection law.</li>
        </ul>

        <h2>6. Processor Obligations</h2>
        <p>The Processor shall:</p>
        <ul>
          <li>Process personal data only on documented instructions from the Controller, unless required by EU or member state law.</li>
          <li>Ensure that persons authorized to process personal data are bound by confidentiality obligations.</li>
          <li>Implement appropriate technical and organizational measures to ensure a level of security appropriate to the risk, including encryption in transit (TLS) and at rest, role-based access control, and row-level security policies.</li>
          <li>Not engage another processor without prior specific or general written authorization of the Controller. The current list of sub-processors is provided in section 7.</li>
          <li>Assist the Controller in fulfilling data subject requests under Art. 15–22 GDPR.</li>
          <li>Assist the Controller in ensuring compliance with obligations under Art. 32–36 GDPR.</li>
          <li>Delete or return all personal data at the end of the service relationship, at the Controller's choice, unless EU or member state law requires further storage.</li>
          <li>Make available to the Controller all information necessary to demonstrate compliance with Art. 28 GDPR.</li>
        </ul>

        <h2>7. Sub-processors</h2>
        <p>
          The Controller hereby provides general authorization for the Processor to engage sub-processors.
          The current list of sub-processors is maintained in our
          <NuxtLink to="/privacy">Privacy Policy</NuxtLink> (Section 12: Sub-processors).
        </p>
        <p>
          The Processor shall inform the Controller of any intended changes concerning the addition or replacement
          of sub-processors at least 14 days in advance, giving the Controller the opportunity to object. If the
          Controller objects, the Processor shall refrain from engaging the new sub-processor or allow the
          Controller to terminate the service agreement.
        </p>

        <h2>8. International Data Transfers</h2>
        <p>
          Where personal data is transferred to countries outside the EU/EEA, the Processor ensures that appropriate
          safeguards are in place, including the EU-US Data Privacy Framework and/or Standard Contractual Clauses (SCCs)
          as adopted by the European Commission. Details are provided in the
          <NuxtLink to="/privacy">Privacy Policy</NuxtLink> (Section 13: International Data Transfers).
        </p>

        <h2>9. Data Breach Notification</h2>
        <p>
          The Processor shall notify the Controller without undue delay after becoming aware of a personal data
          breach. The notification shall include the nature of the breach, categories and approximate number of
          data subjects affected, likely consequences, and measures taken or proposed to address the breach.
        </p>

        <h2>10. Audit Rights</h2>
        <p>
          The Controller may request compliance documentation from the Processor to verify compliance with
          this DPA. Audits shall be conducted with reasonable advance notice and during normal business hours,
          and shall not unreasonably interfere with the Processor's operations.
        </p>

        <h2>11. Data Deletion and Return</h2>
        <p>
          Upon termination of the service agreement, the Processor shall delete all personal data processed
          on behalf of the Controller within 30 days, unless applicable law requires further retention. The
          Controller may export their data prior to termination using the data export feature available in
          the Service (Art. 20 GDPR).
        </p>

        <h2>12. Liability</h2>
        <p>
          The liability of the parties under this DPA is subject to the limitations set forth in the
          <NuxtLink to="/terms">Terms of Service</NuxtLink>.
        </p>

        <h2>13. Contact</h2>
        <p>
          For questions about this DPA or to request execution of a signed copy, contact us at
          <a href="mailto:software@newmatik.com">software@newmatik.com</a>.
        </p>
      </article>
    </main>

    <MarketingFooter />
  </div>
</template>
