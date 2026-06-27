// Drizzle ORM schema for RouteCalc — single table for user vehicles.
// Import alongside any other schema tables you have.

import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const routeCalcVehicles = sqliteTable('route_calc_vehicles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull(),
  name: text('name').notNull(),
  fuelType: text('fuel_type').notNull().default('gasoline'), // 'gasoline' | 'diesel' | 'electric' | 'hybrid'
  consumption: real('consumption').notNull(), // L/100km, or kWh/100km for electric
  fiscalPower: integer('fiscal_power').notNull().default(5), // 1-7 CV (puissance fiscale)
  defaultFuelPrice: real('default_fuel_price'), // €/L or €/kWh
  isDefault: integer('is_default', { mode: 'boolean' }).default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
})
