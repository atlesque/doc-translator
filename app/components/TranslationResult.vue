<script setup lang="ts">
import type { TranslatedChunk } from '../../types/translation'

const props = defineProps<{
  chunks: TranslatedChunk[]
  status: 'done' | 'partial'
  targetLanguage: string
}>()

const emit = defineEmits<{
  (e: 'retry', index: number): void
}>()

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
        {{ successCount }} / {{ chunks.length }} paragraphs translated to {{ targetLanguage }}
      </p>
      <div class="flex gap-2">
        <UButton
          icon="i-heroicons-clipboard"
          size="sm"
          color="gray"
          variant="outline"
          @click="copyAll"
        >
          Copy all
        </UButton>
        <UButton
          icon="i-heroicons-arrow-down-tray"
          size="sm"
          color="gray"
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
          base: chunk.success ? '' : 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950',
        }"
      >
        <template #header>
          <div class="flex items-center justify-between">
            <span class="text-xs font-medium text-gray-500 dark:text-gray-400">
              Paragraph {{ chunk.index + 1 }}
            </span>
            <UButton
              v-if="!chunk.success"
              icon="i-heroicons-arrow-path"
              size="xs"
              color="red"
              variant="ghost"
              @click="emit('retry', chunk.index)"
            >
              Retry
            </UButton>
          </div>
        </template>

        <p v-if="chunk.success" class="text-sm whitespace-pre-wrap">
          {{ chunk.translated }}
        </p>
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
        color="gray"
        variant="outline"
        @click="copyAll"
      >
        Copy all
      </UButton>
      <UButton
        icon="i-heroicons-arrow-down-tray"
        size="sm"
        color="gray"
        variant="outline"
        @click="downloadTxt"
      >
        Download .txt
      </UButton>
    </div>
  </div>
</template>
