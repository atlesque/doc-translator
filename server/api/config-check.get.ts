import { useRuntimeConfig } from "nuxt/app"

export default defineEventHandler(() => {
  const apiKey = useRuntimeConfig().deepseekApiKey
  return { configured: Boolean(apiKey) }
})
