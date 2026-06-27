import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from './api'

export interface Vehicle {
  id: number
  user_id: number
  name: string
  fuel_type: 'gasoline' | 'diesel' | 'electric' | 'hybrid'
  consumption: number
  fiscal_power: number
  default_fuel_price: number | null
  is_default: boolean | number
  sort_order: number
  created_at?: string
}

export const useVehiclesStore = defineStore('vehicles', () => {
  const vehicles = ref<Vehicle[]>([])

  async function fetch(): Promise<void> {
    const { data } = await api.get('/route-calc/vehicles')
    vehicles.value = data
  }

  return { vehicles, fetch }
})
