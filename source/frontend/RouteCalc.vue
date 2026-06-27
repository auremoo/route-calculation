<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { getLocale } from '../../i18n'
import api from '../../stores/api'
import { Settings, Navigation, RotateCcw, Printer, AlertCircle, Car, Fuel } from 'lucide-vue-next'

const router = useRouter()
const { t } = useI18n()

// ---- Vehicles ----
const vehicles = ref<any[]>([])
const selectedVehicleId = ref<number | null>(null)
const selectedVehicle = computed(() => vehicles.value.find(v => v.id === selectedVehicleId.value) || null)

// ---- Trip inputs (shared) ----
const orsAvailable = ref(false)
const fromAddress = ref('')
const toAddress = ref('')
const fromCoords = ref<[number, number] | null>(null)
const toCoords = ref<[number, number] | null>(null)
const fromSuggestions = ref<any[]>([])
const toSuggestions = ref<any[]>([])
const showFromSug = ref(false)
const showToSug = ref(false)
const routeLoading = ref(false)
const routeDistance = ref<number | null>(null)
const routeDuration = ref<number | null>(null)
const manualDistance = ref<number | null>(null)
const roundTrip = ref(false)

const effectiveDistance = computed(() => routeDistance.value ?? manualDistance.value ?? 0)
const totalDistance = computed(() => roundTrip.value ? effectiveDistance.value * 2 : effectiveDistance.value)

// ---- Column A: Essence ----
const useEssence = ref(true)
const avoidTolls = ref(false)
const tollAmount = ref<number>(0)
const consumption = ref<number>(6.5)
const fuelPrice = ref<number>(1.85)
const isElectric = computed(() => selectedVehicle.value?.fuel_type === 'electric')

// ---- Column B: Frais kilométriques ----
const useBareme = ref(true)
const fiscalPower = ref<number>(5)
// annualKmAlready hidden from UI, defaults to 0 (bracket determined by trip distance only)
const annualKmAlready = ref<number>(0)

// ---- Ratio ----
const PRESET_RATIOS = [
  { label: '× 1', value: 1 },
  { label: '÷ 2', value: 0.5 },
  { label: '÷ 3', value: 1 / 3 },
  { label: '÷ 4', value: 0.25 },
  { label: '2/3', value: 2 / 3 },
  { label: '3/4', value: 0.75 },
]
const ratioValue = ref<number>(1)
const customRatio = ref<string>('')
const selectedRatioPreset = ref<number>(1)

function applyPreset(val: number) {
  selectedRatioPreset.value = val
  ratioValue.value = val
  customRatio.value = ''
}
function onCustomRatio() {
  const v = parseFloat(customRatio.value.replace(',', '.'))
  if (!isNaN(v) && v > 0 && v <= 1) {
    ratioValue.value = v
    selectedRatioPreset.value = -1
  }
}
const ratioLabel = computed(() => {
  if (customRatio.value) return `× ${customRatio.value}`
  const p = PRESET_RATIOS.find(r => r.value === ratioValue.value)
  return p ? p.label : `× ${ratioValue.value.toFixed(3)}`
})

// ---- Auto-ratio ----
const autoRatioEnabled = ref(false)
const surplusMaxPer1000km = ref(10)

const autoRatio = computed((): number => {
  if (!essenceResult.value || !baremeResult.value || baremeResult.value.allowance === 0) return 1
  const maxAllowance = essenceResult.value.total + (surplusMaxPer1000km.value * (totalDistance.value / 1000) * nbPersons.value)
  return Math.min(1, Math.max(0, maxAllowance / baremeResult.value.allowance))
})

const effectiveRatio = computed((): number =>
  autoRatioEnabled.value ? autoRatio.value : ratioValue.value
)

// ---- Convoy ----
const convoyEnabled = ref(false)
const nbPersons = ref(2)

interface ConvoyEntry {
  id: string
  label: string
  vehicleId: number | null
  consumption: number
  fuelPrice: number
  fiscalPower: number
}
interface ConvoyResult {
  label: string
  essenceTotal: number
  baremeAllowance: number
}

const convoyExtras = ref<ConvoyEntry[]>([])
const convoyResults = ref<ConvoyResult[]>([])

function addConvoyVehicle() {
  convoyExtras.value.push({
    id: String(Date.now()),
    label: `Véhicule ${convoyExtras.value.length + 2}`,
    vehicleId: null,
    consumption: consumption.value,
    fuelPrice: fuelPrice.value,
    fiscalPower: fiscalPower.value
  })
}

function removeConvoyVehicle(id: string) {
  convoyExtras.value = convoyExtras.value.filter(e => e.id !== id)
}

function applyVehicleToEntry(entry: ConvoyEntry) {
  const v = vehicles.value.find(v => v.id === entry.vehicleId)
  if (!v) return
  entry.consumption = v.consumption
  entry.fiscalPower = v.fiscal_power
  if (v.default_fuel_price) entry.fuelPrice = v.default_fuel_price
}

function decrementPersons() { if (nbPersons.value > 1) nbPersons.value-- }

const convoyEssenceTotal = computed((): number =>
  convoyResults.value.reduce((s, r) => s + r.essenceTotal, 0)
)
const convoyBaremeTotal = computed((): number =>
  convoyResults.value.reduce((s, r) => s + r.baremeAllowance, 0) * effectiveRatio.value
)
const perPersonEssence = computed((): number =>
  nbPersons.value > 0 ? convoyEssenceTotal.value / nbPersons.value : 0
)
const perPersonBareme = computed((): number =>
  nbPersons.value > 0 ? convoyBaremeTotal.value / nbPersons.value : 0
)

// ---- Results ----
interface EssenceResult { fuelCost: number; tollCost: number; total: number; perKm: number }
interface BaremeResult { rate: number; bracket: string; allowance: number; perKm: number }

const essenceResult = ref<EssenceResult | null>(null)
const baremeResult = ref<BaremeResult | null>(null)
const calculating = ref(false)
const calcDone = ref(false)

// ---- ORS ----
let fromTimer: any, toTimer: any

onMounted(async () => {
  try {
    const { data } = await api.get('/route-calc/vehicles')
    vehicles.value = data
    const def = data.find((v: any) => v.is_default)
    if (def) applyVehicle(def)
    else if (data.length) applyVehicle(data[0])
  } catch {}

  try {
    await api.post('/route-calc/geocode', { query: 'Paris' })
    orsAvailable.value = true
  } catch (e: any) {
    orsAvailable.value = e?.response?.status !== 503
  }
})

function applyVehicle(v: any) {
  selectedVehicleId.value = v.id
  consumption.value = v.consumption
  fiscalPower.value = v.fiscal_power
  if (v.default_fuel_price) fuelPrice.value = v.default_fuel_price
}

function onVehicleChange() {
  if (selectedVehicle.value) applyVehicle(selectedVehicle.value)
}

// Address autocomplete
function onFromInput() {
  clearTimeout(fromTimer)
  fromCoords.value = null; routeDistance.value = null
  if (!orsAvailable.value || fromAddress.value.length < 3) { fromSuggestions.value = []; return }
  fromTimer = setTimeout(async () => {
    try { const { data } = await api.post('/route-calc/geocode', { query: fromAddress.value }); fromSuggestions.value = data; showFromSug.value = true } catch {}
  }, 400)
}
function onToInput() {
  clearTimeout(toTimer)
  toCoords.value = null; routeDistance.value = null
  if (!orsAvailable.value || toAddress.value.length < 3) { toSuggestions.value = []; return }
  toTimer = setTimeout(async () => {
    try { const { data } = await api.post('/route-calc/geocode', { query: toAddress.value }); toSuggestions.value = data; showToSug.value = true } catch {}
  }, 400)
}
function pickFrom(s: any) { fromAddress.value = s.label; fromCoords.value = s.coordinates; showFromSug.value = false }
function pickTo(s: any) { toAddress.value = s.label; toCoords.value = s.coordinates; showToSug.value = false }
function hideFrom() { window.setTimeout(() => { showFromSug.value = false }, 200) }
function hideTo() { window.setTimeout(() => { showToSug.value = false }, 200) }

async function getRoute() {
  if (!fromCoords.value || !toCoords.value) return
  routeLoading.value = true
  try {
    const { data } = await api.post('/route-calc/route', { from: fromCoords.value, to: toCoords.value, avoidTolls: avoidTolls.value })
    routeDistance.value = Math.round(data.distanceKm * 10) / 10
    routeDuration.value = Math.round(data.durationMin)
    essenceResult.value = null; baremeResult.value = null; calcDone.value = false
  } catch {} finally { routeLoading.value = false }
}

// ---- Calculate ----
const canCalculate = computed(() => totalDistance.value > 0 && (useEssence.value || useBareme.value))

async function calculate() {
  if (!canCalculate.value) return
  calculating.value = true
  calcError.value = null
  essenceResult.value = null
  baremeResult.value = null
  convoyResults.value = []

  const base = {
    distanceKm: effectiveDistance.value,
    tollAmount: avoidTolls.value ? 0 : tollAmount.value,
    annualKmAlready: annualKmAlready.value,
    roundTrip: roundTrip.value
  }

  try {
    if (convoyEnabled.value) {
      const entries = [
        { label: selectedVehicle.value?.name ?? 'Véhicule 1', consumption: consumption.value, fuelPrice: fuelPrice.value, fiscalPower: fiscalPower.value },
        ...convoyExtras.value.map(e => ({ label: e.label, consumption: e.consumption, fuelPrice: e.fuelPrice, fiscalPower: e.fiscalPower }))
      ]
      const responses = await Promise.all(
        entries.map(e => api.post('/route-calc/calculate', { ...base, consumption: e.consumption, fuelPrice: e.fuelPrice, fiscalPower: e.fiscalPower }))
      )
      convoyResults.value = responses.map((r, i) => ({
        label: entries[i].label,
        essenceTotal: r.data.totalRealCost,
        baremeAllowance: r.data.baremeAllowance
      }))
      const dist = responses[0].data.distanceUsed
      if (useEssence.value) {
        const totalFuel = responses.reduce((s, r) => s + r.data.fuelCost, 0)
        const totalToll = responses.reduce((s, r) => s + r.data.tollCost, 0)
        const totalReal = responses.reduce((s, r) => s + r.data.totalRealCost, 0)
        essenceResult.value = { fuelCost: totalFuel, tollCost: totalToll, total: totalReal, perKm: totalReal / dist }
      }
      if (useBareme.value) {
        const totalAllowance = responses.reduce((s, r) => s + r.data.baremeAllowance, 0)
        baremeResult.value = { rate: responses[0].data.baremeTaux, bracket: responses[0].data.baremeBracket, allowance: totalAllowance, perKm: totalAllowance / dist }
      }
    } else {
      const { data } = await api.post('/route-calc/calculate', { ...base, consumption: consumption.value, fiscalPower: fiscalPower.value, fuelPrice: fuelPrice.value })
      if (useEssence.value) {
        essenceResult.value = { fuelCost: data.fuelCost, tollCost: data.tollCost, total: data.totalRealCost, perKm: data.totalRealCost / data.distanceUsed }
      }
      if (useBareme.value) {
        baremeResult.value = { rate: data.baremeTaux, bracket: data.baremeBracket, allowance: data.baremeAllowance, perKm: data.baremeAllowance / data.distanceUsed }
      }
    }
    calcDone.value = true
  } catch (err) {
    console.error('Calculate error:', err)
    calcError.value = 'Erreur lors du calcul. Vérifiez que tous les champs sont remplis correctement.'
  } finally { calculating.value = false }
}

function reset() {
  fromAddress.value = ''; toAddress.value = ''
  fromCoords.value = null; toCoords.value = null
  routeDistance.value = null; routeDuration.value = null
  manualDistance.value = null
  essenceResult.value = null; baremeResult.value = null; convoyResults.value = []
  calcDone.value = false; calcError.value = null; tollAmount.value = 0
}

// ---- Formatting ----
function fmtEur(n: number) {
  return new Intl.NumberFormat(getLocale() === 'fr' ? 'fr-FR' : 'en-US', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(n)
}
function fmtKm(n: number) {
  return new Intl.NumberFormat(getLocale() === 'fr' ? 'fr-FR' : 'en-US', { maximumFractionDigits: 1 }).format(n) + ' km'
}
function fmtDuration(min: number) {
  const h = Math.floor(min / 60), m = Math.round(min % 60)
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`
}

const delta = computed((): number => {
  if (!essenceResult.value || !baremeResult.value) return 0
  return essenceResult.value.total - baremeResult.value.allowance
})

const scaledDelta = computed((): number => {
  if (!essenceResult.value || !baremeResult.value) return 0
  return essenceResult.value.total - baremeResult.value.allowance * effectiveRatio.value
})

const today = computed(() => new Date().toLocaleDateString(getLocale() === 'fr' ? 'fr-FR' : 'en-US', { day: '2-digit', month: 'long', year: 'numeric' }))

const calcError = ref<string | null>(null)

function printReport() { window.print() }
</script>

<template>
  <div class="w-full max-w-5xl mx-auto">

    <!-- ===== PRINT ZONE (téléportée dans <body> pour que le CSS print fonctionne) ===== -->
    <Teleport to="body">
    <div class="prp-print-zone p-6 bg-white">
      <div class="flex items-center justify-between mb-4 pb-3 border-b border-gray-300">
        <div>
          <h1 class="text-xl font-bold">RouteCalc — Rapport de trajet</h1>
          <p class="text-sm text-gray-500">{{ today }}</p>
        </div>
        <div class="text-right text-sm text-gray-600">
          <p v-if="selectedVehicle">🚗 {{ selectedVehicle.name }}</p>
          <p v-if="fromAddress">De : {{ fromAddress }}</p>
          <p v-if="toAddress">À : {{ toAddress }}</p>
          <p v-if="totalDistance">Distance : {{ fmtKm(totalDistance) }}<span v-if="roundTrip"> (A/R)</span></p>
          <p v-if="effectiveRatio !== 1" class="text-orange-600 font-medium">Ratio : {{ autoRatioEnabled ? `auto ${(autoRatio * 100).toFixed(1)}%` : ratioLabel }}</p>
        </div>
      </div>

      <div class="grid gap-6" :class="essenceResult && baremeResult ? 'grid-cols-2' : 'grid-cols-1'">
        <!-- Essence print -->
        <div v-if="essenceResult" class="border border-gray-300 rounded p-4">
          <h2 class="font-bold text-base mb-3 pb-2 border-b border-gray-200">⛽ Coût carburant</h2>
          <table class="w-full text-sm">
            <tr><td class="py-1 text-gray-600">Consommation</td><td class="text-right">{{ consumption }} {{ isElectric ? 'kWh' : 'L' }}/100km</td></tr>
            <tr><td class="py-1 text-gray-600">Prix {{ isElectric ? 'énergie' : 'carburant' }}</td><td class="text-right">{{ fuelPrice }} €/{{ isElectric ? 'kWh' : 'L' }}</td></tr>
            <tr v-if="essenceResult.tollCost > 0"><td class="py-1 text-gray-600">Péages</td><td class="text-right">{{ fmtEur(essenceResult.tollCost) }}</td></tr>
            <tr class="border-t border-gray-200 font-semibold"><td class="pt-2">Coût {{ isElectric ? 'énergie' : 'carburant' }}</td><td class="text-right pt-2">{{ fmtEur(essenceResult.fuelCost) }}</td></tr>
            <tr class="font-bold text-base"><td class="pt-1">Total</td><td class="text-right pt-1">{{ fmtEur(essenceResult.total) }}</td></tr>
            <tr class="text-gray-500 text-xs"><td class="pt-1">Soit</td><td class="text-right pt-1">{{ fmtEur(essenceResult.perKm) }}/km</td></tr>
          </table>
        </div>

        <!-- Barème print -->
        <div v-if="baremeResult" class="border border-gray-300 rounded p-4">
          <h2 class="font-bold text-base mb-3 pb-2 border-b border-gray-200">📋 Frais kilométriques</h2>
          <table class="w-full text-sm">
            <tr><td class="py-1 text-gray-600">Puissance fiscale</td><td class="text-right">{{ fiscalPower }} CV</td></tr>
            <tr><td class="py-1 text-gray-600">Tranche</td><td class="text-right">{{ baremeResult.bracket }}</td></tr>
            <tr><td class="py-1 text-gray-600">Taux appliqué</td><td class="text-right">{{ baremeResult.rate.toFixed(3) }} €/km</td></tr>
            <tr class="border-t border-gray-200 font-bold text-base"><td class="pt-2">Indemnité<span v-if="effectiveRatio !== 1"> ({{ autoRatioEnabled ? `auto ${(autoRatio * 100).toFixed(1)}%` : ratioLabel }})</span></td><td class="text-right pt-2">{{ fmtEur(baremeResult.allowance * effectiveRatio) }}</td></tr>
            <tr v-if="effectiveRatio !== 1" class="text-gray-400 text-xs"><td class="pt-0.5">Indemnité brute</td><td class="text-right pt-0.5">{{ fmtEur(baremeResult.allowance) }}</td></tr>
            <tr class="text-gray-500 text-xs"><td class="pt-1">Soit</td><td class="text-right pt-1">{{ fmtEur(baremeResult.perKm * effectiveRatio) }}/km</td></tr>
          </table>
        </div>
      </div>

      <!-- Convoy breakdown print -->
      <div v-if="convoyEnabled && convoyResults.length > 1" class="mt-4 p-4 border border-gray-300 rounded">
        <h2 class="font-bold mb-2">Convoi — Détail par véhicule</h2>
        <table class="w-full text-sm">
          <thead>
            <tr class="text-gray-500 border-b border-gray-200">
              <th class="text-left pb-1 font-medium">Véhicule</th>
              <th v-if="useEssence" class="text-right pb-1 font-medium">Coût réel</th>
              <th v-if="useBareme" class="text-right pb-1 font-medium">Indemnité km<span v-if="effectiveRatio !== 1"> ({{ autoRatioEnabled ? `auto ${(autoRatio * 100).toFixed(1)}%` : ratioLabel }})</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in convoyResults" :key="r.label" class="border-b border-gray-100">
              <td class="py-1">{{ r.label }}</td>
              <td v-if="useEssence" class="text-right py-1">{{ fmtEur(r.essenceTotal) }}</td>
              <td v-if="useBareme" class="text-right py-1">{{ fmtEur(r.baremeAllowance * effectiveRatio) }}</td>
            </tr>
          </tbody>
          <tfoot class="font-bold border-t-2 border-gray-300">
            <tr>
              <td class="pt-1">Total ({{ convoyResults.length }} véhicules)</td>
              <td v-if="useEssence" class="text-right pt-1">{{ fmtEur(convoyEssenceTotal) }}</td>
              <td v-if="useBareme" class="text-right pt-1">{{ fmtEur(convoyBaremeTotal) }}</td>
            </tr>
            <tr v-if="nbPersons > 1">
              <td class="pt-1">Par personne ({{ nbPersons }})</td>
              <td v-if="useEssence" class="text-right pt-1">{{ fmtEur(perPersonEssence) }}</td>
              <td v-if="useBareme" class="text-right pt-1">{{ fmtEur(perPersonBareme) }}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- Comparison print -->
      <div v-if="essenceResult && baremeResult" class="mt-4 p-4 border border-gray-300 rounded">
        <h2 class="font-bold mb-2">Comparaison</h2>
        <p class="text-sm">
          Écart<span v-if="effectiveRatio !== 1"> (frais km {{ autoRatioEnabled ? `auto ${(autoRatio * 100).toFixed(1)}%` : ratioLabel }})</span> : <strong>{{ scaledDelta >= 0 ? '+' : '' }}{{ fmtEur(scaledDelta) }}</strong>
          <span v-if="scaledDelta > 0"> — Les frais kilométriques couvrent mieux le trajet</span>
          <span v-else-if="scaledDelta < 0"> — Le coût réel est supérieur de {{ fmtEur(Math.abs(scaledDelta)) }} par rapport à l'indemnité</span>
          <span v-else> — Les deux méthodes sont équivalentes</span>
        </p>
        <p v-if="effectiveRatio !== 1" class="text-xs text-gray-400 mt-1">Écart sans ratio : {{ delta >= 0 ? '+' : '' }}{{ fmtEur(delta) }}</p>
      </div>
    </div>
    </Teleport>

    <!-- ===== SCREEN ZONE ===== -->
    <div class="space-y-5">

      <!-- Top bar -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-2xl">🚗</span>
          <span class="text-xl font-bold text-gray-900">RouteCalc</span>
        </div>
        <div class="flex items-center gap-2">
          <button
            v-if="calcDone"
            @click="printReport"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Printer :size="14" /> Générer PDF
          </button>
          <button @click="router.push('/route-calc/settings')" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-500 hover:bg-gray-100 transition-colors">
            <Settings :size="14" /> Véhicules
          </button>
        </div>
      </div>

      <!-- Vehicle + Trip (shared) -->
      <div class="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">

        <!-- Vehicle -->
        <div class="flex items-center gap-3">
          <Car :size="16" class="text-orange-500 flex-shrink-0" />
          <select
            v-model="selectedVehicleId"
            @change="onVehicleChange"
            class="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-orange-400 outline-none bg-white"
          >
            <option :value="null">— Aucun véhicule (saisie manuelle) —</option>
            <option v-for="v in vehicles" :key="v.id" :value="v.id">
              {{ v.name }} · {{ v.consumption }} {{ v.fuel_type === 'electric' ? 'kWh' : 'L' }}/100 · {{ v.fiscal_power }} CV
            </option>
          </select>
          <label class="flex items-center gap-2 text-sm text-gray-600 flex-shrink-0 cursor-pointer select-none">
            <button
              @click="roundTrip = !roundTrip"
              :class="roundTrip ? 'bg-orange-500' : 'bg-gray-200'"
              class="relative w-9 h-5 rounded-full transition-colors flex-shrink-0"
            >
              <span :class="roundTrip ? 'translate-x-4' : 'translate-x-0.5'" class="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform block" />
            </button>
            A/R
          </label>
        </div>

        <!-- Route -->
        <div>
          <div v-if="orsAvailable" class="space-y-2">
            <div class="grid grid-cols-2 gap-2">
              <!-- From -->
              <div class="relative">
                <input v-model="fromAddress" @input="onFromInput" @blur="hideFrom"
                  placeholder="Départ" class="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:border-orange-400 outline-none" />
                <div v-if="showFromSug && fromSuggestions.length" class="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-44 overflow-y-auto">
                  <button v-for="s in fromSuggestions" :key="s.label" @mousedown.prevent="pickFrom(s)"
                    class="w-full text-left px-3 py-2 text-xs hover:bg-orange-50 border-b border-gray-50 last:border-0">{{ s.label }}</button>
                </div>
              </div>
              <!-- To -->
              <div class="relative">
                <input v-model="toAddress" @input="onToInput" @blur="hideTo"
                  placeholder="Arrivée" class="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:border-orange-400 outline-none" />
                <div v-if="showToSug && toSuggestions.length" class="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-44 overflow-y-auto">
                  <button v-for="s in toSuggestions" :key="s.label" @mousedown.prevent="pickTo(s)"
                    class="w-full text-left px-3 py-2 text-xs hover:bg-orange-50 border-b border-gray-50 last:border-0">{{ s.label }}</button>
                </div>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button @click="getRoute" :disabled="!fromCoords || !toCoords || routeLoading"
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500 text-white text-xs font-medium hover:bg-orange-600 transition-colors disabled:opacity-40">
                <Navigation :size="13" /> {{ routeLoading ? '…' : 'Calculer l\'itinéraire' }}
              </button>
              <div v-if="routeDistance" class="flex items-center gap-3 px-3 py-1.5 bg-green-50 rounded-lg text-xs font-medium text-green-700">
                <span>{{ fmtKm(routeDistance) }}</span>
                <span v-if="routeDuration" class="text-green-500">{{ fmtDuration(routeDuration) }}</span>
                <span v-if="roundTrip" class="text-green-500">→ A/R : {{ fmtKm(routeDistance * 2) }}</span>
              </div>
            </div>
            <p class="text-xs text-gray-400">ou saisir la distance manuellement ↓</p>
          </div>
          <div v-else class="flex items-center gap-2 px-3 py-2 bg-amber-50 rounded-lg text-xs text-amber-700 mb-2">
            <AlertCircle :size="13" /> Géocodage indisponible — clé ORS_API_KEY non configurée
          </div>
          <!-- Manual distance always shown -->
          <div class="flex items-center gap-3 mt-2">
            <input v-model.number="manualDistance" type="text" inputmode="numeric" placeholder="Distance en km"
              class="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-orange-400 outline-none" />
            <span v-if="totalDistance > 0" class="text-sm text-gray-500 flex-shrink-0">
              {{ fmtKm(totalDistance) }}<span v-if="roundTrip"> (A/R)</span>
            </span>
          </div>
        </div>
      </div>

      <!-- Two columns -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">

        <!-- ===== COLUMN A: ESSENCE ===== -->
        <div class="bg-white rounded-2xl border-2 transition-colors" :class="useEssence ? 'border-blue-300' : 'border-gray-200'">
          <div class="p-4 border-b flex items-center justify-between" :class="useEssence ? 'border-blue-100' : 'border-gray-100'">
            <div class="flex items-center gap-2">
              <Fuel :size="16" class="text-blue-500" />
              <span class="font-semibold text-gray-800">Coût carburant</span>
            </div>
            <button @click="useEssence = !useEssence"
              :class="useEssence ? 'bg-blue-500' : 'bg-gray-200'"
              class="relative w-10 h-5 rounded-full transition-colors flex-shrink-0">
              <span :class="useEssence ? 'translate-x-5' : 'translate-x-0.5'" class="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform block" />
            </button>
          </div>

          <div class="p-4 space-y-3" :class="!useEssence ? 'opacity-40 pointer-events-none' : ''">
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-xs text-gray-500 mb-1">Consommation</label>
                <div class="relative">
                  <input v-model.number="consumption" type="text" inputmode="decimal"
                    class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-blue-400 outline-none pr-14" />
                  <span class="absolute right-2.5 top-2 text-xs text-gray-400">{{ isElectric ? 'kWh' : 'L' }}/100</span>
                </div>
              </div>
              <div>
                <label class="block text-xs text-gray-500 mb-1">Prix {{ isElectric ? 'énergie' : 'carburant' }}</label>
                <div class="relative">
                  <input v-model.number="fuelPrice" type="text" inputmode="decimal"
                    class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-blue-400 outline-none pr-12" />
                  <span class="absolute right-2.5 top-2 text-xs text-gray-400">€/{{ isElectric ? 'kWh' : 'L' }}</span>
                </div>
              </div>
            </div>

            <!-- Tolls -->
            <div>
              <label class="flex items-center justify-between mb-2 cursor-pointer select-none">
                <span class="text-xs text-gray-500">Éviter les péages</span>
                <button @click="avoidTolls = !avoidTolls; if(avoidTolls) tollAmount = 0"
                  :class="avoidTolls ? 'bg-blue-500' : 'bg-gray-200'"
                  class="relative w-8 h-4 rounded-full transition-colors">
                  <span :class="avoidTolls ? 'translate-x-4' : 'translate-x-0.5'" class="absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform block" />
                </button>
              </label>
              <input v-if="!avoidTolls" v-model.number="tollAmount" type="text" inputmode="decimal"
                placeholder="Montant des péages (€)"
                class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-blue-400 outline-none" />
            </div>

            <!-- Result A -->
            <div v-if="essenceResult" class="mt-2 pt-3 border-t border-blue-100 space-y-1">
              <div class="flex justify-between text-sm text-gray-600">
                <span>{{ isElectric ? 'Coût énergie' : 'Coût carburant' }}</span>
                <span class="font-medium">{{ fmtEur(essenceResult.fuelCost) }}</span>
              </div>
              <div v-if="essenceResult.tollCost > 0" class="flex justify-between text-sm text-gray-600">
                <span>Péages</span>
                <span class="font-medium">{{ fmtEur(essenceResult.tollCost) }}</span>
              </div>
              <div class="flex justify-between font-bold text-blue-700 text-base pt-1 border-t border-blue-100">
                <span>Total<span v-if="convoyEnabled && convoyResults.length > 1" class="font-normal text-xs text-blue-400 ml-1">({{ convoyResults.length }} véh.)</span></span>
                <span>{{ fmtEur(essenceResult.total) }}</span>
              </div>
              <p class="text-xs text-gray-400 text-right">{{ fmtEur(essenceResult.perKm) }}/km</p>
              <div v-if="nbPersons > 1" class="flex justify-between text-sm font-semibold text-green-700 mt-1 pt-1 border-t border-blue-50">
                <span>Par personne ({{ nbPersons }})</span>
                <span>{{ fmtEur(essenceResult.total / nbPersons) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- ===== COLUMN B: BARÈME ===== -->
        <div class="bg-white rounded-2xl border-2 transition-colors" :class="useBareme ? 'border-orange-300' : 'border-gray-200'">
          <div class="p-4 border-b flex items-center justify-between" :class="useBareme ? 'border-orange-100' : 'border-gray-100'">
            <div class="flex items-center gap-2">
              <span class="text-base">📋</span>
              <span class="font-semibold text-gray-800">Frais kilométriques</span>
            </div>
            <button @click="useBareme = !useBareme"
              :class="useBareme ? 'bg-orange-500' : 'bg-gray-200'"
              class="relative w-10 h-5 rounded-full transition-colors flex-shrink-0">
              <span :class="useBareme ? 'translate-x-5' : 'translate-x-0.5'" class="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform block" />
            </button>
          </div>

          <div class="p-4 space-y-3" :class="!useBareme ? 'opacity-40 pointer-events-none' : ''">
            <div>
              <label class="block text-xs text-gray-500 mb-1">Puissance fiscale</label>
              <div class="relative">
                <input v-model.number="fiscalPower" type="text" inputmode="numeric"
                  class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-orange-400 outline-none pr-8" />
                <span class="absolute right-2.5 top-2 text-xs text-gray-400">CV</span>
              </div>
            </div>

            <!-- Barème info -->
            <div class="px-3 py-2 bg-orange-50 rounded-lg text-xs text-orange-700">
              Barème 2025 · 3 tranches (≤5 000 / 5–20 000 / >20 000 km/an)
            </div>

            <!-- Result B -->
            <div v-if="baremeResult" class="mt-2 pt-3 border-t border-orange-100 space-y-1">
              <div class="flex justify-between text-sm text-gray-600">
                <span>Tranche</span>
                <span class="font-medium text-xs">{{ baremeResult.bracket }}</span>
              </div>
              <div class="flex justify-between text-sm text-gray-600">
                <span>Taux</span>
                <span class="font-medium">{{ baremeResult.rate.toFixed(3) }} €/km</span>
              </div>
              <div class="flex justify-between font-bold text-orange-600 text-base pt-1 border-t border-orange-100">
                <span>Indemnité<span v-if="effectiveRatio !== 1" class="font-normal text-xs text-orange-400 ml-1">{{ autoRatioEnabled ? `auto ${(autoRatio * 100).toFixed(1)}%` : ratioLabel }}</span><span v-if="convoyEnabled && convoyResults.length > 1" class="font-normal text-xs text-orange-400 ml-1">({{ convoyResults.length }} véh.)</span></span>
                <span>{{ fmtEur(baremeResult.allowance * effectiveRatio) }}</span>
              </div>
              <p v-if="effectiveRatio !== 1" class="text-xs text-gray-400 text-right">(brut : {{ fmtEur(baremeResult.allowance) }})</p>
              <p class="text-xs text-gray-400 text-right">{{ fmtEur(baremeResult.perKm * effectiveRatio) }}/km</p>
              <div v-if="nbPersons > 1" class="flex justify-between text-sm font-semibold text-green-700 mt-1 pt-1 border-t border-orange-50">
                <span>Par personne ({{ nbPersons }})</span>
                <span>{{ fmtEur(baremeResult.allowance * effectiveRatio / nbPersons) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Ratio selector -->
      <div v-if="useEssence || useBareme" class="bg-white rounded-2xl border border-gray-200 px-4 py-3 space-y-2">
        <!-- Manual presets -->
        <div class="flex items-center gap-2 flex-wrap" :class="autoRatioEnabled ? 'opacity-40 pointer-events-none' : ''">
          <span class="text-xs font-medium text-gray-500 flex-shrink-0">Ratio :</span>
          <div class="flex items-center gap-1 flex-wrap">
            <button v-for="preset in PRESET_RATIOS" :key="preset.value"
              @click="applyPreset(preset.value)"
              :class="selectedRatioPreset === preset.value ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-200 hover:border-orange-300 hover:text-orange-600'"
              class="px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors">
              {{ preset.label }}
            </button>
          </div>
          <div class="flex items-center gap-1">
            <span class="text-xs text-gray-400">×</span>
            <input v-model="customRatio" @input="onCustomRatio" type="text" placeholder="0.XX"
              :class="selectedRatioPreset === -1 ? 'border-orange-400 ring-1 ring-orange-200' : 'border-gray-200'"
              class="w-14 px-2 py-1 text-xs border rounded-lg focus:border-orange-400 outline-none text-center" />
          </div>
          <span v-if="!autoRatioEnabled && ratioValue !== 1" class="text-xs text-orange-600 font-medium">→ résultats × {{ ratioLabel.replace('× ', '') }}</span>
        </div>

        <!-- Auto-ratio + persons -->
        <div class="flex items-center gap-2 flex-wrap border-t border-gray-100 pt-2">
          <button @click="autoRatioEnabled = !autoRatioEnabled"
            :class="autoRatioEnabled ? 'bg-green-500' : 'bg-gray-200'"
            class="relative w-8 h-4 rounded-full transition-colors flex-shrink-0">
            <span :class="autoRatioEnabled ? 'translate-x-4' : 'translate-x-0.5'" class="absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform block" />
          </button>
          <span class="text-xs font-medium text-gray-600">Ratio auto — surplus max :</span>
          <div class="flex items-center gap-1">
            <input v-model.number="surplusMaxPer1000km" type="number" min="0" step="1"
              class="w-14 px-2 py-1 text-xs border rounded-lg outline-none text-center transition-colors"
              :class="autoRatioEnabled ? 'border-green-400 ring-1 ring-green-100' : 'border-gray-200'" />
            <span class="text-xs text-gray-400">€/pers./1000km</span>
          </div>
          <span class="text-xs text-gray-300">·</span>
          <div class="flex items-center gap-1.5">
            <button @click="decrementPersons" class="w-6 h-6 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium flex items-center justify-center">−</button>
            <span class="text-xs font-bold w-4 text-center">{{ nbPersons }}</span>
            <button @click="nbPersons++" class="w-6 h-6 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium flex items-center justify-center">+</button>
            <span class="text-xs text-gray-400">pers.</span>
          </div>
          <span v-if="autoRatioEnabled && calcDone" class="text-xs font-semibold text-green-700">→ ratio : {{ (autoRatio * 100).toFixed(1) }}%</span>
          <span v-else-if="autoRatioEnabled" class="text-xs text-gray-400 italic">calculer d'abord</span>
        </div>
      </div>

      <!-- Convoy section -->
      <div class="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-sm">🚙🚙</span>
            <span class="text-sm font-medium text-gray-700">Convoi</span>
            <span class="hidden sm:inline text-xs text-gray-400">plusieurs véhicules + partage équitable</span>
          </div>
          <button @click="convoyEnabled = !convoyEnabled"
            :class="convoyEnabled ? 'bg-purple-500' : 'bg-gray-200'"
            class="relative w-10 h-5 rounded-full transition-colors flex-shrink-0">
            <span :class="convoyEnabled ? 'translate-x-5' : 'translate-x-0.5'" class="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform block" />
          </button>
        </div>

        <div v-if="convoyEnabled" class="space-y-2">
          <!-- Vehicle 1 (main) summary -->
          <div class="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg text-xs text-gray-600 flex-wrap">
            <span class="font-medium text-gray-700">{{ selectedVehicle?.name ?? 'Véhicule 1' }}</span>
            <span class="text-gray-300">·</span>
            <span>{{ consumption }} {{ isElectric ? 'kWh' : 'L' }}/100</span>
            <span class="text-gray-300">·</span>
            <span>{{ fuelPrice }} €/{{ isElectric ? 'kWh' : 'L' }}</span>
            <span class="text-gray-300">·</span>
            <span>{{ fiscalPower }} CV</span>
            <span class="ml-auto text-gray-400 italic">(principal — modifiable en haut)</span>
          </div>

          <!-- Extra vehicles -->
          <div v-for="entry in convoyExtras" :key="entry.id" class="border border-gray-200 rounded-xl p-3 space-y-2">
            <div class="flex items-center gap-2">
              <input v-model="entry.label"
                class="text-xs font-medium text-gray-700 border-0 outline-none bg-transparent flex-1 min-w-0 focus:underline" />
              <select v-model="entry.vehicleId" @change="applyVehicleToEntry(entry)"
                class="text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none bg-white flex-shrink-0 focus:border-purple-400">
                <option :value="null">— Manuel —</option>
                <option v-for="v in vehicles" :key="v.id" :value="v.id">{{ v.name }}</option>
              </select>
              <button @click="removeConvoyVehicle(entry.id)" class="text-red-400 hover:text-red-600 flex-shrink-0 font-bold text-base leading-none">×</button>
            </div>
            <div class="grid grid-cols-3 gap-2">
              <div class="relative">
                <input v-model.number="entry.consumption" type="text" inputmode="decimal"
                  class="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:border-purple-400 outline-none pr-10" />
                <span class="absolute right-2 top-1.5 text-xs text-gray-400">L/100</span>
              </div>
              <div class="relative">
                <input v-model.number="entry.fuelPrice" type="text" inputmode="decimal"
                  class="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:border-purple-400 outline-none pr-8" />
                <span class="absolute right-2 top-1.5 text-xs text-gray-400">€/L</span>
              </div>
              <div class="relative">
                <input v-model.number="entry.fiscalPower" type="text" inputmode="numeric"
                  class="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:border-purple-400 outline-none pr-6" />
                <span class="absolute right-2 top-1.5 text-xs text-gray-400">CV</span>
              </div>
            </div>
          </div>

          <button @click="addConvoyVehicle"
            class="w-full py-2 rounded-lg border border-dashed border-gray-300 text-xs text-gray-500 hover:border-purple-400 hover:text-purple-600 transition-colors">
            + Ajouter un véhicule
          </button>
        </div>
      </div>

      <!-- Convoy breakdown table (when results available) -->
      <div v-if="calcDone && convoyEnabled && convoyResults.length > 1" class="bg-white rounded-2xl border border-gray-200 p-4">
        <h3 class="text-sm font-semibold text-gray-700 mb-3">Détail par véhicule</h3>
        <table class="w-full text-xs">
          <thead>
            <tr class="text-gray-400 border-b border-gray-100">
              <th class="text-left pb-2 font-medium">Véhicule</th>
              <th v-if="useEssence" class="text-right pb-2 font-medium text-blue-500">⛽ Coût réel</th>
              <th v-if="useBareme" class="text-right pb-2 font-medium text-orange-500">📋 Indemnité<span v-if="effectiveRatio !== 1"> {{ autoRatioEnabled ? `auto ${(autoRatio * 100).toFixed(1)}%` : ratioLabel }}</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in convoyResults" :key="r.label" class="border-b border-gray-50">
              <td class="py-1.5 text-gray-700">{{ r.label }}</td>
              <td v-if="useEssence" class="text-right py-1.5 text-blue-600 font-medium">{{ fmtEur(r.essenceTotal) }}</td>
              <td v-if="useBareme" class="text-right py-1.5 text-orange-600 font-medium">{{ fmtEur(r.baremeAllowance * effectiveRatio) }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="border-t-2 border-gray-200 font-bold text-gray-800">
              <td class="pt-2">Total ({{ convoyResults.length }} véhicules)</td>
              <td v-if="useEssence" class="text-right pt-2 text-blue-700">{{ fmtEur(convoyEssenceTotal) }}</td>
              <td v-if="useBareme" class="text-right pt-2 text-orange-700">{{ fmtEur(convoyBaremeTotal) }}</td>
            </tr>
            <tr v-if="nbPersons > 1" class="text-green-700 font-bold">
              <td class="pt-1">Par personne ({{ nbPersons }})</td>
              <td v-if="useEssence" class="text-right pt-1">{{ fmtEur(perPersonEssence) }}</td>
              <td v-if="useBareme" class="text-right pt-1">{{ fmtEur(perPersonBareme) }}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- Comparison row (both active + results) -->
      <div v-if="calcDone && essenceResult && baremeResult"
        class="rounded-xl border p-4 flex flex-wrap items-center justify-between gap-3"
        :class="scaledDelta > 0 ? 'bg-orange-50 border-orange-200' : scaledDelta < 0 ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'">
        <div class="min-w-0">
          <p class="font-semibold text-sm" :class="scaledDelta > 0 ? 'text-orange-800' : scaledDelta < 0 ? 'text-blue-800' : 'text-gray-700'">
            <span v-if="scaledDelta > 0">📋 Frais kilométriques supérieurs</span>
            <span v-else-if="scaledDelta < 0">⛽ Coût réel supérieur à l'indemnité</span>
            <span v-else>⚖️ Méthodes équivalentes</span>
          </p>
          <p class="text-xs text-gray-500 mt-0.5">
            <span v-if="scaledDelta > 0">L'indemnité km couvre mieux le trajet</span>
            <span v-else-if="scaledDelta < 0">Le coût réel dépasse l'indemnité de {{ fmtEur(Math.abs(scaledDelta)) }}</span>
          </p>
        </div>
        <div class="text-right flex-shrink-0">
          <p class="text-xs text-gray-500 mb-0.5">Écart<span v-if="effectiveRatio !== 1" class="ml-1 text-orange-500">{{ autoRatioEnabled ? `auto ${(autoRatio * 100).toFixed(1)}%` : ratioLabel }}</span></p>
          <p class="text-lg font-bold" :class="scaledDelta > 0 ? 'text-orange-700' : scaledDelta < 0 ? 'text-blue-700' : 'text-gray-700'">
            {{ scaledDelta >= 0 ? '+' : '' }}{{ fmtEur(scaledDelta) }}
          </p>
        </div>
      </div>

      <!-- Error -->
      <div v-if="calcError" class="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
        <AlertCircle :size="15" class="flex-shrink-0" />
        {{ calcError }}
      </div>

      <!-- Actions -->
      <div class="flex items-center gap-3">
        <button @click="calculate" :disabled="!canCalculate || calculating"
          class="flex-1 py-3 rounded-xl bg-orange-500 text-white font-semibold text-sm hover:bg-orange-600 disabled:bg-gray-300 disabled:text-gray-400 transition-colors shadow-sm">
          {{ calculating ? 'Calcul…' : 'Calculer' }}
        </button>
        <button @click="reset" class="px-4 py-3 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-100 transition-colors">
          <RotateCcw :size="16" />
        </button>
        <button v-if="calcDone" @click="printReport"
          class="flex items-center gap-1.5 px-4 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 transition-colors">
          <Printer :size="15" /> Générer PDF
        </button>
      </div>

    </div>
  </div>
</template>

<style>
/* Masquée en affichage normal, visible uniquement à l'impression */
.prp-print-zone { display: none; }

@media print {
  /* Cache tout sauf la zone print téléportée (enfant direct de body) */
  body > *:not(.prp-print-zone) { display: none !important; }
  .prp-print-zone { display: block !important; }
  @page { margin: 1.5cm; size: A4; }
}
</style>
