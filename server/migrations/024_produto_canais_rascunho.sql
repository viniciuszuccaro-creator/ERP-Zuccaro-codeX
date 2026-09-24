-- Conteudo por canal permanece rascunho ate contrato de aprovacao e gate de publicacao.
CREATE TABLE produto_canais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id),
  empresa_id UUID NOT NULL REFERENCES empresas(id),
  produto_id UUID NOT NULL REFERENCES produtos(id),
  canal TEXT NOT NULL CHECK (canal ~ '^[a-z][a-z0-9_-]{1,39}$'),
  sku TEXT CHECK (sku IS NULL OR length(btrim(sku)) BETWEEN 1 AND 120),
  nome TEXT CHECK (nome IS NULL OR length(btrim(nome)) BETWEEN 1 AND 240),
  descricao TEXT CHECK (descricao IS NULL OR length(btrim(descricao)) BETWEEN 1 AND 4000),
  status TEXT NOT NULL DEFAULT 'RASCUNHO' CHECK (status = 'RASCUNHO'),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (group_id, empresa_id, produto_id, canal)
);

CREATE UNIQUE INDEX uq_produto_canais_sku_ci ON produto_canais(group_id, empresa_id, canal, lower(sku))
  WHERE sku IS NOT NULL;
CREATE INDEX idx_produto_canais_tenant ON produto_canais(group_id, empresa_id, produto_id);

CREATE TRIGGER trg_produto_canais_empresa
  BEFORE INSERT OR UPDATE OF group_id, empresa_id ON produto_canais
  FOR EACH ROW EXECUTE PROCEDURE assert_empresa_belongs_to_group();

CREATE TRIGGER trg_produto_canais_produto
  BEFORE INSERT OR UPDATE OF group_id, empresa_id, produto_id ON produto_canais
  FOR EACH ROW EXECUTE PROCEDURE assert_produto_pim_tenant_integrity();

REVOKE ALL ON produto_canais FROM PUBLIC;
ALTER TABLE produto_canais ENABLE ROW LEVEL SECURITY;
ALTER TABLE produto_canais FORCE ROW LEVEL SECURITY;

COMMENT ON TABLE produto_canais IS 'Rascunho de conteudo por canal subordinado ao Produto; sem publicacao externa.';
