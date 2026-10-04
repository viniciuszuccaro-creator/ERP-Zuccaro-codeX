-- Ledger operacional da Expedição. Os saldos de abertura não são inventados pela migration.
-- Ativar a porta somente depois de reconciliar cada saldo com a fonte de estoque aprovada.
CREATE UNIQUE INDEX idx_entrega_itens_scope_identity ON entrega_itens(id, group_id, empresa_id);
CREATE TABLE expedicao_estoque_saldos (
  group_id UUID NOT NULL REFERENCES groups(id),
  empresa_id UUID NOT NULL REFERENCES empresas(id),
  produto_id UUID NOT NULL REFERENCES produtos(id),
  quantidade NUMERIC(18,6) NOT NULL CHECK (quantidade >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (group_id, empresa_id, produto_id)
);
ALTER TABLE expedicao_estoque_saldos ENABLE ROW LEVEL SECURITY;
ALTER TABLE expedicao_estoque_saldos FORCE ROW LEVEL SECURITY;
REVOKE ALL ON expedicao_estoque_saldos FROM PUBLIC;

CREATE TABLE expedicao_estoque_movimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id),
  empresa_id UUID NOT NULL REFERENCES empresas(id),
  produto_id UUID NOT NULL REFERENCES produtos(id),
  entrega_id UUID NOT NULL REFERENCES entregas(id),
  entrega_item_id UUID NOT NULL REFERENCES entrega_itens(id),
  romaneio_id UUID REFERENCES romaneios(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('DESPACHO', 'DEVOLUCAO', 'CANCELAMENTO')),
  quantidade NUMERIC(18,6) NOT NULL CHECK (quantidade > 0),
  actor_id UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  FOREIGN KEY (entrega_id, group_id, empresa_id) REFERENCES entregas(id, group_id, empresa_id),
  FOREIGN KEY (entrega_item_id, group_id, empresa_id) REFERENCES entrega_itens(id, group_id, empresa_id),
  UNIQUE (group_id, empresa_id, entrega_item_id, tipo)
);
CREATE INDEX idx_expedicao_estoque_movimentos_entrega
  ON expedicao_estoque_movimentos(group_id, empresa_id, entrega_id, entrega_item_id);
ALTER TABLE expedicao_estoque_movimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE expedicao_estoque_movimentos FORCE ROW LEVEL SECURITY;
REVOKE ALL ON expedicao_estoque_movimentos FROM PUBLIC;

CREATE FUNCTION assert_expedicao_estoque_tenant() RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM empresas e WHERE e.id=NEW.empresa_id AND e.group_id=NEW.group_id) THEN
    RAISE EXCEPTION 'TENANT_FK_MISMATCH: estoque outside group';
  END IF;
  IF TG_TABLE_NAME <> 'expedicao_pedido_eventos'
    AND NOT EXISTS (SELECT 1 FROM produtos p WHERE p.id=NEW.produto_id AND p.group_id=NEW.group_id) THEN
    RAISE EXCEPTION 'TENANT_FK_MISMATCH: produto outside group';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_expedicao_estoque_saldos_tenant
  BEFORE INSERT OR UPDATE OF group_id, empresa_id ON expedicao_estoque_saldos
  FOR EACH ROW EXECUTE FUNCTION assert_expedicao_estoque_tenant();
CREATE TRIGGER trg_expedicao_estoque_movimentos_tenant
  BEFORE INSERT OR UPDATE OF group_id, empresa_id ON expedicao_estoque_movimentos
  FOR EACH ROW EXECUTE FUNCTION assert_expedicao_estoque_tenant();

-- Evento de negócio Pedido sem inventar estado de Pedido inexistente no contrato canônico.
CREATE TABLE expedicao_pedido_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id),
  empresa_id UUID NOT NULL REFERENCES empresas(id),
  pedido_id UUID NOT NULL REFERENCES pedidos(id),
  entrega_id UUID REFERENCES entregas(id),
  romaneio_id UUID REFERENCES romaneios(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('SEPARACAO', 'DESPACHO', 'CANCELAMENTO')),
  actor_id UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  FOREIGN KEY (pedido_id, group_id, empresa_id) REFERENCES pedidos(id, group_id, empresa_id),
  UNIQUE (group_id, empresa_id, pedido_id, entrega_id, tipo)
);
CREATE INDEX idx_expedicao_pedido_eventos_pedido ON expedicao_pedido_eventos(group_id, empresa_id, pedido_id);
ALTER TABLE expedicao_pedido_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE expedicao_pedido_eventos FORCE ROW LEVEL SECURITY;
REVOKE ALL ON expedicao_pedido_eventos FROM PUBLIC;
CREATE TRIGGER trg_expedicao_pedido_eventos_tenant
  BEFORE INSERT OR UPDATE OF group_id, empresa_id ON expedicao_pedido_eventos
  FOR EACH ROW EXECUTE FUNCTION assert_expedicao_estoque_tenant();
