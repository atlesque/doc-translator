<script setup lang="ts">
const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const AUTO_DETECT = 'Auto-detect'

const COMMON_LANGUAGES = [
  'English',
  'Spanish',
  'French',
  'German',
  'Chinese',
  'Japanese',
  'Korean',
  'Italian',
  'Portuguese',
  'Russian',
  'Arabic',
  'Dutch',
  'Polish',
  'Turkish',
  'Vietnamese',
] as const

const BUILT_IN = [AUTO_DETECT, ...COMMON_LANGUAGES] as const

const selectOptions = [
  { label: AUTO_DETECT, value: AUTO_DETECT },
  ...COMMON_LANGUAGES.map(lang => ({ label: lang, value: lang })),
  { label: 'Other…', value: '__other__' },
]

const selectedLanguage = computed({
  get: () => {
    if (!props.modelValue) return ''
    if ((BUILT_IN as readonly string[]).includes(props.modelValue)) return props.modelValue
    return '__other__'
  },
  set: (val: string) => {
    if (val === '__other__') {
      emit('update:modelValue', '')
    } else {
      emit('update:modelValue', val)
    }
  },
})

const showCustomInput = computed(
  () =>
    !(BUILT_IN as readonly string[]).includes(props.modelValue) &&
    props.modelValue !== '' &&
    selectedLanguage.value !== '__other__',
)
</script>

<template>
  <div class="space-y-3">
    <USelect
      v-model="selectedLanguage"
      :items="selectOptions"
      placeholder="Select language"
      label="Target Language"
    />

    <UInput
      v-if="showCustomInput"
      :model-value="modelValue"
      placeholder="Enter any language..."
      @update:model-value="emit('update:modelValue', $event)"
    />

    <UInput
      v-else-if="selectedLanguage === '__other__'"
      :model-value="modelValue"
      placeholder="Enter any language..."
      @update:model-value="emit('update:modelValue', $event)"
    />
  </div>
</template>
