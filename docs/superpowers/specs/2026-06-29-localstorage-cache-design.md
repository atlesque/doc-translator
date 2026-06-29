# localStorage Translation Cache — Design Spec

**Date:** 2026-06-29
**Status:** Approved

## Overview

Add a client-side localStorage cache for translation results. Uses SHA-256 content hash of the uploaded `.txt` file as the cache key. Saves translation progress incrementally as chunks arrive via SSE. On re-upload of the same file, replays cached chunks into the translation flow and marks them with a "cached" pill. Includes a "Clear cache & retry" button for fresh re-translation.

## Architecture

```
types/translation.ts              ← Add fromCache, CachedTranslationEntry
app/composables/
  useTranslationCache.ts          ← NEW: checksum, load/save/delete/update cache
  useTranslation.ts               ← Integrate cache into translate/retryChunk/reset
app/components/
  TranslationResult.vue           ← "cached" pill, "Clear cache & retry" button
app/pages/
  index.vue                       ← Wire clearCache event
```

## Types

### Modified: `TranslatedChunk`

```typescript
export interface TranslatedChunk {
  index: number
  original: string
  translated: string | null
  success: boolean
  error?: string
  fromCache?: boolean  // NEW — marks chunk as served from localStorage
}
```

### New: `CachedTranslationEntry`

```typescript
export interface CachedTranslationEntry {
  contentHash: string
  targetLanguage: string
  sourceLanguage?: string
  chunks: TranslatedChunk[]
  totalChunks: number
  timestamp: number
}
```

## localStorage Schema

- **Key format:** `doc-translator:v1:{contentHash}:{targetLang}`
- **Value:** JSON-serialized `CachedTranslationEntry`
- The `v1` prefix enables future schema versioning

## Composable: `useTranslationCache.ts`

Stateless utility. No reactive state.

| Function | Signature | Description |
|---|---|---|
| `computeContentHash` | `(file: File) => Promise<string \| null>` | SHA-256 via Web Crypto API, returns hex or null on failure |
| `buildCacheKey` | `(hash: string, lang: string) => string` | Returns `doc-translator:v1:{hash}:{lang}` |
| `loadCacheEntry` | `(key: string) => CachedTranslationEntry \| null` | Read + parse from localStorage, validate shape |
| `saveCacheEntry` | `(key: string, entry: CachedTranslationEntry) => void` | Write to localStorage, catches QuotaExceededError |
| `updateCachedChunk` | `(key: string, idx: number, chunk: TranslatedChunk) => void` | Replace single chunk in existing entry |
| `deleteCacheEntry` | `(key: string) => void` | Remove from localStorage |
| `hasCacheEntry` | `(hash: string, lang: string) => boolean` | Quick existence check |

Error handling: `QuotaExceededError` caught silently (console.warn). Cache is an enhancement, not critical path.

## Integration: `useTranslation.ts`

### `translate()` flow

1. Compute `contentHash` from file via `computeContentHash()`
2. Build cache key from hash + effective target language
3. **Full cache hit** (all chunks cached): restore chunks with `fromCache: true`, set status to `'done'`/`'partial'`, set progress/detectedLanguage/targetLanguage from cache entry, return immediately — no server call
4. **Partial cache hit** (fewer chunks cached): set cached chunks as initial state with `fromCache: true`, start SSE translation with `startIndex` so server skips cached chunks, save new chunks to cache as they arrive
5. **Cache miss**: normal SSE translation, save each chunk to cache incrementally as they arrive

### `retryChunk()` flow

After successful retry, call `updateCachedChunk()` to overwrite that chunk in the cache entry.

### New state

- `cacheKey: string | null` — active session's cache key
- `hasCachedChunks: ComputedRef<boolean>` — derived from `chunks.some(c => c.fromCache)`

### New exported function

- `clearCacheAndRetry()` — deletes cache entry, resets `fromCache` flags, re-initiates translation

## UI Changes

### `TranslationResult.vue`

**New prop:** `hasCachedChunks: boolean`

**"cached" pill:** `UBadge` with text "cached", color "info", variant "soft", size "xs" — shown next to paragraph number when `chunk.fromCache` is `true`.

**"Clear cache & retry" button:** `UButton` in top action bar (alongside existing Retry/Copy/Download), icon `i-heroicons-trash`, color "warning", variant "outline", shown only when `hasCachedChunks` is `true`.

**New emit:** `(e: 'clearCache'): void`

### `index.vue`

- Reads `hasCachedChunks` from composable, passes to `TranslationResult`
- Wires `@clearCache` to `clearCacheAndRetry()`

## Error Handling

- localStorage full: silent failure (console.warn), translation proceeds uncached
- Corrupt cache data: treated as cache miss, entry overwritten on next save
- Crypto API unavailable (unlikely): fallback gracefully, skip caching entirely
- Cache schema version mismatch (future-proofing): treated as cache miss
