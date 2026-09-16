-- ERP-RUNTIME-02: cadastros simples (UnidadeMedida, GrupoProduto, SetorAtividade)

-- unidades_medida ≈ UnidadeMedida
CREATE TABLE IF NOT EXISTS unidades_medida (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id),
  empresa_id UUID REFERENCES empresas(id),
  sigla TEXT NOT NULL,
  nome_completo TEXT NOT NULL,
  tipo_grandeza TEXT NOT NULL DEFAULT 'Unidade',
  unidade_base_conversao TEXT,
  fator_conversao_para_base NUMERIC(18, 6) NOT NULL DEFAULT 1,
  permite_conversao BOOLEAN NOT NULL DEFAULT true,
  usa_em_estoque BOOLEAN NOT NULL DEFAULT true,
  usa_em_compras BOOLEAN NOT NULL DEFAULT true,
  usa_em_vendas BOOLEAN NOT NULL DEFAULT true,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now())),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now()))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_unidades_medida_group_sigla
  ON unidades_medida (group_id, lower(sigla));
CREATE INDEX IF NOT EXISTS idx_unidades_medida_group ON unidades_medida(group_id);
CREATE INDEX IF NOT EXISTS idx_unidades_medida_empresa ON unidades_medida(empresa_id);
CREATE INDEX IF NOT EXISTS idx_unidades_medida_ativo ON unidades_medida(group_id, ativo);

DROP TRIGGER IF EXISTS trg_unidades_medida_updated_at ON unidades_medida;
CREATE TRIGGER trg_unidades_medida_updated_at
  BEFORE UPDATE ON unidades_medida
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

DROP TRIGGER IF EXISTS trg_unidades_medida_tenant ON unidades_medida;
CREATE TRIGGER trg_unidades_medida_tenant
  BEFORE INSERT OR UPDATE OF group_id, empresa_id ON unidades_medida
  FOR EACH ROW EXECUTE PROCEDURE assert_empresa_belongs_to_group();

ALTER TABLE unidades_medida ENABLE ROW LEVEL SECURITY;
ALTER TABLE unidades_medida FORCE ROW LEVEL SECURITY;

-- grupos_produto ≈ GrupoProduto
CREATE TABLE IF NOT EXISTS grupos_produto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id),
  empresa_id UUID REFERENCES empresas(id),
  nome_grupo TEXT NOT NULL,
  codigo TEXT,
  natureza TEXT NOT NULL DEFAULT 'Revenda',
  ncm_padrao TEXT,
  margem_sugerida NUMERIC(10, 4) NOT NULL DEFAULT 0,
  icone TEXT,
  cor TEXT,
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now())),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now()))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_grupos_produto_group_codigo
  ON grupos_produto (group_id, lower(codigo))
  WHERE codigo IS NOT NULL AND btrim(codigo) <> '';
CREATE INDEX IF NOT EXISTS idx_grupos_produto_group ON grupos_produto(group_id);
CREATE INDEX IF NOT EXISTS idx_grupos_produto_empresa ON grupos_produto(empresa_id);
CREATE INDEX IF NOT EXISTS idx_grupos_produto_nome ON grupos_produto(group_id, lower(nome_grupo));
CREATE INDEX IF NOT EXISTS idx_grupos_produto_ativo ON grupos_produto(group_id, ativo);

DROP TRIGGER IF EXISTS trg_grupos_produto_updated_at ON grupos_produto;
CREATE TRIGGER trg_grupos_produto_updated_at
  BEFORE UPDATE ON grupos_produto
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

DROP TRIGGER IF EXISTS trg_grupos_produto_tenant ON grupos_produto;
CREATE TRIGGER trg_grupos_produto_tenant
  BEFORE INSERT OR UPDATE OF group_id, empresa_id ON grupos_produto
  FOR EACH ROW EXECUTE PROCEDURE assert_empresa_belongs_to_group();

ALTER TABLE grupos_produto ENABLE ROW LEVEL SECURITY;
ALTER TABLE grupos_produto FORCE ROW LEVEL SECURITY;

-- setores_atividade ≈ SetorAtividade
CREATE TABLE IF NOT EXISTS setores_atividade (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id),
  empresa_id UUID REFERENCES empresas(id),
  nome TEXT NOT NULL,
  descricao TEXT,
  tipo_operacao TEXT NOT NULL DEFAULT 'Revenda',
  icone TEXT,
  cor TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now())),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now()))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_setores_atividade_group_nome
  ON setores_atividade (group_id, lower(nome));
CREATE INDEX IF NOT EXISTS idx_setores_atividade_group ON setores_atividade(group_id);
CREATE INDEX IF NOT EXISTS idx_setores_atividade_empresa ON setores_atividade(empresa_id);
CREATE INDEX IF NOT EXISTS idx_setores_atividade_ativo ON setores_atividade(group_id, ativo);

DROP TRIGGER IF EXISTS trg_setores_atividade_updated_at ON setores_atividade;
CREATE TRIGGER trg_setores_atividade_updated_at
  BEFORE UPDATE ON setores_atividade
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

DROP TRIGGER IF EXISTS trg_setores_atividade_tenant ON setores_atividade;
CREATE TRIGGER trg_setores_atividade_tenant
  BEFORE INSERT OR UPDATE OF group_id, empresa_id ON setores_atividade
  FOR EACH ROW EXECUTE PROCEDURE assert_empresa_belongs_to_group();

ALTER TABLE setores_atividade ENABLE ROW LEVEL SECURITY;
ALTER TABLE setores_atividade FORCE ROW LEVEL SECURITY;
