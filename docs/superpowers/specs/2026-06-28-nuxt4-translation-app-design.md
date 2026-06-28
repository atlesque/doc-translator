# Doc Translator — Design Spec

A Nuxt 4 application for translating `.txt` files using the DeepSeek API. Users upload a file, choose a target language, and receive a paragraph-by-paragraph translation with copy and download options.

## Overview

- **Stack:** Nuxt 4, pnpm, Nuxt UI (v3+), TypeScript
- **API:** DeepSeek API (api.deepseek.com), model DeepSeek-V3, API key via `.env`
- **Rendering:** Nuxt SSR with server API routes
- **Persistence:** None — fully ephemeral

## Architecture

```
doc-translator/
├── nuxt.config.ts
├── package.json
├── server/
│   ├── api/
│   │   └── translate.post.ts     # POST: FormData → chunks → DeepSeek → translated[]
│   └── utils/
│       ├── chunker.ts            # Split by 2+ newlines, trim, filter empty
│       └── deepseek.ts           # DeepSeek chat completions client
├── app/
│   ├── app.vue                   # Root layout
│   ├── pages/
│   │   └── index.vue             # Orchestrator: composes components, owns the flow
│   ├── components/
│   │   ├── FileUpload.vue        # Drag & drop + paste .txt file input
│   │   ├── LanguageSelect.vue    # Dropdown of common languages + "other" custom input
│   │   └── TranslationResult.vue # Result display with copy & download buttons
│   └── composables/
│       └── useTranslation.ts     # Reactive state machine: idle → translating → done/error
├── public/
└── types/
    └── translation.ts            # Shared TypeScript types
```

## Page States

The single page (`index.vue`) has three linear states driven by the `useTranslation` composable:

### State 1: Input
- `FileUpload` component: drag-and-drop zone or paste area, accepts `.txt` only
- `LanguageSelect` component: `USelect` dropdown with common languages + "Other" opens freeform input
- `UButton` "Translate to [language]": disabled until both file and language are set
- Only shows when `status === 'idle'`

### State 2: Translating
- Input components hidden
- Shows a centered loading section: "⏳ Translating to French…" with progress bar (`UProgress`) and chunk counter ("3 / 12")
- Shows when `status === 'translating'`

### State 3: Result
- Top: `[📋 Copy all]` and `[⬇ Download .txt]` buttons
- Each translated paragraph in a `UCard`
  - Successful: shows translated text
  - Failed (after 1 retry): red-tinted card showing original text with a "Retry" button
- Bottom: Repeat of `[📋 Copy all]` and `[⬇ Download .txt]` buttons
- Below results: subtle "Translate another file" link to return to State 1
- Shows when `status === 'done'` or `status === 'partial'`

## Components

### FileUpload.vue
- **Props:** `modelValue: File | null`
- **Emits:** `update:modelValue`
- **Features:** drag-and-drop zone with dashed border, click to browse, paste from clipboard, validates `.txt` extension
- **Display:** shows file name with an X button to remove

### LanguageSelect.vue
- **Props:** `modelValue: string`
- **Emits:** `update:modelValue`
- **Features:** `USelect` with ~15 common languages (English, Spanish, French, German, Chinese, Japanese, Korean, Italian, Portuguese, Russian, Arabic, Dutch, Polish, Turkish, Vietnamese). "Other…" option reveals a `UInput` for custom language entry.
- **Behavior:** selecting "Other" clears the dropdown value and focuses the text input

### TranslationResult.vue
- **Props:** `chunks: TranslatedChunk[]`, `status: 'done' | 'partial'`
- **Emits:** `retry(chunkIndex: number)`
- **Features:** renders chunks as `UCard` list, copy-all button (`navigator.clipboard`), download button (generates `.txt` blob and triggers download via URL.createObjectURL)
- **Copy/download:** at top and bottom of results

### TranslateButton (inline in index.vue)
- `UButton` with `loading` prop, text "Translate to [language]"
- Disabled when file or language missing

## Composable: useTranslation.ts

```
status: Ref<'idle' | 'translating' | 'done' | 'partial' | 'error'>
chunks: Ref<TranslatedChunk[]>
progress: Ref<{ current: number, total: number }>
error: Ref<string | null>
translate(file: File, targetLanguage: string): Promise<void>
reset(): void
```

- `translate()` posts FormData to `/api/translate` via `$fetch`
- On success: sets `status` to `'done'`
- If some chunks failed after retry: sets `status` to `'partial'`, marks those chunks
- If all chunks failed: sets `status` to `'error'`
- `reset()` returns all reactive state to initial values

## Server API

### POST /api/translate

**Request:** `multipart/form-data`
- `file`: `.txt` file
- `targetLanguage`: string

**Response (200):**
```json
{
  "chunks": [
    { "index": 0, "original": "...", "translated": "...", "success": true },
    { "index": 1, "original": "...", "translated": null, "success": false, "error": "Rate limited" }
  ]
}
```

**Flow:**
1. Read file text from FormData
2. `chunker.ts`: split by 2+ consecutive newlines, trim each chunk, filter empties
3. For each chunk, call `deepseek.ts` → DeepSeek chat completions API
4. On failure per chunk: retry once, if still failing mark as failed
5. Return all results as array

### chunker.ts
- `splitIntoChunks(text: string): string[]`
- Splits on `\n\n+` (two or more newlines)
- Trims whitespace from each chunk
- Filters empty strings

### deepseek.ts
- `translateChunk(text: string, targetLanguage: string): Promise<string>`
- Calls `https://api.deepseek.com/v1/chat/completions` with Bearer token from `DEEPSEEK_API_KEY` env var
- System prompt: "You are a professional translator. Translate the following text to {language}. Preserve formatting and tone. Output only the translation, no commentary."
- User message: the chunk text
- Returns `choices[0].message.content`

## Error Handling

- **Per-chunk retry:** 1 automatic retry on failure, then mark as failed
- **Network errors:** caught at the composable level, sets `status: 'error'`
- **Invalid file type:** client-side validation before upload
- **Empty file:** server returns 400 with message
- **Missing API key:** server logs warning, returns 500 with clear message
- **Failed chunks in result:** red-tinted cards with original text and per-chunk retry button

## Environment

```
DEEPSEEK_API_KEY=sk-...
```

## Dependencies

- `nuxt` (4.x)
- `@nuxt/ui` (3.x)
- TypeScript
- pnpm as package manager
