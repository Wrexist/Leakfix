export const SCHEMA_SQL = /* sql */ `
CREATE TABLE IF NOT EXISTS scans (
  id text PRIMARY KEY,
  submitted_url text NOT NULL,
  normalized_url text NOT NULL,
  final_url text,
  kind text NOT NULL DEFAULT 'website',
  subject jsonb,
  status text NOT NULL DEFAULT 'queued',
  score integer,
  duration_ms integer,
  error_code text,
  error_message text,
  audit_summary jsonb,
  insights jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS scans_created_at_idx ON scans (created_at);

CREATE TABLE IF NOT EXISTS findings (
  id text PRIMARY KEY,
  scan_id text NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  category text NOT NULL,
  rule_id text NOT NULL,
  title text NOT NULL,
  explanation text NOT NULL,
  severity text NOT NULL,
  evidence text NOT NULL,
  recommendation text NOT NULL,
  confidence text NOT NULL DEFAULT 'high',
  details jsonb,
  sort_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS findings_scan_id_idx ON findings (scan_id);

CREATE TABLE IF NOT EXISTS monitors (
  id text PRIMARY KEY,
  normalized_url text NOT NULL,
  kind text NOT NULL DEFAULT 'website',
  label text,
  active boolean NOT NULL DEFAULT true,
  scan_count integer NOT NULL DEFAULT 0,
  last_scan_id text,
  last_score integer,
  last_scanned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS monitors_normalized_url_idx ON monitors (normalized_url);

-- Idempotent upgrades for databases created before these columns existed.
ALTER TABLE scans ADD COLUMN IF NOT EXISTS audit_summary jsonb;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS insights jsonb;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'website';
ALTER TABLE scans ADD COLUMN IF NOT EXISTS subject jsonb;
ALTER TABLE findings ADD COLUMN IF NOT EXISTS details jsonb;
`;
