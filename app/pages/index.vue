<template>
  <div class="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
    <AppHeader />

    <main class="flex-1">
      <UContainer :class="[isAuthenticated ? 'py-6 md:py-8 space-y-8' : 'py-10 md:py-12 space-y-12']">

        <!-- ── Hero Section (Logged Out) ───────────────────────────────────── -->
        <section v-if="!isAuthenticated" class="text-center space-y-6 max-w-4xl mx-auto">
          <div class="space-y-3">
            <div class="flex items-center justify-center gap-3 mb-4">
              <img
                :src="isDark ? '/icon-black.png' : '/icon-blue.png'"
                alt="Gerbtrace"
                class="size-12 rounded-xl shadow-sm"
              >
              <h1 class="text-4xl font-bold tracking-tight text-gray-900 dark:text-white">Gerbtrace</h1>
            </div>
            
            <p class="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto leading-relaxed">
              Open-source PCB NPI and manufacturing data preparation platform.
              <span class="hidden sm:inline">View, compare, panelize, and prepare your designs for production.</span>
            </p>
          </div>

          <div class="flex flex-col sm:flex-row items-center justify-center gap-3">
            <UButton size="lg" icon="i-lucide-eye" class="w-full sm:w-auto px-6" @click="createProject('viewer')">
              New Viewer Project
            </UButton>
            <UButton size="lg" icon="i-lucide-columns-2" color="neutral" variant="solid" class="w-full sm:w-auto px-6" @click="createProject('compare')">
              New Compare Project
            </UButton>
          </div>

          <div class="text-sm text-gray-500 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 pt-2">
            <span>Try an example:</span>
            <UButton size="xs" color="neutral" variant="soft" @click="loadSample('viewer')">
              Arduino UNO
            </UButton>
            <UButton size="xs" color="neutral" variant="soft" @click="loadSample('compare')">
              Compare Revisions
            </UButton>
          </div>
        </section>

        <!-- Compact Header for Logged-in Users -->
        <section v-else class="flex items-center justify-between gap-3 max-w-5xl mx-auto w-full">
          <div class="min-w-0">
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <img
                :src="isDark ? '/icon-black.png' : '/icon-blue.png'"
                alt="Gerbtrace"
                class="size-8 rounded-lg shadow-sm"
              >
              Gerbtrace
            </h1>
          </div>

          <div class="flex items-center gap-3 shrink-0">
            <UButton icon="i-lucide-book-open-text" color="neutral" variant="outline" @click="openDocs()">
              Docs / Help
            </UButton>
          </div>
        </section>

        <!-- ── Projects Area ───────────────────────────────────────────────── -->
        <div class="max-w-5xl mx-auto space-y-6">
          
          <!-- Search & Filters -->
          <div v-if="hasAnyProjects" class="flex flex-col sm:flex-row gap-2 bg-white dark:bg-gray-900 p-1.5 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800">
            <UInput
              v-model="query"
              icon="i-lucide-search"
              placeholder="Search projects..."
              class="flex-1"
              size="sm"
            >
              <template #trailing>
                <UButton
                  v-show="query !== ''"
                  color="neutral"
                  variant="link"
                  icon="i-lucide-x"
                  :padded="false"
                  size="xs"
                  @click="query = ''"
                />
              </template>
            </UInput>
            <div class="flex gap-2">
              <USelect
                v-model="modeFilter"
                :items="modeOptions"
                class="w-36"
                size="sm"
                icon="i-lucide-filter"
              />
              <USelectMenu
                v-if="isAuthenticated && hasTeam"
                v-model="assigneeFilter"
                :items="assigneeFilterOptions"
                class="w-48"
                size="sm"
                value-key="value"
                label-key="label"
                searchable
                :ui="{ content: 'min-w-[16rem]' }"
              >
                <template #leading>
                  <UIcon name="i-lucide-user" class="text-gray-400 w-4 h-4" />
                </template>
              </USelectMenu>
              <USelectMenu
                v-if="isAuthenticated && hasTeam"
                v-model="spaceFilter"
                :items="spaceFilterOptions"
                class="w-48"
                size="sm"
                value-key="value"
                label-key="label"
                searchable
                :ui="{ content: 'min-w-[16rem]' }"
              >
                <template #leading>
                  <UIcon name="i-lucide-folders" class="text-gray-400 w-4 h-4" />
                </template>
              </USelectMenu>
            </div>
          </div>

          <!-- Team Projects -->
          <section v-if="isAuthenticated && hasTeam" class="space-y-3">
            <div class="flex items-center justify-between px-1">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <UIcon name="i-lucide-users" class="text-primary-500" />
                <span>{{ currentTeam?.name ?? 'Team' }} Projects</span>
                <UBadge color="neutral" variant="subtle" size="xs">{{ filteredTeamProjects.length }}</UBadge>
              </h2>
              <div class="flex items-center gap-2">
                <USelectMenu
                  v-if="isEditor"
                  v-model="newProjectSpaceId"
                  :items="newProjectSpaceOptions"
                  size="xs"
                  class="w-44"
                  value-key="value"
                  label-key="label"
                />
                <UButton v-if="isEditor" icon="i-lucide-plus" size="xs" class="px-3" @click="createTeamProject('viewer')">
                New Team Project
                </UButton>
              </div>
            </div>

            <div v-if="teamProjectsLoading" class="text-center py-8 text-gray-500">
              <UIcon name="i-lucide-loader-2" class="animate-spin text-xl mb-2" />
              <p class="text-sm">Loading team projects...</p>
            </div>

            <div v-else-if="filteredTeamProjects.length" class="grid gap-3 sm:grid-cols-1 lg:grid-cols-2">
              <div
                v-for="project in filteredTeamProjects"
                :key="project.id"
                class="group relative flex rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-primary-500/50 hover:ring-1 hover:ring-primary-500/50 transition-all cursor-pointer shadow-sm overflow-hidden"
                @click="openTeamProject(project)"
              >
                <div class="w-28 h-24 shrink-0 bg-gray-100 dark:bg-gray-800 flex items-center justify-center p-1.5">
                  <img
                    v-if="teamPreviewUrls[project.id]"
                    :src="teamPreviewUrls[project.id]"
                    alt=""
                    class="max-w-full max-h-full object-contain"
                  >
                  <UIcon
                    v-else
                    :name="project.mode === 'viewer' ? 'i-lucide-eye' : 'i-lucide-columns-2'"
                    class="text-2xl text-gray-300 dark:text-gray-600"
                  />
                </div>

                <div class="flex-1 flex flex-col gap-1 p-2 min-w-0">
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <h3 class="font-medium text-sm text-gray-900 dark:text-white truncate pr-4">{{ project.name }}</h3>
                      <div class="text-[11px] leading-tight text-gray-500 dark:text-gray-400 space-y-0.5">
                        <div class="flex items-center gap-1.5 min-w-0">
                          <span class="shrink-0">Created</span>
                          <UBadge color="neutral" variant="outline" size="xs" class="min-w-0 max-w-[11rem]">
                            <span class="inline-flex items-center gap-1 min-w-0">
                              <img
                                v-if="getUserDisplay(project.created_by).avatarUrl"
                                :src="getUserDisplay(project.created_by).avatarUrl!"
                                alt=""
                                class="w-3 h-3 rounded-full object-cover shrink-0"
                              >
                              <span
                                v-else
                                class="w-3 h-3 rounded-full border border-gray-300 dark:border-gray-600 flex items-center justify-center text-[8px] leading-none shrink-0"
                              >
                                {{ getUserDisplay(project.created_by).initials }}
                              </span>
                              <span class="truncate">{{ getUserDisplay(project.created_by).label }}</span>
                            </span>
                          </UBadge>
                          <span class="truncate">{{ formatTeamProjectTimestamp(project.created_at) }}</span>
                        </div>
                        <div class="flex items-center gap-1.5 min-w-0">
                          <span class="shrink-0">Updated</span>
                          <UBadge color="neutral" variant="outline" size="xs" class="min-w-0 max-w-[11rem]">
                            <span class="inline-flex items-center gap-1 min-w-0">
                              <img
                                v-if="getUserDisplay(project.updated_by).avatarUrl"
                                :src="getUserDisplay(project.updated_by).avatarUrl!"
                                alt=""
                                class="w-3 h-3 rounded-full object-cover shrink-0"
                              >
                              <span
                                v-else
                                class="w-3 h-3 rounded-full border border-gray-300 dark:border-gray-600 flex items-center justify-center text-[8px] leading-none shrink-0"
                              >
                                {{ getUserDisplay(project.updated_by).initials }}
                              </span>
                              <span class="truncate">{{ getUserDisplay(project.updated_by).label }}</span>
                            </span>
                          </UBadge>
                          <span class="truncate">{{ formatTeamProjectTimestamp(project.updated_at) }}</span>
                        </div>
                      </div>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                      <UBadge
                        :color="teamProjectStatusColor(project.status)"
                        size="xs"
                        variant="subtle"
                      >
                        <UIcon :name="teamProjectStatusIcon(project.status)" class="w-3 h-3 mr-1" />
                        {{ teamProjectStatusLabel(project.status) }}
                      </UBadge>
                      <UBadge
                        v-if="project.status === 'for_approval' && project.approver_user_id"
                        color="neutral"
                        size="xs"
                        variant="subtle"
                      >
                        <UIcon name="i-lucide-user-check" class="w-3 h-3 mr-1" />
                        {{ getApproverLabel(project.approver_user_id) }}
                      </UBadge>
                    </div>
                  </div>

                  <div class="flex items-center justify-between gap-2 pt-1 mt-auto border-t border-gray-100 dark:border-gray-800/50" @click.stop>
                    <div class="flex items-center gap-1 min-w-0">
                      <USelectMenu
                        v-if="isEditor"
                        :model-value="project.assignee_user_id ?? ASSIGNEE_UNASSIGNED"
                        size="xs"
                        :items="assigneeOptions"
                        variant="none"
                        :disabled="isAssigning(project.id)"
                        value-key="value"
                        label-key="label"
                        searchable
                        :ui="{ content: 'min-w-[16rem]' }"
                        @update:model-value="(value: string) => updateProjectAssignee(project, value)"
                      >
                        <template #leading>
                          <UIcon name="i-lucide-user" class="text-gray-400 w-3 h-3" />
                        </template>
                      </USelectMenu>
                      <USelectMenu
                        v-if="isEditor"
                        :model-value="resolveProjectSpaceValue(project.space_id)"
                        size="xs"
                        :items="projectSpaceOptions"
                        variant="none"
                        :disabled="isAssigning(project.id)"
                        value-key="value"
                        label-key="label"
                        searchable
                        :ui="{ content: 'min-w-[16rem]' }"
                        @update:model-value="(value: string) => updateProjectSpace(project, value)"
                      >
                        <template #leading>
                          <UIcon name="i-lucide-folders" class="text-gray-400 w-3 h-3" />
                        </template>
                      </USelectMenu>
                      <div v-else class="text-xs text-gray-500 flex items-center gap-1 px-2 py-1">
                        <UIcon name="i-lucide-user" class="w-3 h-3" />
                        {{ getAssigneeLabel(project.assignee_user_id) }} · {{ getSpaceLabel(project.space_id) }}
                      </div>
                    </div>

                    <UButton
                      v-if="isAdmin"
                      size="xs"
                      color="error"
                      variant="ghost"
                      icon="i-lucide-trash-2"
                      class="opacity-0 group-hover:opacity-100 transition-opacity"
                      @click="confirmDeleteTeamProject(project)"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div v-else class="text-center py-8 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-lg bg-gray-50/50 dark:bg-gray-900/50">
              <UIcon name="i-lucide-folder-open" class="text-3xl text-gray-300 dark:text-gray-700 mb-2 mx-auto" />
              <p class="text-sm text-gray-500">No team projects found matching your filters.</p>
            </div>
          </section>

          <!-- Join Team Prompt -->
          <section v-if="isAuthenticated && !hasTeam && teamsLoaded" class="max-w-xl mx-auto">
            <div class="rounded-lg border border-dashed border-primary-500/30 bg-primary-50/50 dark:bg-primary-950/10 p-6 text-center">
              <div class="inline-flex p-2 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 mb-3">
                <UIcon name="i-lucide-users" class="text-xl" />
              </div>
              <h3 class="text-base font-semibold text-gray-900 dark:text-white mb-1">Collaborate with your team</h3>
              <p class="text-sm text-gray-500 dark:text-gray-400 mb-4 max-w-sm mx-auto">
                Create a team to share projects, manage components, and review designs together.
              </p>
              <UButton to="/team/create" icon="i-lucide-plus" size="sm">
                Create a Team
              </UButton>
            </div>
          </section>

          <!-- Personal Projects -->
          <section class="space-y-3">
            <div class="flex flex-col gap-2 px-1 sm:flex-row sm:items-center sm:justify-between">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <UIcon name="i-lucide-laptop" class="text-gray-400" />
                <span>{{ isAuthenticated ? 'Personal Projects' : 'Your Projects' }}</span>
                <UBadge color="neutral" variant="subtle" size="xs">{{ filteredProjects.length }}</UBadge>
              </h2>
              <div class="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:justify-end">
                <UButton
                  icon="i-lucide-plus"
                  size="xs"
                  color="neutral"
                  variant="outline"
                  class="whitespace-nowrap px-3"
                  @click="createProject('viewer')"
                >
                  New Personal Project
                </UButton>
                <UButton
                  icon="i-lucide-plus"
                  size="xs"
                  color="neutral"
                  variant="outline"
                  class="whitespace-nowrap px-3"
                  @click="createProject('compare')"
                >
                  New Compare Project
                </UButton>
              </div>
            </div>

            <div v-if="filteredProjects.length" class="grid gap-3 sm:grid-cols-1 lg:grid-cols-2">
              <div
                v-for="project in filteredProjects"
                :key="project.id"
                class="group relative flex rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-600 transition-all cursor-pointer shadow-sm overflow-hidden"
                @click="openProject(project)"
              >
                <div class="w-28 h-24 shrink-0 bg-gray-100 dark:bg-gray-800 flex items-center justify-center p-1.5">
                  <img
                    v-if="project.id && localPreviewUrls[project.id]"
                    :src="localPreviewUrls[project.id]"
                    alt=""
                    class="max-w-full max-h-full object-contain"
                  >
                  <UIcon
                    v-else
                    :name="project.mode === 'viewer' ? 'i-lucide-eye' : 'i-lucide-columns-2'"
                    class="text-2xl text-gray-300 dark:text-gray-600"
                  />
                </div>

                <div class="flex-1 p-2 min-w-0">
                  <div class="flex items-center justify-between gap-3">
                    <div class="min-w-0">
                      <h3 class="font-medium text-sm text-gray-900 dark:text-white truncate">{{ project.name }}</h3>
                      <div class="text-xs text-gray-500 dark:text-gray-400">
                        Updated {{ formatDate(project.updatedAt) }}
                      </div>
                    </div>
                    <UBadge :color="project.mode === 'viewer' ? 'info' : 'neutral'" variant="subtle" size="xs">
                      {{ project.mode === 'viewer' ? 'Viewer' : 'Compare' }}
                    </UBadge>
                  </div>
                </div>

                <div class="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity" @click.stop>
                  <UButton
                    size="xs"
                    color="error"
                    variant="ghost"
                    icon="i-lucide-trash-2"
                    @click="confirmDelete(project)"
                  />
                </div>
              </div>
            </div>

            <div v-else class="text-center py-8 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-lg bg-gray-50/50 dark:bg-gray-900/50">
              <p class="text-sm text-gray-500">No personal projects yet.</p>
            </div>
          </section>

          <!-- Download Desktop App (Below Projects) -->
          <div v-if="!isAuthenticated && !isTauri && release" class="flex flex-col items-center gap-2 pt-10">
            <div class="flex items-center gap-3">
              <a
                v-if="release.macosUrl"
                :href="release.macosUrl"
                class="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 text-sm hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
              >
                <UIcon name="i-lucide-apple" class="w-4 h-4" />
                <span>Download for macOS</span>
              </a>
              <a
                v-if="release.windowsExeUrl"
                :href="release.windowsExeUrl"
                class="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 text-sm hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
              >
                <UIcon name="i-lucide-monitor" class="w-4 h-4" />
                <span>Download for Windows</span>
              </a>
            </div>
            <a
              v-if="release?.releasePage"
              :href="release.releasePage"
              target="_blank"
              class="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              Latest version v{{ release.version }}
            </a>
          </div>

        </div>

        <!-- ── Features & Docs ─────────────────────────────────────────────── -->
        <section v-if="!isAuthenticated" class="pt-12 border-t border-gray-200 dark:border-gray-800">
          <div class="text-center mb-8 space-y-1.5">
            <h2 class="text-xl font-bold text-gray-900 dark:text-white">More than a Gerber Viewer</h2>
            <p class="text-sm text-gray-600 dark:text-gray-400">Everything you need to prepare your PCB for manufacturing.</p>
          </div>

          <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
            <button type="button" class="group block p-4 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 transition-all text-left w-full" @click="openDocs('/viewer/panel')">
              <div class="p-2 rounded bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white inline-block mb-3">
                <UIcon name="i-lucide-layout-grid" class="text-xl" />
              </div>
              <h3 class="font-semibold text-sm text-gray-900 dark:text-white mb-1.5 group-hover:underline">Panelization</h3>
              <p class="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">Create production panels with frames, fiducials, and mouse bites in seconds.</p>
            </button>

            <button type="button" class="group block p-4 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 transition-all text-left w-full" @click="openDocs('/viewer/bom')">
              <div class="p-2 rounded bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white inline-block mb-3">
                <UIcon name="i-lucide-list-todo" class="text-xl" />
              </div>
              <h3 class="font-semibold text-sm text-gray-900 dark:text-white mb-1.5 group-hover:underline">BOM Manager</h3>
              <p class="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">Import BOMs, automatic part matching, and real-time pricing estimation.</p>
            </button>

            <button type="button" class="group block p-4 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 transition-all text-left w-full" @click="openDocs('/viewer/smd')">
              <div class="p-2 rounded bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white inline-block mb-3">
                <UIcon name="i-lucide-cpu" class="text-xl" />
              </div>
              <h3 class="font-semibold text-sm text-gray-900 dark:text-white mb-1.5 group-hover:underline">Pick & Place</h3>
              <p class="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">Visualize component placement, verify rotations, and export machine files.</p>
            </button>

            <button type="button" class="group block p-4 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 transition-all text-left w-full" @click="openDocs()">
              <div class="p-2 rounded bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white inline-block mb-3">
                <UIcon name="i-lucide-book" class="text-xl" />
              </div>
              <h3 class="font-semibold text-sm text-gray-900 dark:text-white mb-1.5 group-hover:underline">Documentation</h3>
              <p class="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">Learn how to use all features with our comprehensive guides and tutorials.</p>
            </button>
          </div>
        </section>

      </UContainer>
    </main>

    <!-- ── Footer ──────────────────────────────────────────────────────── -->
    <footer class="py-6 border-t border-gray-200 dark:border-gray-800 mt-10 bg-white dark:bg-gray-950">
      <div class="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div class="flex items-center gap-2 text-xs text-gray-500">
          <span class="font-semibold text-gray-700 dark:text-gray-300">Gerbtrace</span>
          <span class="opacity-30">•</span>
          <span>v{{ appVersion }}</span>
        </div>
        
        <div class="flex items-center gap-6 text-xs text-gray-500">
          <button class="hover:text-primary-600 dark:hover:text-primary-400 transition-colors" @click="openDocs()">Documentation</button>
          <a v-if="release?.releasePage" :href="release.releasePage" target="_blank" class="hover:text-primary-600 dark:hover:text-primary-400 transition-colors">Releases</a>
          <button class="hover:text-primary-600 dark:hover:text-primary-400 transition-colors" @click="aboutOpen = true">About</button>
        </div>

        <div v-if="!isTauri && release" class="flex items-center gap-3">
          <template v-if="isAuthenticated">
            <a
              v-if="release.macosUrl"
              :href="release.macosUrl"
              class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-xs hover:text-gray-800 dark:hover:text-gray-100 hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
            >
              <UIcon name="i-lucide-apple" class="w-3.5 h-3.5" />
              <span>Download for macOS</span>
            </a>
            <a
              v-if="release.windowsExeUrl"
              :href="release.windowsExeUrl"
              class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-xs hover:text-gray-800 dark:hover:text-gray-100 hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
            >
              <UIcon name="i-lucide-monitor" class="w-3.5 h-3.5" />
              <span>Download for Windows</span>
            </a>
          </template>
          <template v-else>
            <a v-if="release.macosUrl" :href="release.macosUrl" class="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">macOS</a>
            <a v-if="release.windowsExeUrl" :href="release.windowsExeUrl" class="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">Windows</a>
          </template>
        </div>
      </div>
    </footer>

    <AppAboutModal v-model:open="aboutOpen" />

    <!-- Modals -->
    <UModal v-model:open="teamDeleteModalOpen">
      <template #content>
        <div class="p-5 space-y-4">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h3 class="text-sm font-semibold text-gray-900 dark:text-white">Delete team project?</h3>
              <p class="text-xs text-gray-500 mt-1">
                This will permanently remove the project and all its files for the entire team.
              </p>
            </div>
            <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-x" @click="teamDeleteModalOpen = false" />
          </div>

          <div v-if="teamProjectToDelete" class="rounded-md border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-3">
            <div class="text-sm font-medium text-gray-900 dark:text-white">{{ teamProjectToDelete.name }}</div>
            <div class="text-xs text-gray-500 mt-1 flex gap-2">
              <span>{{ teamProjectToDelete.mode === 'viewer' ? 'Viewer' : 'Compare' }}</span>
              <span>•</span>
              <span>Updated {{ formatDate(teamProjectToDelete.updated_at) }}</span>
            </div>
          </div>

          <div class="flex justify-end gap-2 pt-2">
            <UButton size="sm" variant="outline" color="neutral" @click="teamDeleteModalOpen = false">Cancel</UButton>
            <UButton size="sm" color="error" icon="i-lucide-trash-2" :loading="teamDeleteLoading" @click="performDeleteTeamProject">
              Delete Project
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="deleteModalOpen">
      <template #content>
        <div class="p-5 space-y-4">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h3 class="text-sm font-semibold text-gray-900 dark:text-white">Delete project?</h3>
              <p class="text-xs text-gray-500 mt-1">
                This will permanently remove the project and its files.
              </p>
            </div>
            <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-x" @click="deleteModalOpen = false" />
          </div>

          <div v-if="projectToDelete" class="rounded-md border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-3">
            <div class="text-sm font-medium text-gray-900 dark:text-white">{{ projectToDelete.name }}</div>
            <div class="text-xs text-gray-500 mt-1 flex gap-2">
              <span>{{ projectToDelete.mode === 'viewer' ? 'Viewer' : 'Compare' }}</span>
              <span>•</span>
              <span>Updated {{ formatDate(projectToDelete.updatedAt) }}</span>
            </div>
          </div>

          <div class="flex justify-end gap-2 pt-2">
            <UButton size="sm" variant="outline" color="neutral" @click="deleteModalOpen = false">Cancel</UButton>
            <UButton size="sm" color="error" icon="i-lucide-trash-2" @click="performDelete">
              Delete Project
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { useColorMode } from '#imports'
import { isTauri as coreIsTauri } from '@tauri-apps/api/core'

const router = useRouter()
const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')
const { openDocs } = useDocsLink()
const { projects, createNewProject, removeProject } = useProject()
const { loadSampleProject } = useSampleProject()
const { release, platform } = useLatestRelease()
const isTauri = import.meta.client && coreIsTauri()
const appVersion = useRuntimeConfig().public.appVersion as string
const aboutOpen = ref(false)

// Auth and team state
const { isAuthenticated } = useAuth()
const { currentTeam, hasTeam, isEditor, isAdmin, teamsLoaded } = useTeam()
const { members } = useTeamMembers()
const { spaces, fetchSpaces } = useSpaces()
const { projects: teamProjects, projectsLoading: teamProjectsLoading, createProject: createTeamProjectFn, updateProject: updateTeamProjectFn, deleteProject: deleteTeamProjectFn, getPreviewUrl: getTeamPreviewUrl } = useTeamProjects()

const query = ref('')
const modeFilter = ref<'all' | 'viewer' | 'compare'>('all')
const modeOptions = [
  { label: 'All Projects', value: 'all' },
  { label: 'Viewer Only', value: 'viewer' },
  { label: 'Compare Only', value: 'compare' },
]
const ASSIGNEE_ALL = '__all__'
const ASSIGNEE_UNASSIGNED = '__unassigned__'
const SPACE_ALL = '__all_spaces__'
const SPACE_UNASSIGNED = '__unassigned_space__'
const assigneeFilter = ref<string>(ASSIGNEE_ALL)
const spaceFilter = ref<string>(SPACE_ALL)
const newProjectSpaceId = ref<string>(SPACE_UNASSIGNED)
const assigningByProjectId = ref<Record<string, boolean>>({})

// ── Preview thumbnails ──
const teamPreviewUrls = ref<Record<string, string>>({})
const localPreviewUrls = ref<Record<number, string>>({})

watch(teamProjects, async (list) => {
  const urls: Record<string, string> = {}
  await Promise.all(list.map(async (p) => {
    const url = await getTeamPreviewUrl(p)
    if (url) urls[p.id] = url
  }))
  teamPreviewUrls.value = urls
}, { immediate: true })

watch(projects, async (list) => {
  const prev = localPreviewUrls.value
  const next: Record<number, string> = {}
  for (const p of list) {
    if (!p.id) continue
    if (prev[p.id]) {
      next[p.id] = prev[p.id]
      continue
    }
    if (p.previewImage) {
      next[p.id] = URL.createObjectURL(p.previewImage)
    }
  }
  for (const id of Object.keys(prev)) {
    if (!(Number(id) in next)) URL.revokeObjectURL(prev[Number(id)])
  }
  localPreviewUrls.value = next
}, { immediate: true })

onBeforeUnmount(() => {
  for (const url of Object.values(localPreviewUrls.value)) URL.revokeObjectURL(url)
})

const assignableMembers = computed(() => {
  return members.value.filter(m => m.status === 'active' && (m.role === 'admin' || m.role === 'editor'))
})

const assigneeFilterOptions = computed(() => {
  return [
    { label: 'All assignees', value: ASSIGNEE_ALL },
    { label: 'Unassigned', value: ASSIGNEE_UNASSIGNED },
    ...assignableMembers.value.map(member => ({
      label: member.profile?.name?.trim() || member.profile?.email || 'Unnamed member',
      value: member.user_id,
    })),
  ]
})

const assigneeOptions = computed(() => {
  return [
    { label: 'Unassigned', value: ASSIGNEE_UNASSIGNED },
    ...assignableMembers.value.map(member => ({
      label: member.profile?.name?.trim() || member.profile?.email || 'Unnamed member',
      value: member.user_id,
    })),
  ]
})

const spaceFilterOptions = computed(() => [
  { label: 'All spaces', value: SPACE_ALL },
  { label: 'Unassigned', value: SPACE_UNASSIGNED },
  ...spaces.value.map(space => ({ label: space.name, value: space.id })),
])

const defaultSpace = computed(() => {
  const explicit = spaces.value.find(space => space.name.trim().toLowerCase() === 'general')
  return explicit ?? spaces.value[0] ?? null
})

const projectSpaceOptions = computed(() => [
  { label: 'Unassigned', value: SPACE_UNASSIGNED },
  ...spaces.value.map(space => ({ label: space.name, value: space.id })),
])

const newProjectSpaceOptions = computed(() => projectSpaceOptions.value)

const hasAnyProjects = computed(() => projects.value.length > 0 || teamProjects.value.length > 0)

const filteredTeamProjects = computed(() => {
  const q = query.value.trim().toLowerCase()
  return teamProjects.value.filter(p => {
    const matchesMode = modeFilter.value === 'all' ? true : p.mode === modeFilter.value
    const matchesQuery = !q ? true : p.name.toLowerCase().includes(q)
    const matchesAssignee = assigneeFilter.value === ASSIGNEE_ALL
      ? true
      : assigneeFilter.value === ASSIGNEE_UNASSIGNED
        ? !p.assignee_user_id
        : p.assignee_user_id === assigneeFilter.value
    const matchesSpace = spaceFilter.value === SPACE_ALL
      ? true
      : spaceFilter.value === SPACE_UNASSIGNED
        ? !p.space_id
        : p.space_id === spaceFilter.value
    return matchesMode && matchesQuery && matchesAssignee && matchesSpace
  })
})

const filteredProjects = computed(() => {
  const q = query.value.trim().toLowerCase()
  return projects.value.filter(p => {
    const matchesMode = modeFilter.value === 'all' ? true : p.mode === modeFilter.value
    const matchesQuery = !q ? true : p.name.toLowerCase().includes(q)
    return matchesMode && matchesQuery
  })
})

const deleteModalOpen = ref(false)
const projectToDelete = ref<any>(null)

async function createProject(mode: 'viewer' | 'compare') {
  const project = await createNewProject(mode)
  openProject(project)
}

async function createTeamProject(mode: 'viewer' | 'compare') {
  const spaceId = newProjectSpaceId.value === SPACE_UNASSIGNED ? null : newProjectSpaceId.value
  const { project } = await createTeamProjectFn(mode, undefined, spaceId)
  if (project) {
    router.push(`/${mode}/team-${project.id}`)
  }
}

function getAssigneeLabel(assigneeUserId: string | null) {
  if (!assigneeUserId) return 'Unassigned'
  const member = assignableMembers.value.find(m => m.user_id === assigneeUserId)
  return member?.profile?.name?.trim() || member?.profile?.email || 'Former member'
}

function getCreatorLabel(userId: string | null) {
  if (!userId) return 'Unknown user'
  const member = members.value.find(m => m.user_id === userId)
  return member?.profile?.name?.trim() || member?.profile?.email || 'Former member'
}

function getUpdaterLabel(userId: string | null) {
  if (!userId) return 'Unknown user'
  const member = members.value.find(m => m.user_id === userId)
  return member?.profile?.name?.trim() || member?.profile?.email || 'Former member'
}

function getUserInitials(label: string) {
  const parts = label.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return parts.slice(0, 2).map(part => part[0]?.toUpperCase() ?? '').join('') || '?'
}

function getUserDisplay(userId: string | null): { label: string; avatarUrl: string | null; initials: string } {
  if (!userId) return { label: 'Unknown user', avatarUrl: null, initials: '?' }
  const member = members.value.find(m => m.user_id === userId)
  const label = member?.profile?.name?.trim() || member?.profile?.email || 'Former member'
  const avatarUrl = member?.profile?.avatar_url ?? null
  return {
    label,
    avatarUrl,
    initials: getUserInitials(label),
  }
}

function getApproverLabel(approverUserId: string | null) {
  if (!approverUserId) return 'No approver'
  const member = assignableMembers.value.find(m => m.user_id === approverUserId)
  return member?.profile?.name?.trim() || member?.profile?.email || 'Former member'
}

function getSpaceLabel(spaceId: string | null) {
  if (!spaceId) return defaultSpace.value?.name ?? 'No space'
  const space = spaces.value.find(s => s.id === spaceId)
  return space?.name ?? defaultSpace.value?.name ?? 'Unknown space'
}

function resolveProjectSpaceValue(spaceId: string | null) {
  if (!spaceId) return SPACE_UNASSIGNED
  const knownSpace = spaces.value.some(space => space.id === spaceId)
  if (knownSpace) return spaceId
  return defaultSpace.value?.id ?? SPACE_UNASSIGNED
}

function teamProjectStatusLabel(status: 'draft' | 'in_progress' | 'for_approval' | 'approved') {
  if (status === 'in_progress') return 'In Progress'
  if (status === 'for_approval') return 'For Approval'
  if (status === 'approved') return 'Approved'
  return 'Draft'
}

function teamProjectStatusIcon(status: 'draft' | 'in_progress' | 'for_approval' | 'approved') {
  if (status === 'in_progress') return 'i-lucide-play'
  if (status === 'for_approval') return 'i-lucide-hourglass'
  if (status === 'approved') return 'i-lucide-lock'
  return 'i-lucide-file-pen'
}

function teamProjectStatusColor(status: 'draft' | 'in_progress' | 'for_approval' | 'approved') {
  if (status === 'in_progress') return 'primary'
  if (status === 'for_approval') return 'info'
  if (status === 'approved') return 'success'
  return 'warning'
}

function isAssigning(projectId: string) {
  return Boolean(assigningByProjectId.value[projectId])
}

async function updateProjectAssignee(project: { id: string; assignee_user_id: string | null }, assigneeValue: string) {
  if (!isEditor.value || isAssigning(project.id)) return

  const nextAssigneeUserId = assigneeValue === ASSIGNEE_UNASSIGNED ? null : assigneeValue
  if (nextAssigneeUserId === project.assignee_user_id) return

  assigningByProjectId.value = { ...assigningByProjectId.value, [project.id]: true }
  try {
    await updateTeamProjectFn(project.id, { assignee_user_id: nextAssigneeUserId })
  } finally {
    const next = { ...assigningByProjectId.value }
    delete next[project.id]
    assigningByProjectId.value = next
  }
}

async function updateProjectSpace(project: { id: string; space_id: string | null }, spaceValue: string) {
  if (!isEditor.value || isAssigning(project.id)) return
  const nextSpaceId = spaceValue === SPACE_UNASSIGNED ? null : spaceValue
  if (nextSpaceId === project.space_id) return

  assigningByProjectId.value = { ...assigningByProjectId.value, [project.id]: true }
  try {
    await updateTeamProjectFn(project.id, { space_id: nextSpaceId })
  } finally {
    const next = { ...assigningByProjectId.value }
    delete next[project.id]
    assigningByProjectId.value = next
  }
}

function openProject(project: { id?: number; mode: string }) {
  if (!project.id) return
  router.push(`/${project.mode}/${project.id}`)
}

function openTeamProject(project: { id: string; mode: string }) {
  router.push(`/${project.mode}/team-${project.id}`)
}

function confirmDelete(project: any) {
  projectToDelete.value = project
  deleteModalOpen.value = true
}

async function performDelete() {
  const p = projectToDelete.value
  if (!p?.id) return
  await removeProject(p.id)
  deleteModalOpen.value = false
  projectToDelete.value = null
}

// Team project deletion
const teamDeleteModalOpen = ref(false)
const teamProjectToDelete = ref<any>(null)
const teamDeleteLoading = ref(false)

function confirmDeleteTeamProject(project: any) {
  teamProjectToDelete.value = project
  teamDeleteModalOpen.value = true
}

async function performDeleteTeamProject() {
  const p = teamProjectToDelete.value
  if (!p?.id) return
  teamDeleteLoading.value = true
  try {
    const { error } = await deleteTeamProjectFn(p.id)
    if (!error) {
      teamDeleteModalOpen.value = false
      teamProjectToDelete.value = null
    }
  } finally {
    teamDeleteLoading.value = false
  }
}

async function loadSample(mode: 'viewer' | 'compare') {
  const project = await loadSampleProject(mode)
  if (project?.id) {
    router.push(`/${mode}/${project.id}`)
  }
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatTeamProjectTimestamp(date: Date | string): string {
  const dt = new Date(date)
  const year = dt.getFullYear()
  const month = String(dt.getMonth() + 1).padStart(2, '0')
  const day = String(dt.getDate()).padStart(2, '0')
  const minutes = String(dt.getMinutes()).padStart(2, '0')
  const format = currentTeam.value?.time_format ?? '24h'

  if (format === '12h') {
    const rawHours = dt.getHours()
    const suffix = rawHours >= 12 ? 'PM' : 'AM'
    const hours12 = rawHours % 12 || 12
    const hours = String(hours12).padStart(2, '0')
    return `${year}-${month}-${day} ${hours}:${minutes} ${suffix}`
  }

  const hours = String(dt.getHours()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

onMounted(async () => {
  await fetchSpaces()
  const firstSpace = defaultSpace.value
  if (firstSpace) newProjectSpaceId.value = firstSpace.id
})
</script>