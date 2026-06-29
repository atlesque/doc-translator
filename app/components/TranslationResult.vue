<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui';
import type { TranslatedChunk } from '../../types/translation';

const props = defineProps<{
  chunks: readonly TranslatedChunk[]
  status: 'done' | 'partial'
  targetLanguage: string
  total?: number
  retryingIndex?: number | null
  hasCachedChunks?: boolean
}>()

const emit = defineEmits<{
  (e: 'retry', index: number): void
  (e: 'restart', index: number): void
  (e: 'retryAll'): void
  (e: 'clearCache'): void
}>()

const isRetrying = (index: number) => props.retryingIndex === index

const failedIndices = computed(() =>
  props.chunks
    .map((c, i) => (c.success ? -1 : i))
    .filter(i => i !== -1),
)

function chunkMenuItems(index: number): DropdownMenuItem[][] {
  return [
    [
      {
        label: 'Retry this paragraph',
        icon: 'i-heroicons-arrow-path',
        onSelect() {
          emit('retry', index)
        },
      },
      {
        label: 'Restart from here',
        icon: 'i-heroicons-play',
        onSelect() {
          emit('restart', index)
        },
      },
    ],
  ]
}

function copyAll() {
  const text = props.chunks
    .map(c => (c.success ? c.translated : `[FAILED] ${c.original}`))
    .join('\n\n')
  navigator.clipboard.writeText(text)
}

function downloadTxt() {
  const text = props.chunks
    .map(c => (c.success ? c.translated : `[FAILED] ${c.original}`))
    .join('\n\n')
  const blob = new Blob([text], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'translation.txt'
  a.click()
  URL.revokeObjectURL(url)
}

const successCount = computed(() => props.chunks.filter(c => c.success).length)
</script>

<template>
  <div class="space-y-4">
    <!-- Top action bar -->
    <div class="flex items-center justify-between">
      <p class="text-sm text-gray-500 dark:text-gray-400">
        {{ successCount }} / {{ total ?? chunks.length }} paragraphs translated to {{ targetLanguage }}
      </p>
      <div class="flex gap-2">
        <UButton
          v-if="hasCachedChunks"
          icon="i-heroicons-trash"
          size="sm"
          color="warning"
          variant="outline"
          @click="emit('clearCache')"
        >
          Clear cache &amp; retry
        </UButton>
        <UButton
          v-if="failedIndices.length > 0"
          icon="i-heroicons-arrow-path"
          size="sm"
          color="warning"
          variant="outline"
          @click="emit('retryAll')"
        >
          Retry all failed
        </UButton>
        <UButton
          icon="i-heroicons-clipboard"
          size="sm"
          color="neutral"
          variant="outline"
          @click="copyAll"
        >
          Copy all
        </UButton>
        <UButton
          icon="i-heroicons-arrow-down-tray"
          size="sm"
          color="neutral"
          variant="outline"
          @click="downloadTxt"
        >
          Download .txt
        </UButton>
      </div>
    </div>

    <!-- Chunk cards -->
    <div class="space-y-3">
      <UCard
        v-for="chunk in chunks"
        :key="chunk.index"
        :ui="{
          root: isRetrying(chunk.index)
            ? 'border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-primary-950'
            : chunk.success
              ? ''
              : 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950',
        }"
      >
        <template #header>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-xs font-medium text-gray-500 dark:text-gray-400">
                Paragraph {{ chunk.index + 1 }}
              </span>
              <UBadge
                v-if="chunk.fromCache"
                label="cached"
                color="info"
                variant="soft"
                size="xs"
              />
            </div>
            <UDropdownMenu
              :items="chunkMenuItems(chunk.index)"
            >
              <UButton
                icon="i-heroicons-ellipsis-horizontal"
                size="xs"
                color="neutral"
                variant="ghost"
                aria-label="Paragraph actions"
              />
            </UDropdownMenu>
          </div>
        </template>

        <div v-if="isRetrying(chunk.index)">
          <!-- Skeleton loader while retrying -->
          <div class="space-y-2 animate-pulse">
            <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full" />
            <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
            <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-4/6" />
          </div>
        </div>
        <div v-else-if="chunk.success">
          <p class="text-sm whitespace-pre-wrap">{{ chunk.translated }}</p>
        </div>
        <div v-else>
          <p class="text-xs text-amber-600 dark:text-amber-400 mb-2">
            ⚠️ This paragraph failed to translate. Use the context menu to retry.
          </p>
          <details class="text-xs text-gray-500 dark:text-gray-400">
            <summary class="cursor-pointer">Show original text</summary>
            <p class="mt-1 whitespace-pre-wrap">{{ chunk.original }}</p>
          </details>
        </div>
      </UCard>
    </div>

    <!-- Bottom action bar -->
    <div class="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
      <UButton
        icon="i-heroicons-clipboard"
        size="sm"
        color="neutral"
        variant="outline"
        @click="copyAll"
      >
        Copy all
      </UButton>
      <UButton
        icon="i-heroicons-arrow-down-tray"
        size="sm"
        color="neutral"
        variant="outline"
        @click="downloadTxt"
      >
        Download .txt
      </UButton>
    </div>
  </div>
</template>
