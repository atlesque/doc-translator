import type { TranslateResponse } from '~/types/translation'

export default defineEventHandler(async (event) => {
  const formData = await readMultipartFormData(event)

  if (!formData) {
    throw createError({ statusCode: 400, statusMessage: 'No form data provided' })
  }

  // Extract file and targetLanguage from form fields
  let fileContent = ''
  let targetLanguage = ''

  for (const field of formData) {
    if (field.name === 'file' && field.filename) {
      fileContent = field.data.toString('utf-8')
    } else if (field.name === 'targetLanguage') {
      targetLanguage = field.data.toString('utf-8')
    }
  }

  if (!fileContent) {
    throw createError({ statusCode: 400, statusMessage: 'No file provided' })
  }

  if (!targetLanguage) {
    throw createError({ statusCode: 400, statusMessage: 'No target language provided' })
  }

  // Chunk the text
  const chunkTexts = splitIntoChunks(fileContent)

  if (chunkTexts.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'File contains no text to translate' })
  }

  // Translate each chunk with one retry
  const chunks: TranslateResponse['chunks'] = []

  for (let i = 0; i < chunkTexts.length; i++) {
    const original = chunkTexts[i]

    try {
      const translated = await translateChunk(original, targetLanguage)
      chunks.push({ index: i, original, translated, success: true })
    } catch (firstError) {
      console.warn(`Chunk ${i} first attempt failed, retrying...`, firstError)
      try {
        const translated = await translateChunk(original, targetLanguage)
        chunks.push({ index: i, original, translated, success: true })
      } catch (secondError: any) {
        console.error(`Chunk ${i} failed after retry:`, secondError)
        chunks.push({
          index: i,
          original,
          translated: null,
          success: false,
          error: secondError?.message || 'Translation failed',
        })
      }
    }
  }

  return { chunks } satisfies TranslateResponse
})
