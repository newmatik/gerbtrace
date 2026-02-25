<script setup lang="ts">
useHead({
  title: 'Licensing',
  meta: [
    { name: 'description', content: 'Gerbtrace licensing. Understand the Business Source License 1.1 (BUSL-1.1) and what source-available means.' },
    { property: 'og:title', content: 'Licensing | Gerbtrace' },
    { property: 'og:description', content: 'Gerbtrace licensing. Understand the Business Source License 1.1 (BUSL-1.1) and what source-available means.' },
  ],
})

const showFullLicense = ref(false)

const LICENSE_TEXT = `License text copyright (c) 2020 MariaDB Corporation Ab, All Rights Reserved.
"Business Source License" is a trademark of MariaDB Corporation Ab.

Parameters

Licensor:             Newmatik GmbH
Licensed Work:        Gerbtrace 1.0.0 and all subsequent versions.
                      The Licensed Work is (c) 2025-2026 Newmatik GmbH.
Additional Use Grant: You may make production use of the Licensed Work,
                      provided Your use does not include offering the
                      Licensed Work to third parties on a hosted,
                      embedded, or repackaged basis in order to compete
                      with Newmatik's paid or free version(s) of the
                      Licensed Work. For purposes of this license:

                      A "competitive offering" is a Product that is
                      offered to third parties — whether on a paid or
                      free basis — that substantially replicates the
                      functionality of the Licensed Work. This includes,
                      but is not limited to, taking the Licensed Work
                      (or a modified version of it), rebranding it, and
                      providing it to customers as a product or service.

                      "Product" means software that is offered to end
                      users to manage in their own environments, offered
                      as a service on a hosted basis, or distributed as
                      a downloadable application.

                      "Embedded" means including the source code or
                      executable code from the Licensed Work in a
                      competitive offering. "Embedded" also means
                      packaging the competitive offering in such a way
                      that the Licensed Work must be accessed or
                      downloaded for the competitive offering to operate.

                      Using the Licensed Work for internal purposes
                      within an organization is not considered a
                      competitive offering. Newmatik considers your
                      organization to include all of your affiliates
                      under common control.

                      Contributing improvements back to the Licensed
                      Work via pull requests or patches is expressly
                      permitted and encouraged.

Change Date:          Four years from the date the Licensed Work is
                      published.
Change License:       MIT

For information about alternative licensing arrangements for the Licensed
Work, please contact software@newmatik.com.

Notice

Business Source License 1.1

Terms

The Licensor hereby grants you the right to copy, modify, create derivative
works, redistribute, and make non-production use of the Licensed Work. The
Licensor may make an Additional Use Grant, above, permitting limited
production use.

Effective on the Change Date, or the fourth anniversary of the first publicly
available distribution of a specific version of the Licensed Work under this
License, whichever comes first, the Licensor hereby grants you rights under
the terms of the Change License, and the rights granted in the paragraph
above terminate.

If your use of the Licensed Work does not comply with the requirements
currently in effect as described in this License, you must purchase a
commercial license from the Licensor, its affiliated entities, or authorized
resellers, or you must refrain from using the Licensed Work.

All copies of the original and modified Licensed Work, and derivative works
of the Licensed Work, are subject to this License. This License applies
separately for each version of the Licensed Work and the Change Date may vary
for each version of the Licensed Work released by Licensor.

You must conspicuously display this License on each original or modified copy
of the Licensed Work. If you receive the Licensed Work in original or
modified form from a third party, the terms and conditions set forth in this
License apply to your use of that work.

Any use of the Licensed Work in violation of this License will automatically
terminate your rights under this License for the current and all other
versions of the Licensed Work.

This License does not grant you any right in any trademark or logo of
Licensor or its affiliates (provided that you may use a trademark or logo of
Licensor as expressly required by this License).

TO THE EXTENT PERMITTED BY APPLICABLE LAW, THE LICENSED WORK IS PROVIDED ON
AN "AS IS" BASIS. LICENSOR HEREBY DISCLAIMS ALL WARRANTIES AND CONDITIONS,
EXPRESS OR IMPLIED, INCLUDING (WITHOUT LIMITATION) WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, AND
TITLE.`
</script>

<template>
  <div class="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
    <AppHeader marketing />

    <main class="flex-1 py-16 px-4">
      <article class="max-w-3xl mx-auto prose prose-neutral dark:prose-invert prose-sm">
        <h1>Licensing</h1>
        <p class="lead">Last updated: February 25, 2026</p>

        <p>
          Gerbtrace is licensed under the
          <a href="https://mariadb.com/bsl11/" target="_blank" rel="noopener noreferrer">Business Source License 1.1</a>
          (BUSL-1.1). This page explains what that means for you.
        </p>

        <h2>1. Source available, not open source</h2>
        <p>
          Gerbtrace is <strong>source available</strong>. The entire source code is published on
          <a href="https://github.com/newmatik/gerbtrace" target="_blank" rel="noopener noreferrer">GitHub</a>
          and anyone can read, study, and modify it. However, the BUSL-1.1 is not an
          <a href="https://opensource.org/osd" target="_blank" rel="noopener noreferrer">OSI-approved open-source license</a>
          because it places one restriction on commercial use: you may not use the code to offer a product that competes
          with Gerbtrace.
        </p>
        <p>
          In practice, this distinction matters only if you intend to redistribute the software commercially. For
          all other uses — internal tooling, learning, contributing — the license is permissive.
        </p>

        <h2>2. What you can do</h2>
        <ul>
          <li>Use Gerbtrace internally within your organization for any purpose, including production.</li>
          <li>Read, study, modify, and learn from the source code.</li>
          <li>Contribute improvements back via pull requests.</li>
          <li>Build internal tools or integrations that use Gerbtrace.</li>
        </ul>

        <h2>3. What you cannot do</h2>
        <ul>
          <li>Offer Gerbtrace (or a modified version) to third parties as a competing product or service.</li>
          <li>Rebrand and redistribute Gerbtrace as your own product to customers.</li>
          <li>Embed Gerbtrace in a commercial offering that competes with Gerbtrace.</li>
        </ul>
        <p>
          The license defines a "competitive offering" as a product offered to third parties — whether paid or free — that
          substantially replicates the functionality of Gerbtrace. Using the software for internal purposes within your
          organization, including all affiliates under common control, is not considered competitive.
        </p>

        <h2>4. Automatic relicensing to MIT</h2>
        <p>
          Each version of Gerbtrace automatically converts to the
          <a href="https://opensource.org/licenses/MIT" target="_blank" rel="noopener noreferrer">MIT license</a>
          four years after its release date. This means every release will eventually become fully open source
          with no restrictions on use.
        </p>

        <h2>5. Alternative licensing</h2>
        <p>
          If the BUSL-1.1 does not fit your use case — for example, if you want to embed Gerbtrace in a commercial
          product — contact us to discuss an alternative commercial license.
        </p>
        <p>
          Reach out at <a href="mailto:software@newmatik.com">software@newmatik.com</a>.
        </p>

        <h2>6. Full license text</h2>
        <p>
          The complete license is available in the
          <a href="https://github.com/newmatik/gerbtrace/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">LICENSE</a>
          file in the repository. A copy is included below.
        </p>

        <button
          class="text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline cursor-pointer not-prose"
          @click="showFullLicense = !showFullLicense"
        >
          {{ showFullLicense ? 'Hide full license text' : 'Show full license text' }}
        </button>

        <div
          v-if="showFullLicense"
          v-text="LICENSE_TEXT"
          class="mt-4 rounded-lg bg-gray-100 dark:bg-gray-900 p-4 overflow-x-auto text-xs leading-relaxed font-mono whitespace-pre-wrap not-prose text-gray-700 dark:text-gray-300"
        />

        <h2>7. Contact</h2>
        <p>
          Questions about licensing? Contact us at
          <a href="mailto:software@newmatik.com">software@newmatik.com</a>.
        </p>
      </article>
    </main>

    <MarketingFooter />
  </div>
</template>
