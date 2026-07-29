-- USD/INR Exchange Rate Monitor — D1 Database Schema
-- Run: npx wrangler d1 execute usdinr-db --file=./schema.sql

CREATE TABLE IF NOT EXISTS exchange_rates (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  date                  TEXT    NOT NULL UNIQUE,          -- YYYY-MM-DD
  rate                  REAL    NOT NULL,                  -- e.g. 84.52
  is_6mo_low            INTEGER NOT NULL DEFAULT 0,       -- 1 = true
  predicted_lowest_rate REAL,                             -- AI forecast
  predicted_date        TEXT,                             -- e.g. "2026-08-10 to 2026-08-17"
  ai_analysis           TEXT,                             -- AI market rationale
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_exchange_rates_date ON exchange_rates(date DESC);

CREATE TABLE IF NOT EXISTS alert_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  sent_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  channel    TEXT NOT NULL,      -- 'telegram' | 'discord'
  message    TEXT NOT NULL,
  status     TEXT NOT NULL       -- 'success' | 'failed'
);
