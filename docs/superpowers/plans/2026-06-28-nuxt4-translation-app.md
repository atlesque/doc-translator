# Nuxt 4 Translation App — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap a Nuxt 4 + Nuxt UI translation app that accepts .txt file uploads, chunks by paragraph, sends to DeepSeek API for translation, and displays results with copy/download.

**Architecture:** Single-page Nuxt 4 app with server API route. Client components (FileUpload, LanguageSelect, TranslationResult) wired through a `useTranslation` composable. Server-side chunker and DeepSeek client handle translation logic. API key never exposed to client.

**Tech Stack:** Nuxt 4, pnpm, @nuxt/ui (v3), TypeScript, DeepSeek API (deepseek-v3)

---

## File Structure

```
doc-translator/
├── nuxt.config.ts
├── package.json
├── tsconfig.json
├── .env                    # DEEPSEEK_API_KEY (gitignored)
├── .env.example            # Template without real key
├── .gitignore
├── server/
│   ├── api/
│   │   └── translate.post.ts
│   └── utils/
│       ├── chunker.ts
│       └── deepseek.ts
├── app/
│   ├── app.vue
│   ├── pages/
│   │   └── index.vue
│   ├── components/
│   │   ├── FileUpload.vue
│   │   ├── LanguageSelect.vue
│   │   └── TranslationResult.vue
│   └── composables/
│       └── useTranslation.ts
└── types/
    └── translation.ts
```

---

### Task 1: Bootstrap Nuxt 4 Project

**Files:**
- Create: `package.json`, `nuxt.config.ts`, `tsconfig.json`, `.gitignore`, `app/app.vue`

- [ ] **Step 1: Scaffold Nuxt 4 project with pnpm**

Run:
```bash
cd "/Users/alex/Atlesque/Atlesque Tools/copilot-worktrees/doc-translator/atlesque-shiny-guide"
pnpm create nuxt@latest . --packageManager pnpm
```
Follow prompts: choose "Nuxt 4 (compatibilityVersion: 4)", TypeScript, pnpm.

If interactive prompts aren't feasible, create files manually.

- [ ] **Step 2: Verify project structure exists**

Run:
```bash
ls -la package.json nuxt.config.ts app/app.vue
```
Expected: all three files exist.

- [ ] **Step 3: Install @nuxt/ui**

Run:
```bash
cd "/Users/alex/Atlesque/Atlesque Tools/copilot-worktrees/doc-translator/atlesque-shiny-guide"
pnpm add @nuxt/ui
```

- [ ] **Step 4: Configure nuxt.config.ts**

Edit `nuxt.config.ts` to register @nuxt/ui module:

```typescript
// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/ui'],

  future: {
    compatibilityVersion: 4,
  },

  compatibilityDate: '2025-06-28',
})
```

- [ ] **Step 5: Configure .gitignore for .env**

Ensure `.gitignore` includes:
```
.env
```

- [ ] **Step 6: Install and verify dev server starts**

Run:
```bash
cd "/Users/alex/Atlesque/Atlesque Tools/copilot-worktrees/doc-translator/atlesque-shiny-guide"
pnpm dev
```
Expected: Nuxt dev server starts on http://localhost:3000.

After confirming it starts (5 seconds), stop it with Ctrl+C.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: bootstrap Nuxt 4 project with @nuxt/ui"
```

---

### Task 2: Shared Types

**Files:**
- Create: `types/translation.ts`

- [ ] **Step 1: Create translation types file**

Create `types/translation.ts`:

```typescript
export interface TranslatedChunk {
  index: number
  original: string
  translated: string | null
  success: boolean
  error?: string
}

export interface TranslateResponse {
  chunks: TranslatedChunk[]
}

export type TranslationStatus =
  | 'idle'
  | 'translating'
  | 'done'
  | 'partial'
  | 'error'
```

- [ ] **Step 2: Verify TypeScript compilation**

Run:
```bash
cd "/Users/alex/Atlesque/Atlesque Tools/copilot-worktrees/doc-translator/atlesque-shiny-guide"
npx nuxi typecheck
```
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add types/translation.ts
git commit -m "feat: add shared translation types"
```

---

### Task 3: Server Utilities — Chunker

**Files:**
- Create: `server/utils/chunker.ts`

- [ ] **Step 1: Create the chunker**

Create `server/utils/chunker.ts`:

```typescript
/**
 * Splits text into paragraphs separated by two or more newlines.
 * Trims each paragraph and filters out empty strings.
 */
export function splitIntoChunks(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map(chunk => chunk.trim())
    .filter(chunk => chunk.length > 0)
}
```

- [ ] **Step 2: Verify chunker works with test input**

Run (interactive Node.js inline test):
```bash
cd "/Users/alex/Atlesque/Atlesque Tools/copilot-worktrees/doc-translator/atlesque-shiny-guide"
node -e "
const text = 'First paragraph.\n\nSecond paragraph.\n\n\nThird paragraph.';
const chunks = text.split(/\n{2,}/).map(c => c.trim()).filter(c => c.length > 0);
console.log(JSON.stringify(chunks));
console.log('Count:', chunks.length);
"
```
Expected: `["First paragraph.","Second paragraph.","Third paragraph."]` and `Count: 3`.

- [ ] **Step 3: Commit**

```bash
git add server/utils/chunker.ts
git commit -m "feat: add paragraph chunker utility"
```

---

### Task 4: Server Utilities — DeepSeek Client

**Files:**
- Create: `server/utils/deepseek.ts`, `.env.example`

- [ ] **Step 1: Create .env.example**

Create `.env.example`:

```
DEEPSEEK_API_KEY=sk-your-key-here
```

- [ ] **Step 2: Create DeepSeek client**

Create `server/utils/deepseek.ts`:

```typescript
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions'

const SYSTEM_PROMPT =
  'You are a professional translator. Translate the following text to the target language. Preserve formatting, tone, and paragraph structure. Output only the translation with no additional commentary or notes.'

export async function translateChunk(
  text: string,
  targetLanguage: string,
): Promise<string> {
  const apiKey = useRuntimeConfig().deepseekApiKey

  if (!apiKey) {
    throw new Error(
      'DEEPSEEK_API_KEY is not configured. Set it in .env file.',
    )
  }

  const response = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Translate the following text to ${targetLanguage}:\n\n${text}`,
        },
      ],
      temperature: 0.1,
      max_tokens: 4096,
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`DeepSeek API error ${response.status}: ${errorBody}`)
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>
  }

  return data.choices[0].message.content.trim()
}
```

- [ ] **Step 3: Update nuxt.config.ts to read runtime config**

Edit `nuxt.config.ts`:

```typescript
// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/ui'],

  future: {
    compatibilityVersion: 4,
  },

  compatibilityDate: '2025-06-28',

  runtimeConfig: {
    deepseekApiKey: '',
  },
})
```

- [ ] **Step 4: Commit**

```bash
git add server/utils/deepseek.ts .env.example nuxt.config.ts
git commit -m "feat: add DeepSeek API client utility"
```

---

### Task 5: Server API Route — /api/translate

**Files:**
- Create: `server/api/translate.post.ts`

- [ ] **Step 1: Create the API route**

Create `server/api/translate.post.ts`:

```typescript
import { ref } from 'vue'
import type { TranslateResponse } from '~/types/translation'

export default defineEventHandler(async (event) => {
  const formData = await readMultipartFormData(event)

  if (!formData) {
    throw createError({ statusCode: 400, statusMessage: 'No form data provided' })
  }

  // Extract file and targetLanguage from form fields
  let fileContent = ''
  let targetLanguage = ''

  for (const field of formData) {
    if (field.name === 'file' && field.filename) {
      fileContent = field.data.toString('utf-8')
    } else if (field.name === 'targetLanguage') {
      targetLanguage = field.data.toString('utf-8')
    }
  }

  if (!fileContent) {
    throw createError({ statusCode: 400, statusMessage: 'No file provided' })
  }

  if (!targetLanguage) {
    throw createError({ statusCode: 400, statusMessage: 'No target language provided' })
  }

  // Chunk the text
  const chunkTexts = splitIntoChunks(fileContent)

  if (chunkTexts.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'File contains no text to translate' })
  }

  // Translate each chunk with one retry
  const chunks: TranslateResponse['chunks'] = []

  for (let i = 0; i < chunkTexts.length; i++) {
    const original = chunkTexts[i]

    try {
      const translated = await translateChunk(original, targetLanguage)
      chunks.push({ index: i, original, translated, success: true })
    } catch (firstError) {
      console.warn(`Chunk ${i} first attempt failed, retrying...`, firstError)
      try {
        const translated = await translateChunk(original, targetLanguage)
        chunks.push({ index: i, original, translated, success: true })
      } catch (secondError: any) {
        console.error(`Chunk ${i} failed after retry:`, secondError)
        chunks.push({
          index: i,
          original,
          translated: null,
          success: false,
          error: secondError?.message || 'Translation failed',
        })
      }
    }
  }

  return { chunks } satisfies TranslateResponse
})
```

- [ ] **Step 2: Commit**

```bash
git add server/api/translate.post.ts
git commit -m "feat: add /api/translate endpoint with chunking and retry"
```

---

### Task 6: Composable — useTranslation

**Files:**
- Create: `app/composables/useTranslation.ts`

- [ ] **Step 1: Create the composable**

Create `app/composables/useTranslation.ts`:

```typescript
import type { TranslatedChunk, TranslationStatus } from '~/types/translation'

export function useTranslation() {
  const status = ref<TranslationStatus>('idle')
  const chunks = ref<TranslatedChunk[]>([])
  const progress = ref({ current: 0, total: 0 })
  const error = ref<string | null>(null)
  const targetLanguage = ref('')

  async function translate(file: File, lang: string) {
    status.value = 'translating'
    targetLanguage.value = lang
    error.value = null
    chunks.value = []

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('targetLanguage', lang)

      const response = await $fetch<{ chunks: TranslatedChunk[] }>(
        '/api/translate',
        {
          method: 'POST',
          body: formData,
        },
      )

      chunks.value = response.chunks
      progress.value = { current: response.chunks.length, total: response.chunks.length }

      const failedCount = response.chunks.filter(c => !c.success).length

      if (failedCount === response.chunks.length) {
        status.value = 'error'
        error.value = 'All chunks failed to translate.'
      } else if (failedCount > 0) {
        status.value = 'partial'
      } else {
        status.value = 'done'
      }
    } catch (err: any) {
      status.value = 'error'
      error.value = err?.data?.statusMessage || err?.message || 'Translation request failed'
    }
  }

  function reset() {
    status.value = 'idle'
    chunks.value = []
    progress.value = { current: 0, total: 0 }
    error.value = null
    targetLanguage.value = ''
  }

  return {
    status: readonly(status),
    chunks: readonly(chunks),
    progress: readonly(progress),
    error: readonly(error),
    targetLanguage: readonly(targetLanguage),
    translate,
    reset,
  }
}
```

- [ ] **Step 2: Verify TypeScript compilation**

Run:
```bash
cd "/Users/alex/Atlesque/Atlesque Tools/copilot-worktrees/doc-translator/atlesque-shiny-guide"
npx nuxi typecheck
```
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add app/composables/useTranslation.ts
git commit -m "feat: add useTranslation composable"
```

---

### Task 7: Component — FileUpload

**Files:**
- Create: `app/components/FileUpload.vue`

- [ ] **Step 1: Create FileUpload component**

Create `app/components/FileUpload.vue`:

```vue
<script setup lang="ts">
const props = defineProps<{
  modelValue: File | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: File | null): void
}>()

const isDragging = ref(false)
const error = ref<string | null>(null)

const ALLOWED_EXTENSIONS = ['.txt']
const ALLOWED_MIME = ['text/plain']

function validateFile(file: File): boolean {
  const extension = '.' + file.name.split('.').pop()?.toLowerCase()
  if (!ALLOWED_EXTENSIONS.includes(extension) && !ALLOWED_MIME.includes(file.type)) {
    error.value = 'Only .txt files are supported.'
    return false
  }
  error.value = null
  return true
}

function handleFile(file: File) {
  if (validateFile(file)) {
    emit('update:modelValue', file)
  }
}

function onDrop(e: DragEvent) {
  isDragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) handleFile(file)
}

function onFileInput(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) handleFile(file)
}

function onPaste(e: ClipboardEvent) {
  const file = e.clipboardData?.files?.[0]
  if (file) handleFile(file)
}

function clearFile() {
  emit('update:modelValue', null)
  error.value = null
}
</script>

<template>
  <div>
    <div
      v-if="!modelValue"
      class="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors"
      :class="isDragging ? 'border-primary-500 bg-primary-50 dark:bg-primary-950' : 'border-gray-300 dark:border-gray-600 hover:border-primary-400'"
      @dragover.prevent="isDragging = true"
      @dragleave="isDragging = false"
      @drop.prevent="onDrop"
      @paste="onPaste"
    >
      <UIcon name="i-heroicons-document-arrow-up" class="mx-auto text-4xl text-gray-400 mb-3" />
      <p class="text-sm font-medium text-gray-700 dark:text-gray-300">
        Drag & drop a .txt file here
      </p>
      <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
        or click to browse &mdash; or paste content
      </p>
      <input
        type="file"
        accept=".txt,text/plain"
        class="absolute inset-0 opacity-0 cursor-pointer"
        @change="onFileInput"
      >
    </div>

    <div
      v-else
      class="border rounded-lg p-4 flex items-center justify-between bg-gray-50 dark:bg-gray-800"
    >
      <div class="flex items-center gap-2">
        <UIcon name="i-heroicons-document-text" class="text-gray-500" />
        <span class="text-sm font-medium">{{ modelValue.name }}</span>
        <span class="text-xs text-gray-400">({{ (modelValue.size / 1024).toFixed(1) }} KB)</span>
      </div>
      <UButton
        icon="i-heroicons-x-mark"
        color="gray"
        variant="ghost"
        size="xs"
        @click="clearFile"
      />
    </div>

    <p v-if="error" class="text-red-500 text-xs mt-1">{{ error }}</p>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add app/components/FileUpload.vue
git commit -m "feat: add FileUpload component with drag/drop and paste"
```

---

### Task 8: Component — LanguageSelect

**Files:**
- Create: `app/components/LanguageSelect.vue`

- [ ] **Step 1: Create LanguageSelect component**

Create `app/components/LanguageSelect.vue`:

```vue
<script setup lang="ts">
const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const COMMON_LANGUAGES = [
  'English',
  'Spanish',
  'French',
  'German',
  'Chinese',
  'Japanese',
  'Korean',
  'Italian',
  'Portuguese',
  'Russian',
  'Arabic',
  'Dutch',
  'Polish',
  'Turkish',
  'Vietnamese',
]

const selectOptions = [
  ...COMMON_LANGUAGES.map(lang => ({ label: lang, value: lang })),
  { label: 'Other…', value: '__other__' },
]

const selectedLanguage = computed({
  get: () => {
    if (!props.modelValue) return ''
    if (COMMON_LANGUAGES.includes(props.modelValue)) return props.modelValue
    return '__other__'
  },
  set: (val: string) => {
    if (val === '__other__') {
      emit('update:modelValue', '')
    } else {
      emit('update:modelValue', val)
    }
  },
})

const showCustomInput = computed(() => !COMMON_LANGUAGES.includes(props.modelValue) && props.modelValue !== '' || selectedLanguage.value === '__other__')

function onCustomInput(val: string) {
  emit('update:modelValue', val)
}
</script>

<template>
  <div class="space-y-3">
    <USelect
      v-model="selectedLanguage"
      :options="selectOptions"
      placeholder="Select language"
      label="Target Language"
    />

    <UInput
      v-if="showCustomInput"
      :model-value="selectedLanguage === '__other__' ? '' : modelValue"
      placeholder="Enter any language..."
      @update:model-value="onCustomInput"
    />
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add app/components/LanguageSelect.vue
git commit -m "feat: add LanguageSelect component with custom language support"
```

---

### Task 9: Component — TranslationResult

**Files:**
- Create: `app/components/TranslationResult.vue`

- [ ] **Step 1: Create TranslationResult component**

Create `app/components/TranslationResult.vue`:

```vue
<script setup lang="ts">
import type { TranslatedChunk } from '~/types/translation'

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
```

- [ ] **Step 2: Commit**

```bash
git add app/components/TranslationResult.vue
git commit -m "feat: add TranslationResult component with copy and download"
```

---

### Task 10: App Layout — app.vue

**Files:**
- Modify: `app/app.vue`

- [ ] **Step 1: Update app.vue with clean layout**

Replace contents of `app/app.vue`:

```vue
<template>
  <UContainer>
    <NuxtPage />
  </UContainer>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add app/app.vue
git commit -m "feat: set up app root layout with Nuxt UI container"
```

---

### Task 11: Page — index.vue (Orchestrator)

**Files:**
- Create/modify: `app/pages/index.vue`

- [ ] **Step 1: Create the main page**

Create `app/pages/index.vue`:

```vue
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
```

- [ ] **Step 2: Verify TypeScript compilation**

Run:
```bash
cd "/Users/alex/Atlesque/Atlesque Tools/copilot-worktrees/doc-translator/atlesque-shiny-guide"
npx nuxi typecheck
```
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add app/pages/index.vue
git commit -m "feat: add main translation page with three-state flow"
```

---

### Task 12: Final Verification

**Files:**
- Modify: `.env` (create with placeholder)

- [ ] **Step 1: Create .env file**

Create `.env`:

```
DEEPSEEK_API_KEY=sk-your-key-here
```

- [ ] **Step 2: Run full type check**

Run:
```bash
cd "/Users/alex/Atlesque/Atlesque Tools/copilot-worktrees/doc-translator/atlesque-shiny-guide"
npx nuxi typecheck
```
Expected: no type errors.

- [ ] **Step 3: Build the project**

Run:
```bash
cd "/Users/alex/Atlesque/Atlesque Tools/copilot-worktrees/doc-translator/atlesque-shiny-guide"
pnpm build
```
Expected: successful build with no errors.

- [ ] **Step 4: Verify all files exist**

Run:
```bash
cd "/Users/alex/Atlesque/Atlesque Tools/copilot-worktrees/doc-translator/atlesque-shiny-guide"
echo "=== Checking all expected files ==="
for f in \
  package.json \
  nuxt.config.ts \
  tsconfig.json \
  .env \
  .env.example \
  .gitignore \
  types/translation.ts \
  server/utils/chunker.ts \
  server/utils/deepseek.ts \
  server/api/translate.post.ts \
  app/app.vue \
  app/pages/index.vue \
  app/components/FileUpload.vue \
  app/components/LanguageSelect.vue \
  app/components/TranslationResult.vue \
  app/composables/useTranslation.ts; do
  [ -f "$f" ] && echo "  ✓ $f" || echo "  ✗ MISSING: $f"
done
```
Expected: all files show ✓.

- [ ] **Step 5: Final commit**

```bash
git add .env
git commit -m "chore: add .env file and final verification"
```
