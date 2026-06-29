import type { TranslatedChunk } from '../../types/translation'

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

  // Narrowed after the guard above, but re-bind for closure safety
  const lang: string = targetLanguage

  // Chunk the text
  const chunkTexts = splitIntoChunks(fileContent)

  if (chunkTexts.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'File contains no text to translate' })
  }

  const total = chunkTexts.length

  // Set up SSE streaming response
  setHeader(event, 'Content-Type', 'text/event-stream')
  setHeader(event, 'Cache-Control', 'no-cache')
  setHeader(event, 'Connection', 'keep-alive')
  setHeader(event, 'X-Accel-Buffering', 'no')

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      let hasFailure = false

      // Send initial total so frontend knows how many chunks to expect
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'total', total })}\n\n`))

      for (let i = 0; i < total; i++) {
        const original = chunkTexts[i]!
        let chunk: TranslatedChunk

        try {
          const translated = await translateChunk(original, lang)
          chunk = { index: i, original, translated, success: true }
        } catch (firstError) {
          console.warn(`Chunk ${i} first attempt failed, retrying...`, firstError)
          try {
            const translated = await translateChunk(original, lang)
            chunk = { index: i, original, translated, success: true }
          } catch (secondError: any) {
            console.error(`Chunk ${i} failed after retry:`, secondError)
            hasFailure = true
            chunk = {
              index: i,
              original,
              translated: null,
              success: false,
              error: secondError?.message || 'Translation failed',
            }
          }
        }

        // Stream this chunk immediately
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'chunk', chunk })}\n\n`))
      }

      // Send completion event
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'done', hasFailure })}\n\n`),
      )
      controller.close()
    },
  })

  return sendStream(event, stream)
})
