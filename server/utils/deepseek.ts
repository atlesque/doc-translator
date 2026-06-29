const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions'

const SYSTEM_PROMPT =
  'You are a professional translator. Translate the following text to the target language. Preserve formatting, tone, and paragraph structure. Output only the translation with no additional commentary or notes.'

/**
 * Sends the first ~1000 characters to DeepSeek to detect the source language.
 * Returns a language name string like "French", "Spanish", "German", etc.
 */
export async function detectLanguage(text: string): Promise<string> {
  const apiKey = useRuntimeConfig().deepseekApiKey

  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY is not configured. Set it in .env file.')
  }

  const sample = text.slice(0, 1000).trim()

  const response = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system' as const,
          content:
            'You are a language detection expert. Analyze the provided text and respond with ONLY the language name (e.g., "French", "Spanish", "German", "Chinese", "Japanese", "English", etc.). Do not include any other text, punctuation, or explanation.',
        },
        {
          role: 'user' as const,
          content: `Detect the language of this text:\n\n${sample}`,
        },
      ],
      temperature: 0,
      max_tokens: 32,
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

export async function translateChunk(
  text: string,
  targetLanguage: string,
  sourceLanguage?: string,
): Promise<string> {
  const apiKey = useRuntimeConfig().deepseekApiKey

  if (!apiKey) {
    throw new Error(
      'DEEPSEEK_API_KEY is not configured. Set it in .env file.',
    )
  }

  const sourceClause = sourceLanguage
    ? ` from ${sourceLanguage}`
    : ''

  const messages = [
    { role: 'system' as const, content: SYSTEM_PROMPT },
    {
      role: 'user' as const,
      content: `Translate the following text${sourceClause} to ${targetLanguage}:\n\n${text}`,
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
