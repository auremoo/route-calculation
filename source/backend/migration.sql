-- Migration: create RouteCalc vehicles table
-- Run once on a fresh DB

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
