-- ERP-COMERCIAL-360: snapshot imutavel de CondicaoPagamento em Orcamento/Pedido.
-- Aditiva; sem DROP/TRUNCATE. Executar somente em CI ate gate de VPS proprio.
-- Snapshot: id (FK ja existente) + codigo + nome + parcelas JSON no momento da gravacao.

ALTER TABLE orcamentos
  ADD COLUMN IF NOT EXISTS condicao_pagamento_codigo_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS condicao_pagamento_nome_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS condicao_pagamento_parcelas_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS tabela_preco_id UUID REFERENCES tabelas_preco(id);

ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS condicao_pagamento_codigo_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS condicao_pagamento_nome_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS condicao_pagamento_parcelas_snapshot JSONB;

-- Novos documentos: snapshot obrigatorio (legado pre-025 permanece nullable).
ALTER TABLE orcamentos
  DROP CONSTRAINT IF EXISTS orcamentos_condicao_snapshot_pair;
ALTER TABLE orcamentos
  ADD CONSTRAINT orcamentos_condicao_snapshot_pair CHECK (
    (
      condicao_pagamento_codigo_snapshot IS NULL
      AND condicao_pagamento_nome_snapshot IS NULL
      AND condicao_pagamento_parcelas_snapshot IS NULL
    )
    OR (
      btrim(condicao_pagamento_codigo_snapshot) <> ''
      AND btrim(condicao_pagamento_nome_snapshot) <> ''
      AND jsonb_typeof(condicao_pagamento_parcelas_snapshot) = 'array'
      AND jsonb_array_length(condicao_pagamento_parcelas_snapshot) >= 1
    )
  );

ALTER TABLE pedidos
  DROP CONSTRAINT IF EXISTS pedidos_condicao_snapshot_pair;
ALTER TABLE pedidos
  ADD CONSTRAINT pedidos_condicao_snapshot_pair CHECK (
    (
      condicao_pagamento_codigo_snapshot IS NULL
      AND condicao_pagamento_nome_snapshot IS NULL
      AND condicao_pagamento_parcelas_snapshot IS NULL
    )
    OR (
      btrim(condicao_pagamento_codigo_snapshot) <> ''
      AND btrim(condicao_pagamento_nome_snapshot) <> ''
      AND jsonb_typeof(condicao_pagamento_parcelas_snapshot) = 'array'
      AND jsonb_array_length(condicao_pagamento_parcelas_snapshot) >= 1
    )
  );

-- Tenant: tabela_preco opcional no Orçamento (mesmo padrao do Pedido).
CREATE OR REPLACE FUNCTION assert_orcamento_same_tenant() RETURNS TRIGGER AS $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM empresas e WHERE e.id=NEW.empresa_id AND e.group_id=NEW.group_id) THEN
    RAISE EXCEPTION 'TENANT_FK_MISMATCH: empresa outside group';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM cliente_empresas ce WHERE ce.id=NEW.cliente_empresa_id AND ce.group_id=NEW.group_id AND ce.empresa_id=NEW.empresa_id AND ce.ativo) THEN
    RAISE EXCEPTION 'TENANT_FK_MISMATCH: cliente_empresa outside scope';
  END IF;
  IF NOT EXISTS(
    SELECT 1 FROM condicoes_pagamento c
    JOIN condicao_pagamento_empresas ce ON ce.condicao_pagamento_id=c.id AND ce.group_id=c.group_id
    WHERE c.id=NEW.condicao_pagamento_id AND c.group_id=NEW.group_id AND ce.empresa_id=NEW.empresa_id AND c.ativo AND ce.ativo
  ) THEN
    RAISE EXCEPTION 'TENANT_FK_MISMATCH: condicao_pagamento outside scope';
  END IF;
  IF NEW.tabela_preco_id IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM tabelas_preco t
    JOIN tabela_preco_empresas te ON te.tabela_preco_id=t.id AND te.group_id=t.group_id
    WHERE t.id=NEW.tabela_preco_id AND t.group_id=NEW.group_id AND t.ativo AND te.empresa_id=NEW.empresa_id AND te.ativo
  ) THEN
    RAISE EXCEPTION 'TENANT_FK_MISMATCH: tabela_preco outside scope';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_orcamentos_tenant ON orcamentos;
CREATE TRIGGER trg_orcamentos_tenant
  BEFORE INSERT OR UPDATE OF group_id,empresa_id,cliente_empresa_id,condicao_pagamento_id,tabela_preco_id
  ON orcamentos FOR EACH ROW EXECUTE PROCEDURE assert_orcamento_same_tenant();

COMMENT ON COLUMN orcamentos.condicao_pagamento_codigo_snapshot IS 'Snapshot imutavel do codigo da CondicaoPagamento no momento da gravacao.';
COMMENT ON COLUMN orcamentos.condicao_pagamento_nome_snapshot IS 'Snapshot imutavel do nome da CondicaoPagamento no momento da gravacao.';
COMMENT ON COLUMN orcamentos.condicao_pagamento_parcelas_snapshot IS 'Snapshot JSON das parcelas (ordem/dias/percentual) no momento da gravacao.';
COMMENT ON COLUMN orcamentos.tabela_preco_id IS 'Tabela de preco resolvida no momento da gravacao (opcional; itens ja tem preco snapshot).';
COMMENT ON COLUMN pedidos.condicao_pagamento_codigo_snapshot IS 'Snapshot imutavel do codigo da CondicaoPagamento no momento da gravacao.';
COMMENT ON COLUMN pedidos.condicao_pagamento_nome_snapshot IS 'Snapshot imutavel do nome da CondicaoPagamento no momento da gravacao.';
COMMENT ON COLUMN pedidos.condicao_pagamento_parcelas_snapshot IS 'Snapshot JSON das parcelas (ordem/dias/percentual) no momento da gravacao.';

-- Rollback somente com backup/gate:
-- ALTER TABLE orcamentos DROP COLUMN IF EXISTS condicao_pagamento_codigo_snapshot, DROP COLUMN IF EXISTS condicao_pagamento_nome_snapshot, DROP COLUMN IF EXISTS condicao_pagamento_parcelas_snapshot, DROP COLUMN IF EXISTS tabela_preco_id;
-- ALTER TABLE pedidos DROP COLUMN IF EXISTS condicao_pagamento_codigo_snapshot, DROP COLUMN IF EXISTS condicao_pagamento_nome_snapshot, DROP COLUMN IF EXISTS condicao_pagamento_parcelas_snapshot;
