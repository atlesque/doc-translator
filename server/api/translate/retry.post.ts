export default defineEventHandler(async (event) => {
  const body = await readBody<{
    text: string
    targetLanguage: string
    sourceLanguage?: string
  }>(event)

  if (!body?.text || !body?.targetLanguage) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing text or targetLanguage',
    })
  }

  let result: { translated: string; success: true } | { success: false; error: string }
  try {
    const translated = await translateChunk(body.text, body.targetLanguage, body.sourceLanguage)
    result = { translated, success: true }
  } catch (firstError: any) {
    console.warn('Single chunk retry first attempt failed, retrying...', firstError)
    try {
      const translated = await translateChunk(body.text, body.targetLanguage, body.sourceLanguage)
      result = { translated, success: true }
    } catch (secondError: any) {
      result = { success: false, error: secondError?.message || 'Translation failed' }
    }
  }

  return result
})
