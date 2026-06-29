# localStorage Translation Cache — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a localStorage-based translation cache using SHA-256 content hashing as the key, with "cached" pills in the UI and a "Clear cache & retry" button.

**Architecture:** New `useTranslationCache` composable (stateless, Web Crypto + localStorage). Integrate into `useTranslation` at `translate()`, `retryChunk()`, and a new `clearCacheAndRetry()`. UI changes in `TranslationResult.vue` (cached pill + clear button) and `index.vue` (wire events).

**Tech Stack:** Nuxt 4, Vue 3, TypeScript, Web Crypto API, localStorage

---

### Task 1: Extend shared types

**Files:**
- Modify: `types/translation.ts`

- [ ] **Step 1: Add `fromCache` to `TranslatedChunk` and create `CachedTranslationEntry`**

In `types/translation.ts`:
- Add optional `fromCache?: boolean` to `TranslatedChunk`
- Add new interface `CachedTranslationEntry` with fields: `contentHash: string`, `targetLanguage: string`, `sourceLanguage?: string`, `chunks: TranslatedChunk[]`, `totalChunks: number`, `timestamp: number`

- [ ] **Step 2: Verify TypeScript compilation**

Run: `cd "/Users/alex/Atlesque/Atlesque Tools/doc-translator" && npx nuxi typecheck`
Expected: no new type errors.

- [ ] **Step 3: Commit**

```bash
git add types/translation.ts
git commit -m "feat: add fromCache flag and CachedTranslationEntry types"
```

---

### Task 2: Create cache composable

**Files:**
- Create: `app/composables/useTranslationCache.ts`

- [ ] **Step 1: Implement `computeContentHash`**

Use `crypto.subtle.digest('SHA-256', await file.arrayBuffer())`, convert to hex string. Return hex string. Handle errors by returning `null` (caller decides to skip caching).

- [ ] **Step 2: Implement `buildCacheKey`**

Return `` `doc-translator:v1:${contentHash}:${targetLanguage}` ``.

- [ ] **Step 3: Implement `loadCacheEntry`**

Read from `localStorage.getItem(key)`, JSON parse, validate shape (check `contentHash`, `chunks` array exists). Return `CachedTranslationEntry | null`. Catch JSON parse errors → return null.

- [ ] **Step 4: Implement `saveCacheEntry`**

`localStorage.setItem(key, JSON.stringify(entry))` wrapped in try/catch for `QuotaExceededError` (console.warn, no throw).

- [ ] **Step 5: Implement `updateCachedChunk`**

Load existing entry via `loadCacheEntry`. If entry exists, replace `chunks[index]` with the new chunk, call `saveCacheEntry`. If entry doesn't exist, create a minimal entry with just that chunk and save.

- [ ] **Step 6: Implement `deleteCacheEntry` and `hasCacheEntry`**

`deleteCacheEntry`: `localStorage.removeItem(key)`.
`hasCacheEntry`: call `buildCacheKey` then `localStorage.getItem(key) !== null`.

- [ ] **Step 7: Export all functions from the composable**

Return all seven functions from `useTranslationCache()`.

- [ ] **Step 8: Verify TypeScript compilation**

Run: `npx nuxi typecheck`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add app/composables/useTranslationCache.ts
git commit -m "feat: add useTranslationCache composable with SHA-256 + localStorage"
```

---

### Task 3: Integrate cache into useTranslation

**Files:**
- Modify: `app/composables/useTranslation.ts`

This is the main integration — modify `translate()`, `retryChunk()`, add new state and `clearCacheAndRetry()`.

- [ ] **Step 1: Import and instantiate cache composable**

Add `import { useTranslationCache } from './useTranslationCache'` and call `const cache = useTranslationCache()` at the top of `useTranslation()`.

- [ ] **Step 2: Add new reactive state**

Add `const cacheKey = ref<string | null>(null)` and `const hasCachedChunks = computed(() => chunks.value.some(c => c.fromCache))`.

- [ ] **Step 3: Modify `translate()` — add cache check at entry**

After extracting `file` and `lang`, before the `status.value = 'translating'` line:
1. Compute `const contentHash = await cache.computeContentHash(file)`
2. If null, skip caching (proceed as normal)
3. Build key: `const key = cache.buildCacheKey(contentHash, effectiveTargetLang)`
4. Check: `const cached = cache.loadCacheEntry(key)`
5. If cached and `cached.chunks.length === totalChunks` (full hit): restore all chunks with `fromCache: true`, set status to done/partial, set progress/detectedLanguage/targetLanguage from cache, store `cacheKey`, return early
6. If cached and partial (fewer chunks): set cached chunks as initial `chunks` ref (with `fromCache: true`), set progress with cached count, set `cacheKey`, store `startIndex = cached.chunks.length`, then proceed to SSE translation
7. If no cache: set `cacheKey`, proceed to normal SSE translation

- [ ] **Step 4: Modify SSE `processEvent` — save chunks incrementally**

In the `'chunk'` case handler: after appending the chunk to `chunks`, call `cache.saveCacheEntry(cacheKey.value!, { contentHash, targetLanguage: effectiveTargetLang, sourceLanguage: effectiveSourceLang, chunks: chunks.value, totalChunks: progress.value.total, timestamp: Date.now() })`.

In the `'done'` case handler: also save the final state to cache.

- [ ] **Step 5: Modify `retryChunk()` — update cache on success**

After a successful retry (where `result.success && result.translated`), call `cache.updateCachedChunk(cacheKey.value!, index, chunks.value[index])`.

- [ ] **Step 6: Add `clearCacheAndRetry()` function**

1. If `cacheKey.value`, call `cache.deleteCacheEntry(cacheKey.value)`
2. Remove `fromCache: true` from all chunks (map over and delete the property, or set to false)
3. Call `translate(originalFile!, effectiveTargetLanguage)` to restart fresh

Note: `clearCacheAndRetry()` needs access to the original file. The composable already stores `originalFile` — but for the full-cache-hit case where we didn't call the server, we need to also store it. Make sure `originalFile` is set before any cache-hit early return.

- [ ] **Step 7: Export `hasCachedChunks` and `clearCacheAndRetry`**

Add them to the return object alongside existing exports.

- [ ] **Step 8: Verify TypeScript compilation

Run: `npx nuxi typecheck`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add app/composables/useTranslation.ts
git commit -m "feat: integrate localStorage cache into translation flow"
```

---

### Task 4: Add "cached" pill and "Clear cache & retry" button to TranslationResult

**Files:**
- Modify: `app/components/TranslationResult.vue`

- [ ] **Step 1: Add new prop `hasCachedChunks`**

Add `hasCachedChunks?: boolean` to props definition (default `false`).

- [ ] **Step 2: Add new emit `clearCache`**

Add `(e: 'clearCache'): void` to emits definition.

- [ ] **Step 3: Add "Clear cache & retry" button in top action bar**

In the top action bar `div` (alongside Retry all failed, Copy all, Download), add:

```html
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
```

- [ ] **Step 4: Add "cached" pill on chunk card headers**

In the card header template, next to `<span>Paragraph {{ chunk.index + 1 }}</span>`, add:

```html
<UBadge
  v-if="chunk.fromCache"
  label="cached"
  color="info"
  variant="soft"
  size="xs"
/>
```

- [ ] **Step 5: Verify TypeScript compilation**

Run: `npx nuxi typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add app/components/TranslationResult.vue
git commit -m "feat: add cached pill and clear cache button to TranslationResult"
```

---

### Task 5: Wire clearCache in index.vue

**Files:**
- Modify: `app/pages/index.vue`

- [ ] **Step 1: Destructure new exports from useTranslation**

Add `hasCachedChunks` and `clearCacheAndRetry` to the destructured composable call.

- [ ] **Step 2: Pass `hasCachedChunks` to TranslationResult**

On each `<TranslationResult>` usage (there are 4 instances across translating, retrying, done/partial, and error states), add `:has-cached-chunks="hasCachedChunks"` prop.

- [ ] **Step 3: Wire `@clearCache` event**

On each `<TranslationResult>` instance, add `@clear-cache="clearCacheAndRetry"`.

- [ ] **Step 4: Verify TypeScript compilation**

Run: `npx nuxi typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/pages/index.vue
git commit -m "feat: wire clear cache to index page"
```

---

### Task 6: Verification

- [ ] **Step 1: Manual test — first translation saves to cache**

1. Upload a `.txt` file, select a language, click Translate
2. Let translation complete
3. Open DevTools → Application → Local Storage → verify an entry exists with key `doc-translator:v1:{hash}:{lang}` containing the chunks

- [ ] **Step 2: Manual test — re-upload hits cache (full hit)**

1. Upload the SAME file with the SAME target language
2. Verify: result screen appears immediately with all chunks showing a blue "cached" pill
3. Verify: "Clear cache & retry" button is visible in the action bar

- [ ] **Step 3: Manual test — "Clear cache & retry" works**

1. Click "Clear cache & retry"
2. Verify: translation restarts from scratch (SSE progress bar visible)
3. Verify: "cached" pills are gone on the new results
4. Verify: localStorage entry is updated with fresh translation

- [ ] **Step 4: Manual test — retry a chunk updates cache**

1. Translate a file; if any chunk fails, use context menu → "Retry this paragraph"
2. After retry succeeds, check localStorage — verify that chunk's entry is updated
3. Re-upload the same file — verify the retried chunk shows with "cached" pill

- [ ] **Step 5: Manual test — different file, same language (cache miss)**

1. Upload a DIFFERENT `.txt` file with the same target language
2. Verify: normal SSE translation happens (no cached pills on first run)
3. Verify: a separate localStorage entry is created for the new file

---

## Relevant files

- `types/translation.ts` — add `fromCache` field and `CachedTranslationEntry` interface
- `app/composables/useTranslationCache.ts` — NEW: checksum, load/save/delete/update cache functions
- `app/composables/useTranslation.ts` — integrate cache into translate/retry/clear flow
- `app/components/TranslationResult.vue` — cached pill (UBadge), clear cache button (UButton)
- `app/pages/index.vue` — destructure hasCachedChunks/clearCacheAndRetry, pass to TranslationResult

## Decisions

- **SHA-256 via Web Crypto** — no dependencies, universally supported
- **localStorage over IndexedDB** — simpler API, sufficient capacity for text translations
- **Cache key includes target language** — same file translated to different languages gets separate cache entries
- **Partial cache hit uses existing `startIndex` server param** — already implemented for `restartFromChunk`
- **Cache failures are silent** — translation always proceeds, cache is best-effort enhancement
- **"Clear cache & retry" re-translates entirely** — does NOT attempt to reuse uncached chunks from the previous run
