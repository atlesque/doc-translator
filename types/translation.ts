export interface TranslatedChunk {
  index: number
  original: string
  translated: string | null
  success: boolean
  error?: string
  fromCache?: boolean
}

export interface CachedTranslationEntry {
  contentHash: string
  targetLanguage: string
  sourceLanguage?: string
  chunks: TranslatedChunk[]
  totalChunks: number
  timestamp: number
}

export interface TranslateResponse {
  chunks: TranslatedChunk[]
}

export type TranslationStatus =
  | 'idle'
  | 'translating'
  | 'retrying'
  | 'done'
  | 'partial'
  | 'error'
