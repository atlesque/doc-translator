import { readonly, ref } from 'vue'
import type { TranslatedChunk, TranslationStatus } from '../../types/translation'

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
  const apiKeyConfigured = ref(true)
  const configChecked = ref(false)

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

  async function translate(file: File, lang: string) {
    cancelled = false
    status.value = 'translating'
    targetLanguage.value = lang
    error.value = null
    chunks.value = []
    detectedLanguage.value = null
    progress.value = { current: 0, total: 0 }

    abortController = new AbortController()

    function processEvent(event: SSEEvent) {
      if (cancelled) return
      switch (event.type) {
        case 'total':
          progress.value = { current: 0, total: event.total! }
          break
        case 'detectedLanguage':
          detectedLanguage.value = event.detectedLanguage ?? null
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
      formData.append('file', file)
      formData.append('targetLanguage', lang)

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

  function reset() {
    cancelled = true
    abortController?.abort()
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
    progress: readonly(progress),
    error: readonly(error),
    targetLanguage: readonly(targetLanguage),
    detectedLanguage: readonly(detectedLanguage),
    apiKeyConfigured: readonly(apiKeyConfigured),
    configChecked: readonly(configChecked),
    translate,
    cancel,
    reset,
    checkConfig,
  }
}
