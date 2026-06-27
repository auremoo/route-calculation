<script setup lang="ts">
import { ref, computed } from 'vue'
import { Delete } from 'lucide-vue-next'

const emit = defineEmits<{ (e: 'submit', pin: string): void }>()

const digits = ref<string[]>([])
const pin = computed(() => digits.value.join(''))

function press(d: string) {
  if (digits.value.length >= 6) return
  digits.value.push(d)
  if (digits.value.length === 6) {
    emit('submit', pin.value)
    setTimeout(() => { digits.value = [] }, 300)
  }
}

function backspace() {
  digits.value.pop()
}

const keys = ['1','2','3','4','5','6','7','8','9','','0','⌫']
</script>

<template>
  <div class="flex flex-col items-center gap-6">
    <!-- PIN dots -->
    <div class="flex items-center gap-3">
      <span
        v-for="i in 6"
        :key="i"
        class="w-3 h-3 rounded-full border-2 transition-colors"
        :class="digits.length >= i ? 'bg-accent-500 border-accent-500' : 'border-ink-300'"
      />
    </div>

    <!-- Keypad -->
    <div class="grid grid-cols-3 gap-3">
      <template v-for="key in keys" :key="key">
        <button
          v-if="key === '⌫'"
          @click="backspace"
          class="w-16 h-14 flex items-center justify-center rounded-lg border border-ink-100 text-ink-500 hover:bg-ink-50 active:bg-ink-100 transition-colors"
        >
          <Delete :size="18" />
        </button>
        <button
          v-else-if="key === ''"
          class="w-16 h-14"
          disabled
        />
        <button
          v-else
          @click="press(key)"
          class="w-16 h-14 flex items-center justify-center rounded-lg border border-ink-100 text-ink-800 text-xl font-medium hover:bg-ink-50 active:bg-ink-100 transition-colors"
        >
          {{ key }}
        </button>
      </template>
    </div>
  </div>
</template>
