-- ERP-RUNTIME-03: Produto MASTER DATA aditivo (sem estoque/custo/preço/fiscal operacional)
-- 001-006 IMUTAVEIS. Nao recria tabela produtos.

ALTER TABLE produtos
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

-- Unicidade de codigo_barras por grupo (quando preenchido)
CREATE UNIQUE INDEX IF NOT EXISTS uq_produtos_group_codigo_barras
  ON produtos (group_id, lower(codigo_barras))
  WHERE codigo_barras IS NOT NULL AND btrim(codigo_barras) <> '';

CREATE INDEX IF NOT EXISTS idx_produtos_codigo_barras
  ON produtos (group_id, lower(codigo_barras))
  WHERE codigo_barras IS NOT NULL AND btrim(codigo_barras) <> '';

CREATE INDEX IF NOT EXISTS idx_produtos_tipo_item
  ON produtos (group_id, tipo_item);

CREATE INDEX IF NOT EXISTS idx_produtos_status
  ON produtos (group_id, status);

CREATE INDEX IF NOT EXISTS idx_produtos_setor
  ON produtos (setor_atividade_id);

COMMENT ON TABLE produtos IS 'ERP-RUNTIME-03 MASTER DATA. Sem saldo/custo/preço/movimentação/fiscal operacional.';
COMMENT ON COLUMN produtos.unidades_secundarias IS 'JSON array de siglas (master). Sem fatores CPA reais.';
COMMENT ON COLUMN produtos.fatores_conversao IS 'JSON opcional de fatores cadastrais. Sem inventar fatores reais CPA.';
COMMENT ON COLUMN produtos.grupo_legado IS 'Texto legado do form (grupo). Preferir grupo_produto_id.';
