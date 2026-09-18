-- ERP-RUNTIME-06A: Local/endereço canônico do Cliente.
-- Não cria Obra e não altera migrations 001-010.

CREATE TABLE IF NOT EXISTS cliente_locais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id),
  cliente_id UUID NOT NULL REFERENCES clientes(id),
  nome TEXT NOT NULL,
  cep TEXT,
  logradouro TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  uf TEXT,
  pais TEXT NOT NULL DEFAULT 'BRASIL',
  referencia TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  coordinate_source TEXT,
  geocode_status TEXT NOT NULL DEFAULT 'NAO_GEOCODIFICADO',
  geocode_source TEXT,
  geocode_precision TEXT,
  geocoded_at TIMESTAMPTZ,
  endereco_incompleto BOOLEAN NOT NULL DEFAULT false,
  endereco_fingerprint TEXT NOT NULL DEFAULT '',
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
  updated_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now()))
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_cliente_locais_endereco'
      AND conrelid = 'cliente_locais'::regclass
  ) THEN
    ALTER TABLE cliente_locais
      ADD CONSTRAINT chk_cliente_locais_endereco CHECK (
        (
          endereco_incompleto = false
          AND btrim(nome) <> ''
          AND cep ~ '^[0-9]{8}$'
          AND logradouro IS NOT NULL AND btrim(logradouro) <> ''
          AND numero IS NOT NULL AND btrim(numero) <> ''
          AND bairro IS NOT NULL AND btrim(bairro) <> ''
          AND cidade IS NOT NULL AND btrim(cidade) <> ''
          AND uf ~ '^[A-Z]{2}$'
          AND btrim(pais) <> ''
        )
        OR (
          endereco_incompleto = true
          AND origem = 'MIGRACAO'
          AND source_system IS NOT NULL AND btrim(source_system) <> ''
          AND migration_batch IS NOT NULL AND btrim(migration_batch) <> ''
        )
      );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_cliente_locais_geo'
      AND conrelid = 'cliente_locais'::regclass
  ) THEN
    ALTER TABLE cliente_locais
      ADD CONSTRAINT chk_cliente_locais_geo CHECK (
        (
          latitude IS NULL
          AND longitude IS NULL
          AND coordinate_source IS NULL
        )
        OR (
          latitude IS NOT NULL
          AND longitude IS NOT NULL
          AND latitude BETWEEN -90 AND 90
          AND longitude BETWEEN -180 AND 180
          AND coordinate_source IN (
            'MANUAL', 'GPS', 'IMPORTACAO', 'GEOCODER', 'APP_MOTORISTA', 'API'
          )
        )
      );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_cliente_locais_geocode_metadata'
      AND conrelid = 'cliente_locais'::regclass
  ) THEN
    ALTER TABLE cliente_locais
      ADD CONSTRAINT chk_cliente_locais_geocode_metadata CHECK (
        (
          geocode_status = 'GEOCODIFICADO'
          AND latitude IS NOT NULL
          AND longitude IS NOT NULL
          AND geocode_source IS NOT NULL
          AND geocoded_at IS NOT NULL
        )
        OR (
          geocode_status IN ('NAO_GEOCODIFICADO', 'PENDENTE', 'FALHA')
          AND geocoded_at IS NULL
        )
      );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_cliente_locais_origem'
      AND conrelid = 'cliente_locais'::regclass
  ) THEN
    ALTER TABLE cliente_locais
      ADD CONSTRAINT chk_cliente_locais_origem CHECK (
        origem IN (
          'ERP', 'MIGRACAO', 'SITE_CPA', 'B2B', 'PORTAL', 'CHATBOT',
          'WHATSAPP', 'MARKETPLACE', 'APP', 'API'
        )
      );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION set_cliente_local_fingerprint()
RETURNS TRIGGER AS $$
BEGIN
  NEW.cep = regexp_replace(coalesce(NEW.cep, ''), '\D', '', 'g');
  NEW.uf = upper(btrim(coalesce(NEW.uf, '')));
  NEW.pais = upper(btrim(coalesce(NEW.pais, 'BRASIL')));
  -- Chave textual interna para comparação; não é hash criptográfico.
  NEW.endereco_fingerprint = concat_ws('|',
    NEW.group_id::text,
    NEW.cliente_id::text,
    regexp_replace(lower(coalesce(NEW.cep, '')), '[^a-z0-9]', '', 'g'),
    regexp_replace(lower(coalesce(NEW.logradouro, '')), '[^a-z0-9]', '', 'g'),
    regexp_replace(lower(coalesce(NEW.numero, '')), '[^a-z0-9]', '', 'g'),
    regexp_replace(lower(coalesce(NEW.complemento, '')), '[^a-z0-9]', '', 'g'),
    regexp_replace(lower(coalesce(NEW.cidade, '')), '[^a-z0-9]', '', 'g'),
    regexp_replace(lower(coalesce(NEW.uf, '')), '[^a-z0-9]', '', 'g')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION assert_cliente_local_same_tenant()
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

DROP TRIGGER IF EXISTS trg_cliente_locais_fingerprint ON cliente_locais;
CREATE TRIGGER trg_cliente_locais_fingerprint
  BEFORE INSERT OR UPDATE OF group_id, cliente_id, cep, logradouro, numero,
    complemento, cidade, uf
  ON cliente_locais
  FOR EACH ROW EXECUTE PROCEDURE set_cliente_local_fingerprint();

DROP TRIGGER IF EXISTS trg_cliente_locais_tenant ON cliente_locais;
CREATE TRIGGER trg_cliente_locais_tenant
  BEFORE INSERT OR UPDATE OF group_id, cliente_id ON cliente_locais
  FOR EACH ROW EXECUTE PROCEDURE assert_cliente_local_same_tenant();

DROP TRIGGER IF EXISTS trg_cliente_locais_updated_at ON cliente_locais;
CREATE TRIGGER trg_cliente_locais_updated_at
  BEFORE UPDATE ON cliente_locais
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

CREATE INDEX IF NOT EXISTS idx_cliente_locais_scope
  ON cliente_locais(group_id, cliente_id, ativo);
CREATE INDEX IF NOT EXISTS idx_cliente_locais_busca
  ON cliente_locais(group_id, lower(cidade), uf, cep);
CREATE INDEX IF NOT EXISTS idx_cliente_locais_fingerprint
  ON cliente_locais(group_id, cliente_id, endereco_fingerprint);

ALTER TABLE cliente_locais ENABLE ROW LEVEL SECURITY;
ALTER TABLE cliente_locais FORCE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS cliente_local_finalidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id),
  cliente_id UUID NOT NULL REFERENCES clientes(id),
  cliente_local_id UUID NOT NULL REFERENCES cliente_locais(id),
  finalidade TEXT NOT NULL,
  principal BOOLEAN NOT NULL DEFAULT false,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now())),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now())),
  UNIQUE (cliente_local_id, finalidade),
  CHECK (
    finalidade IN (
      'CADASTRAL', 'FISCAL', 'COBRANCA', 'ENTREGA', 'CORRESPONDENCIA', 'OUTRO'
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cliente_local_principal_finalidade
  ON cliente_local_finalidades(group_id, cliente_id, finalidade)
  WHERE principal = true AND ativo = true;

CREATE INDEX IF NOT EXISTS idx_cliente_local_finalidades_local
  ON cliente_local_finalidades(group_id, cliente_id, cliente_local_id, ativo);

CREATE OR REPLACE FUNCTION assert_cliente_local_finalidade_same_tenant()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM cliente_locais l
    WHERE l.id = NEW.cliente_local_id
      AND l.cliente_id = NEW.cliente_id
      AND l.group_id = NEW.group_id
  ) THEN
    RAISE EXCEPTION 'TENANT_FK_MISMATCH: cliente_local_id % does not belong to cliente/group',
      NEW.cliente_local_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cliente_local_finalidades_tenant ON cliente_local_finalidades;
CREATE TRIGGER trg_cliente_local_finalidades_tenant
  BEFORE INSERT OR UPDATE OF group_id, cliente_id, cliente_local_id
  ON cliente_local_finalidades
  FOR EACH ROW EXECUTE PROCEDURE assert_cliente_local_finalidade_same_tenant();

DROP TRIGGER IF EXISTS trg_cliente_local_finalidades_updated_at ON cliente_local_finalidades;
CREATE TRIGGER trg_cliente_local_finalidades_updated_at
  BEFORE UPDATE ON cliente_local_finalidades
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

ALTER TABLE cliente_local_finalidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE cliente_local_finalidades FORCE ROW LEVEL SECURITY;
