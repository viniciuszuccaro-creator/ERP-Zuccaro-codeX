-- Piloto ERP-RUNTIME-01: Marca (cadastro simples, fora de financeiro/fiscal/estoque)

CREATE TABLE IF NOT EXISTS marcas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id),
  empresa_id UUID REFERENCES empresas(id),
  nome_marca TEXT NOT NULL,
  descricao TEXT,
  cnpj TEXT,
  pais_origem TEXT,
  site TEXT,
  logo_url TEXT,
  categoria TEXT,
  fornecedor_id UUID,
  certificacoes JSONB NOT NULL DEFAULT '[]'::jsonb,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now())),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now()))
);

CREATE INDEX IF NOT EXISTS idx_marcas_group_id ON marcas(group_id);
CREATE INDEX IF NOT EXISTS idx_marcas_empresa_id ON marcas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_marcas_nome ON marcas(group_id, lower(nome_marca));
CREATE INDEX IF NOT EXISTS idx_marcas_ativo ON marcas(group_id, ativo);

DROP TRIGGER IF EXISTS trg_marcas_updated_at ON marcas;
CREATE TRIGGER trg_marcas_updated_at
  BEFORE UPDATE ON marcas
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

ALTER TABLE marcas ENABLE ROW LEVEL SECURITY;
ALTER TABLE marcas FORCE ROW LEVEL SECURITY;
