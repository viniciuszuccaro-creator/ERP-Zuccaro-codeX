-- ERP-RUNTIME-08B: Condição de Pagamento canônica.
-- Aditiva; migrations 001-013 permanecem imutáveis. Não cria FormaPagamento,
-- Orçamento, Pedido, títulos ou ContaReceber.

CREATE TABLE IF NOT EXISTS condicoes_pagamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id),
  empresa_id UUID NOT NULL REFERENCES empresas(id),
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  codigo_condicao_legado TEXT,
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
  UNIQUE (id, group_id),
  CHECK (btrim(nome) <> ''),
  CHECK (codigo ~ '^[0-9]{6}$'),
  CHECK (descricao IS NULL OR char_length(descricao) <= 500),
  CHECK (codigo_condicao_legado IS NULL OR char_length(codigo_condicao_legado) <= 64),
  CHECK (origem IN ('ERP','MIGRACAO','SITE_CPA','B2B','PORTAL','CHATBOT','WHATSAPP','MARKETPLACE','APP','API'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_condicoes_pagamento_origem_nome_ativo ON condicoes_pagamento (group_id, empresa_id, lower(btrim(nome))) WHERE ativo = true;

CREATE OR REPLACE FUNCTION assert_condicao_pagamento_same_tenant() RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM empresas e WHERE e.id=NEW.empresa_id AND e.group_id=NEW.group_id) THEN
    RAISE EXCEPTION 'TENANT_FK_MISMATCH: empresa_id % does not belong to group_id %', NEW.empresa_id, NEW.group_id;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_condicoes_pagamento_tenant BEFORE INSERT OR UPDATE OF group_id, empresa_id ON condicoes_pagamento FOR EACH ROW EXECUTE PROCEDURE assert_condicao_pagamento_same_tenant();
CREATE TRIGGER trg_condicoes_pagamento_updated_at BEFORE UPDATE ON condicoes_pagamento FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE INDEX IF NOT EXISTS idx_condicoes_pagamento_scope ON condicoes_pagamento(group_id, empresa_id, ativo);
CREATE INDEX IF NOT EXISTS idx_condicoes_pagamento_nome ON condicoes_pagamento(group_id, lower(nome));
ALTER TABLE condicoes_pagamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE condicoes_pagamento FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE condicoes_pagamento FROM PUBLIC;

CREATE TABLE IF NOT EXISTS condicao_pagamento_empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id),
  condicao_pagamento_id UUID NOT NULL REFERENCES condicoes_pagamento(id),
  empresa_id UUID NOT NULL REFERENCES empresas(id),
  eh_padrao BOOLEAN NOT NULL DEFAULT false,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES profiles(id), updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now())), updated_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now())),
  UNIQUE (condicao_pagamento_id, empresa_id), CHECK (eh_padrao=false OR ativo=true),
  FOREIGN KEY (condicao_pagamento_id, group_id) REFERENCES condicoes_pagamento(id, group_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_condicao_pagamento_empresas_padrao_ativo ON condicao_pagamento_empresas(empresa_id) WHERE eh_padrao=true AND ativo=true;
CREATE OR REPLACE FUNCTION assert_condicao_pagamento_empresa_same_tenant() RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM condicoes_pagamento c WHERE c.id=NEW.condicao_pagamento_id AND c.group_id=NEW.group_id) OR NOT EXISTS (SELECT 1 FROM empresas e WHERE e.id=NEW.empresa_id AND e.group_id=NEW.group_id) THEN
    RAISE EXCEPTION 'TENANT_FK_MISMATCH: condicao_pagamento/empresa outside group';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_condicao_pagamento_empresas_tenant BEFORE INSERT OR UPDATE OF group_id,condicao_pagamento_id,empresa_id ON condicao_pagamento_empresas FOR EACH ROW EXECUTE PROCEDURE assert_condicao_pagamento_empresa_same_tenant();
CREATE TRIGGER trg_condicao_pagamento_empresas_updated_at BEFORE UPDATE ON condicao_pagamento_empresas FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE INDEX IF NOT EXISTS idx_condicao_pagamento_empresas_empresa ON condicao_pagamento_empresas(group_id,empresa_id,ativo);
ALTER TABLE condicao_pagamento_empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE condicao_pagamento_empresas FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE condicao_pagamento_empresas FROM PUBLIC;

CREATE TABLE IF NOT EXISTS condicao_pagamento_parcelas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id),
  condicao_pagamento_id UUID NOT NULL REFERENCES condicoes_pagamento(id),
  ordem INTEGER NOT NULL, dias INTEGER NOT NULL, percentual NUMERIC(9,6) NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES profiles(id), updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now())), updated_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now())),
  UNIQUE (condicao_pagamento_id, ordem),
  CHECK (ordem > 0), CHECK (dias >= 0), CHECK (percentual > 0 AND percentual <= 100),
  FOREIGN KEY (condicao_pagamento_id, group_id) REFERENCES condicoes_pagamento(id, group_id)
);
CREATE OR REPLACE FUNCTION assert_condicao_pagamento_parcela_same_tenant() RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM condicoes_pagamento c WHERE c.id=NEW.condicao_pagamento_id AND c.group_id=NEW.group_id) THEN RAISE EXCEPTION 'TENANT_FK_MISMATCH: condicao_pagamento outside group'; END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_condicao_pagamento_parcelas_tenant BEFORE INSERT OR UPDATE OF group_id,condicao_pagamento_id ON condicao_pagamento_parcelas FOR EACH ROW EXECUTE PROCEDURE assert_condicao_pagamento_parcela_same_tenant();
CREATE TRIGGER trg_condicao_pagamento_parcelas_updated_at BEFORE UPDATE ON condicao_pagamento_parcelas FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE INDEX IF NOT EXISTS idx_condicao_pagamento_parcelas_scope ON condicao_pagamento_parcelas(group_id,condicao_pagamento_id,ativo,ordem);
ALTER TABLE condicao_pagamento_parcelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE condicao_pagamento_parcelas FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE condicao_pagamento_parcelas FROM PUBLIC;

-- Deferred checks permit create/replace atomic transactions but reject partial active state at commit.
CREATE OR REPLACE FUNCTION assert_condicao_pagamento_parcelas_validas() RETURNS TRIGGER AS $$
DECLARE condicao UUID := COALESCE(NEW.condicao_pagamento_id, OLD.condicao_pagamento_id); grupo UUID := COALESCE(NEW.group_id, OLD.group_id); total NUMERIC(9,6); ativa BOOLEAN;
BEGIN
  SELECT c.ativo, COALESCE(sum(p.percentual) FILTER (WHERE p.ativo),0) INTO ativa,total FROM condicoes_pagamento c LEFT JOIN condicao_pagamento_parcelas p ON p.condicao_pagamento_id=c.id AND p.group_id=c.group_id WHERE c.id=condicao AND c.group_id=grupo GROUP BY c.ativo;
  IF ativa AND total <> 100.000000 THEN RAISE EXCEPTION 'CONDICAO_PAGAMENTO_INVALID_PARCELAS: active condition requires parcelas totaling 100.000000'; END IF;
  RETURN NULL;
END; $$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER trg_condicao_pagamento_parcelas_validas AFTER INSERT OR UPDATE OR DELETE ON condicao_pagamento_parcelas DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE PROCEDURE assert_condicao_pagamento_parcelas_validas();
CREATE OR REPLACE FUNCTION assert_condicao_pagamento_ativa_com_parcelas() RETURNS TRIGGER AS $$
DECLARE total NUMERIC(9,6);
BEGIN
  IF NEW.ativo THEN
    SELECT COALESCE(sum(percentual) FILTER (WHERE ativo),0) INTO total FROM condicao_pagamento_parcelas WHERE condicao_pagamento_id=NEW.id AND group_id=NEW.group_id;
    IF total <> 100.000000 THEN RAISE EXCEPTION 'CONDICAO_PAGAMENTO_INVALID_PARCELAS: active condition requires parcelas totaling 100.000000'; END IF;
  END IF;
  RETURN NULL;
END; $$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER trg_condicoes_pagamento_parcelas_validas AFTER INSERT OR UPDATE OF ativo ON condicoes_pagamento DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE PROCEDURE assert_condicao_pagamento_ativa_com_parcelas();

ALTER TABLE cliente_empresas ADD COLUMN IF NOT EXISTS condicao_pagamento_id UUID;
CREATE OR REPLACE FUNCTION assert_cliente_empresa_condicao_pagamento() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.condicao_pagamento_id IS NULL THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM condicoes_pagamento c JOIN condicao_pagamento_empresas ce ON ce.condicao_pagamento_id=c.id AND ce.group_id=c.group_id WHERE c.id=NEW.condicao_pagamento_id AND c.group_id=NEW.group_id AND c.ativo AND ce.empresa_id=NEW.empresa_id AND ce.ativo) THEN
    RAISE EXCEPTION 'CONDICAO_PAGAMENTO_NOT_AUTHORIZED: condition not authorized for ClienteEmpresa';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_cliente_empresas_condicao_pagamento BEFORE INSERT OR UPDATE OF condicao_pagamento_id,group_id,empresa_id ON cliente_empresas FOR EACH ROW EXECUTE PROCEDURE assert_cliente_empresa_condicao_pagamento();
CREATE INDEX IF NOT EXISTS idx_cliente_empresas_condicao_pagamento ON cliente_empresas(group_id,condicao_pagamento_id) WHERE condicao_pagamento_id IS NOT NULL;
COMMENT ON TABLE condicoes_pagamento IS 'ERP-RUNTIME-08B master de prazo/parcelamento; não é meio de pagamento.';
