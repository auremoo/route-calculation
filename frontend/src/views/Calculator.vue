<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getLocale } from '../i18n/index'
import api from '../stores/api'
import {
  Navigation, RotateCcw, Printer, AlertCircle, Fuel,
  Plus, Minus, ChevronDown, ChevronUp, Car
} from 'lucide-vue-next'

const router = useRouter()

// ---- Vehicles ----
const vehicles = ref<any[]>([])
const selectedVehicleId = ref<number | null>(null)
const selectedVehicle = computed(() => vehicles.value.find(v => v.id === selectedVehicleId.value) ?? null)
const vehiclePickerOpen = ref(false)

// ---- Trip inputs ----
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

// ---- Fuel column ----
const useEssence = ref(true)
const avoidTolls = ref(false)
const tollAmount = ref<number>(0)
const consumption = ref<number>(6.5)
const fuelPrice = ref<number>(1.85)
const isElectric = computed(() => selectedVehicle.value?.fuel_type === 'electric')

// ---- Barème column ----
const useBareme = ref(true)
const fiscalPower = ref<number>(5)
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
const nbPersons = ref(1)

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
const convoyOpen = ref(false)

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
    fiscalPower: fiscalPower.value,
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
const calcError = ref<string | null>(null)

// ---- ORS ----
let fromTimer: ReturnType<typeof setTimeout>
let toTimer: ReturnType<typeof setTimeout>

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

function selectVehicle(v: any) {
  applyVehicle(v)
  vehiclePickerOpen.value = false
}
function clearVehicle() {
  selectedVehicleId.value = null
  vehiclePickerOpen.value = false
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
    roundTrip: roundTrip.value,
  }

  try {
    if (convoyEnabled.value) {
      const entries = [
        { label: selectedVehicle.value?.name ?? 'Véhicule 1', consumption: consumption.value, fuelPrice: fuelPrice.value, fiscalPower: fiscalPower.value },
        ...convoyExtras.value.map(e => ({ label: e.label, consumption: e.consumption, fuelPrice: e.fuelPrice, fiscalPower: e.fiscalPower })),
      ]
      const responses = await Promise.all(
        entries.map(e => api.post('/route-calc/calculate', { ...base, consumption: e.consumption, fuelPrice: e.fuelPrice, fiscalPower: e.fiscalPower }))
      )
      convoyResults.value = responses.map((r, i) => ({
        label: entries[i].label,
        essenceTotal: r.data.totalRealCost,
        baremeAllowance: r.data.baremeAllowance,
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
    calcError.value = 'Erreur lors du calcul. Vérifiez que tous les champs sont remplis.'
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

function decrementPersons() { if (nbPersons.value > 1) nbPersons.value-- }
function printReport() { window.print() }
</script>

<template>
  <div class="w-full max-w-5xl mx-auto">

    <!-- ===== PRINT ZONE ===== -->
    <Teleport to="body">
    <div class="rc-print-zone">

      <!-- En-tête -->
      <div class="rc-header">
        <div class="rc-logo">🚗 RouteCalc</div>
        <div class="rc-meta">
          <strong>Rapport de frais de déplacement</strong><br/>
          <span class="rc-muted">{{ today }}</span>
        </div>
      </div>

      <!-- Infos trajet -->
      <div class="rc-trip-block">
        <div class="rc-trip-row" v-if="selectedVehicle || fromAddress || toAddress || totalDistance">
          <div v-if="selectedVehicle" class="rc-trip-item">
            <span class="rc-label">Véhicule</span>
            <span class="rc-value">{{ selectedVehicle.name }} · {{ selectedVehicle.consumption }} {{ isElectric ? 'kWh' : 'L' }}/100 · {{ fiscalPower }} CV</span>
          </div>
          <div v-if="fromAddress || toAddress" class="rc-trip-item">
            <span class="rc-label">Trajet</span>
            <span class="rc-value">{{ fromAddress || '—' }} → {{ toAddress || '—' }}</span>
          </div>
          <div v-if="totalDistance" class="rc-trip-item">
            <span class="rc-label">Distance</span>
            <span class="rc-value">{{ fmtKm(totalDistance) }}<span v-if="roundTrip"> (aller-retour)</span></span>
          </div>
          <div v-if="effectiveRatio !== 1" class="rc-trip-item">
            <span class="rc-label">Ratio appliqué</span>
            <span class="rc-value rc-orange">{{ autoRatioEnabled ? `auto ${(autoRatio * 100).toFixed(1)}%` : ratioLabel }}</span>
          </div>
        </div>
      </div>

      <!-- Résultats (deux colonnes) -->
      <div class="rc-results" :class="essenceResult && baremeResult ? 'rc-two-col' : ''">

        <!-- Colonne carburant -->
        <div v-if="essenceResult" class="rc-card rc-blue">
          <div class="rc-card-header">⛽ Coût {{ isElectric ? 'énergie' : 'carburant' }}</div>
          <table class="rc-table">
            <tr><td>Consommation</td><td>{{ consumption }} {{ isElectric ? 'kWh' : 'L' }}/100km</td></tr>
            <tr><td>Prix {{ isElectric ? 'énergie' : 'carburant' }}</td><td>{{ fuelPrice }} €/{{ isElectric ? 'kWh' : 'L' }}</td></tr>
            <tr><td>{{ isElectric ? 'Énergie' : 'Carburant' }}</td><td>{{ fmtEur(essenceResult.fuelCost) }}</td></tr>
            <tr v-if="essenceResult.tollCost > 0"><td>Péages</td><td>{{ fmtEur(essenceResult.tollCost) }}</td></tr>
            <tr class="rc-row-total"><td>TOTAL</td><td>{{ fmtEur(essenceResult.total) }}</td></tr>
            <tr class="rc-row-sub"><td>soit</td><td>{{ fmtEur(essenceResult.perKm) }}/km</td></tr>
            <tr v-if="nbPersons > 1" class="rc-row-person"><td>Par personne ({{ nbPersons }})</td><td>{{ fmtEur(essenceResult.total / nbPersons) }}</td></tr>
          </table>
        </div>

        <!-- Colonne barème -->
        <div v-if="baremeResult" class="rc-card rc-orange">
          <div class="rc-card-header">📋 Frais kilométriques 2025</div>
          <table class="rc-table">
            <tr><td>Puissance fiscale</td><td>{{ fiscalPower }} CV</td></tr>
            <tr><td>Tranche annuelle</td><td>{{ baremeResult.bracket }}</td></tr>
            <tr><td>Taux appliqué</td><td>{{ baremeResult.rate.toFixed(3) }} €/km</td></tr>
            <tr v-if="effectiveRatio !== 1"><td>Indemnité brute</td><td>{{ fmtEur(baremeResult.allowance) }}</td></tr>
            <tr class="rc-row-total">
              <td>INDEMNITÉ<span v-if="effectiveRatio !== 1"> ({{ autoRatioEnabled ? `auto ${(autoRatio * 100).toFixed(1)}%` : ratioLabel }})</span></td>
              <td>{{ fmtEur(baremeResult.allowance * effectiveRatio) }}</td>
            </tr>
            <tr class="rc-row-sub"><td>soit</td><td>{{ fmtEur(baremeResult.perKm * effectiveRatio) }}/km</td></tr>
            <tr v-if="nbPersons > 1" class="rc-row-person"><td>Par personne ({{ nbPersons }})</td><td>{{ fmtEur(baremeResult.allowance * effectiveRatio / nbPersons) }}</td></tr>
          </table>
        </div>
      </div>

      <!-- Convoi -->
      <div v-if="convoyEnabled && convoyResults.length > 1" class="rc-convoy">
        <div class="rc-section-title">Convoi — Détail par véhicule</div>
        <table class="rc-table rc-table-full">
          <thead>
            <tr>
              <th class="rc-th-left">Véhicule</th>
              <th v-if="useEssence" class="rc-th-right">Coût réel ⛽</th>
              <th v-if="useBareme" class="rc-th-right">Indemnité km 📋<span v-if="effectiveRatio !== 1"> ({{ autoRatioEnabled ? `${(autoRatio * 100).toFixed(1)}%` : ratioLabel }})</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in convoyResults" :key="r.label">
              <td>{{ r.label }}</td>
              <td v-if="useEssence" class="rc-td-right">{{ fmtEur(r.essenceTotal) }}</td>
              <td v-if="useBareme" class="rc-td-right">{{ fmtEur(r.baremeAllowance * effectiveRatio) }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="rc-foot-total">
              <td>Total ({{ convoyResults.length }} véhicules)</td>
              <td v-if="useEssence" class="rc-td-right">{{ fmtEur(convoyEssenceTotal) }}</td>
              <td v-if="useBareme" class="rc-td-right">{{ fmtEur(convoyBaremeTotal) }}</td>
            </tr>
            <tr v-if="nbPersons > 1" class="rc-foot-person">
              <td>Par personne ({{ nbPersons }})</td>
              <td v-if="useEssence" class="rc-td-right">{{ fmtEur(perPersonEssence) }}</td>
              <td v-if="useBareme" class="rc-td-right">{{ fmtEur(perPersonBareme) }}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- Comparaison finale -->
      <div v-if="essenceResult && baremeResult" class="rc-comparison" :class="scaledDelta > 0 ? 'rc-cmp-orange' : scaledDelta < 0 ? 'rc-cmp-blue' : 'rc-cmp-gray'">
        <div class="rc-cmp-label">
          <strong v-if="scaledDelta > 0">Les frais kilométriques sont plus avantageux</strong>
          <strong v-else-if="scaledDelta < 0">Le coût réel dépasse le barème</strong>
          <strong v-else>Méthodes équivalentes</strong>
        </div>
        <div class="rc-cmp-delta">
          <span class="rc-cmp-sign">Écart</span>
          <span class="rc-cmp-amount">{{ scaledDelta >= 0 ? '+' : '' }}{{ fmtEur(scaledDelta) }}</span>
        </div>
      </div>

      <div class="rc-footer">Généré avec RouteCalc · Barème kilométrique 2025</div>
    </div>
    </Teleport>

    <!-- ===== SCREEN ===== -->
    <div class="space-y-4">

      <!-- ── SECTION 1 : Véhicule ── -->
      <div class="bg-white rounded-xl border border-ink-100 shadow-soft">
        <!-- Vehicle picker header -->
        <button
          @click="vehiclePickerOpen = !vehiclePickerOpen"
          class="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-ink-50 transition-colors rounded-xl"
        >
          <div class="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
            <Car :size="16" class="text-orange-500" />
          </div>
          <div class="flex-1 text-left min-w-0">
            <p class="text-xs text-ink-300 font-medium uppercase tracking-wide mb-0.5">Véhicule</p>
            <p class="text-sm font-semibold text-ink-800 truncate">
              {{ selectedVehicle ? `${selectedVehicle.name} · ${selectedVehicle.consumption} ${selectedVehicle.fuel_type === 'electric' ? 'kWh' : 'L'}/100 · ${selectedVehicle.fiscal_power} CV` : 'Saisie manuelle' }}
            </p>
          </div>
          <ChevronDown :size="16" class="text-ink-300 flex-shrink-0 transition-transform" :class="vehiclePickerOpen ? 'rotate-180' : ''" />
        </button>

        <!-- Dropdown: vehicle list -->
        <div v-if="vehiclePickerOpen" class="border-t border-ink-100 p-2 space-y-1">
          <button
            @click="clearVehicle"
            class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left"
            :class="!selectedVehicleId ? 'bg-orange-50 text-orange-700' : 'hover:bg-ink-50 text-ink-500'"
          >
            <span class="text-sm font-medium">— Saisie manuelle —</span>
          </button>
          <button
            v-for="v in vehicles"
            :key="v.id"
            @click="selectVehicle(v)"
            class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left"
            :class="selectedVehicleId === v.id ? 'bg-orange-50 text-orange-700' : 'hover:bg-ink-50'"
          >
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold truncate" :class="selectedVehicleId === v.id ? 'text-orange-700' : 'text-ink-800'">
                {{ v.name }}
                <span v-if="v.is_default" class="ml-1 text-xs font-normal text-orange-400">★ défaut</span>
              </p>
              <p class="text-xs text-ink-300">
                {{ v.consumption }} {{ v.fuel_type === 'electric' ? 'kWh' : 'L' }}/100km · {{ v.fiscal_power }} CV
                <span v-if="v.default_fuel_price"> · {{ v.default_fuel_price }} €/{{ v.fuel_type === 'electric' ? 'kWh' : 'L' }}</span>
              </p>
            </div>
          </button>
          <button
            @click="router.push('/settings'); vehiclePickerOpen = false"
            class="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-ink-100 text-xs text-ink-300 hover:border-orange-300 hover:text-orange-500 transition-colors"
          >
            <Plus :size="12" /> Gérer les véhicules
          </button>
        </div>
      </div>

      <!-- ── SECTION 2 : Trajet ── -->
      <div class="bg-white rounded-xl border border-ink-100 shadow-soft p-4 space-y-3">
        <div class="flex items-center justify-between">
          <p class="text-xs text-ink-300 font-medium uppercase tracking-wide">Trajet</p>
          <label class="flex items-center gap-2 text-xs text-ink-500 cursor-pointer select-none">
            <button
              @click="roundTrip = !roundTrip"
              :class="roundTrip ? 'bg-orange-500' : 'bg-ink-100'"
              class="relative w-8 h-4 rounded-full transition-colors flex-shrink-0"
            >
              <span :class="roundTrip ? 'translate-x-4' : 'translate-x-0.5'" class="absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform block" />
            </button>
            Aller-retour
          </label>
        </div>

        <!-- ORS address inputs -->
        <div v-if="orsAvailable" class="space-y-2">
          <div class="grid grid-cols-2 gap-2">
            <div class="relative">
              <input v-model="fromAddress" @input="onFromInput" @blur="hideFrom"
                placeholder="Départ" class="input text-xs py-2" />
              <div v-if="showFromSug && fromSuggestions.length" class="absolute z-20 w-full mt-1 bg-white border border-ink-100 rounded-lg shadow-medium max-h-44 overflow-y-auto">
                <button v-for="s in fromSuggestions" :key="s.label" @mousedown.prevent="pickFrom(s)"
                  class="w-full text-left px-3 py-2 text-xs hover:bg-orange-50 border-b border-ink-50 last:border-0">{{ s.label }}</button>
              </div>
            </div>
            <div class="relative">
              <input v-model="toAddress" @input="onToInput" @blur="hideTo"
                placeholder="Arrivée" class="input text-xs py-2" />
              <div v-if="showToSug && toSuggestions.length" class="absolute z-20 w-full mt-1 bg-white border border-ink-100 rounded-lg shadow-medium max-h-44 overflow-y-auto">
                <button v-for="s in toSuggestions" :key="s.label" @mousedown.prevent="pickTo(s)"
                  class="w-full text-left px-3 py-2 text-xs hover:bg-orange-50 border-b border-ink-50 last:border-0">{{ s.label }}</button>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button @click="getRoute" :disabled="!fromCoords || !toCoords || routeLoading"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500 text-white text-xs font-medium hover:bg-orange-600 transition-colors disabled:opacity-40">
              <Navigation :size="12" /> {{ routeLoading ? '…' : 'Calculer l\'itinéraire' }}
            </button>
            <div v-if="routeDistance" class="flex items-center gap-2 px-2.5 py-1.5 bg-green-50 rounded-lg text-xs font-medium text-green-700">
              <span>{{ fmtKm(routeDistance) }}</span>
              <span v-if="routeDuration" class="text-green-500">{{ fmtDuration(routeDuration) }}</span>
              <span v-if="roundTrip" class="text-green-500">→ A/R : {{ fmtKm(routeDistance * 2) }}</span>
            </div>
          </div>
          <p class="text-xs text-ink-300">ou saisir la distance manuellement ↓</p>
        </div>
        <div v-else class="flex items-center gap-2 px-3 py-2 bg-amber-50 rounded-lg text-xs text-amber-700">
          <AlertCircle :size="12" /> Géocodage indisponible — ORS_API_KEY non configurée
        </div>

        <!-- Manual distance (always shown) -->
        <div class="flex items-center gap-2">
          <input v-model.number="manualDistance" type="text" inputmode="numeric" placeholder="Distance en km"
            class="input text-sm flex-1" />
          <span v-if="totalDistance > 0" class="text-sm font-semibold text-ink-500 flex-shrink-0 whitespace-nowrap">
            = {{ fmtKm(totalDistance) }}<span v-if="roundTrip" class="text-xs font-normal text-ink-300"> A/R</span>
          </span>
        </div>
      </div>

      <!-- ── SECTION 3 : Paramètres (deux colonnes) ── -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">

        <!-- Col A: Carburant -->
        <div class="bg-white rounded-xl border-2 transition-colors shadow-soft" :class="useEssence ? 'border-blue-300' : 'border-ink-100'">
          <div class="px-4 py-3 border-b flex items-center justify-between" :class="useEssence ? 'border-blue-100' : 'border-ink-50'">
            <div class="flex items-center gap-2">
              <Fuel :size="15" class="text-blue-500" />
              <span class="text-sm font-semibold text-ink-800">Coût carburant</span>
            </div>
            <button @click="useEssence = !useEssence"
              :class="useEssence ? 'bg-blue-500' : 'bg-ink-100'"
              class="relative w-9 h-5 rounded-full transition-colors flex-shrink-0">
              <span :class="useEssence ? 'translate-x-4' : 'translate-x-0.5'" class="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform block" />
            </button>
          </div>
          <div class="p-4 space-y-3" :class="!useEssence ? 'opacity-40 pointer-events-none' : ''">
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="label text-xs">Consommation</label>
                <div class="relative">
                  <input v-model.number="consumption" type="text" inputmode="decimal"
                    class="input pr-14 text-sm" />
                  <span class="absolute right-2.5 top-2 text-xs text-ink-300">{{ isElectric ? 'kWh' : 'L' }}/100</span>
                </div>
              </div>
              <div>
                <label class="label text-xs">Prix {{ isElectric ? 'énergie' : 'carburant' }}</label>
                <div class="relative">
                  <input v-model.number="fuelPrice" type="text" inputmode="decimal"
                    class="input pr-12 text-sm" />
                  <span class="absolute right-2.5 top-2 text-xs text-ink-300">€/{{ isElectric ? 'kWh' : 'L' }}</span>
                </div>
              </div>
            </div>

            <div>
              <label class="flex items-center justify-between mb-2 cursor-pointer select-none">
                <span class="text-xs text-ink-300">Éviter les péages</span>
                <button @click="avoidTolls = !avoidTolls; if(avoidTolls) tollAmount = 0"
                  :class="avoidTolls ? 'bg-blue-500' : 'bg-ink-100'"
                  class="relative w-8 h-4 rounded-full transition-colors">
                  <span :class="avoidTolls ? 'translate-x-4' : 'translate-x-0.5'" class="absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform block" />
                </button>
              </label>
              <input v-if="!avoidTolls" v-model.number="tollAmount" type="text" inputmode="decimal"
                placeholder="Montant des péages (€)" class="input text-sm" />
            </div>

            <!-- Résultat A -->
            <div v-if="essenceResult" class="pt-3 border-t border-blue-100 space-y-1">
              <div class="flex justify-between text-sm text-ink-500">
                <span>{{ isElectric ? 'Énergie' : 'Carburant' }}</span>
                <span class="font-medium">{{ fmtEur(essenceResult.fuelCost) }}</span>
              </div>
              <div v-if="essenceResult.tollCost > 0" class="flex justify-between text-sm text-ink-500">
                <span>Péages</span>
                <span class="font-medium">{{ fmtEur(essenceResult.tollCost) }}</span>
              </div>
              <div class="flex justify-between font-bold text-blue-700 text-base pt-1 border-t border-blue-100">
                <span>Total<span v-if="convoyEnabled && convoyResults.length > 1" class="font-normal text-xs text-blue-400 ml-1">({{ convoyResults.length }} véh.)</span></span>
                <span>{{ fmtEur(essenceResult.total) }}</span>
              </div>
              <p class="text-xs text-ink-300 text-right">{{ fmtEur(essenceResult.perKm) }}/km</p>
              <div v-if="nbPersons > 1" class="flex justify-between text-sm font-semibold text-green-700 pt-1 border-t border-blue-50">
                <span>Par personne ({{ nbPersons }})</span>
                <span>{{ fmtEur(essenceResult.total / nbPersons) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Col B: Barème -->
        <div class="bg-white rounded-xl border-2 transition-colors shadow-soft" :class="useBareme ? 'border-orange-300' : 'border-ink-100'">
          <div class="px-4 py-3 border-b flex items-center justify-between" :class="useBareme ? 'border-orange-100' : 'border-ink-50'">
            <div class="flex items-center gap-2">
              <span class="text-sm">📋</span>
              <span class="text-sm font-semibold text-ink-800">Frais kilométriques</span>
            </div>
            <button @click="useBareme = !useBareme"
              :class="useBareme ? 'bg-orange-500' : 'bg-ink-100'"
              class="relative w-9 h-5 rounded-full transition-colors flex-shrink-0">
              <span :class="useBareme ? 'translate-x-4' : 'translate-x-0.5'" class="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform block" />
            </button>
          </div>
          <div class="p-4 space-y-3" :class="!useBareme ? 'opacity-40 pointer-events-none' : ''">
            <div>
              <label class="label text-xs">Puissance fiscale</label>
              <div class="relative">
                <input v-model.number="fiscalPower" type="text" inputmode="numeric"
                  class="input pr-8 text-sm" />
                <span class="absolute right-2.5 top-2 text-xs text-ink-300">CV</span>
              </div>
            </div>
            <div class="px-3 py-2 bg-orange-50 rounded-lg text-xs text-orange-700">
              Barème 2025 · 3 tranches (≤5 000 / 5–20 000 / >20 000 km/an)
            </div>

            <!-- Résultat B -->
            <div v-if="baremeResult" class="pt-3 border-t border-orange-100 space-y-1">
              <div class="flex justify-between text-sm text-ink-500">
                <span>Tranche</span>
                <span class="font-medium text-xs">{{ baremeResult.bracket }}</span>
              </div>
              <div class="flex justify-between text-sm text-ink-500">
                <span>Taux</span>
                <span class="font-medium">{{ baremeResult.rate.toFixed(3) }} €/km</span>
              </div>
              <div class="flex justify-between font-bold text-orange-600 text-base pt-1 border-t border-orange-100">
                <span>Indemnité<span v-if="effectiveRatio !== 1" class="font-normal text-xs text-orange-400 ml-1">{{ autoRatioEnabled ? `auto ${(autoRatio * 100).toFixed(1)}%` : ratioLabel }}</span><span v-if="convoyEnabled && convoyResults.length > 1" class="font-normal text-xs text-orange-400 ml-1">({{ convoyResults.length }} véh.)</span></span>
                <span>{{ fmtEur(baremeResult.allowance * effectiveRatio) }}</span>
              </div>
              <p v-if="effectiveRatio !== 1" class="text-xs text-ink-300 text-right">(brut : {{ fmtEur(baremeResult.allowance) }})</p>
              <p class="text-xs text-ink-300 text-right">{{ fmtEur(baremeResult.perKm * effectiveRatio) }}/km</p>
              <div v-if="nbPersons > 1" class="flex justify-between text-sm font-semibold text-green-700 pt-1 border-t border-orange-50">
                <span>Par personne ({{ nbPersons }})</span>
                <span>{{ fmtEur(baremeResult.allowance * effectiveRatio / nbPersons) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ── SECTION 4 : Ratio & Personnes (collapsible) ── -->
      <div v-if="useEssence || useBareme" class="bg-white rounded-xl border border-ink-100 shadow-soft">
        <div class="flex items-center gap-2 flex-wrap px-4 py-3" :class="autoRatioEnabled ? 'opacity-40 pointer-events-none' : ''">
          <span class="text-xs font-medium text-ink-500 flex-shrink-0">Ratio :</span>
          <div class="flex items-center gap-1 flex-wrap">
            <button v-for="preset in PRESET_RATIOS" :key="preset.value"
              @click="applyPreset(preset.value)"
              :class="selectedRatioPreset === preset.value ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-ink-500 border-ink-100 hover:border-orange-300'"
              class="px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors">
              {{ preset.label }}
            </button>
          </div>
          <div class="flex items-center gap-1">
            <span class="text-xs text-ink-300">×</span>
            <input v-model="customRatio" @input="onCustomRatio" type="text" placeholder="0.XX"
              :class="selectedRatioPreset === -1 ? 'border-orange-400 ring-1 ring-orange-200' : 'border-ink-100'"
              class="w-14 px-2 py-1 text-xs border rounded-lg outline-none text-center" />
          </div>
          <span v-if="!autoRatioEnabled && ratioValue !== 1" class="text-xs text-orange-600 font-medium">→ résultats × {{ ratioLabel.replace('× ', '') }}</span>
        </div>

        <div class="border-t border-ink-50 flex items-center gap-3 flex-wrap px-4 py-3">
          <!-- Auto-ratio -->
          <button @click="autoRatioEnabled = !autoRatioEnabled"
            :class="autoRatioEnabled ? 'bg-green-500' : 'bg-ink-100'"
            class="relative w-8 h-4 rounded-full transition-colors flex-shrink-0">
            <span :class="autoRatioEnabled ? 'translate-x-4' : 'translate-x-0.5'" class="absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform block" />
          </button>
          <span class="text-xs text-ink-500">Ratio auto — surplus max :</span>
          <div class="flex items-center gap-1">
            <input v-model.number="surplusMaxPer1000km" type="number" min="0" step="1"
              class="w-14 px-2 py-1 text-xs border rounded-lg outline-none text-center transition-colors"
              :class="autoRatioEnabled ? 'border-green-400 ring-1 ring-green-100' : 'border-ink-100'" />
            <span class="text-xs text-ink-300">€/pers./1000km</span>
          </div>
          <span class="text-ink-100">·</span>
          <!-- Personnes -->
          <div class="flex items-center gap-1.5">
            <button @click="decrementPersons" class="w-6 h-6 rounded-full border border-ink-100 text-ink-500 hover:bg-ink-50 text-sm font-medium flex items-center justify-center">
              <Minus :size="10" />
            </button>
            <span class="text-xs font-bold w-4 text-center">{{ nbPersons }}</span>
            <button @click="nbPersons++" class="w-6 h-6 rounded-full border border-ink-100 text-ink-500 hover:bg-ink-50 text-sm font-medium flex items-center justify-center">
              <Plus :size="10" />
            </button>
            <span class="text-xs text-ink-300">pers.</span>
          </div>
          <span v-if="autoRatioEnabled && calcDone" class="text-xs font-semibold text-green-700">→ ratio : {{ (autoRatio * 100).toFixed(1) }}%</span>
          <span v-else-if="autoRatioEnabled" class="text-xs text-ink-300 italic">calculer d'abord</span>
        </div>
      </div>

      <!-- ── SECTION 5 : Convoi (collapsible) ── -->
      <div class="bg-white rounded-xl border border-ink-100 shadow-soft">
        <button
          @click="convoyOpen = !convoyOpen"
          class="w-full flex items-center justify-between px-4 py-3 hover:bg-ink-50 transition-colors rounded-xl"
        >
          <div class="flex items-center gap-2">
            <span class="text-sm">🚙🚙</span>
            <span class="text-sm font-medium text-ink-700">Convoi</span>
            <span class="text-xs text-ink-300">plusieurs véhicules + partage</span>
          </div>
          <div class="flex items-center gap-2">
            <button
              @click.stop="convoyEnabled = !convoyEnabled; if(convoyEnabled && !convoyOpen) convoyOpen = true"
              :class="convoyEnabled ? 'bg-purple-500' : 'bg-ink-100'"
              class="relative w-9 h-5 rounded-full transition-colors flex-shrink-0">
              <span :class="convoyEnabled ? 'translate-x-4' : 'translate-x-0.5'" class="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform block" />
            </button>
            <ChevronDown :size="14" class="text-ink-300 transition-transform" :class="convoyOpen ? 'rotate-180' : ''" />
          </div>
        </button>

        <div v-if="convoyOpen" class="border-t border-ink-50 p-4 space-y-3">
          <!-- Véhicule principal -->
          <div class="flex items-center gap-2 px-3 py-2 bg-ink-50 rounded-lg text-xs text-ink-500 flex-wrap">
            <span class="font-medium text-ink-700">{{ selectedVehicle?.name ?? 'Véhicule 1' }}</span>
            <span class="text-ink-100">·</span>
            <span>{{ consumption }} {{ isElectric ? 'kWh' : 'L' }}/100</span>
            <span class="text-ink-100">·</span>
            <span>{{ fuelPrice }} €/{{ isElectric ? 'kWh' : 'L' }}</span>
            <span class="text-ink-100">·</span>
            <span>{{ fiscalPower }} CV</span>
            <span class="ml-auto text-ink-300 italic">(principal)</span>
          </div>

          <!-- Véhicules supplémentaires -->
          <div v-for="entry in convoyExtras" :key="entry.id" class="border border-ink-100 rounded-lg p-3 space-y-2">
            <div class="flex items-center gap-2">
              <input v-model="entry.label"
                class="text-xs font-medium text-ink-700 border-0 outline-none bg-transparent flex-1 min-w-0 focus:underline" />
              <select v-model="entry.vehicleId" @change="applyVehicleToEntry(entry)"
                class="text-xs border border-ink-100 rounded-lg px-2 py-1 outline-none bg-white flex-shrink-0 focus:border-purple-400">
                <option :value="null">— Manuel —</option>
                <option v-for="v in vehicles" :key="v.id" :value="v.id">{{ v.name }}</option>
              </select>
              <button @click="removeConvoyVehicle(entry.id)" class="text-red-400 hover:text-red-600 flex-shrink-0 font-bold text-base leading-none">×</button>
            </div>
            <div class="grid grid-cols-3 gap-2">
              <div class="relative">
                <input v-model.number="entry.consumption" type="text" inputmode="decimal"
                  class="w-full px-2 py-1.5 text-xs border border-ink-100 rounded-lg focus:border-purple-400 outline-none pr-10" />
                <span class="absolute right-2 top-1.5 text-xs text-ink-300">L/100</span>
              </div>
              <div class="relative">
                <input v-model.number="entry.fuelPrice" type="text" inputmode="decimal"
                  class="w-full px-2 py-1.5 text-xs border border-ink-100 rounded-lg focus:border-purple-400 outline-none pr-8" />
                <span class="absolute right-2 top-1.5 text-xs text-ink-300">€/L</span>
              </div>
              <div class="relative">
                <input v-model.number="entry.fiscalPower" type="text" inputmode="numeric"
                  class="w-full px-2 py-1.5 text-xs border border-ink-100 rounded-lg focus:border-purple-400 outline-none pr-6" />
                <span class="absolute right-2 top-1.5 text-xs text-ink-300">CV</span>
              </div>
            </div>
          </div>

          <button @click="addConvoyVehicle"
            class="w-full py-2 rounded-lg border border-dashed border-ink-100 text-xs text-ink-300 hover:border-purple-400 hover:text-purple-600 transition-colors">
            + Ajouter un véhicule
          </button>
        </div>
      </div>

      <!-- Convoy breakdown (post-calc) -->
      <div v-if="calcDone && convoyEnabled && convoyResults.length > 1" class="bg-white rounded-xl border border-ink-100 shadow-soft p-4">
        <h3 class="text-sm font-semibold text-ink-700 mb-3">Détail par véhicule</h3>
        <table class="w-full text-xs">
          <thead><tr class="text-ink-300 border-b border-ink-50">
            <th class="text-left pb-2 font-medium">Véhicule</th>
            <th v-if="useEssence" class="text-right pb-2 font-medium text-blue-500">⛽ Coût réel</th>
            <th v-if="useBareme" class="text-right pb-2 font-medium text-orange-500">📋 Indemnité<span v-if="effectiveRatio !== 1"> {{ autoRatioEnabled ? `auto ${(autoRatio * 100).toFixed(1)}%` : ratioLabel }}</span></th>
          </tr></thead>
          <tbody>
            <tr v-for="r in convoyResults" :key="r.label" class="border-b border-ink-50">
              <td class="py-1.5 text-ink-700">{{ r.label }}</td>
              <td v-if="useEssence" class="text-right py-1.5 text-blue-600 font-medium">{{ fmtEur(r.essenceTotal) }}</td>
              <td v-if="useBareme" class="text-right py-1.5 text-orange-600 font-medium">{{ fmtEur(r.baremeAllowance * effectiveRatio) }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="border-t-2 border-ink-100 font-bold text-ink-800">
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

      <!-- Comparaison -->
      <div v-if="calcDone && essenceResult && baremeResult"
        class="rounded-xl border p-4 flex flex-wrap items-center justify-between gap-3"
        :class="scaledDelta > 0 ? 'bg-orange-50 border-orange-200' : scaledDelta < 0 ? 'bg-blue-50 border-blue-200' : 'bg-ink-50 border-ink-100'">
        <div class="min-w-0">
          <p class="font-semibold text-sm" :class="scaledDelta > 0 ? 'text-orange-800' : scaledDelta < 0 ? 'text-blue-800' : 'text-ink-700'">
            <span v-if="scaledDelta > 0">📋 Frais kilométriques supérieurs</span>
            <span v-else-if="scaledDelta < 0">⛽ Coût réel supérieur à l'indemnité</span>
            <span v-else>⚖️ Méthodes équivalentes</span>
          </p>
          <p class="text-xs text-ink-300 mt-0.5">
            <span v-if="scaledDelta > 0">L'indemnité km couvre mieux le trajet</span>
            <span v-else-if="scaledDelta < 0">Le coût réel dépasse l'indemnité de {{ fmtEur(Math.abs(scaledDelta)) }}</span>
          </p>
        </div>
        <div class="text-right flex-shrink-0">
          <p class="text-xs text-ink-300 mb-0.5">Écart<span v-if="effectiveRatio !== 1" class="ml-1 text-orange-500">{{ autoRatioEnabled ? `auto ${(autoRatio * 100).toFixed(1)}%` : ratioLabel }}</span></p>
          <p class="text-lg font-bold" :class="scaledDelta > 0 ? 'text-orange-700' : scaledDelta < 0 ? 'text-blue-700' : 'text-ink-700'">
            {{ scaledDelta >= 0 ? '+' : '' }}{{ fmtEur(scaledDelta) }}
          </p>
        </div>
      </div>

      <!-- Erreur -->
      <div v-if="calcError" class="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
        <AlertCircle :size="15" class="flex-shrink-0" />
        {{ calcError }}
      </div>

      <!-- Actions -->
      <div class="flex items-center gap-3">
        <button @click="calculate" :disabled="!canCalculate || calculating"
          class="flex-1 py-3 rounded-xl bg-orange-500 text-white font-semibold text-sm hover:bg-orange-600 disabled:bg-ink-100 disabled:text-ink-300 transition-colors shadow-sm">
          {{ calculating ? 'Calcul…' : 'Calculer' }}
        </button>
        <button @click="reset" class="px-4 py-3 rounded-xl border border-ink-100 text-ink-500 hover:bg-ink-50 transition-colors">
          <RotateCcw :size="16" />
        </button>
        <button v-if="calcDone" @click="printReport"
          class="flex items-center gap-1.5 px-4 py-3 rounded-xl border border-ink-100 text-ink-500 text-sm hover:bg-ink-50 transition-colors">
          <Printer :size="15" /> PDF
        </button>
      </div>

    </div>
  </div>
</template>

<style>
.rc-print-zone { display: none; }

@media print {
  body > *:not(.rc-print-zone) { display: none !important; }
  .rc-print-zone {
    display: block !important;
    font-family: 'Inter', system-ui, sans-serif;
    color: #121110;
    font-size: 11pt;
    line-height: 1.5;
    padding: 0;
  }
  @page { margin: 1.5cm; size: A4; }

  /* Header */
  .rc-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 12px;
    border-bottom: 2px solid #121110;
    margin-bottom: 16px;
  }
  .rc-logo { font-size: 16pt; font-weight: 700; }
  .rc-meta { text-align: right; font-size: 9pt; }
  .rc-muted { color: #9E9B91; }

  /* Trip block */
  .rc-trip-block {
    background: #F5F3ED;
    border-radius: 6px;
    padding: 10px 14px;
    margin-bottom: 16px;
  }
  .rc-trip-row { display: flex; flex-wrap: wrap; gap: 12px 24px; }
  .rc-trip-item { display: flex; flex-direction: column; }
  .rc-label { font-size: 8pt; text-transform: uppercase; letter-spacing: .04em; color: #9E9B91; }
  .rc-value { font-size: 10pt; font-weight: 600; }
  .rc-orange { color: #ea580c; }

  /* Results */
  .rc-results { margin-bottom: 16px; }
  .rc-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .rc-card { border: 1px solid #E8E7E3; border-radius: 8px; padding: 12px 14px; }
  .rc-card.rc-blue { border-top: 3px solid #3b82f6; }
  .rc-card.rc-orange { border-top: 3px solid #f97316; }
  .rc-card-header { font-size: 10pt; font-weight: 700; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid #E8E7E3; }

  /* Tables */
  .rc-table { width: 100%; font-size: 9.5pt; border-collapse: collapse; }
  .rc-table td { padding: 3px 0; }
  .rc-table td:last-child { text-align: right; font-weight: 500; }
  .rc-row-total td { border-top: 1px solid #E8E7E3; padding-top: 6px; font-weight: 700; font-size: 11pt; }
  .rc-row-sub td { color: #9E9B91; font-size: 8.5pt; padding-top: 1px; }
  .rc-row-person td { border-top: 1px solid #F5F3ED; padding-top: 4px; font-weight: 600; color: #16a34a; }

  /* Convoy */
  .rc-convoy { margin-bottom: 16px; }
  .rc-section-title { font-size: 10pt; font-weight: 700; margin-bottom: 8px; color: #4A4740; }
  .rc-table-full { width: 100%; font-size: 9pt; border-collapse: collapse; }
  .rc-th-left, .rc-th-right { font-size: 8pt; text-transform: uppercase; letter-spacing: .04em; color: #9E9B91; padding: 4px 0; border-bottom: 1px solid #E8E7E3; }
  .rc-th-right { text-align: right; }
  .rc-td-right { text-align: right; }
  .rc-table-full tbody tr td { padding: 4px 0; border-bottom: 1px solid #F5F3ED; }
  .rc-foot-total td { border-top: 2px solid #E8E7E3; padding-top: 6px; font-weight: 700; }
  .rc-foot-person td { font-weight: 600; color: #16a34a; padding-top: 3px; }

  /* Comparison */
  .rc-comparison {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-radius: 8px;
    padding: 12px 16px;
    margin-bottom: 16px;
  }
  .rc-cmp-orange { background: #fff7ed; border: 1px solid #fed7aa; }
  .rc-cmp-blue { background: #eff6ff; border: 1px solid #bfdbfe; }
  .rc-cmp-gray { background: #F6F6F5; border: 1px solid #E8E7E3; }
  .rc-cmp-label { font-size: 10pt; }
  .rc-cmp-delta { text-align: right; }
  .rc-cmp-sign { display: block; font-size: 8pt; color: #9E9B91; text-transform: uppercase; letter-spacing: .04em; }
  .rc-cmp-amount { font-size: 16pt; font-weight: 700; }
  .rc-cmp-orange .rc-cmp-amount { color: #c2410c; }
  .rc-cmp-blue .rc-cmp-amount { color: #1d4ed8; }

  /* Footer */
  .rc-footer { margin-top: 20px; font-size: 8pt; color: #9E9B91; text-align: center; }
}
</style>
