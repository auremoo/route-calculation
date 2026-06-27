<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import api from '../../stores/api'
import { Car, Plus, Pencil, Trash2, Star, AlertTriangle } from 'lucide-vue-next'

const { t } = useI18n()

const loading = ref(true)
const vehicles = ref<any[]>([])
const showModal = ref(false)
const editingVehicle = ref<any | null>(null)
const saving = ref(false)
const deleteTarget = ref<any | null>(null)

const form = ref({
  name: '',
  fuelType: 'gasoline',
  consumption: 6.5,
  fiscalPower: 5,
  defaultFuelPrice: null as number | null,
  isDefault: false,
  sortOrder: 0,
})

const fuelTypes = computed(() => [
  { value: 'gasoline', label: t('routecalc.settings.fuelTypeGasoline') },
  { value: 'diesel', label: t('routecalc.settings.fuelTypeDiesel') },
  { value: 'electric', label: t('routecalc.settings.fuelTypeElectric') },
  { value: 'hybrid', label: t('routecalc.settings.fuelTypeHybrid') },
])

onMounted(async () => {
  await fetchVehicles()
  loading.value = false
})

async function fetchVehicles() {
  try {
    const resp = await api.get('/route-calc/vehicles')
    vehicles.value = resp.data
  } catch { /* ignore */ }
}

function getFuelTypeLabel(ft: string): string {
  return fuelTypes.value.find(f => f.value === ft)?.label || ft
}

function openCreate() {
  editingVehicle.value = null
  form.value = {
    name: '',
    fuelType: 'gasoline',
    consumption: 6.5,
    fiscalPower: 5,
    defaultFuelPrice: null,
    isDefault: false,
    sortOrder: vehicles.value.length,
  }
  showModal.value = true
}

function openEdit(v: any) {
  editingVehicle.value = v
  form.value = {
    name: v.name,
    fuelType: v.fuel_type,
    consumption: v.consumption,
    fiscalPower: v.fiscal_power,
    defaultFuelPrice: v.default_fuel_price,
    isDefault: !!v.is_default,
    sortOrder: v.sort_order,
  }
  showModal.value = true
}

async function handleSave() {
  if (!form.value.name.trim() || form.value.consumption <= 0) return
  saving.value = true
  try {
    const payload = {
      name: form.value.name,
      fuelType: form.value.fuelType,
      consumption: form.value.consumption,
      fiscalPower: form.value.fiscalPower,
      defaultFuelPrice: form.value.defaultFuelPrice || null,
      isDefault: form.value.isDefault,
      sortOrder: form.value.sortOrder,
    }
    if (editingVehicle.value) {
      await api.put(`/route-calc/vehicles/${editingVehicle.value.id}`, payload)
    } else {
      await api.post('/route-calc/vehicles', payload)
    }
    showModal.value = false
    await fetchVehicles()
  } catch (err: any) {
    alert(err.response?.data?.error || t('common.error'))
  } finally {
    saving.value = false
  }
}

async function handleDelete() {
  if (!deleteTarget.value) return
  try {
    await api.delete(`/route-calc/vehicles/${deleteTarget.value.id}`)
    deleteTarget.value = null
    await fetchVehicles()
  } catch (err: any) {
    alert(err.response?.data?.error || t('common.error'))
  }
}
</script>

<template>
  <div v-if="loading" class="flex flex-col items-center justify-center min-h-[60vh] gap-4">
    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
    <p class="text-gray-500 text-sm">{{ $t('common.loading') }}</p>
  </div>

  <div v-else class="w-full max-w-3xl mx-auto">
    <!-- Header -->
    <div class="mb-6">
      <h1 class="text-2xl font-bold mb-1">{{ $t('routecalc.settings.title') }}</h1>
    </div>

    <!-- Vehicles list -->
    <div class="bg-white rounded-xl border border-gray-200 p-6 mb-6" style="box-shadow: 0 1px 3px rgba(0,0,0,0.04)">
      <div class="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
        <div class="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style="background-color: rgba(249,115,22,0.08)">
          <Car :size="20" color="#f97316" />
        </div>
        <div class="flex-1">
          <h2 class="text-base font-semibold">{{ $t('routecalc.settings.title') }}</h2>
        </div>
        <button @click="openCreate" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500 text-white text-xs font-medium hover:bg-orange-600 transition-colors">
          <Plus :size="14" />
          {{ $t('routecalc.settings.addVehicle') }}
        </button>
      </div>

      <div v-if="vehicles.length === 0" class="text-center py-8">
        <Car :size="40" class="mx-auto mb-3 text-gray-300" />
        <p class="text-gray-500 font-medium text-sm">{{ $t('routecalc.settings.noVehicles') }}</p>
        <p class="text-gray-400 text-xs mt-1">{{ $t('routecalc.settings.noVehiclesDesc') }}</p>
      </div>

      <div v-else class="space-y-2">
        <div
          v-for="v in vehicles" :key="v.id"
          class="flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors"
        >
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium truncate">{{ v.name }}</span>
              <span v-if="v.is_default" class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-orange-100 text-orange-700">
                <Star :size="10" />
                {{ $t('routecalc.settings.default') }}
              </span>
            </div>
            <p class="text-xs text-gray-500 mt-0.5">
              {{ getFuelTypeLabel(v.fuel_type) }} · {{ v.consumption }} {{ v.fuel_type === 'electric' ? 'kWh' : 'L' }}/100km · {{ v.fiscal_power }} CV
              <span v-if="v.default_fuel_price"> · {{ v.default_fuel_price }}€/{{ v.fuel_type === 'electric' ? 'kWh' : 'L' }}</span>
            </p>
          </div>
          <button @click="openEdit(v)" class="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500 hover:text-orange-600 transition-colors">
            <Pencil :size="14" />
          </button>
          <button @click="deleteTarget = v" class="p-1.5 rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-600 transition-colors">
            <Trash2 :size="14" />
          </button>
        </div>
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click.self="showModal = false">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-md p-6" @click.stop>
        <h2 class="text-lg font-semibold mb-4">{{ editingVehicle ? $t('routecalc.settings.editVehicle') : $t('routecalc.settings.addVehicle') }}</h2>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-1">{{ $t('routecalc.settings.name') }} *</label>
            <input v-model="form.name" type="text" :placeholder="$t('routecalc.settings.namePlaceholder')" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-orange-500 outline-none" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">{{ $t('routecalc.settings.fuelType') }}</label>
            <select v-model="form.fuelType" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-orange-500 outline-none bg-white">
              <option v-for="ft in fuelTypes" :key="ft.value" :value="ft.value">{{ ft.label }}</option>
            </select>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium mb-1">{{ $t('routecalc.settings.consumption') }}</label>
              <input v-model.number="form.consumption" type="text" inputmode="decimal" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-orange-500 outline-none" />
              <p class="text-xs text-gray-400 mt-0.5">{{ form.fuelType === 'electric' ? 'kWh/100km' : 'L/100km' }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">{{ $t('routecalc.settings.fiscalPower') }}</label>
              <select v-model.number="form.fiscalPower" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-orange-500 outline-none bg-white">
                <option v-for="n in [1,2,3,4,5,6,7]" :key="n" :value="n">{{ n <= 3 ? '≤ 3' : n >= 7 ? '≥ 7' : n }} CV</option>
              </select>
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">{{ $t('routecalc.settings.defaultFuelPrice') }}</label>
            <input v-model.number="form.defaultFuelPrice" type="text" inputmode="decimal" :placeholder="$t('routecalc.settings.defaultFuelPricePlaceholder')" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-orange-500 outline-none" />
          </div>
          <label class="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" v-model="form.isDefault" class="accent-orange-500" />
            {{ $t('routecalc.settings.isDefault') }}
          </label>
        </div>
        <div class="flex justify-end gap-3 mt-6">
          <button @click="showModal = false" class="px-4 py-2 rounded-lg bg-gray-100 border border-gray-200 text-sm font-medium hover:bg-gray-200 transition-colors">{{ $t('common.cancel') }}</button>
          <button @click="handleSave" :disabled="saving || !form.name.trim()" class="px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition-colors disabled:opacity-50">
            {{ saving ? $t('common.loading') : $t('common.save') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Delete confirm modal -->
    <div v-if="deleteTarget" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click.self="deleteTarget = null">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-sm p-6" @click.stop>
        <div class="flex items-center gap-3 mb-4">
          <AlertTriangle :size="24" color="#ef4444" />
          <h2 class="text-lg font-semibold">{{ $t('routecalc.settings.deleteVehicle') }}</h2>
        </div>
        <p class="text-gray-500 text-sm mb-2">{{ $t('routecalc.settings.deleteConfirm') }}</p>
        <p class="font-medium text-sm">{{ deleteTarget.name }}</p>
        <div class="flex justify-end gap-3 mt-6">
          <button @click="deleteTarget = null" class="px-4 py-2 rounded-lg bg-gray-100 border border-gray-200 text-sm font-medium hover:bg-gray-200 transition-colors">{{ $t('common.cancel') }}</button>
          <button @click="handleDelete" class="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors">{{ $t('common.delete') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>
