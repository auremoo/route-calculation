import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from './api'

interface User { id: number; name: string }

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)

  async function verify(): Promise<boolean> {
    try {
      const { data } = await api.post('/auth/verify')
      user.value = data
      return true
    } catch {
      user.value = null
      return false
    }
  }

  async function login(userId: number, pin: string): Promise<void> {
    const { data } = await api.post('/auth/login', { userId, pin })
    user.value = data
  }

  async function logout(): Promise<void> {
    await api.post('/auth/logout')
    user.value = null
  }

  async function changePin(oldPin: string, newPin: string): Promise<void> {
    await api.put('/auth/change-pin', { oldPin, newPin })
  }

  return { user, verify, login, logout, changePin }
})
