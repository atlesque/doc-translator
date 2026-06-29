<script setup lang="ts">
import { onMounted } from 'vue';
import { useTranslation } from './composables/useTranslation';

const { apiKeyConfigured, configChecked, checkConfig } = useTranslation()

onMounted(() => {
  checkConfig()
})
</script>

<template>
  <UApp>
    <UContainer>
      <UAlert
        v-if="configChecked && !apiKeyConfigured"
        color="warning"
        variant="soft"
        icon="i-heroicons-exclamation-triangle"
        title="DeepSeek API key not configured"
        description="Set DEEPSEEK_API_KEY in your .env file for translations to work."
        class="mt-4"
      />
      <NuxtPage />
    </UContainer>
  </UApp>
</template>
