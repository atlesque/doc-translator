const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions'

const SYSTEM_PROMPT =
  'You are a professional translator. Translate the following text to the target language. Preserve formatting, tone, and paragraph structure. Output only the translation with no additional commentary or notes.'

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

  const response = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Translate the following text to ${targetLanguage}:\n\n${text}`,
        },
      ],
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
