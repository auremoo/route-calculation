<script setup lang="ts">
import { ref, watch } from 'vue'

/**
 * Champ numérique tolérant : accepte indifféremment la virgule ou le point
 * comme séparateur décimal, et affiche la virgule (convention française).
 *
 * `v-model.number` ne convient pas ici : il s'appuie sur parseFloat, qui
 * s'arrête à la virgule — « 6,5 » y devient silencieusement 6.
 */
const props = withDefaults(defineProps<{
  modelValue: number | null
  /** N'accepte que des entiers (clavier numérique sans séparateur). */
  integer?: boolean
  /** Valeur émise quand le champ est vidé. */
  emptyValue?: number | null
}>(), { integer: false, emptyValue: null })

const emit = defineEmits<{ (e: 'update:modelValue', value: number | null): void }>()

function toText(v: number | null): string {
  if (v === null || v === undefined || Number.isNaN(v)) return ''
  return String(v).replace('.', ',')
}

function parse(raw: string): number | null {
  const cleaned = raw.replace(/\s/g, '').replace(',', '.')
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

const text = ref(toText(props.modelValue))
const focused = ref(false)

// Reflète les changements venant du parent (sélection d'un véhicule, reset…),
// sauf pendant la saisie : on ne réécrit jamais sous les doigts de l'utilisateur.
watch(() => props.modelValue, v => {
  if (!focused.value && parse(text.value) !== v) text.value = toText(v)
})

function onInput(e: Event) {
  const el = e.target as HTMLInputElement
  const allowed = props.integer ? /[^\d-]/g : /[^\d.,-]/g
  const filtered = el.value.replace(allowed, '')
  if (filtered !== el.value) el.value = filtered
  text.value = filtered
  const parsed = parse(filtered)
  emit('update:modelValue', parsed === null ? props.emptyValue : parsed)
}

function onBlur() {
  focused.value = false
  // Normalise l'affichage : « 6. » → « 6 », et remet la valeur retenue si le
  // champ a été vidé alors qu'une valeur de repli est appliquée.
  const parsed = parse(text.value)
  text.value = toText(parsed === null ? props.emptyValue : parsed)
}
</script>

<template>
  <input
    :value="text"
    type="text"
    :inputmode="integer ? 'numeric' : 'decimal'"
    @focus="focused = true"
    @input="onInput"
    @blur="onBlur"
  />
</template>
