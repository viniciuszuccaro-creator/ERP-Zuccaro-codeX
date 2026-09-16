-- ERP-RUNTIME-01 foundation schema
-- Reproduzivel via Git. Sem dados reais.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now()))
);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- groups ≈ GrupoEmpresarial
CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_do_grupo TEXT NOT NULL,
  razao_social_grupo TEXT,
  cnpj_grupo TEXT,
  status TEXT NOT NULL DEFAULT 'Ativo',
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now())),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now()))
);

DROP TRIGGER IF EXISTS trg_groups_updated_at ON groups;
CREATE TRIGGER trg_groups_updated_at
  BEFORE UPDATE ON groups
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

-- empresas ≈ Empresa (tenant operacional)
CREATE TABLE IF NOT EXISTS empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id),
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  cnpj TEXT,
  status TEXT NOT NULL DEFAULT 'Ativa',
  created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now())),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now()))
);

CREATE INDEX IF NOT EXISTS idx_empresas_group_id ON empresas(group_id);

DROP TRIGGER IF EXISTS trg_empresas_updated_at ON empresas;
CREATE TRIGGER trg_empresas_updated_at
  BEFORE UPDATE ON empresas
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

-- profiles ≈ User / perfil ERP (auth Supabase depois)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  ativo BOOLEAN NOT NULL DEFAULT true,
  group_id UUID REFERENCES groups(id),
  empresa_id UUID REFERENCES empresas(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now())),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now()))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email_lower ON profiles ((lower(email)));
CREATE INDEX IF NOT EXISTS idx_profiles_group_id ON profiles(group_id);

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

-- audit_logs (trilha obrigatoria)
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID,
  empresa_id UUID,
  actor_id UUID,
  actor_email TEXT,
  entity TEXT NOT NULL,
  entity_id TEXT,
  action TEXT NOT NULL,
  before_data JSONB,
  after_data JSONB,
  request_id TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now()))
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_group ON audit_logs(group_id, empresa_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_request ON audit_logs(request_id);

-- integration_events (base para S2S futuro ERP-RUNTIME-05 / ERP-SITE)
CREATE TABLE IF NOT EXISTS integration_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID,
  empresa_id UUID,
  source TEXT NOT NULL,
  event_type TEXT NOT NULL,
  idempotency_key TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'received',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now())),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now()))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_integration_events_idempotency
  ON integration_events(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_integration_events_scope
  ON integration_events(group_id, empresa_id, event_type);

DROP TRIGGER IF EXISTS trg_integration_events_updated_at ON integration_events;
CREATE TRIGGER trg_integration_events_updated_at
  BEFORE UPDATE ON integration_events
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
