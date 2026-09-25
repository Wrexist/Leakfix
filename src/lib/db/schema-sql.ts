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
  owner_hash text,
  normalized_url text NOT NULL,
  kind text NOT NULL DEFAULT 'website',
  label text,
  active boolean NOT NULL DEFAULT true,
  scan_count integer NOT NULL DEFAULT 0,
  last_scan_id text,
  last_score integer,
  last_scanned_at timestamptz,
  notify_webhook_url text,
  notify_email text,
  webhook_secret text,
  notify_policy text NOT NULL DEFAULT 'drop',
  last_notified_at timestamptz,
  last_notified_score integer,
  digest_frequency text NOT NULL DEFAULT 'off',
  digest_recipients jsonb,
  last_digest_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id text PRIMARY KEY,
  monitor_id text NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  scan_id text,
  channel text NOT NULL,
  target text NOT NULL,
  status text NOT NULL,
  detail text,
  attempts integer NOT NULL DEFAULT 1,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_monitor_id_idx ON notifications (monitor_id);

CREATE TABLE IF NOT EXISTS entitlements (
  id text PRIMARY KEY,
  scan_id text NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  normalized_url text NOT NULL,
  kind text NOT NULL DEFAULT 'report_unlock',
  provider text NOT NULL DEFAULT 'dev',
  reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS entitlements_scan_id_idx ON entitlements (scan_id);
CREATE INDEX IF NOT EXISTS entitlements_normalized_url_idx ON entitlements (normalized_url);

-- Idempotent upgrades for databases created before these columns existed.
ALTER TABLE scans ADD COLUMN IF NOT EXISTS audit_summary jsonb;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS insights jsonb;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'website';
ALTER TABLE scans ADD COLUMN IF NOT EXISTS subject jsonb;
ALTER TABLE findings ADD COLUMN IF NOT EXISTS details jsonb;
ALTER TABLE monitors ADD COLUMN IF NOT EXISTS notify_webhook_url text;
ALTER TABLE monitors ADD COLUMN IF NOT EXISTS notify_email text;
ALTER TABLE monitors ADD COLUMN IF NOT EXISTS notify_policy text NOT NULL DEFAULT 'drop';
ALTER TABLE monitors ADD COLUMN IF NOT EXISTS last_notified_at timestamptz;
ALTER TABLE monitors ADD COLUMN IF NOT EXISTS last_notified_score integer;
ALTER TABLE monitors ADD COLUMN IF NOT EXISTS digest_frequency text NOT NULL DEFAULT 'off';
ALTER TABLE monitors ADD COLUMN IF NOT EXISTS digest_recipients jsonb;
ALTER TABLE monitors ADD COLUMN IF NOT EXISTS last_digest_at timestamptz;
ALTER TABLE monitors ADD COLUMN IF NOT EXISTS webhook_secret text;
ALTER TABLE monitors ADD COLUMN IF NOT EXISTS owner_hash text;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 1;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS payload jsonb;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Monitors are unique per (owner, URL), so two browsers can monitor one URL.
-- Legacy rows keep a NULL owner (NULLs never collide in a unique index).
DROP INDEX IF EXISTS monitors_normalized_url_idx;
CREATE UNIQUE INDEX IF NOT EXISTS monitors_owner_url_idx ON monitors (owner_hash, normalized_url);
CREATE INDEX IF NOT EXISTS monitors_url_idx ON monitors (normalized_url);

-- Unlocks for future scans of a site are tied to the buyer's browser identity.
ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS buyer_hash text;
ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS buyer_email text;
CREATE INDEX IF NOT EXISTS entitlements_url_buyer_idx ON entitlements (normalized_url, buyer_hash);

CREATE TABLE IF NOT EXISTS report_leads (
  id text PRIMARY KEY,
  scan_id text NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  email text NOT NULL,
  owner_hash text,
  marketing_consent boolean NOT NULL DEFAULT false,
  unsubscribe_token text NOT NULL,
  follow_ups_sent integer NOT NULL DEFAULT 0,
  last_emailed_at timestamptz,
  unsubscribed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS report_leads_scan_email_idx ON report_leads (scan_id, email);
CREATE UNIQUE INDEX IF NOT EXISTS report_leads_unsubscribe_idx ON report_leads (unsubscribe_token);
CREATE INDEX IF NOT EXISTS report_leads_email_idx ON report_leads (email);

-- Accounts: passwordless magic-link sign-in and the Pro subscription.
CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  email text NOT NULL,
  owner_id text,
  owner_hash text,
  stripe_customer_id text,
  plan text NOT NULL DEFAULT 'free',
  subscription_id text,
  subscription_status text,
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users (email);
CREATE UNIQUE INDEX IF NOT EXISTS users_owner_hash_idx ON users (owner_hash);
CREATE INDEX IF NOT EXISTS users_stripe_customer_idx ON users (stripe_customer_id);
CREATE INDEX IF NOT EXISTS users_subscription_idx ON users (subscription_id);

CREATE TABLE IF NOT EXISTS login_tokens (
  id text PRIMARY KEY,
  email text NOT NULL,
  token_hash text NOT NULL,
  requester_hash text,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS login_tokens_token_hash_idx ON login_tokens (token_hash);

CREATE TABLE IF NOT EXISTS sessions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS sessions_token_hash_idx ON sessions (token_hash);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id);

-- Merging a browser identity into an account looks rows up by owner/buyer hash.
CREATE INDEX IF NOT EXISTS entitlements_buyer_idx ON entitlements (buyer_hash);
CREATE INDEX IF NOT EXISTS report_leads_owner_idx ON report_leads (owner_hash);

-- Shared fixed-window rate-limit counters (one row per limiter key).
CREATE TABLE IF NOT EXISTS rate_limits (
  key text PRIMARY KEY,
  count integer NOT NULL,
  window_start timestamptz NOT NULL,
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS rate_limits_expires_at_idx ON rate_limits (expires_at);
`;
