-- ERP-RUNTIME-02: Produto cadastro-base (sem estoque/custo/fiscal operacional)

CREATE TABLE IF NOT EXISTS produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id),
  empresa_id UUID REFERENCES empresas(id),
  codigo TEXT,
  descricao TEXT NOT NULL,
  nome TEXT,
  unidade_medida_id UUID REFERENCES unidades_medida(id),
  unidade_medida TEXT,
  grupo_produto_id UUID REFERENCES grupos_produto(id),
  marca_id UUID REFERENCES marcas(id),
  setor_atividade_id UUID REFERENCES setores_atividade(id),
  ncm TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  -- Campos operacionais (estoque/custo/fiscal) ficam FORA deste lote.
  created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now())),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now()))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_produtos_group_codigo
  ON produtos (group_id, lower(codigo))
  WHERE codigo IS NOT NULL AND btrim(codigo) <> '';
CREATE INDEX IF NOT EXISTS idx_produtos_group ON produtos(group_id);
CREATE INDEX IF NOT EXISTS idx_produtos_empresa ON produtos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_produtos_descricao ON produtos(group_id, lower(descricao));
CREATE INDEX IF NOT EXISTS idx_produtos_ativo ON produtos(group_id, ativo);
CREATE INDEX IF NOT EXISTS idx_produtos_grupo ON produtos(grupo_produto_id);
CREATE INDEX IF NOT EXISTS idx_produtos_marca ON produtos(marca_id);
CREATE INDEX IF NOT EXISTS idx_produtos_unidade ON produtos(unidade_medida_id);

DROP TRIGGER IF EXISTS trg_produtos_updated_at ON produtos;
CREATE TRIGGER trg_produtos_updated_at
  BEFORE UPDATE ON produtos
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

DROP TRIGGER IF EXISTS trg_produtos_tenant ON produtos;
CREATE TRIGGER trg_produtos_tenant
  BEFORE INSERT OR UPDATE OF group_id, empresa_id ON produtos
  FOR EACH ROW EXECUTE PROCEDURE assert_empresa_belongs_to_group();

ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE produtos FORCE ROW LEVEL SECURITY;

COMMENT ON TABLE produtos IS 'ERP-RUNTIME-02 cadastro-base. Sem saldo/custo/movimentacao/fiscal operacional.';
