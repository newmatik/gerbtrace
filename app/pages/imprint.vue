<script setup lang="ts">
definePageMeta({
  alias: ['/de/impressum'],
})

useHead({
  title: 'Imprint — Gerbtrace',
  meta: [
    { name: 'description', content: 'Legal information and contact details for Gerbtrace, operated by Newmatik GmbH.' },
    { property: 'og:title', content: 'Imprint — Gerbtrace' },
    { property: 'og:description', content: 'Legal information and contact details for Gerbtrace, operated by Newmatik GmbH.' },
  ],
})
</script>

<template>
  <div class="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
    <AppHeader marketing />

    <main class="flex-1 py-16 px-4">
      <article class="max-w-3xl mx-auto prose prose-neutral dark:prose-invert prose-sm">
        <h1>Imprint</h1>
        <p class="lead">Angaben gemäß § 5 DDG</p>

        <h2>Company Information</h2>
        <p>
          <strong>Newmatik GmbH</strong><br>
          Am Markt 1<br>
          55619 Hennweiler<br>
          Germany
        </p>

        <h2>Contact</h2>
        <p>
          Phone: <a href="tel:+4967521699800">+49 6752 16998-0</a><br>
          Email: <a href="mailto:software@newmatik.com">software@newmatik.com</a><br>
          Website: <a href="https://www.newmatik.com" target="_blank" rel="noopener noreferrer">www.newmatik.com</a>
        </p>

        <h2>Management</h2>
        <p>
          <strong>Geschäftsführer (Managing Directors):</strong><br>
          Dominik Ottenbreit<br>
          Björn Ottenbreit
        </p>
        <p>
          <strong>Prokuristin (Authorized Signatory):</strong><br>
          Ingrid Ottenbreit
        </p>

        <h2>Company Registration</h2>
        <p>
          Commercial Register: HRB 3460<br>
          Registry Court: Amtsgericht Bad Kreuznach<br>
          VAT ID (USt-IdNr.): DE 812 004 832
        </p>

        <h2>Responsible for Content</h2>
        <p>
          Responsible according to § 18 Abs. 2 MStV:<br>
          Dominik Ottenbreit<br>
          Newmatik GmbH<br>
          Am Markt 1<br>
          55619 Hennweiler, Germany
        </p>

        <h2>EU Online Dispute Resolution</h2>
        <p>
          The European Commission provides a platform for online dispute resolution (ODR):
          <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener noreferrer">https://ec.europa.eu/consumers/odr/</a>
        </p>
        <p>
          We are not willing or obliged to participate in dispute resolution proceedings before a consumer arbitration board.
        </p>

        <h2>Liability for Content</h2>
        <p>
          The contents of our pages were created with the greatest care. However, we cannot guarantee the accuracy,
          completeness, or timeliness of the content. As a service provider, we are responsible for our own content on
          these pages under general laws. However, we are not obligated to monitor transmitted or stored third-party
          information or to investigate circumstances that indicate illegal activity.
        </p>

        <h2>Liability for Links</h2>
        <p>
          Our website contains links to external websites of third parties over whose content we have no influence.
          We therefore cannot accept any liability for this third-party content. The respective provider or operator
          of the linked pages is always responsible for the content of the linked pages.
        </p>

        <h2>Copyright</h2>
        <p>
          The content and works on these pages created by the site operators are subject to German copyright law.
          Duplication, processing, distribution, or any form of commercialization of such material beyond the scope
          of the copyright law requires the prior written consent of its respective author or creator.
        </p>
      </article>
    </main>

    <MarketingFooter />
  </div>
</template>
