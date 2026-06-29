import { readonly, ref } from 'vue'
import type { TranslatedChunk, TranslationStatus } from '../../types/translation'

interface SSEEvent {
  type: 'total' | 'chunk' | 'done'
  total?: number
  chunk?: TranslatedChunk
  hasFailure?: boolean
}

export function useTranslation() {
  const status = ref<TranslationStatus>('idle')
  const chunks = ref<TranslatedChunk[]>([])
  const progress = ref({ current: 0, total: 0 })
  const error = ref<string | null>(null)
  const targetLanguage = ref('')
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

  async function translate(file: File, lang: string) {
    status.value = 'translating'
    targetLanguage.value = lang
    error.value = null
    chunks.value = []
    progress.value = { current: 0, total: 0 }

    let aborted = false

    function processEvent(event: SSEEvent) {
      if (aborted) return
      switch (event.type) {
        case 'total':
          progress.value = { current: 0, total: event.total! }
          break
        case 'chunk':
          chunks.value = [...chunks.value, event.chunk!]
          progress.value = { current: chunks.value.length, total: progress.value.total }
          break
        case 'done': {
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
      if (buffer.startsWith('data: ')) {
        try {
          const event = JSON.parse(buffer.slice(6)) as SSEEvent
          processEvent(event)
        } catch { /* skip */ }
      }
    } catch (err: any) {
      aborted = true
      if (status.value === 'translating') {
        status.value = 'error'
        error.value = err?.message || 'Translation request failed'
      }
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
    apiKeyConfigured: readonly(apiKeyConfigured),
    configChecked: readonly(configChecked),
    translate,
    reset,
    checkConfig,
  }
}
