-- JASTICA 5S Audit - Neon PostgreSQL
-- Run this in the SAME Neon database used by the existing 5S application.
-- This script is safe to run more than once.

CREATE TABLE IF NOT EXISTS five_s_users (
  id BIGSERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','internal','external')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS five_s_user_sites (
  user_id BIGINT NOT NULL REFERENCES five_s_users(id) ON DELETE CASCADE,
  site TEXT NOT NULL,
  PRIMARY KEY (user_id, site)
);

CREATE TABLE IF NOT EXISTS five_s_sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES five_s_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_five_s_sessions_token ON five_s_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_five_s_sessions_expiry ON five_s_sessions(expires_at);

CREATE TABLE IF NOT EXISTS five_s_sites (
  site TEXT PRIMARY KEY,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO five_s_sites(site) VALUES
('BBO'),('BKN'),('BTO'),('EME'),('GNT'),('HOF'),('HRN'),('LKM'),('MGT'),('MVB'),('ORIC'),('RDP'),('UDW'),('VBL'),('WMB')
ON CONFLICT (site) DO NOTHING;

CREATE TABLE IF NOT EXISTS five_s_audits (
  id BIGSERIAL PRIMARY KEY,
  organisation TEXT NOT NULL DEFAULT 'JASTICA',
  site TEXT NOT NULL,
  department TEXT,
  audit_month TEXT NOT NULL,
  audit_type TEXT NOT NULL DEFAULT 'monthly' CHECK (audit_type IN ('monthly','annual')),
  auditor TEXT,
  auditor_type TEXT CHECK (auditor_type IN ('Internal Auditor','External Auditor')),
  scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  section_notes JSONB NOT NULL DEFAULT '{}'::jsonb,
  q14 JSONB NOT NULL DEFAULT '{"text":{},"score":{}}'::jsonb,
  special_note TEXT NOT NULL DEFAULT '',
  signature JSONB NOT NULL DEFAULT '{"dataUrl":"","signedAt":null}'::jsonb,
  overall_total INTEGER NOT NULL DEFAULT 0,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by BIGINT REFERENCES five_s_users(id) ON DELETE SET NULL
);

ALTER TABLE five_s_audits ADD COLUMN IF NOT EXISTS audit_type TEXT NOT NULL DEFAULT 'monthly';
UPDATE five_s_audits SET audit_type='monthly' WHERE audit_type IS NULL;
ALTER TABLE five_s_audits DROP CONSTRAINT IF EXISTS five_s_audits_audit_type_check;
ALTER TABLE five_s_audits ADD CONSTRAINT five_s_audits_audit_type_check CHECK (audit_type IN ('monthly','annual'));
ALTER TABLE five_s_audits ALTER COLUMN organisation SET DEFAULT 'JASTICA';

-- Replace the old site/month uniqueness with site + audit type + period,
-- allowing one monthly audit and one annual audit for the same site/year.
ALTER TABLE five_s_audits DROP CONSTRAINT IF EXISTS five_s_audits_site_audit_month_key;
ALTER TABLE five_s_audits DROP CONSTRAINT IF EXISTS five_s_audits_site_month_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_five_s_audits_site_type_period
  ON five_s_audits(site, audit_type, audit_month);

CREATE INDEX IF NOT EXISTS idx_five_s_audits_site_period
  ON five_s_audits(site, audit_type, audit_month);

-- IMPORTANT: passwords are always stored as bcrypt hashes by the API.
-- Do not insert plain-text passwords into this database.
