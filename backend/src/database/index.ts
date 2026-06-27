import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema.js'
import path from 'path'
import { fileURLToPath } from 'url'
import { mkdirSync } from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = process.env.DATABASE_PATH ||
  path.join(__dirname, '../../..', 'data', 'routecalc.db')

mkdirSync(path.dirname(dbPath), { recursive: true })

export const sqlite = new Database(dbPath)
export const db = drizzle(sqlite, { schema })

export function runMigrations(): void {
  sqlite.exec(`CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY)`)

  const row = sqlite.prepare('SELECT MAX(version) as v FROM schema_version').get() as { v: number | null }
  const version = row?.v ?? 0

  if (version < 1) {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        pin_hash TEXT NOT NULL,
        last_login_at TEXT
      )
    `)
    sqlite.prepare('INSERT OR IGNORE INTO schema_version (version) VALUES (1)').run()
  }

  if (version < 2) {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS route_calc_vehicles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        fuel_type TEXT NOT NULL DEFAULT 'gasoline',
        consumption REAL NOT NULL,
        fiscal_power INTEGER NOT NULL DEFAULT 5,
        default_fuel_price REAL,
        is_default INTEGER DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_rc_vehicles_user ON route_calc_vehicles(user_id);
    `)
    sqlite.prepare('INSERT OR IGNORE INTO schema_version (version) VALUES (2)').run()
  }
}
