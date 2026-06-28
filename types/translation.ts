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
