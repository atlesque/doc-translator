<script setup lang="ts">
const {
  status,
  chunks,
  error,
  targetLanguage,
  translate,
  reset,
} = useTranslation()

const file = ref<File | null>(null)
const language = ref('')

const canTranslate = computed(
  () => file.value !== null && language.value.trim().length > 0,
)

const buttonLabel = computed(() => {
  if (!language.value) return 'Select a language'
  return `Translate to ${language.value}`
})

async function handleTranslate() {
  if (!file.value || !language.value) return
  await translate(file.value, language.value)
}

function handleReset() {
  file.value = null
  language.value = ''
  reset()
}
</script>

<template>
  <div class="py-8 max-w-2xl mx-auto space-y-6">
    <!-- Header -->
    <div class="text-center">
      <h1 class="text-2xl font-bold">🌐 Doc Translator</h1>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
        Translate .txt files with DeepSeek AI
      </p>
    </div>

    <!-- State 1: Input -->
    <div v-if="status === 'idle'" class="space-y-6">
      <FileUpload v-model="file" />
      <LanguageSelect v-model="language" />
      <UButton
        block
        size="lg"
        :disabled="!canTranslate"
        @click="handleTranslate"
      >
        {{ buttonLabel }}
      </UButton>
    </div>

    <!-- State 2: Translating -->
    <div v-else-if="status === 'translating'" class="text-center py-12 space-y-4">
      <UIcon
        name="i-heroicons-arrow-path"
        class="text-4xl text-primary-500 animate-spin mx-auto"
      />
      <p class="text-lg font-medium">Translating to {{ targetLanguage }}&hellip;</p>
      <p class="text-sm text-gray-500 dark:text-gray-400">
        This may take a moment
      </p>
    </div>

    <!-- State 3: Results -->
    <div v-else-if="status === 'done' || status === 'partial'" class="space-y-6">
      <TranslationResult
        :chunks="chunks"
        :status="status"
        :target-language="targetLanguage"
      />
      <div class="text-center">
        <UButton
          variant="ghost"
          color="gray"
          @click="handleReset"
        >
          Translate another file
        </UButton>
      </div>
    </div>

    <!-- State: Error (no chunks at all) -->
    <UAlert
      v-else-if="status === 'error'"
      color="red"
      :title="error || 'Translation failed'"
      :actions="[{ label: 'Try again', onClick: handleReset }]"
    />
  </div>
</template>
