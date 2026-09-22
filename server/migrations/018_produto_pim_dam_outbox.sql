-- Comercial 360 Onda 1: extensao aditiva do Produto canonico.

ALTER TABLE produtos
  ADD COLUMN IF NOT EXISTS descricao_tecnica TEXT,
  ADD COLUMN IF NOT EXISTS descricao_comercial TEXT,
  ADD COLUMN IF NOT EXISTS titulo_seo TEXT,
  ADD COLUMN IF NOT EXISTS descricao_seo TEXT,
  ADD COLUMN IF NOT EXISTS embalagem_tipo TEXT,
  ADD COLUMN IF NOT EXISTS multiplo_venda NUMERIC(18,6) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS quantidade_minima_venda NUMERIC(18,6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS permite_fracionamento BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS workflow_status TEXT NOT NULL DEFAULT 'RASCUNHO';

ALTER TABLE produtos DROP CONSTRAINT IF EXISTS produtos_multiplo_venda_check;
ALTER TABLE produtos ADD CONSTRAINT produtos_multiplo_venda_check CHECK (multiplo_venda > 0);
ALTER TABLE produtos DROP CONSTRAINT IF EXISTS produtos_quantidade_minima_venda_check;
ALTER TABLE produtos ADD CONSTRAINT produtos_quantidade_minima_venda_check CHECK (quantidade_minima_venda >= 0);
ALTER TABLE produtos DROP CONSTRAINT IF EXISTS produtos_workflow_status_check;
ALTER TABLE produtos ADD CONSTRAINT produtos_workflow_status_check
  CHECK (workflow_status IN ('RASCUNHO','EM_REVISAO','APROVADO','PUBLICADO','INATIVO'));

CREATE TABLE IF NOT EXISTS produto_variantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id),
  empresa_id UUID REFERENCES empresas(id),
  produto_id UUID NOT NULL REFERENCES produtos(id),
  sku TEXT NOT NULL,
  codigo_barras TEXT,
  atributos JSONB NOT NULL DEFAULT '{}'::jsonb,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (group_id, sku)
);

CREATE TABLE IF NOT EXISTS produto_equivalentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id),
  empresa_id UUID REFERENCES empresas(id),
  produto_id UUID NOT NULL REFERENCES produtos(id),
  produto_equivalente_id UUID NOT NULL REFERENCES produtos(id),
  tipo TEXT NOT NULL DEFAULT 'EQUIVALENTE' CHECK (tipo IN ('EQUIVALENTE','SUBSTITUTO')),
  direcional BOOLEAN NOT NULL DEFAULT false,
  aprovado BOOLEAN NOT NULL DEFAULT false,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CHECK (produto_id <> produto_equivalente_id),
  UNIQUE (group_id, produto_id, produto_equivalente_id, tipo)
);

CREATE TABLE IF NOT EXISTS produto_midias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id),
  empresa_id UUID REFERENCES empresas(id),
  produto_id UUID NOT NULL REFERENCES produtos(id),
  storage_key TEXT NOT NULL,
  categoria TEXT NOT NULL CHECK (categoria IN ('IMAGEM','VIDEO','DESENHO','MANUAL','CERTIFICADO','CAD')),
  nome_arquivo TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  tamanho_bytes BIGINT NOT NULL CHECK (tamanho_bytes > 0),
  sha256 TEXT NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  versao INTEGER NOT NULL DEFAULT 1 CHECK (versao > 0),
  status TEXT NOT NULL DEFAULT 'QUARENTENA' CHECK (status IN ('QUARENTENA','APROVADO','REJEITADO','INATIVO')),
  principal BOOLEAN NOT NULL DEFAULT false,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (group_id, storage_key, versao)
);

CREATE INDEX IF NOT EXISTS idx_produto_variantes_tenant ON produto_variantes(group_id, empresa_id, produto_id);
CREATE INDEX IF NOT EXISTS idx_produto_equivalentes_tenant ON produto_equivalentes(group_id, empresa_id, produto_id);
CREATE INDEX IF NOT EXISTS idx_produto_midias_tenant ON produto_midias(group_id, empresa_id, produto_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_produto_midia_principal
  ON produto_midias(group_id, produto_id) WHERE principal AND ativo;

DROP TRIGGER IF EXISTS trg_produto_variantes_tenant ON produto_variantes;
CREATE TRIGGER trg_produto_variantes_tenant BEFORE INSERT OR UPDATE OF group_id, empresa_id
  ON produto_variantes FOR EACH ROW EXECUTE PROCEDURE assert_empresa_belongs_to_group();
DROP TRIGGER IF EXISTS trg_produto_equivalentes_tenant ON produto_equivalentes;
CREATE OR REPLACE FUNCTION assert_produto_pim_tenant_integrity()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM produtos p WHERE p.id = NEW.produto_id AND p.group_id = NEW.group_id) THEN
    RAISE EXCEPTION 'TENANT_FK_MISMATCH: produto_id % does not belong to group_id %', NEW.produto_id, NEW.group_id;
  END IF;
  IF TG_TABLE_NAME = 'produto_equivalentes' AND NOT EXISTS (
    SELECT 1 FROM produtos p WHERE p.id = NEW.produto_equivalente_id AND p.group_id = NEW.group_id
  ) THEN
    RAISE EXCEPTION 'TENANT_FK_MISMATCH: produto_equivalente_id % does not belong to group_id %',
      NEW.produto_equivalente_id, NEW.group_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_produto_variantes_refs ON produto_variantes;
CREATE TRIGGER trg_produto_variantes_refs BEFORE INSERT OR UPDATE OF group_id, produto_id
  ON produto_variantes FOR EACH ROW EXECUTE PROCEDURE assert_produto_pim_tenant_integrity();
DROP TRIGGER IF EXISTS trg_produto_equivalentes_refs ON produto_equivalentes;
CREATE TRIGGER trg_produto_equivalentes_refs BEFORE INSERT OR UPDATE OF group_id, produto_id, produto_equivalente_id
  ON produto_equivalentes FOR EACH ROW EXECUTE PROCEDURE assert_produto_pim_tenant_integrity();
DROP TRIGGER IF EXISTS trg_produto_midias_refs ON produto_midias;
CREATE TRIGGER trg_produto_midias_refs BEFORE INSERT OR UPDATE OF group_id, produto_id
  ON produto_midias FOR EACH ROW EXECUTE PROCEDURE assert_produto_pim_tenant_integrity();

REVOKE ALL ON produto_variantes, produto_equivalentes, produto_midias FROM PUBLIC;

CREATE TRIGGER trg_produto_equivalentes_tenant BEFORE INSERT OR UPDATE OF group_id, empresa_id
  ON produto_equivalentes FOR EACH ROW EXECUTE PROCEDURE assert_empresa_belongs_to_group();
DROP TRIGGER IF EXISTS trg_produto_midias_tenant ON produto_midias;
CREATE TRIGGER trg_produto_midias_tenant BEFORE INSERT OR UPDATE OF group_id, empresa_id
  ON produto_midias FOR EACH ROW EXECUTE PROCEDURE assert_empresa_belongs_to_group();

ALTER TABLE produto_variantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE produto_variantes FORCE ROW LEVEL SECURITY;
ALTER TABLE produto_equivalentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE produto_equivalentes FORCE ROW LEVEL SECURITY;
ALTER TABLE produto_midias ENABLE ROW LEVEL SECURITY;
ALTER TABLE produto_midias FORCE ROW LEVEL SECURITY;

ALTER TABLE integration_events
  ADD COLUMN IF NOT EXISTS schema_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS aggregate_type TEXT,
  ADD COLUMN IF NOT EXISTS aggregate_id UUID,
  ADD COLUMN IF NOT EXISTS correlation_id TEXT,
  ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dead_letter_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payload_checksum TEXT;

ALTER TABLE integration_events DROP CONSTRAINT IF EXISTS integration_events_attempts_check;
ALTER TABLE integration_events ADD CONSTRAINT integration_events_attempts_check
  CHECK (attempts >= 0 AND max_attempts > 0 AND attempts <= max_attempts);

COMMENT ON TABLE produto_variantes IS 'Variantes subordinadas ao Produto mestre; nao duplicam ficha PIM.';
COMMENT ON TABLE produto_equivalentes IS 'Equivalencias/substituicoes explicitas; nunca aplicadas automaticamente em Pedido.';
COMMENT ON TABLE produto_midias IS 'Metadados DAM; binarios e URLs assinadas permanecem fora do banco.';
