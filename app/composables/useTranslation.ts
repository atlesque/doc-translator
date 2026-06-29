import { computed, readonly, ref } from 'vue'
import type { TranslatedChunk, TranslationStatus } from '../../types/translation'
import { useTranslationCache } from './useTranslationCache'

interface SSEEvent {
  type: 'total' | 'detectedLanguage' | 'chunk' | 'done'
  total?: number
  detectedLanguage?: string
  chunk?: TranslatedChunk
  hasFailure?: boolean
}

export function useTranslation() {
  const status = ref<TranslationStatus>('idle')
  const chunks = ref<TranslatedChunk[]>([])
  const progress = ref({ current: 0, total: 0 })
  const error = ref<string | null>(null)
  const targetLanguage = ref('')
  const detectedLanguage = ref<string | null>(null)
  const retryingIndex = ref<number | null>(null)
  const apiKeyConfigured = ref(true)
  const configChecked = ref(false)

  // Keep a reference to the original file for restart-from-chunk
  let originalFile: File | null = null
  let effectiveTargetLanguage = ''
  let effectiveSourceLanguage: string | undefined

  const cache = useTranslationCache()
  const cacheKey = ref<string | null>(null)
  const hasCachedChunks = computed(() => chunks.value.some(c => c.fromCache))

  async function checkConfig() {
    try {
      const result = await $fetch<{ configured: boolean }>('/api/config-check')
      apiKeyConfigured.value = result.configured
    } catch {
      apiKeyConfigured.value = false
    } finally {
      configChecked.value = true
    }
  }

  let abortController: AbortController | null = null
  let cancelled = false

  function cancel() {
    cancelled = true
    abortController?.abort()
    if (status.value === 'translating') {
      status.value = 'partial'
    }
  }

  /**
   * Retry translating a single failed chunk in-place.
   */
  async function retryChunk(index: number) {
    const chunk = chunks.value[index]
    if (!chunk) return

    // Mark this specific chunk as retrying
    retryingIndex.value = index
    status.value = 'retrying'

    try {
      const result = await $fetch<{ translated?: string; success: boolean; error?: string }>(
        '/api/translate/retry',
        {
          method: 'POST',
          body: {
            text: chunk.original,
            targetLanguage: effectiveTargetLanguage,
            sourceLanguage: effectiveSourceLanguage,
          },
        },
      )

      if (result.success && result.translated) {
        chunks.value[index] = {
          ...chunk,
          translated: result.translated,
          success: true,
          error: undefined,
        }
        // Update cache if we have a cache key
        if (cacheKey.value) {
          cache.updateCachedChunk(cacheKey.value, index, chunks.value[index])
        }
      } else {
        chunks.value[index] = {
          ...chunk,
          error: result.error || 'Retry failed',
        }
      }
    } catch (err: any) {
      chunks.value[index] = {
        ...chunk,
        error: err?.message || 'Retry failed',
      }
    } finally {
      retryingIndex.value = null
    }

    // Re-evaluate overall status
    const failedCount = chunks.value.filter(c => !c.success).length
    if (failedCount === 0) {
      status.value = 'done'
    } else if (failedCount === chunks.value.length) {
      status.value = 'error'
      error.value = 'All chunks failed to translate.'
    } else {
      status.value = 'partial'
    }
  }

  /**
   * Retry all failed chunks sequentially.
   */
  async function retryAll() {
    const failed = chunks.value
      .map((c, i) => (c.success ? -1 : i))
      .filter(i => i !== -1)

    if (failed.length === 0) return

    for (const index of failed) {
      await retryChunk(index)
    }
  }

  /**
   * Keeps all chunks before the given index, re-translates from index onward.
   */
  async function restartFromChunk(index: number) {
    if (!originalFile) return

    cancelled = false
    abortController = new AbortController()

    // Keep chunks before the restart point
    const preservedChunks = chunks.value.slice(0, index)

    status.value = 'translating'
    error.value = null
    chunks.value = preservedChunks
    progress.value = { current: preservedChunks.length, total: progress.value.total }

    function processEvent(event: SSEEvent) {
      if (cancelled) return
      switch (event.type) {
        case 'total':
          // total now represents remaining chunks; add preserved count for display
          progress.value = { current: preservedChunks.length, total: preservedChunks.length + event.total! }
          break
        case 'chunk':
          chunks.value = [...chunks.value, event.chunk!]
          progress.value = { current: chunks.value.length, total: progress.value.total }
          break
        case 'done': {
          if (cancelled) break
          const failedCount = chunks.value.filter(c => !c.success).length
          if (failedCount === chunks.value.length) {
            status.value = 'error'
            error.value = 'All chunks failed to translate.'
          } else if (failedCount > 0) {
            status.value = 'partial'
          } else {
            status.value = 'done'
          }
          break
        }
      }
    }

    try {
      const formData = new FormData()
      formData.append('file', originalFile)
      formData.append('targetLanguage', effectiveTargetLanguage)
      formData.append('startIndex', String(index))

      const response = await fetch('/api/translate', {
        method: 'POST',
        body: formData,
        signal: abortController.signal,
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({ statusMessage: response.statusText }))
        throw new Error(body?.statusMessage || `HTTP ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        if (cancelled) {
          reader.cancel()
          break
        }
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''

        for (const part of parts) {
          if (!part.startsWith('data: ')) continue
          try {
            const event = JSON.parse(part.slice(6)) as SSEEvent
            processEvent(event)
          } catch { /* skip */ }
        }
      }

      if (!cancelled && buffer.startsWith('data: ')) {
        try {
          const event = JSON.parse(buffer.slice(6)) as SSEEvent
          processEvent(event)
        } catch { /* skip */ }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return
      cancelled = true
      if (status.value === 'translating') {
        status.value = 'error'
        error.value = err?.message || 'Translation request failed'
      }
    } finally {
      abortController = null
    }
  }

  async function translate(file: File, lang: string) {
    cancelled = false
    originalFile = file
    effectiveTargetLanguage = lang
    effectiveSourceLanguage = undefined

    // Check localStorage cache before starting translation
    const contentHash = await cache.computeContentHash(file)
    if (contentHash) {
      const resolvedTargetLang = lang === 'Auto-detect' ? 'English' : lang
      const key = cache.buildCacheKey(contentHash, resolvedTargetLang)
      const cached = cache.loadCacheEntry(key)
      if (cached && cached.chunks.length > 0) {
        const allCached = cached.chunks.length === cached.totalChunks
        if (allCached) {
          // Full cache hit — restore everything immediately
          chunks.value = cached.chunks.map(c => ({ ...c, fromCache: true }))
          progress.value = { current: cached.totalChunks, total: cached.totalChunks }
          detectedLanguage.value = cached.sourceLanguage ?? null
          effectiveSourceLanguage = cached.sourceLanguage ?? undefined
          targetLanguage.value = cached.targetLanguage
          cacheKey.value = key
          const failedCount = cached.chunks.filter(c => !c.success).length
          if (failedCount === cached.totalChunks) {
            status.value = 'error'
            error.value = 'All chunks failed to translate.'
          } else if (failedCount > 0) {
            status.value = 'partial'
          } else {
            status.value = 'done'
          }
          return
        } else {
          // Partial cache hit — replay cached chunks, translate the rest
          chunks.value = cached.chunks.map(c => ({ ...c, fromCache: true }))
          progress.value = { current: cached.chunks.length, total: cached.totalChunks }
          detectedLanguage.value = cached.sourceLanguage ?? null
          effectiveSourceLanguage = cached.sourceLanguage ?? undefined
          targetLanguage.value = cached.targetLanguage
          cacheKey.value = key
        }
      } else {
        // Cache miss or empty — start fresh, record key for saving later
        cacheKey.value = key
      }
    }

    status.value = 'translating'
    targetLanguage.value = lang
    error.value = null
    chunks.value = []
    detectedLanguage.value = null
    progress.value = { current: 0, total: 0 }

    abortController = new AbortController()

    /**
     * Persists the current chunks array to localStorage cache.
     * Uses the cached contentHash and resolved target language for the key.
     * No-op if no cache key has been established (hashing failed or was skipped).
     */
    function persistToCache() {
      const key = cacheKey.value
      if (!key) return
      cache.saveCacheEntry(key, {
        contentHash: contentHash ?? '',
        targetLanguage: lang === 'Auto-detect' ? 'English' : lang,
        sourceLanguage: effectiveSourceLanguage,
        chunks: chunks.value,
        totalChunks: progress.value.total,
        timestamp: Date.now(),
      })
    }

    function processEvent(event: SSEEvent) {
      if (cancelled) return
      switch (event.type) {
        case 'total':
          progress.value = { current: 0, total: event.total! }
          break
        case 'detectedLanguage':
          detectedLanguage.value = event.detectedLanguage ?? null
          effectiveSourceLanguage = event.detectedLanguage ?? undefined
          break
        case 'chunk':
          chunks.value = [...chunks.value, event.chunk!]
          progress.value = { current: chunks.value.length, total: progress.value.total }
          // Save to cache incrementally as each chunk arrives
          persistToCache()
          break
        case 'done': {
          if (cancelled) break
          // Save final state to cache
          persistToCache()
          const failedCount = chunks.value.filter(c => !c.success).length
          if (failedCount === chunks.value.length) {
            status.value = 'error'
            error.value = 'All chunks failed to translate.'
          } else if (failedCount > 0) {
            status.value = 'partial'
          } else {
            status.value = 'done'
          }
          break
        }
      }
    }

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('targetLanguage', lang)

      // If partial cache hit, pass startIndex so server skips cached chunks
      if (chunks.value.length > 0) {
        formData.append('startIndex', String(chunks.value.length))
      }

      const response = await fetch('/api/translate', {
        method: 'POST',
        body: formData,
        signal: abortController.signal,
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({ statusMessage: response.statusText }))
        throw new Error(body?.statusMessage || `HTTP ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        if (cancelled) {
          reader.cancel()
          break
        }
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // Process complete SSE messages (separated by \n\n)
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''

        for (const part of parts) {
          if (!part.startsWith('data: ')) continue
          const json = part.slice(6)
          try {
            const event = JSON.parse(json) as SSEEvent
            processEvent(event)
          } catch {
            // skip malformed events
          }
        }
      }

      // Flush remaining buffer
      if (!cancelled && buffer.startsWith('data: ')) {
        try {
          const event = JSON.parse(buffer.slice(6)) as SSEEvent
          processEvent(event)
        } catch { /* skip */ }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        // cancelled by user — already handled in cancel()
        return
      }
      cancelled = true
      if (status.value === 'translating') {
        status.value = 'error'
        error.value = err?.message || 'Translation request failed'
      }
    } finally {
      abortController = null
    }
  }

  /**
   * Clears the cached translation for the current file and re-translates from scratch.
   * Removes the localStorage entry, strips fromCache flags, and restarts translation.
   */
  async function clearCacheAndRetry() {
    if (cacheKey.value) {
      cache.deleteCacheEntry(cacheKey.value)
    }
    cacheKey.value = null

    // Strip fromCache flags from all chunks
    chunks.value = chunks.value.map((c) => {
      const { fromCache, ...rest } = c
      return rest
    })

    // Re-initiate translation from scratch
    if (originalFile) {
      await translate(originalFile, effectiveTargetLanguage)
    }
  }

  function reset() {
    cancelled = true
    abortController?.abort()
    originalFile = null
    effectiveTargetLanguage = ''
    effectiveSourceLanguage = undefined
    retryingIndex.value = null
    cacheKey.value = null
    status.value = 'idle'
    chunks.value = []
    progress.value = { current: 0, total: 0 }
    error.value = null
    targetLanguage.value = ''
    detectedLanguage.value = null
  }

  return {
    status: readonly(status),
    chunks: readonly(chunks),
    retryingIndex: readonly(retryingIndex),
    progress: readonly(progress),
    error: readonly(error),
    targetLanguage: readonly(targetLanguage),
    detectedLanguage: readonly(detectedLanguage),
    hasCachedChunks,
    apiKeyConfigured: readonly(apiKeyConfigured),
    configChecked: readonly(configChecked),
    translate,
    cancel,
    retryChunk,
    retryAll,
    restartFromChunk,
    clearCacheAndRetry,
    reset,
    checkConfig,
  }
}
