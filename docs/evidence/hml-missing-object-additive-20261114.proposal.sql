-- PRIVATE GUARDED ADDITIVE DRAFT, NOT A COMPLETE MIGRATION.
-- Functions/policies/triggers/conditional/data/access changes remain in the review matrix.
BEGIN;
DO $review_gate$ BEGIN RAISE EXCEPTION 'HML_OBJECT_DELTA_PROPOSAL_ONLY_NOT_AUTHORIZED'; END; $review_gate$;
SET LOCAL search_path TO :"verified_hml_schema", pg_catalog, pg_temp;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
-- source 005_cadastros_simples.sql statement 0
CREATE TABLE :"verified_hml_schema".unidades_medida (
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
-- source 005_cadastros_simples.sql statement 1
CREATE UNIQUE INDEX uq_unidades_medida_group_sigla
  ON :"verified_hml_schema".unidades_medida (group_id, lower(sigla));
-- source 005_cadastros_simples.sql statement 2
CREATE INDEX idx_unidades_medida_group ON :"verified_hml_schema".unidades_medida(group_id);
-- source 005_cadastros_simples.sql statement 3
CREATE INDEX idx_unidades_medida_empresa ON :"verified_hml_schema".unidades_medida(empresa_id);
-- source 005_cadastros_simples.sql statement 4
CREATE INDEX idx_unidades_medida_ativo ON :"verified_hml_schema".unidades_medida(group_id, ativo);
-- source 005_cadastros_simples.sql statement 9
ALTER TABLE :"verified_hml_schema".unidades_medida ENABLE ROW LEVEL SECURITY;
-- source 005_cadastros_simples.sql statement 10
ALTER TABLE :"verified_hml_schema".unidades_medida FORCE ROW LEVEL SECURITY;
-- source 005_cadastros_simples.sql statement 11
CREATE TABLE :"verified_hml_schema".grupos_produto (
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
-- source 005_cadastros_simples.sql statement 12
CREATE UNIQUE INDEX uq_grupos_produto_group_codigo
  ON :"verified_hml_schema".grupos_produto (group_id, lower(codigo))
  WHERE codigo IS NOT NULL AND btrim(codigo) <> '';
-- source 005_cadastros_simples.sql statement 13
CREATE INDEX idx_grupos_produto_group ON :"verified_hml_schema".grupos_produto(group_id);
-- source 005_cadastros_simples.sql statement 14
CREATE INDEX idx_grupos_produto_empresa ON :"verified_hml_schema".grupos_produto(empresa_id);
-- source 005_cadastros_simples.sql statement 15
CREATE INDEX idx_grupos_produto_nome ON :"verified_hml_schema".grupos_produto(group_id, lower(nome_grupo));
-- source 005_cadastros_simples.sql statement 16
CREATE INDEX idx_grupos_produto_ativo ON :"verified_hml_schema".grupos_produto(group_id, ativo);
-- source 005_cadastros_simples.sql statement 21
ALTER TABLE :"verified_hml_schema".grupos_produto ENABLE ROW LEVEL SECURITY;
-- source 005_cadastros_simples.sql statement 22
ALTER TABLE :"verified_hml_schema".grupos_produto FORCE ROW LEVEL SECURITY;
-- source 005_cadastros_simples.sql statement 23
CREATE TABLE :"verified_hml_schema".setores_atividade (
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
-- source 005_cadastros_simples.sql statement 24
CREATE UNIQUE INDEX uq_setores_atividade_group_nome
  ON :"verified_hml_schema".setores_atividade (group_id, lower(nome));
-- source 005_cadastros_simples.sql statement 25
CREATE INDEX idx_setores_atividade_group ON :"verified_hml_schema".setores_atividade(group_id);
-- source 005_cadastros_simples.sql statement 26
CREATE INDEX idx_setores_atividade_empresa ON :"verified_hml_schema".setores_atividade(empresa_id);
-- source 005_cadastros_simples.sql statement 27
CREATE INDEX idx_setores_atividade_ativo ON :"verified_hml_schema".setores_atividade(group_id, ativo);
-- source 005_cadastros_simples.sql statement 32
ALTER TABLE :"verified_hml_schema".setores_atividade ENABLE ROW LEVEL SECURITY;
-- source 005_cadastros_simples.sql statement 33
ALTER TABLE :"verified_hml_schema".setores_atividade FORCE ROW LEVEL SECURITY;
-- source 006_produtos_base.sql statement 0
CREATE TABLE :"verified_hml_schema".produtos (
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

  created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now())),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now()))
);
-- source 006_produtos_base.sql statement 1
CREATE UNIQUE INDEX uq_produtos_group_codigo
  ON :"verified_hml_schema".produtos (group_id, lower(codigo))
  WHERE codigo IS NOT NULL AND btrim(codigo) <> '';
-- source 006_produtos_base.sql statement 2
CREATE INDEX idx_produtos_group ON :"verified_hml_schema".produtos(group_id);
-- source 006_produtos_base.sql statement 3
CREATE INDEX idx_produtos_empresa ON :"verified_hml_schema".produtos(empresa_id);
-- source 006_produtos_base.sql statement 4
CREATE INDEX idx_produtos_descricao ON :"verified_hml_schema".produtos(group_id, lower(descricao));
-- source 006_produtos_base.sql statement 5
CREATE INDEX idx_produtos_ativo ON :"verified_hml_schema".produtos(group_id, ativo);
-- source 006_produtos_base.sql statement 6
CREATE INDEX idx_produtos_grupo ON :"verified_hml_schema".produtos(grupo_produto_id);
-- source 006_produtos_base.sql statement 7
CREATE INDEX idx_produtos_marca ON :"verified_hml_schema".produtos(marca_id);
-- source 006_produtos_base.sql statement 8
CREATE INDEX idx_produtos_unidade ON :"verified_hml_schema".produtos(unidade_medida_id);
-- source 006_produtos_base.sql statement 13
ALTER TABLE :"verified_hml_schema".produtos ENABLE ROW LEVEL SECURITY;
-- source 006_produtos_base.sql statement 14
ALTER TABLE :"verified_hml_schema".produtos FORCE ROW LEVEL SECURITY;
-- source 007_produtos_master_data.sql statement 0
ALTER TABLE :"verified_hml_schema".produtos
  ADD COLUMN IF NOT EXISTS codigo_barras TEXT,
  ADD COLUMN IF NOT EXISTS tipo_item TEXT NOT NULL DEFAULT 'Revenda',
  ADD COLUMN IF NOT EXISTS tipo_aco TEXT,
  ADD COLUMN IF NOT EXISTS eh_bitola BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS peso_teorico_kg_m NUMERIC(18, 6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bitola_diametro_mm NUMERIC(18, 6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comprimento_barra_padrao_m NUMERIC(18, 6) NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS unidade_principal TEXT,
  ADD COLUMN IF NOT EXISTS unidades_secundarias JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS fatores_conversao JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS peso_liquido_kg NUMERIC(18, 6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS peso_bruto_kg NUMERIC(18, 6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS altura_cm NUMERIC(18, 6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS largura_cm NUMERIC(18, 6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comprimento_cm NUMERIC(18, 6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS volume_m3 NUMERIC(18, 9) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cest TEXT,
  ADD COLUMN IF NOT EXISTS origem_mercadoria TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Ativo',
  ADD COLUMN IF NOT EXISTS foto_produto_url TEXT,
  ADD COLUMN IF NOT EXISTS grupo_legado TEXT;
-- source 007_produtos_master_data.sql statement 1
CREATE UNIQUE INDEX uq_produtos_group_codigo_barras
  ON :"verified_hml_schema".produtos (group_id, lower(codigo_barras))
  WHERE codigo_barras IS NOT NULL AND btrim(codigo_barras) <> '';
-- source 007_produtos_master_data.sql statement 2
CREATE INDEX idx_produtos_codigo_barras
  ON :"verified_hml_schema".produtos (group_id, lower(codigo_barras))
  WHERE codigo_barras IS NOT NULL AND btrim(codigo_barras) <> '';
-- source 007_produtos_master_data.sql statement 3
CREATE INDEX idx_produtos_tipo_item
  ON :"verified_hml_schema".produtos (group_id, tipo_item);
-- source 007_produtos_master_data.sql statement 4
CREATE INDEX idx_produtos_status
  ON :"verified_hml_schema".produtos (group_id, status);
-- source 007_produtos_master_data.sql statement 5
CREATE INDEX idx_produtos_setor
  ON :"verified_hml_schema".produtos (setor_atividade_id);
-- source 012_obras.sql statement 0
CREATE TABLE :"verified_hml_schema".obras (
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
  UNIQUE (id, group_id),
  CHECK (btrim(nome) <> ''),
  CHECK (codigo ~ '^[0-9]{6}$'),
  CHECK (status IN ('ATIVA', 'PAUSADA', 'CONCLUIDA', 'CANCELADA')),
  CHECK (observacao IS NULL OR char_length(observacao) <= 500)
);
-- source 012_obras.sql statement 6
CREATE INDEX idx_obras_scope
  ON :"verified_hml_schema".obras(group_id, cliente_id, ativo);
-- source 012_obras.sql statement 7
CREATE INDEX idx_obras_status
  ON :"verified_hml_schema".obras(group_id, status, ativo);
-- source 012_obras.sql statement 8
CREATE INDEX idx_obras_updated
  ON :"verified_hml_schema".obras(group_id, updated_at DESC);
-- source 012_obras.sql statement 9
CREATE INDEX idx_obras_nome
  ON :"verified_hml_schema".obras(group_id, cliente_id, lower(nome));
-- source 012_obras.sql statement 10
ALTER TABLE :"verified_hml_schema".obras ENABLE ROW LEVEL SECURITY;
-- source 012_obras.sql statement 11
ALTER TABLE :"verified_hml_schema".obras FORCE ROW LEVEL SECURITY;
-- source 013_tabelas_preco.sql statement 0
CREATE TABLE :"verified_hml_schema".tabelas_preco (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id),
  empresa_id UUID NOT NULL REFERENCES empresas(id),
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  moeda CHAR(3) NOT NULL DEFAULT 'BRL',
  vigencia_inicio DATE NOT NULL,
  vigencia_fim DATE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  codigo_tabela_legado TEXT,
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
  CHECK (moeda = 'BRL'),
  CHECK (vigencia_fim IS NULL OR vigencia_fim >= vigencia_inicio),
  CHECK (codigo_tabela_legado IS NULL OR char_length(codigo_tabela_legado) <= 64),
  CHECK (descricao IS NULL OR char_length(descricao) <= 500),
  CHECK (
    origem IN (
      'ERP', 'MIGRACAO', 'SITE_CPA', 'B2B', 'PORTAL', 'CHATBOT',
      'WHATSAPP', 'MARKETPLACE', 'APP', 'API'
    )
  )
);
-- source 013_tabelas_preco.sql statement 1
CREATE UNIQUE INDEX uq_tabelas_preco_origem_nome_ativo
  ON :"verified_hml_schema".tabelas_preco (group_id, empresa_id, lower(btrim(nome)))
  WHERE ativo = true;
-- source 013_tabelas_preco.sql statement 7
CREATE INDEX idx_tabelas_preco_scope
  ON :"verified_hml_schema".tabelas_preco(group_id, empresa_id, ativo);
-- source 013_tabelas_preco.sql statement 8
CREATE INDEX idx_tabelas_preco_updated
  ON :"verified_hml_schema".tabelas_preco(group_id, updated_at DESC);
-- source 013_tabelas_preco.sql statement 9
CREATE INDEX idx_tabelas_preco_nome
  ON :"verified_hml_schema".tabelas_preco(group_id, lower(nome));
-- source 013_tabelas_preco.sql statement 10
CREATE INDEX idx_tabelas_preco_vigencia
  ON :"verified_hml_schema".tabelas_preco(group_id, vigencia_inicio, vigencia_fim);
-- source 013_tabelas_preco.sql statement 11
ALTER TABLE :"verified_hml_schema".tabelas_preco ENABLE ROW LEVEL SECURITY;
-- source 013_tabelas_preco.sql statement 12
ALTER TABLE :"verified_hml_schema".tabelas_preco FORCE ROW LEVEL SECURITY;
-- source 016_orcamentos_comercial_360.sql statement 0
CREATE TABLE :"verified_hml_schema".orcamentos (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), group_id UUID NOT NULL REFERENCES groups(id), empresa_id UUID NOT NULL REFERENCES empresas(id), numero VARCHAR(8) NOT NULL, status TEXT NOT NULL DEFAULT 'EM_ABERTO', cliente_empresa_id UUID NOT NULL REFERENCES cliente_empresas(id), condicao_pagamento_id UUID NOT NULL REFERENCES condicoes_pagamento(id), validade_em TIMESTAMPTZ NOT NULL, observacoes TEXT, subtotal NUMERIC(18,6) NOT NULL, desconto NUMERIC(18,6) NOT NULL DEFAULT 0, total NUMERIC(18,6) NOT NULL, ativo BOOLEAN NOT NULL DEFAULT true, created_by UUID REFERENCES profiles(id), updated_by UUID REFERENCES profiles(id), created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc',now()), updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc',now()), UNIQUE(empresa_id,numero), UNIQUE(id,group_id,empresa_id), CHECK(status IN ('EM_ABERTO','CANCELADO')), CHECK(btrim(numero) ~ '^[0-9]{8}$'), CHECK(subtotal>=0 AND desconto>=0 AND total>=0 AND desconto<=subtotal), CHECK((status='CANCELADO') = (ativo=false))
);
-- source 016_orcamentos_comercial_360.sql statement 4
CREATE INDEX idx_orcamentos_scope_page ON :"verified_hml_schema".orcamentos(group_id,empresa_id,status,numero DESC,id DESC);
-- source 016_orcamentos_comercial_360.sql statement 5
ALTER TABLE :"verified_hml_schema".orcamentos ENABLE ROW LEVEL SECURITY;
-- source 016_orcamentos_comercial_360.sql statement 6
ALTER TABLE :"verified_hml_schema".orcamentos FORCE ROW LEVEL SECURITY;
-- source 016_orcamentos_comercial_360.sql statement 8
CREATE TABLE :"verified_hml_schema".orcamento_itens (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), group_id UUID NOT NULL REFERENCES groups(id), empresa_id UUID NOT NULL REFERENCES empresas(id), orcamento_id UUID NOT NULL REFERENCES orcamentos(id), produto_id UUID NOT NULL REFERENCES produtos(id), unidade_id UUID NOT NULL REFERENCES unidades_medida(id), descricao_snapshot TEXT NOT NULL, unidade_snapshot TEXT NOT NULL, quantidade NUMERIC(18,6) NOT NULL, preco_unitario NUMERIC(18,6) NOT NULL, desconto NUMERIC(18,6) NOT NULL DEFAULT 0, subtotal NUMERIC(18,6) NOT NULL, total NUMERIC(18,6) NOT NULL, ativo BOOLEAN NOT NULL DEFAULT true, created_by UUID REFERENCES profiles(id), updated_by UUID REFERENCES profiles(id), created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc',now()), updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc',now()), FOREIGN KEY(orcamento_id,group_id,empresa_id) REFERENCES orcamentos(id,group_id,empresa_id), CHECK(btrim(descricao_snapshot)<>'' AND btrim(unidade_snapshot)<>''), CHECK(quantidade>0 AND preco_unitario>=0 AND desconto>=0 AND subtotal>=0 AND total>=0 AND desconto<=subtotal)
);
-- source 016_orcamentos_comercial_360.sql statement 12
CREATE INDEX idx_orcamento_itens_scope ON :"verified_hml_schema".orcamento_itens(group_id,empresa_id,orcamento_id,created_at);
-- source 016_orcamentos_comercial_360.sql statement 13
ALTER TABLE :"verified_hml_schema".orcamento_itens ENABLE ROW LEVEL SECURITY;
-- source 016_orcamentos_comercial_360.sql statement 14
ALTER TABLE :"verified_hml_schema".orcamento_itens FORCE ROW LEVEL SECURITY;
-- source 017_pedidos_comercial_360.sql statement 0
CREATE TABLE :"verified_hml_schema".pedidos (
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
-- source 017_pedidos_comercial_360.sql statement 4
CREATE INDEX idx_pedidos_scope_page ON :"verified_hml_schema".pedidos(group_id,empresa_id,status,numero DESC,id DESC);
-- source 017_pedidos_comercial_360.sql statement 5
CREATE INDEX idx_pedidos_entrega ON :"verified_hml_schema".pedidos(group_id,empresa_id,data_entrega_solicitada,status);
-- source 017_pedidos_comercial_360.sql statement 6
CREATE INDEX idx_pedidos_cliente ON :"verified_hml_schema".pedidos(group_id,empresa_id,cliente_empresa_id,numero DESC);
-- source 017_pedidos_comercial_360.sql statement 7
ALTER TABLE :"verified_hml_schema".pedidos ENABLE ROW LEVEL SECURITY;
-- source 017_pedidos_comercial_360.sql statement 8
ALTER TABLE :"verified_hml_schema".pedidos FORCE ROW LEVEL SECURITY;
-- source 017_pedidos_comercial_360.sql statement 10
CREATE TABLE :"verified_hml_schema".pedido_itens (
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
-- source 017_pedidos_comercial_360.sql statement 14
CREATE INDEX idx_pedido_itens_scope ON :"verified_hml_schema".pedido_itens(group_id,empresa_id,pedido_id,created_at,id);
-- source 017_pedidos_comercial_360.sql statement 15
ALTER TABLE :"verified_hml_schema".pedido_itens ENABLE ROW LEVEL SECURITY;
-- source 017_pedidos_comercial_360.sql statement 16
ALTER TABLE :"verified_hml_schema".pedido_itens FORCE ROW LEVEL SECURITY;
-- source 038_cadastros_codigo_registro.sql statement 3
ALTER TABLE :"verified_hml_schema".setores_atividade ADD COLUMN IF NOT EXISTS codigo TEXT;
-- source 038_cadastros_codigo_registro.sql statement 4
ALTER TABLE :"verified_hml_schema".setores_atividade ADD COLUMN IF NOT EXISTS codigo_origem TEXT;
-- source 038_cadastros_codigo_registro.sql statement 5
CREATE UNIQUE INDEX uq_setores_atividade_group_codigo
  ON :"verified_hml_schema".setores_atividade (group_id, lower(codigo))
  WHERE codigo IS NOT NULL AND btrim(codigo) <> '';
-- source 038_cadastros_codigo_registro.sql statement 6
ALTER TABLE :"verified_hml_schema".unidades_medida ADD COLUMN IF NOT EXISTS codigo TEXT;
-- source 038_cadastros_codigo_registro.sql statement 7
ALTER TABLE :"verified_hml_schema".unidades_medida ADD COLUMN IF NOT EXISTS codigo_origem TEXT;
-- source 038_cadastros_codigo_registro.sql statement 8
CREATE UNIQUE INDEX uq_unidades_medida_group_codigo
  ON :"verified_hml_schema".unidades_medida (group_id, lower(codigo))
  WHERE codigo IS NOT NULL AND btrim(codigo) <> '';
-- source 038_cadastros_codigo_registro.sql statement 9
ALTER TABLE :"verified_hml_schema".grupos_produto ADD COLUMN IF NOT EXISTS codigo_origem TEXT;
-- source 039_orcamentos_tabela_preco.sql statement 0
ALTER TABLE :"verified_hml_schema".orcamentos
  ADD COLUMN IF NOT EXISTS tabela_preco_id UUID REFERENCES tabelas_preco(id);
-- source 040_crm_oportunidades.sql statement 2
CREATE TABLE :"verified_hml_schema".oportunidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id),
  empresa_id UUID NOT NULL REFERENCES empresas(id),
  codigo TEXT NOT NULL CHECK (codigo ~ '^[0-9]{6,19}$'),
  codigo_oportunidade TEXT NOT NULL CHECK (length(btrim(codigo_oportunidade)) BETWEEN 1 AND 64),
  legacy_store_id TEXT CHECK (length(btrim(legacy_store_id)) BETWEEN 1 AND 180),
  idempotency_key TEXT NOT NULL CHECK (length(btrim(idempotency_key)) BETWEEN 1 AND 600),
  payload_fingerprint TEXT NOT NULL CHECK (payload_fingerprint ~ '^[a-f0-9]{64}$'),
  cliente_empresa_id UUID,
  cliente_id TEXT,
  cliente_nome TEXT,
  cliente_email TEXT,
  cliente_telefone TEXT,
  titulo TEXT NOT NULL CHECK (length(btrim(titulo)) BETWEEN 1 AND 240),
  descricao TEXT CHECK (length(descricao) <= 2000),
  responsavel TEXT CHECK (length(responsavel) <= 240),
  etapa TEXT NOT NULL CHECK (length(btrim(etapa)) BETWEEN 1 AND 60),
  status TEXT NOT NULL CHECK (length(btrim(status)) BETWEEN 1 AND 60),
  valor_estimado NUMERIC(18,6) NOT NULL CHECK (valor_estimado >= 0 AND valor_estimado <> 'NaN'::numeric),
  orcamento_cliente NUMERIC(18,6) NOT NULL DEFAULT 0 CHECK (orcamento_cliente >= 0 AND orcamento_cliente <> 'NaN'::numeric),
  probabilidade NUMERIC(5,2) NOT NULL CHECK (probabilidade BETWEEN 0 AND 100),
  temperatura TEXT NOT NULL CHECK (length(btrim(temperatura)) BETWEEN 1 AND 40),
  origem TEXT NOT NULL CHECK (length(btrim(origem)) BETWEEN 1 AND 80),
  observacoes TEXT CHECK (length(observacoes) <= 2000),
  necessidades TEXT CHECK (length(necessidades) <= 2000),
  data_abertura DATE NOT NULL,
  data_previsao DATE,
  proxima_acao TEXT CHECK (length(proxima_acao) <= 240),
  data_proxima_acao DATE,
  produtos_interesse JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(produtos_interesse)='array'),
  data_fechamento DATE,
  historico_mudancas_etapa JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(historico_mudancas_etapa) = 'array'),

  orcamento_id TEXT,
  legacy_orcamento_id TEXT,
  pedido_id TEXT,
  legacy_pedido_id TEXT,
  convertido_em TEXT CHECK (convertido_em IN ('orcamento','pedido')),
  convertido_em_id TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by UUID NOT NULL REFERENCES profiles(id),
  updated_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (id, group_id, empresa_id),
  UNIQUE (group_id, codigo),
  UNIQUE (group_id, empresa_id, codigo_oportunidade),
  UNIQUE (group_id, empresa_id, idempotency_key),
  FOREIGN KEY (empresa_id, group_id) REFERENCES empresas(id, group_id),
  FOREIGN KEY (cliente_empresa_id, group_id, empresa_id)
    REFERENCES cliente_empresas(id, group_id, empresa_id),
  CHECK (cliente_empresa_id IS NOT NULL OR COALESCE(length(btrim(cliente_nome)),0) > 0
    OR COALESCE(length(btrim(cliente_email)),0) > 0)
);
-- source 040_crm_oportunidades.sql statement 3
CREATE UNIQUE INDEX uq_oportunidades_legacy_scope
  ON :"verified_hml_schema".oportunidades(group_id, empresa_id, legacy_store_id) WHERE legacy_store_id IS NOT NULL;
-- source 040_crm_oportunidades.sql statement 4
CREATE INDEX idx_oportunidades_page
  ON :"verified_hml_schema".oportunidades(group_id, empresa_id, ativo, updated_at DESC, id DESC);
-- source 040_crm_oportunidades.sql statement 5
CREATE INDEX idx_oportunidades_cliente
  ON :"verified_hml_schema".oportunidades(group_id, empresa_id, cliente_empresa_id);
-- source 040_crm_oportunidades.sql statement 6
CREATE UNIQUE INDEX uq_oportunidades_pedido_canonico
  ON :"verified_hml_schema".oportunidades(group_id,empresa_id,convertido_em_id) WHERE convertido_em='pedido';
-- source 040_crm_oportunidades.sql statement 13
ALTER TABLE :"verified_hml_schema".oportunidades ENABLE ROW LEVEL SECURITY;
-- source 040_crm_oportunidades.sql statement 14
ALTER TABLE :"verified_hml_schema".oportunidades FORCE ROW LEVEL SECURITY;
-- source 041_produto_empresas_operacao.sql statement 0
CREATE UNIQUE INDEX uq_produtos_id_group_scope ON :"verified_hml_schema".produtos(id,group_id);
-- source 041_produto_empresas_operacao.sql statement 1
CREATE TABLE :"verified_hml_schema".produto_empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id),
  empresa_id UUID NOT NULL REFERENCES empresas(id),
  produto_id UUID NOT NULL REFERENCES produtos(id),
  ativo BOOLEAN NOT NULL DEFAULT false,
  habilitado_operacao BOOLEAN NOT NULL DEFAULT false,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
  created_by UUID NOT NULL REFERENCES profiles(id),
  updated_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc',now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc',now()),
  UNIQUE(group_id,empresa_id,produto_id),
  FOREIGN KEY(produto_id,group_id) REFERENCES produtos(id,group_id),
  FOREIGN KEY(empresa_id,group_id) REFERENCES empresas(id,group_id),
  CHECK(ativo OR NOT habilitado_operacao)
);
-- source 041_produto_empresas_operacao.sql statement 2
ALTER TABLE :"verified_hml_schema".produto_empresas ENABLE ROW LEVEL SECURITY;
-- source 041_produto_empresas_operacao.sql statement 3
ALTER TABLE :"verified_hml_schema".produto_empresas FORCE ROW LEVEL SECURITY;
-- source 043_legado_identidade_compartilhada.sql statement 1
ALTER TABLE :"verified_hml_schema".produtos ADD COLUMN IF NOT EXISTS origem text;
-- source 043_legado_identidade_compartilhada.sql statement 2
ALTER TABLE :"verified_hml_schema".produtos ADD COLUMN IF NOT EXISTS codigo_legado text;
-- source 043_legado_identidade_compartilhada.sql statement 3
ALTER TABLE :"verified_hml_schema".produtos ADD COLUMN IF NOT EXISTS legacy_id text;
-- source 043_legado_identidade_compartilhada.sql statement 4
ALTER TABLE :"verified_hml_schema".produtos ADD COLUMN IF NOT EXISTS source_system text;
-- source 043_legado_identidade_compartilhada.sql statement 5
ALTER TABLE :"verified_hml_schema".produtos ADD COLUMN IF NOT EXISTS migration_batch text;
-- source 043_legado_identidade_compartilhada.sql statement 8
CREATE UNIQUE INDEX produtos_legacy_identity_uidx
  ON :"verified_hml_schema".produtos(group_id,source_system,codigo_legado)
  WHERE source_system IS NOT NULL AND codigo_legado IS NOT NULL;
-- source 044_pedidos_idempotencia_direta.sql statement 0
ALTER TABLE :"verified_hml_schema".pedidos ADD COLUMN IF NOT EXISTS idempotency_key UUID;
-- source 044_pedidos_idempotencia_direta.sql statement 1
ALTER TABLE :"verified_hml_schema".pedidos ADD COLUMN IF NOT EXISTS payload_fingerprint TEXT;
-- source 044_pedidos_idempotencia_direta.sql statement 2
ALTER TABLE :"verified_hml_schema".pedidos ADD CONSTRAINT pedidos_idempotency_pair_check
  CHECK ((idempotency_key IS NULL AND payload_fingerprint IS NULL)
    OR (idempotency_key IS NOT NULL AND payload_fingerprint ~ '^[a-f0-9]{64}$'));
-- source 044_pedidos_idempotencia_direta.sql statement 3
CREATE UNIQUE INDEX uq_pedidos_idempotency_scope
  ON :"verified_hml_schema".pedidos(group_id, empresa_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
ROLLBACK;
