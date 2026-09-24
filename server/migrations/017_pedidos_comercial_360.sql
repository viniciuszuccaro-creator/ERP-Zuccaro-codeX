-- ERP-COMERCIAL-360 V1. Aditiva; executar somente em CI ate gate de VPS proprio.
CREATE TABLE IF NOT EXISTS pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id),
  empresa_id UUID NOT NULL REFERENCES empresas(id),
  numero VARCHAR(8) NOT NULL,
  status TEXT NOT NULL DEFAULT 'EM_ABERTO',
  cliente_empresa_id UUID NOT NULL REFERENCES cliente_empresas(id),
  cliente_local_id UUID REFERENCES cliente_locais(id),
  obra_id UUID REFERENCES obras(id),
  tabela_preco_id UUID REFERENCES tabelas_preco(id),
  condicao_pagamento_id UUID NOT NULL REFERENCES condicoes_pagamento(id),
  orcamento_id UUID REFERENCES orcamentos(id),
  vendedor_id UUID NOT NULL REFERENCES profiles(id),
  tipo_operacao TEXT NOT NULL,
  data_entrega_solicitada TIMESTAMPTZ NOT NULL,
  observacoes TEXT,
  subtotal NUMERIC(18,6) NOT NULL,
  desconto NUMERIC(18,6) NOT NULL DEFAULT 0,
  total NUMERIC(18,6) NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (empresa_id, numero),
  UNIQUE (empresa_id, orcamento_id),
  UNIQUE (id, group_id, empresa_id),
  CHECK (btrim(numero) ~ '^[0-9]{8}$'),
  CHECK (status IN ('EM_ABERTO','EM_PRODUCAO','PRONTO_ENTREGA','PRONTO_RETIRADA','FINALIZADO','CANCELADO')),
  CHECK (tipo_operacao IN ('ENTREGA','RETIRADA')),
  CHECK (subtotal >= 0 AND desconto >= 0 AND total >= 0 AND desconto <= subtotal),
  CHECK ((status = 'CANCELADO') = (ativo = false)),
  CHECK (observacoes IS NULL OR char_length(observacoes) <= 1000)
);

CREATE OR REPLACE FUNCTION assert_pedido_same_tenant() RETURNS TRIGGER AS $$
DECLARE cliente_master UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM empresas e WHERE e.id=NEW.empresa_id AND e.group_id=NEW.group_id) THEN
    RAISE EXCEPTION 'TENANT_FK_MISMATCH: empresa outside group';
  END IF;
  SELECT ce.cliente_id INTO cliente_master FROM cliente_empresas ce
    WHERE ce.id=NEW.cliente_empresa_id AND ce.group_id=NEW.group_id AND ce.empresa_id=NEW.empresa_id
      AND ce.ativo AND ce.habilitado_operacao AND NOT ce.bloqueado;
  IF cliente_master IS NULL THEN RAISE EXCEPTION 'TENANT_FK_MISMATCH: cliente_empresa outside scope'; END IF;
  IF NEW.cliente_local_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM cliente_locais l WHERE l.id=NEW.cliente_local_id AND l.group_id=NEW.group_id AND l.cliente_id=cliente_master AND l.ativo) THEN
    RAISE EXCEPTION 'TENANT_FK_MISMATCH: cliente_local outside scope';
  END IF;
  IF NEW.obra_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM obras o JOIN obra_empresas oe ON oe.obra_id=o.id AND oe.group_id=o.group_id WHERE o.id=NEW.obra_id AND o.group_id=NEW.group_id AND o.cliente_id=cliente_master AND o.ativo AND oe.empresa_id=NEW.empresa_id AND oe.ativo) THEN
    RAISE EXCEPTION 'TENANT_FK_MISMATCH: obra outside scope';
  END IF;
  IF NEW.tabela_preco_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM tabelas_preco t JOIN tabela_preco_empresas te ON te.tabela_preco_id=t.id AND te.group_id=t.group_id WHERE t.id=NEW.tabela_preco_id AND t.group_id=NEW.group_id AND t.ativo AND te.empresa_id=NEW.empresa_id AND te.ativo) THEN
    RAISE EXCEPTION 'TENANT_FK_MISMATCH: tabela_preco outside scope';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM condicoes_pagamento c JOIN condicao_pagamento_empresas ce ON ce.condicao_pagamento_id=c.id AND ce.group_id=c.group_id WHERE c.id=NEW.condicao_pagamento_id AND c.group_id=NEW.group_id AND c.ativo AND ce.empresa_id=NEW.empresa_id AND ce.ativo) THEN
    RAISE EXCEPTION 'TENANT_FK_MISMATCH: condicao_pagamento outside scope';
  END IF;
  IF NEW.orcamento_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM orcamentos o WHERE o.id=NEW.orcamento_id AND o.group_id=NEW.group_id AND o.empresa_id=NEW.empresa_id) THEN
    RAISE EXCEPTION 'TENANT_FK_MISMATCH: orcamento outside scope';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_pedidos_tenant BEFORE INSERT OR UPDATE OF group_id,empresa_id,cliente_empresa_id,cliente_local_id,obra_id,tabela_preco_id,condicao_pagamento_id,orcamento_id
  ON pedidos FOR EACH ROW EXECUTE PROCEDURE assert_pedido_same_tenant();
CREATE TRIGGER trg_pedidos_updated_at BEFORE UPDATE ON pedidos FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE INDEX IF NOT EXISTS idx_pedidos_scope_page ON pedidos(group_id,empresa_id,status,numero DESC,id DESC);
CREATE INDEX IF NOT EXISTS idx_pedidos_entrega ON pedidos(group_id,empresa_id,data_entrega_solicitada,status);
CREATE INDEX IF NOT EXISTS idx_pedidos_cliente ON pedidos(group_id,empresa_id,cliente_empresa_id,numero DESC);
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE pedidos FROM PUBLIC;

CREATE TABLE IF NOT EXISTS pedido_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id),
  empresa_id UUID NOT NULL REFERENCES empresas(id),
  pedido_id UUID NOT NULL REFERENCES pedidos(id),
  produto_id UUID NOT NULL REFERENCES produtos(id),
  unidade_id UUID NOT NULL REFERENCES unidades_medida(id),
  descricao_snapshot TEXT NOT NULL,
  unidade_snapshot TEXT NOT NULL,
  quantidade NUMERIC(18,6) NOT NULL,
  preco_unitario NUMERIC(18,6) NOT NULL,
  desconto NUMERIC(18,6) NOT NULL DEFAULT 0,
  subtotal NUMERIC(18,6) NOT NULL,
  total NUMERIC(18,6) NOT NULL,
  requer_producao BOOLEAN NOT NULL DEFAULT false,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  FOREIGN KEY (pedido_id,group_id,empresa_id) REFERENCES pedidos(id,group_id,empresa_id),
  CHECK (btrim(descricao_snapshot) <> '' AND btrim(unidade_snapshot) <> ''),
  CHECK (quantidade > 0 AND preco_unitario >= 0 AND desconto >= 0 AND subtotal >= 0 AND total >= 0 AND desconto <= subtotal)
);

CREATE OR REPLACE FUNCTION assert_pedido_item_same_tenant() RETURNS TRIGGER AS $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pedidos p WHERE p.id=NEW.pedido_id AND p.group_id=NEW.group_id AND p.empresa_id=NEW.empresa_id) THEN RAISE EXCEPTION 'TENANT_FK_MISMATCH: item outside pedido scope'; END IF;
  IF NOT EXISTS (SELECT 1 FROM produtos p WHERE p.id=NEW.produto_id AND p.group_id=NEW.group_id AND p.empresa_id=NEW.empresa_id AND p.unidade_medida_id=NEW.unidade_id AND p.ativo) THEN RAISE EXCEPTION 'TENANT_FK_MISMATCH: produto outside scope'; END IF;
  IF NOT EXISTS (SELECT 1 FROM unidades_medida u WHERE u.id=NEW.unidade_id AND u.group_id=NEW.group_id AND u.ativo) THEN RAISE EXCEPTION 'TENANT_FK_MISMATCH: unidade outside group'; END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_pedido_itens_tenant BEFORE INSERT OR UPDATE OF group_id,empresa_id,pedido_id,produto_id,unidade_id ON pedido_itens FOR EACH ROW EXECUTE PROCEDURE assert_pedido_item_same_tenant();
CREATE TRIGGER trg_pedido_itens_updated_at BEFORE UPDATE ON pedido_itens FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE INDEX IF NOT EXISTS idx_pedido_itens_scope ON pedido_itens(group_id,empresa_id,pedido_id,created_at,id);
ALTER TABLE pedido_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_itens FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE pedido_itens FROM PUBLIC;

CREATE TABLE IF NOT EXISTS pedido_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem BIGINT GENERATED ALWAYS AS IDENTITY,
  group_id UUID NOT NULL REFERENCES groups(id),
  empresa_id UUID NOT NULL REFERENCES empresas(id),
  pedido_id UUID NOT NULL REFERENCES pedidos(id),
  status_anterior TEXT,
  status_novo TEXT NOT NULL,
  actor_id UUID NOT NULL REFERENCES profiles(id),
  motivo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  FOREIGN KEY (pedido_id,group_id,empresa_id) REFERENCES pedidos(id,group_id,empresa_id),
  CHECK (status_anterior IS NULL OR status_anterior IN ('EM_ABERTO','EM_PRODUCAO','PRONTO_ENTREGA','PRONTO_RETIRADA','FINALIZADO','CANCELADO')),
  CHECK (status_novo IN ('EM_ABERTO','EM_PRODUCAO','PRONTO_ENTREGA','PRONTO_RETIRADA','FINALIZADO','CANCELADO')),
  CHECK (motivo IS NULL OR char_length(motivo) <= 500)
);
CREATE INDEX IF NOT EXISTS idx_pedido_historico_scope ON pedido_historico(group_id,empresa_id,pedido_id,ordem);
ALTER TABLE pedido_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_historico FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE pedido_historico FROM PUBLIC;

COMMENT ON TABLE pedidos IS 'Comercial 360: agregado canonico tenant-scoped de Pedido.';
COMMENT ON TABLE pedido_itens IS 'Snapshots comerciais imutaveis por estado do Pedido.';
COMMENT ON TABLE pedido_historico IS 'Historico append-only de estados do Pedido.';
-- Rollback somente com backup/gate: DROP TABLE pedido_historico; DROP TABLE pedido_itens; DROP TABLE pedidos; DROP FUNCTION assert_pedido_item_same_tenant(); DROP FUNCTION assert_pedido_same_tenant();
