<script setup lang="ts">
const {
  status,
  chunks,
  progress,
  error,
  targetLanguage,
  detectedLanguage,
  translate,
  cancel,
  reset,
} = useTranslation()

const file = ref<File | null>(null)
const language = ref('Auto-detect')

const canTranslate = computed(
  () => file.value !== null && language.value.trim().length > 0,
)

const buttonLabel = 'Translate'

const translatingLabel = computed(() => {
  if (detectedLanguage.value) {
    return `Translating from ${detectedLanguage.value} to English…`
  }
  return targetLanguage.value === 'Auto-detect'
    ? 'Detecting language…'
    : `Translating to ${targetLanguage.value}…`
})

const displayLanguage = computed(() =>
  detectedLanguage.value
    ? `${detectedLanguage.value} → English`
    : targetLanguage.value,
)

const progressPercent = computed(() =>
  progress.value.total > 0
    ? Math.round((progress.value.current / progress.value.total) * 100)
    : 0,
)

async function handleTranslate() {
  if (!file.value || !language.value) return
  await translate(file.value, language.value)
}

function handleCancel() {
  cancel()
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
    <div v-else-if="status === 'translating'" class="space-y-6">
      <div class="text-center space-y-3">
        <UIcon
          name="i-heroicons-arrow-path"
          class="text-4xl text-primary-500 animate-spin mx-auto"
        />
        <p class="text-lg font-medium">{{ translatingLabel }}</p>
      </div>

      <!-- Progress bar and counter -->
      <div class="space-y-2">
        <div class="flex justify-between text-sm text-gray-500 dark:text-gray-400">
          <span>
            Paragraph {{ progress.current }} of {{ progress.total || '…' }}
          </span>
          <span>{{ progressPercent }}%</span>
        </div>
        <UProgress
          :model-value="progress.total > 0 ? progressPercent : null"
          :max="100"
          size="lg"
          color="primary"
        />
      </div>

      <!-- Cancel button -->
      <div class="text-center">
        <UButton
          variant="outline"
          color="error"
          size="md"
          @click="handleCancel"
        >
          Cancel translation
        </UButton>
      </div>

      <!-- Progressive chunk display as they arrive -->
      <div v-if="chunks.length > 0" class="space-y-3">
        <TranslationResult
          :chunks="chunks"
          status="partial"
          :target-language="displayLanguage"
        />
      </div>

      <p v-if="chunks.length === 0" class="text-sm text-center text-gray-400 dark:text-gray-500">
        Starting translation…
      </p>
    </div>

    <!-- State 3: Results -->
    <div v-else-if="status === 'done' || status === 'partial'" class="space-y-6">
      <TranslationResult
        :chunks="chunks"
        :status="status"
        :target-language="displayLanguage"
      />
      <div class="text-center">
        <UButton
          variant="ghost"
          color="neutral"
          @click="handleReset"
        >
          Translate another file
        </UButton>
      </div>
    </div>

    <!-- State: All chunks failed (show results + error banner) -->
    <div v-else-if="status === 'error' && chunks.length > 0" class="space-y-6">
      <UAlert
        color="error"
        :title="error || 'Translation failed'"
      />
      <TranslationResult
        :chunks="chunks"
        status="partial"
        :target-language="displayLanguage"
      />
      <div class="text-center">
        <UButton
          variant="ghost"
          color="neutral"
          @click="handleReset"
        >
          Translate another file
        </UButton>
      </div>
    </div>

    <!-- State: Error (no chunks at all — network / config error) -->
    <UAlert
      v-else-if="status === 'error'"
      color="error"
      :title="error || 'Translation failed'"
      :actions="[{ label: 'Try again', onClick: handleReset }]"
    />
  </div>
</template>
