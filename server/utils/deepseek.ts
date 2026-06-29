const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions'

const SYSTEM_PROMPT =
  'You are a professional translator. Translate the following text to the target language. Preserve formatting, tone, and paragraph structure. Output only the translation with no additional commentary or notes.'

const AUTO_DETECT_SYSTEM_PROMPT =
  'You are a professional translator. Detect the source language of the provided text and translate it to English. Preserve formatting, tone, and paragraph structure. Output only the translation with no additional commentary or notes.'

export async function translateChunk(
  text: string,
  targetLanguage: string,
): Promise<string> {
  const apiKey = useRuntimeConfig().deepseekApiKey

  if (!apiKey) {
    throw new Error(
      'DEEPSEEK_API_KEY is not configured. Set it in .env file.',
    )
  }

  const isAutoDetect = targetLanguage === 'Auto-detect'

  const messages = isAutoDetect
    ? [
        { role: 'system' as const, content: AUTO_DETECT_SYSTEM_PROMPT },
        {
          role: 'user' as const,
          content: `Translate the following text to English:\n\n${text}`,
        },
      ]
    : [
        { role: 'system' as const, content: SYSTEM_PROMPT },
        {
          role: 'user' as const,
          content: `Translate the following text to ${targetLanguage}:\n\n${text}`,
        },
      ]

  const response = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages,
      temperature: 0.1,
      max_tokens: 4096,
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`DeepSeek API error ${response.status}: ${errorBody}`)
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>
  }

  return data.choices[0].message.content.trim()
}
