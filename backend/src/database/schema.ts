import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  pinHash: text('pin_hash').notNull(),
  lastLoginAt: text('last_login_at'),
})

export const routeCalcVehicles = sqliteTable('route_calc_vehicles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull(),
  name: text('name').notNull(),
  fuelType: text('fuel_type').notNull().default('gasoline'),
  consumption: real('consumption').notNull(),
  fiscalPower: integer('fiscal_power').notNull().default(5),
  defaultFuelPrice: real('default_fuel_price'),
  isDefault: integer('is_default', { mode: 'boolean' }).default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
})
