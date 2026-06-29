<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui';
import type { TranslatedChunk } from '../../types/translation';

const props = defineProps<{
  chunks: readonly TranslatedChunk[]
  status: 'done' | 'partial'
  targetLanguage: string
  total?: number
}>()

const emit = defineEmits<{
  (e: 'retry', index: number): void
  (e: 'restart', index: number): void
  (e: 'retryAll'): void
}>()

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
        // @ts-ignore — custom payload for @select handler
        _action: 'retry' as const,
        _index: index,
      },
      {
        label: 'Restart from here',
        icon: 'i-heroicons-play',
        // @ts-ignore
        _action: 'restart' as const,
        _index: index,
      },
    ],
  ]
}

function onChunkMenuSelect(item: DropdownMenuItem & { _action?: string; _index?: number }) {
  if (item._action === 'retry' && item._index !== undefined) {
    emit('retry', item._index)
  } else if (item._action === 'restart' && item._index !== undefined) {
    emit('restart', item._index)
  }
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
          root: chunk.success ? '' : 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950',
        }"
      >
        <template #header>
          <div class="flex items-center justify-between">
            <span class="text-xs font-medium text-gray-500 dark:text-gray-400">
              Paragraph {{ chunk.index + 1 }}
            </span>
            <UDropdownMenu
              :items="chunkMenuItems(chunk.index)"
              @select="onChunkMenuSelect"
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

        <div v-if="chunk.success">
          <p class="text-sm whitespace-pre-wrap">{{ chunk.translated }}</p>
        </div>
        <div v-else>
          <p class="text-xs text-red-600 dark:text-red-400 mb-1">
            Translation failed — showing original text
          </p>
          <p class="text-sm text-gray-500 dark:text-gray-400 whitespace-pre-wrap">
            {{ chunk.original }}
          </p>
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
