<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
  modelValue: File | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: File | null): void
}>()

const isDragging = ref(false)
const error = ref<string | null>(null)

const ALLOWED_EXTENSIONS = ['.txt']
const ALLOWED_MIME = ['text/plain']

function validateFile(file: File): boolean {
  const extension = '.' + file.name.split('.').pop()?.toLowerCase()
  if (!ALLOWED_EXTENSIONS.includes(extension) && !ALLOWED_MIME.includes(file.type)) {
    error.value = 'Only .txt files are supported.'
    return false
  }
  error.value = null
  return true
}

function handleFile(file: File) {
  if (validateFile(file)) {
    emit('update:modelValue', file)
  }
}

function onDrop(e: DragEvent) {
  isDragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) handleFile(file)
}

function onFileInput(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) handleFile(file)
}

function onPaste(e: ClipboardEvent) {
  const file = e.clipboardData?.files?.[0]
  if (file) handleFile(file)
}

function clearFile() {
  emit('update:modelValue', null)
  error.value = null
}
</script>

<template>
  <div>
    <div
      v-if="!modelValue"
      class="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors relative"
      :class="isDragging ? 'border-primary-500 bg-primary-50 dark:bg-primary-950' : 'border-gray-300 dark:border-gray-600 hover:border-primary-400'"
      @dragover.prevent="isDragging = true"
      @dragleave="isDragging = false"
      @drop.prevent="onDrop"
    >
      <UIcon name="i-heroicons-document-arrow-up" class="mx-auto text-4xl text-gray-400 mb-3" />
      <p class="text-sm font-medium text-gray-700 dark:text-gray-300">
        Drag & drop a .txt file here
      </p>
      <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
        or click to browse
      </p>
      <input
        type="file"
        accept=".txt,text/plain"
        class="absolute inset-0 opacity-0 cursor-pointer"
        @change="onFileInput"
      >
    </div>

    <div
      v-else
      class="border rounded-lg p-4 flex items-center justify-between bg-gray-50 dark:bg-gray-800"
    >
      <div class="flex items-center gap-2">
        <UIcon name="i-heroicons-document-text" class="text-gray-500" />
        <span class="text-sm font-medium">{{ modelValue.name }}</span>
        <span class="text-xs text-gray-400">({{ (modelValue.size / 1024).toFixed(1) }} KB)</span>
      </div>
      <UButton
        icon="i-heroicons-x-mark"
        color="gray"
        variant="ghost"
        size="xs"
        @click="clearFile"
      />
    </div>

    <p v-if="error" class="text-red-500 text-xs mt-1">{{ error }}</p>
  </div>
</template>
