import { readonly, ref } from 'vue'
import type { TranslatedChunk, TranslationStatus } from '../../types/translation'

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
    apiKeyConfigured: readonly(apiKeyConfigured),
    configChecked: readonly(configChecked),
    translate,
    reset,
    checkConfig,
  }
}
