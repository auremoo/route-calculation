<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import PinKeypad from '../components/PinKeypad.vue'
import api from '../stores/api'
import { UserCircle2, Plus, ArrowLeft, AlertCircle } from 'lucide-vue-next'

const router = useRouter()
const auth = useAuthStore()

type Screen = 'users' | 'pin' | 'register'

const screen = ref<Screen>('users')
const users = ref<{ id: number; name: string }[]>([])
const selectedUser = ref<{ id: number; name: string } | null>(null)
const error = ref('')
const loading = ref(false)

// Register form
const newName = ref('')
const newPin = ref('')
const newPinConfirm = ref('')
const registerStep = ref<'name' | 'pin' | 'confirm'>('name')

onMounted(async () => {
  const { data } = await api.get('/auth/users')
  users.value = data
})

function selectUser(u: { id: number; name: string }) {
  selectedUser.value = u
  error.value = ''
  screen.value = 'pin'
}

async function handlePin(pin: string) {
  if (!selectedUser.value) return
  loading.value = true
  error.value = ''
  try {
    await auth.login(selectedUser.value.id, pin)
    router.push('/calculator')
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Code PIN incorrect'
  } finally {
    loading.value = false
  }
}

function startRegister() {
  newName.value = ''
  newPin.value = ''
  newPinConfirm.value = ''
  registerStep.value = 'name'
  error.value = ''
  screen.value = 'register'
}

function handleRegisterPin(pin: string) {
  if (registerStep.value === 'pin') {
    newPin.value = pin
    registerStep.value = 'confirm'
  } else if (registerStep.value === 'confirm') {
    newPinConfirm.value = pin
    if (pin !== newPin.value) {
      error.value = 'Les codes PIN ne correspondent pas'
      registerStep.value = 'pin'
      newPin.value = ''
    } else {
      doRegister()
    }
  }
}

async function doRegister() {
  loading.value = true
  error.value = ''
  try {
    await api.post('/auth/register', { name: newName.value.trim(), pin: newPin.value })
    const { data } = await api.get('/auth/users')
    users.value = data
    screen.value = 'users'
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Erreur lors de la création du compte'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-cream-50 flex flex-col items-center justify-center px-4">
    <div class="w-full max-w-sm">
      <!-- Logo -->
      <div class="text-center mb-8">
        <span class="text-4xl">🚗</span>
        <h1 class="text-2xl font-bold text-ink-900 mt-2">RouteCalc</h1>
        <p class="text-sm text-ink-300 mt-1">Calculateur de frais kilométriques</p>
      </div>

      <!-- Screen: users -->
      <div v-if="screen === 'users'" class="space-y-3">
        <p class="text-sm font-medium text-ink-500 text-center mb-4">Choisissez votre compte</p>

        <div v-if="users.length === 0" class="text-center py-6 text-ink-300 text-sm">
          Aucun compte — créez-en un pour commencer
        </div>

        <button
          v-for="u in users"
          :key="u.id"
          @click="selectUser(u)"
          class="w-full flex items-center gap-3 px-4 py-3.5 bg-white rounded-lg border border-ink-100 shadow-soft hover:border-accent-500 hover:shadow-medium transition-all text-left"
        >
          <div class="w-9 h-9 rounded-full bg-accent-500/10 flex items-center justify-center flex-shrink-0">
            <UserCircle2 :size="20" class="text-accent-500" />
          </div>
          <span class="font-medium text-ink-800">{{ u.name }}</span>
        </button>

        <button
          @click="startRegister"
          class="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-dashed border-ink-100 text-sm text-ink-300 hover:border-accent-500 hover:text-accent-500 transition-colors"
        >
          <Plus :size="16" class="flex-shrink-0" />
          Créer un compte
        </button>
      </div>

      <!-- Screen: PIN entry -->
      <div v-else-if="screen === 'pin'" class="space-y-6">
        <div class="flex items-center gap-2">
          <button @click="screen = 'users'; error = ''" class="p-1.5 rounded hover:bg-ink-50 text-ink-300 hover:text-ink-500 transition-colors">
            <ArrowLeft :size="16" />
          </button>
          <p class="text-sm font-medium text-ink-500">Code PIN pour <strong class="text-ink-800">{{ selectedUser?.name }}</strong></p>
        </div>

        <PinKeypad @submit="handlePin" />

        <div v-if="error" class="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          <AlertCircle :size="14" class="flex-shrink-0" />
          {{ error }}
        </div>
      </div>

      <!-- Screen: register -->
      <div v-else-if="screen === 'register'" class="space-y-6">
        <div class="flex items-center gap-2">
          <button @click="screen = 'users'; error = ''" class="p-1.5 rounded hover:bg-ink-50 text-ink-300 hover:text-ink-500 transition-colors">
            <ArrowLeft :size="16" />
          </button>
          <p class="text-sm font-medium text-ink-500">Créer un compte</p>
        </div>

        <!-- Step 1: name -->
        <div v-if="registerStep === 'name'" class="space-y-4">
          <div>
            <label class="label">Votre prénom ou nom</label>
            <input
              v-model="newName"
              type="text"
              placeholder="Ex: Marie"
              class="input"
              @keydown.enter="newName.trim() && (registerStep = 'pin')"
              autofocus
            />
          </div>
          <button
            @click="registerStep = 'pin'"
            :disabled="!newName.trim()"
            class="btn-primary w-full"
          >
            Continuer
          </button>
        </div>

        <!-- Step 2 & 3: PIN -->
        <div v-else class="space-y-4">
          <p class="text-sm text-ink-500 text-center">
            {{ registerStep === 'pin' ? 'Choisissez un code PIN à 6 chiffres' : 'Confirmez votre code PIN' }}
          </p>
          <PinKeypad @submit="handleRegisterPin" />
        </div>

        <div v-if="error" class="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          <AlertCircle :size="14" class="flex-shrink-0" />
          {{ error }}
        </div>
      </div>
    </div>
  </div>
</template>
