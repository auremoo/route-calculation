import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface Vehicle {
  id: number
  name: string
  fuel_type: 'gasoline' | 'diesel' | 'electric' | 'hybrid'
  consumption: number
  fiscal_power: number
  default_fuel_price: number | null
  is_default: boolean
  sort_order: number
}

export interface VehiclePayload {
  name: string
  fuelType: string
  consumption: number
  fiscalPower: number
  defaultFuelPrice: number | null
  isDefault: boolean
  sortOrder: number
}

const STORAGE_KEY = 'routecalc_vehicles'

function read(): Vehicle[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function write(list: Vehicle[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

export const useVehiclesStore = defineStore('vehicles', () => {
  const vehicles = ref<Vehicle[]>([])

  function load(): void {
    vehicles.value = read().sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
  }

  function persist(): void {
    write(vehicles.value)
  }

  function create(payload: VehiclePayload): Vehicle {
    const nextId = vehicles.value.reduce((max, v) => Math.max(max, v.id), 0) + 1
    if (payload.isDefault) vehicles.value.forEach(v => (v.is_default = false))
    const vehicle: Vehicle = {
      id: nextId,
      name: payload.name,
      fuel_type: payload.fuelType as Vehicle['fuel_type'],
      consumption: payload.consumption,
      fiscal_power: payload.fiscalPower,
      default_fuel_price: payload.defaultFuelPrice ?? null,
      is_default: payload.isDefault,
      sort_order: payload.sortOrder,
    }
    vehicles.value.push(vehicle)
    persist()
    return vehicle
  }

  function update(id: number, payload: VehiclePayload): void {
    if (payload.isDefault) vehicles.value.forEach(v => (v.is_default = false))
    const v = vehicles.value.find(x => x.id === id)
    if (!v) return
    v.name = payload.name
    v.fuel_type = payload.fuelType as Vehicle['fuel_type']
    v.consumption = payload.consumption
    v.fiscal_power = payload.fiscalPower
    v.default_fuel_price = payload.defaultFuelPrice ?? null
    v.is_default = payload.isDefault
    v.sort_order = payload.sortOrder
    persist()
  }

  function remove(id: number): void {
    vehicles.value = vehicles.value.filter(v => v.id !== id)
    persist()
  }

  return { vehicles, load, create, update, remove }
})
