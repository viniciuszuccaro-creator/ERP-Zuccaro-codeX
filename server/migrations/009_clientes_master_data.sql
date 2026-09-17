-- ERP-RUNTIME-04: Cliente MASTER DATA (identidade no Grupo; vínculo empresa separado)
-- NÃO altera 001-008.
-- Soft-delete via ativo=false. Código sequencial por group_id (concorrente-safe).

CREATE TABLE IF NOT EXISTS entity_code_sequences (
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  entity_name TEXT NOT NULL,
  next_value BIGINT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now())),
  PRIMARY KEY (group_id, entity_name)
);

CREATE OR REPLACE FUNCTION reserve_entity_codigo(p_group_id UUID, p_entity_name TEXT, p_width INT DEFAULT 6)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_next BIGINT;
BEGIN
  INSERT INTO entity_code_sequences (group_id, entity_name, next_value)
  VALUES (p_group_id, p_entity_name, 2)
  ON CONFLICT (group_id, entity_name) DO UPDATE
    SET next_value = entity_code_sequences.next_value + 1,
        updated_at = timezone('utc', now())
  RETURNING next_value - 1 INTO v_next;

  RETURN lpad(v_next::text, GREATEST(p_width, length(v_next::text)), '0');
END;
$$;

CREATE TABLE IF NOT EXISTS clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id),
  -- empresa_id opcional: vínculo operacional preferencial; identidade é do Grupo
  empresa_id UUID REFERENCES empresas(id),
  codigo TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('Pessoa Física', 'Pessoa Jurídica')),
  documento TEXT,
  documento_normalizado TEXT,
  nome TEXT,
  razao_social TEXT,
  nome_fantasia TEXT,
  nome_social TEXT,
  inscricao_estadual TEXT,
  inscricao_municipal TEXT,
  email TEXT,
  telefone TEXT,
  celular TEXT,
  status TEXT NOT NULL DEFAULT 'Ativo',
  origem TEXT NOT NULL DEFAULT 'ERP',
  codigo_legado TEXT,
  legacy_id TEXT,
  source_system TEXT,
  migration_batch TEXT,
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now())),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now())),
  CONSTRAINT chk_clientes_documento_tipo CHECK (
    (tipo = 'Pessoa Física' AND (documento_normalizado IS NULL OR length(documento_normalizado) = 11))
    OR (tipo = 'Pessoa Jurídica' AND (documento_normalizado IS NULL OR length(documento_normalizado) = 14))
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_clientes_group_codigo
  ON clientes (group_id, codigo);

CREATE UNIQUE INDEX IF NOT EXISTS uq_clientes_group_documento
  ON clientes (group_id, documento_normalizado)
  WHERE documento_normalizado IS NOT NULL AND btrim(documento_normalizado) <> '';

CREATE INDEX IF NOT EXISTS idx_clientes_group ON clientes(group_id);
CREATE INDEX IF NOT EXISTS idx_clientes_empresa ON clientes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_clientes_ativo ON clientes(group_id, ativo);
CREATE INDEX IF NOT EXISTS idx_clientes_nome ON clientes(group_id, lower(coalesce(nome, '')));
CREATE INDEX IF NOT EXISTS idx_clientes_razao ON clientes(group_id, lower(coalesce(razao_social, '')));
CREATE INDEX IF NOT EXISTS idx_clientes_codigo_num
  ON clientes (group_id, (NULLIF(regexp_replace(codigo, '\D', '', 'g'), '')::BIGINT));

DROP TRIGGER IF EXISTS trg_clientes_updated_at ON clientes;
CREATE TRIGGER trg_clientes_updated_at
  BEFORE UPDATE ON clientes
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

DROP TRIGGER IF EXISTS trg_clientes_tenant ON clientes;
CREATE TRIGGER trg_clientes_tenant
  BEFORE INSERT OR UPDATE OF group_id, empresa_id ON clientes
  FOR EACH ROW EXECUTE PROCEDURE assert_empresa_belongs_to_group();

ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes FORCE ROW LEVEL SECURITY;

-- Relacionamento Cliente ↔ Empresa (parametrização comercial futura)
CREATE TABLE IF NOT EXISTS cliente_empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id),
  cliente_id UUID NOT NULL REFERENCES clientes(id),
  empresa_id UUID NOT NULL REFERENCES empresas(id),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now())),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now())),
  UNIQUE (cliente_id, empresa_id)
);

CREATE INDEX IF NOT EXISTS idx_cliente_empresas_group ON cliente_empresas(group_id);
CREATE INDEX IF NOT EXISTS idx_cliente_empresas_empresa ON cliente_empresas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_cliente_empresas_cliente ON cliente_empresas(cliente_id);

DROP TRIGGER IF EXISTS trg_cliente_empresas_updated_at ON cliente_empresas;
CREATE TRIGGER trg_cliente_empresas_updated_at
  BEFORE UPDATE ON cliente_empresas
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

DROP TRIGGER IF EXISTS trg_cliente_empresas_tenant ON cliente_empresas;
CREATE TRIGGER trg_cliente_empresas_tenant
  BEFORE INSERT OR UPDATE OF group_id, empresa_id ON cliente_empresas
  FOR EACH ROW EXECUTE PROCEDURE assert_empresa_belongs_to_group();

ALTER TABLE cliente_empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE cliente_empresas FORCE ROW LEVEL SECURITY;
