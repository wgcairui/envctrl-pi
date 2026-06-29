CREATE TABLE IF NOT EXISTS device (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  kind         TEXT NOT NULL,
  bus          TEXT NOT NULL,
  config_json  TEXT NOT NULL,
  enabled      INTEGER NOT NULL DEFAULT 1,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS point_latest (
  device_id    TEXT NOT NULL,
  point_id     TEXT NOT NULL,
  value        TEXT NOT NULL,
  quality      TEXT NOT NULL,
  ts           INTEGER NOT NULL,
  PRIMARY KEY (device_id, point_id)
);

CREATE TABLE IF NOT EXISTS sample (
  device_id    TEXT NOT NULL,
  point_id     TEXT NOT NULL,
  value        TEXT NOT NULL,
  quality      TEXT NOT NULL,
  ts           INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sample_device_point_ts ON sample (device_id, point_id, ts);
CREATE INDEX IF NOT EXISTS idx_sample_ts ON sample (ts);

CREATE TABLE IF NOT EXISTS alarm_rule (
  id           TEXT PRIMARY KEY,
  source       TEXT NOT NULL,
  condition    TEXT NOT NULL,
  severity     TEXT NOT NULL,
  actions_json TEXT NOT NULL,
  enabled      INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS alarm (
  id           TEXT PRIMARY KEY,
  rule_id      TEXT NOT NULL,
  device_id    TEXT,
  point_id     TEXT,
  value        TEXT,
  severity     TEXT NOT NULL,
  message      TEXT NOT NULL,
  triggered_at INTEGER NOT NULL,
  resolved_at  INTEGER
);

CREATE INDEX IF NOT EXISTS idx_alarm_triggered ON alarm (triggered_at DESC);

CREATE TABLE IF NOT EXISTS audit (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  actor        TEXT NOT NULL,
  action       TEXT NOT NULL,
  detail_json  TEXT,
  ts           INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS llm_provider (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  base_url     TEXT NOT NULL,
  api_key      TEXT NOT NULL,
  model        TEXT NOT NULL,
  is_preset    INTEGER NOT NULL DEFAULT 0,
  is_active    INTEGER NOT NULL DEFAULT 0,
  notes        TEXT,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_llm_active
  ON llm_provider (is_active) WHERE is_active = 1;