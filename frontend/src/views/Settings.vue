<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useVehiclesStore } from '../stores/vehicles'
import { getOrsKey, setOrsKey } from '../lib/ors'
import { getDataSafeConfig, setDataSafeConfig, exportData } from '../lib/backup'
import { Car, Plus, Pencil, Trash2, Star, AlertTriangle, MapPin, Save, UploadCloud } from 'lucide-vue-next'

const vehiclesStore = useVehiclesStore()

const loading = ref(true)
const vehicles = ref<any[]>([])
const showModal = ref(false)
const editingVehicle = ref<any | null>(null)
const saving = ref(false)
const deleteTarget = ref<any | null>(null)

const orsKey = ref('')
const orsSaved = ref(false)
function saveOrsKey() {
  setOrsKey(orsKey.value)
  orsSaved.value = true
  setTimeout(() => { orsSaved.value = false }, 2000)
}

const dataSafe = ref({ url: '', apiKey: '', appName: '' })
const dataSafeSaved = ref(false)
function saveDataSafeConfig() {
  setDataSafeConfig(dataSafe.value)
  dataSafeSaved.value = true
  setTimeout(() => { dataSafeSaved.value = false }, 2000)
}

const exporting = ref(false)
const exportStatus = ref<string | null>(null)
async function handleExport() {
  exporting.value = true
  exportStatus.value = null
  try {
    const result = await exportData()
    if (result.mode === 'datasafe') {
      exportStatus.value = '✓ Sauvegardé sur DataSafe'
    } else if (result.reason === 'network-error') {
      exportStatus.value = '⚠ DataSafe injoignable — fichier téléchargé à la place'
    } else {
      exportStatus.value = '✓ Fichier téléchargé'
    }
  } finally {
    exporting.value = false
    setTimeout(() => { exportStatus.value = null }, 4000)
  }
}

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
  { value: 'gasoline', label: 'Essence' },
  { value: 'diesel', label: 'Diesel' },
  { value: 'electric', label: 'Électrique' },
  { value: 'hybrid', label: 'Hybride' },
])

onMounted(() => {
  fetchVehicles()
  orsKey.value = getOrsKey()
  dataSafe.value = getDataSafeConfig()
  loading.value = false
})

function fetchVehicles() {
  vehiclesStore.load()
  vehicles.value = vehiclesStore.vehicles
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

function handleSave() {
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
      vehiclesStore.update(editingVehicle.value.id, payload)
    } else {
      vehiclesStore.create(payload)
    }
    showModal.value = false
    fetchVehicles()
  } finally {
    saving.value = false
  }
}

function handleDelete() {
  if (!deleteTarget.value) return
  vehiclesStore.remove(deleteTarget.value.id)
  deleteTarget.value = null
  fetchVehicles()
}
</script>

<template>
  <div v-if="loading" class="flex flex-col items-center justify-center min-h-[60vh] gap-4">
    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
    <p class="text-ink-300 text-sm">Chargement...</p>
  </div>

  <div v-else class="w-full max-w-3xl mx-auto">
    <div class="mb-6">
      <h1 class="text-2xl font-bold mb-1 text-ink-900">Paramètres — Véhicules</h1>
    </div>

    <div class="bg-white rounded-xl border border-ink-100 shadow-soft p-6 mb-6">
      <div class="flex items-center gap-3 mb-6 pb-4 border-b border-ink-100">
        <div class="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-orange-50">
          <Car :size="20" color="#f97316" />
        </div>
        <div class="flex-1">
          <h2 class="text-base font-semibold text-ink-800">Paramètres — Véhicules</h2>
        </div>
        <button @click="openCreate" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500 text-white text-xs font-medium hover:bg-orange-600 transition-colors">
          <Plus :size="14" />
          Ajouter un véhicule
        </button>
      </div>

      <div v-if="vehicles.length === 0" class="text-center py-8">
        <Car :size="40" class="mx-auto mb-3 text-ink-100" />
        <p class="text-ink-500 font-medium text-sm">Aucun véhicule enregistré</p>
        <p class="text-ink-300 text-xs mt-1">Ajoutez vos véhicules pour pré-remplir le calculateur.</p>
      </div>

      <div v-else class="space-y-2">
        <div
          v-for="v in vehicles" :key="v.id"
          class="flex items-center gap-3 px-4 py-3 rounded-lg border border-ink-50 hover:bg-ink-50 transition-colors"
        >
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium truncate text-ink-800">{{ v.name }}</span>
              <span v-if="v.is_default" class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-orange-100 text-orange-700">
                <Star :size="10" />
                Par défaut
              </span>
            </div>
            <p class="text-xs text-ink-300 mt-0.5">
              {{ getFuelTypeLabel(v.fuel_type) }} · {{ v.consumption }} {{ v.fuel_type === 'electric' ? 'kWh' : 'L' }}/100km · {{ v.fiscal_power }} CV
              <span v-if="v.default_fuel_price"> · {{ v.default_fuel_price }}€/{{ v.fuel_type === 'electric' ? 'kWh' : 'L' }}</span>
            </p>
          </div>
          <button @click="openEdit(v)" class="p-1.5 rounded-lg hover:bg-ink-100 text-ink-300 hover:text-orange-600 transition-colors">
            <Pencil :size="14" />
          </button>
          <button @click="deleteTarget = v" class="p-1.5 rounded-lg hover:bg-red-50 text-ink-300 hover:text-red-600 transition-colors">
            <Trash2 :size="14" />
          </button>
        </div>
      </div>
    </div>

    <!-- ORS API key -->
    <div class="bg-white rounded-xl border border-ink-100 shadow-soft p-6 mb-6">
      <div class="flex items-center gap-3 mb-4">
        <div class="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-accent-500/10">
          <MapPin :size="20" class="text-accent-500" />
        </div>
        <div class="flex-1">
          <h2 class="text-base font-semibold text-ink-800">Recherche d'adresses (optionnel)</h2>
          <p class="text-xs text-ink-300 mt-0.5">Collez votre clé OpenRouteService pour activer l'autocomplétion et le calcul d'itinéraire.</p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <input
          v-model="orsKey"
          type="password"
          placeholder="Clé API ORS"
          class="input flex-1"
          autocomplete="off"
        />
        <button @click="saveOrsKey" class="btn-primary whitespace-nowrap">
          {{ orsSaved ? '✓ Enregistré' : 'Enregistrer' }}
        </button>
      </div>
      <p class="text-xs text-ink-300 mt-2">
        Clé gratuite (~2 000 requêtes/jour) sur
        <a href="https://openrouteservice.org/dev/#/signup" target="_blank" rel="noopener" class="text-accent-500 hover:underline">openrouteservice.org</a>.
        Stockée uniquement dans ce navigateur. Sans clé, la distance se saisit à la main.
      </p>
    </div>

    <!-- Sauvegarde / DataSafe -->
    <div class="bg-white rounded-xl border border-ink-100 shadow-soft p-6 mb-6">
      <div class="flex items-center gap-3 mb-4">
        <div class="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-accent-500/10">
          <UploadCloud :size="20" class="text-accent-500" />
        </div>
        <div class="flex-1">
          <h2 class="text-base font-semibold text-ink-800">Sauvegarde des données</h2>
          <p class="text-xs text-ink-300 mt-0.5">Configurez DataSafe pour pousser vos sauvegardes à distance, ou laissez vide pour télécharger un fichier local.</p>
        </div>
      </div>

      <div class="space-y-3">
        <div>
          <label class="label">URL DataSafe</label>
          <input v-model="dataSafe.url" type="text" placeholder="https://mon-prp.example.com/api/data-safe/ingest" class="input" autocomplete="off" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="label">Clé API</label>
            <input v-model="dataSafe.apiKey" type="password" placeholder="Clé API DataSafe" class="input" autocomplete="off" />
          </div>
          <div>
            <label class="label">Nom de l'app</label>
            <input v-model="dataSafe.appName" type="text" placeholder="routecalc" class="input" autocomplete="off" />
          </div>
        </div>
        <div class="flex justify-end">
          <button @click="saveDataSafeConfig" class="btn-secondary whitespace-nowrap">
            {{ dataSafeSaved ? '✓ Enregistré' : 'Enregistrer' }}
          </button>
        </div>
      </div>

      <div class="flex items-center justify-between mt-4 pt-4 border-t border-ink-100">
        <p class="text-xs text-ink-300">{{ exportStatus || 'Exporte vos véhicules, votre clé ORS et vos préférences.' }}</p>
        <button @click="handleExport" :disabled="exporting" class="btn-primary whitespace-nowrap inline-flex items-center gap-1.5">
          <Save :size="14" />
          {{ exporting ? 'Chargement...' : 'Sauvegarder' }}
        </button>
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click.self="showModal = false">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-md p-6" @click.stop>
        <h2 class="text-lg font-semibold mb-4 text-ink-900">{{ editingVehicle ? 'Modifier le véhicule' : 'Ajouter un véhicule' }}</h2>
        <div class="space-y-4">
          <div>
            <label class="label">Nom *</label>
            <input v-model="form.name" type="text" placeholder="Ex: Renault Clio" class="input" />
          </div>
          <div>
            <label class="label">Type de carburant</label>
            <select v-model="form.fuelType" class="input">
              <option v-for="ft in fuelTypes" :key="ft.value" :value="ft.value">{{ ft.label }}</option>
            </select>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="label">Consommation</label>
              <input v-model.number="form.consumption" type="text" inputmode="decimal" class="input" />
              <p class="text-xs text-ink-300 mt-0.5">{{ form.fuelType === 'electric' ? 'kWh/100km' : 'L/100km' }}</p>
            </div>
            <div>
              <label class="label">Puissance fiscale (CV fiscaux)</label>
              <select v-model.number="form.fiscalPower" class="input">
                <option v-for="n in [1,2,3,4,5,6,7]" :key="n" :value="n">{{ n <= 3 ? '≤ 3' : n >= 7 ? '≥ 7' : n }} CV</option>
              </select>
            </div>
          </div>
          <div>
            <label class="label">Prix carburant par défaut (€/L ou €/kWh)</label>
            <input v-model.number="form.defaultFuelPrice" type="text" inputmode="decimal" placeholder="Ex: 1.85" class="input" />
          </div>
          <label class="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" v-model="form.isDefault" class="accent-orange-500" />
            Véhicule par défaut
          </label>
        </div>
        <div class="flex justify-end gap-3 mt-6">
          <button @click="showModal = false" class="btn-secondary">Annuler</button>
          <button @click="handleSave" :disabled="saving || !form.name.trim()" class="btn-primary">
            {{ saving ? 'Chargement...' : 'Enregistrer' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Delete confirm modal -->
    <div v-if="deleteTarget" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click.self="deleteTarget = null">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-sm p-6" @click.stop>
        <div class="flex items-center gap-3 mb-4">
          <AlertTriangle :size="24" color="#ef4444" />
          <h2 class="text-lg font-semibold text-ink-900">Supprimer le véhicule</h2>
        </div>
        <p class="text-ink-500 text-sm mb-2">Ce véhicule sera définitivement supprimé.</p>
        <p class="font-medium text-sm text-ink-800">{{ deleteTarget.name }}</p>
        <div class="flex justify-end gap-3 mt-6">
          <button @click="deleteTarget = null" class="btn-secondary">Annuler</button>
          <button @click="handleDelete" class="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors">Supprimer</button>
        </div>
      </div>
    </div>
  </div>
</template>
