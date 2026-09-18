-- ERP-RUNTIME-06B: Obra canônica (negócio), autorização por Empresa e locais.
-- Não altera migrations 001-011. Não cria finalidade OBRA em ClienteLocal.
-- Não armazena endereço/geolocalização em obras.

CREATE TABLE IF NOT EXISTS obras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id),
  cliente_id UUID NOT NULL REFERENCES clientes(id),
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ATIVA',
  observacao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  origem TEXT NOT NULL DEFAULT 'ERP',
  legacy_id TEXT,
  legacy_code TEXT,
  source_system TEXT,
  migration_batch TEXT,
  imported_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now())),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now())),
  UNIQUE (group_id, codigo),
  CHECK (btrim(nome) <> ''),
  CHECK (codigo ~ '^[0-9]{6}$'),
  CHECK (status IN ('ATIVA', 'PAUSADA', 'CONCLUIDA', 'CANCELADA')),
  CHECK (observacao IS NULL OR char_length(observacao) <= 500)
);

CREATE OR REPLACE FUNCTION assert_obra_same_tenant()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM clientes c
    WHERE c.id = NEW.cliente_id AND c.group_id = NEW.group_id
  ) THEN
    RAISE EXCEPTION 'TENANT_FK_MISMATCH: cliente_id % does not belong to group_id %',
      NEW.cliente_id, NEW.group_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_obras_tenant ON obras;
CREATE TRIGGER trg_obras_tenant
  BEFORE INSERT OR UPDATE OF group_id, cliente_id ON obras
  FOR EACH ROW EXECUTE PROCEDURE assert_obra_same_tenant();

DROP TRIGGER IF EXISTS trg_obras_updated_at ON obras;
CREATE TRIGGER trg_obras_updated_at
  BEFORE UPDATE ON obras
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

CREATE INDEX IF NOT EXISTS idx_obras_scope
  ON obras(group_id, cliente_id, ativo);
CREATE INDEX IF NOT EXISTS idx_obras_status
  ON obras(group_id, status, ativo);
CREATE INDEX IF NOT EXISTS idx_obras_updated
  ON obras(group_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_obras_nome
  ON obras(group_id, cliente_id, lower(nome));

ALTER TABLE obras ENABLE ROW LEVEL SECURITY;
ALTER TABLE obras FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE obras FROM PUBLIC;

CREATE TABLE IF NOT EXISTS obra_empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id),
  obra_id UUID NOT NULL REFERENCES obras(id),
  empresa_id UUID NOT NULL REFERENCES empresas(id),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now())),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now())),
  UNIQUE (obra_id, empresa_id)
);

CREATE OR REPLACE FUNCTION assert_obra_empresa_same_tenant()
RETURNS TRIGGER AS $$
DECLARE
  v_cliente_id UUID;
BEGIN
  SELECT o.cliente_id INTO v_cliente_id
  FROM obras o
  WHERE o.id = NEW.obra_id AND o.group_id = NEW.group_id;

  IF v_cliente_id IS NULL THEN
    RAISE EXCEPTION 'TENANT_FK_MISMATCH: obra_id % does not belong to group_id %',
      NEW.obra_id, NEW.group_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM empresas e
    WHERE e.id = NEW.empresa_id AND e.group_id = NEW.group_id
  ) THEN
    RAISE EXCEPTION 'TENANT_FK_MISMATCH: empresa_id % does not belong to group_id %',
      NEW.empresa_id, NEW.group_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM cliente_empresas ce
    WHERE ce.cliente_id = v_cliente_id
      AND ce.empresa_id = NEW.empresa_id
      AND ce.group_id = NEW.group_id
  ) THEN
    RAISE EXCEPTION 'CLIENTE_EMPRESA_REQUIRED: empresa % has no ClienteEmpresa for obra cliente',
      NEW.empresa_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_obra_empresas_tenant ON obra_empresas;
CREATE TRIGGER trg_obra_empresas_tenant
  BEFORE INSERT OR UPDATE OF group_id, obra_id, empresa_id ON obra_empresas
  FOR EACH ROW EXECUTE PROCEDURE assert_obra_empresa_same_tenant();

DROP TRIGGER IF EXISTS trg_obra_empresas_updated_at ON obra_empresas;
CREATE TRIGGER trg_obra_empresas_updated_at
  BEFORE UPDATE ON obra_empresas
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

CREATE INDEX IF NOT EXISTS idx_obra_empresas_empresa
  ON obra_empresas(group_id, empresa_id, ativo);
CREATE INDEX IF NOT EXISTS idx_obra_empresas_obra
  ON obra_empresas(obra_id, ativo);

ALTER TABLE obra_empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE obra_empresas FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE obra_empresas FROM PUBLIC;

CREATE TABLE IF NOT EXISTS obra_locais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id),
  obra_id UUID NOT NULL REFERENCES obras(id),
  cliente_local_id UUID NOT NULL REFERENCES cliente_locais(id),
  uso_na_obra TEXT NOT NULL,
  principal BOOLEAN NOT NULL DEFAULT false,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now())),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now())),
  UNIQUE (obra_id, cliente_local_id, uso_na_obra),
  CHECK (uso_na_obra IN ('FISICO', 'ENTREGA', 'ADMINISTRATIVO', 'FISCAL', 'OUTRO')),
  CHECK (principal = false OR ativo = true)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_obra_locais_principal
  ON obra_locais(obra_id)
  WHERE principal = true AND ativo = true;

CREATE OR REPLACE FUNCTION assert_obra_local_same_tenant()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM obras o
    JOIN cliente_locais l ON l.id = NEW.cliente_local_id
    WHERE o.id = NEW.obra_id
      AND o.group_id = NEW.group_id
      AND l.group_id = NEW.group_id
      AND l.cliente_id = o.cliente_id
  ) THEN
    RAISE EXCEPTION 'TENANT_FK_MISMATCH: cliente_local_id % does not belong to obra cliente/group',
      NEW.cliente_local_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_obra_locais_tenant ON obra_locais;
CREATE TRIGGER trg_obra_locais_tenant
  BEFORE INSERT OR UPDATE OF group_id, obra_id, cliente_local_id ON obra_locais
  FOR EACH ROW EXECUTE PROCEDURE assert_obra_local_same_tenant();

DROP TRIGGER IF EXISTS trg_obra_locais_updated_at ON obra_locais;
CREATE TRIGGER trg_obra_locais_updated_at
  BEFORE UPDATE ON obra_locais
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

CREATE INDEX IF NOT EXISTS idx_obra_locais_local
  ON obra_locais(cliente_local_id, ativo);
CREATE INDEX IF NOT EXISTS idx_obra_locais_obra
  ON obra_locais(obra_id, ativo);

ALTER TABLE obra_locais ENABLE ROW LEVEL SECURITY;
ALTER TABLE obra_locais FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE obra_locais FROM PUBLIC;
