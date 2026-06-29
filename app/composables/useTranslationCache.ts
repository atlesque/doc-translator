import type { CachedTranslationEntry, TranslatedChunk } from '../../types/translation'

const STORAGE_PREFIX = 'doc-translator:v1'

/**
 * Stateless utility composable for caching translation results in localStorage.
 * Cache key = SHA-256 content hash of the uploaded file + target language.
 * Cache is best-effort: failures are silently logged, translation proceeds uncached.
 */
export function useTranslationCache() {
  /**
   * Computes a SHA-256 hex digest of the file's content using the Web Crypto API.
   * Returns null if the crypto API is unavailable or reading fails.
   */
  async function computeContentHash(file: File): Promise<string | null> {
    try {
      const buffer = await file.arrayBuffer()
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    } catch (err) {
      console.warn('useTranslationCache: Failed to compute content hash', err)
      return null
    }
  }

  /**
   * Builds a localStorage key from a content hash and target language.
   */
  function buildCacheKey(contentHash: string, targetLanguage: string): string {
    return `${STORAGE_PREFIX}:${contentHash}:${targetLanguage}`
  }

  /**
   * Loads a cached translation entry from localStorage.
   * Returns null on miss, corrupt data, or schema mismatch.
   */
  function loadCacheEntry(key: string): CachedTranslationEntry | null {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return null

      const parsed = JSON.parse(raw) as CachedTranslationEntry

      // Validate shape to guard against corrupt data
      if (!parsed.contentHash || !Array.isArray(parsed.chunks)) {
        console.warn('useTranslationCache: Invalid cache entry, discarding')
        localStorage.removeItem(key)
        return null
      }

      return parsed
    } catch {
      return null
    }
  }

  /**
   * Saves a translation entry to localStorage.
   * Silently catches QuotaExceededError and logs a warning.
   */
  function saveCacheEntry(key: string, entry: CachedTranslationEntry): void {
    try {
      localStorage.setItem(key, JSON.stringify(entry))
    } catch (err) {
      if (err instanceof DOMException && err.name === 'QuotaExceededError') {
        console.warn('useTranslationCache: localStorage quota exceeded, cache not saved')
      } else {
        console.warn('useTranslationCache: Failed to save cache entry', err)
      }
    }
  }

  /**
   * Replaces a single chunk at the given index in an existing cache entry.
   * If no entry exists yet (e.g. first chunk saved), creates a minimal one.
   * Note: totalChunks is preserved from the existing entry; if creating a
   * minimal entry, it's set to 0 and should be updated by subsequent saves.
   */
  function updateCachedChunk(
    key: string,
    index: number,
    chunk: TranslatedChunk,
  ): void {
    const existing = loadCacheEntry(key)
    if (existing) {
      // Preserve the fromCache flag if the cached chunk had it
      const updatedChunks = [...existing.chunks]
      updatedChunks[index] = { ...chunk, fromCache: existing.chunks[index]?.fromCache ?? false }
      saveCacheEntry(key, {
        ...existing,
        chunks: updatedChunks,
        timestamp: Date.now(),
      })
    } else {
      // No existing entry — create a minimal one
      saveCacheEntry(key, {
        contentHash: '',
        targetLanguage: '',
        chunks: [chunk],
        totalChunks: 0,
        timestamp: Date.now(),
      })
    }
  }

  /**
   * Deletes a cache entry from localStorage.
   */
  function deleteCacheEntry(key: string): void {
    try {
      localStorage.removeItem(key)
    } catch (err) {
      console.warn('useTranslationCache: Failed to delete cache entry', err)
    }
  }

  /**
   * Checks whether a cache entry exists for the given hash and language.
   */
  function hasCacheEntry(contentHash: string, targetLanguage: string): boolean {
    const key = buildCacheKey(contentHash, targetLanguage)
    return localStorage.getItem(key) !== null
  }

  return {
    computeContentHash,
    buildCacheKey,
    loadCacheEntry,
    saveCacheEntry,
    updateCachedChunk,
    deleteCacheEntry,
    hasCacheEntry,
  }
}
