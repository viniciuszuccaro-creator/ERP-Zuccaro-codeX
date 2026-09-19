-- ERP-RUNTIME-07B: TabelaPreco canônica (cabeçalho + N:N empresas + itens).
-- Não altera migrations 001-012. Aditivo em cliente_empresas.tabela_preco_id.
-- Sem Pedido/Orçamento/faixas/reajuste/cópia. Sem policy RLS permissiva.

CREATE TABLE IF NOT EXISTS tabelas_preco (
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

-- Nome: NÃO único no Grupo. Proteção opcional só por empresa ORIGEM
-- (Empresas A e A2 podem ter ATACADO ativas independentemente).
CREATE UNIQUE INDEX IF NOT EXISTS uq_tabelas_preco_origem_nome_ativo
  ON tabelas_preco (group_id, empresa_id, lower(btrim(nome)))
  WHERE ativo = true;

CREATE OR REPLACE FUNCTION assert_tabela_preco_same_tenant()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM empresas e
    WHERE e.id = NEW.empresa_id AND e.group_id = NEW.group_id
  ) THEN
    RAISE EXCEPTION 'TENANT_FK_MISMATCH: empresa_id % does not belong to group_id %',
      NEW.empresa_id, NEW.group_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tabelas_preco_tenant ON tabelas_preco;
CREATE TRIGGER trg_tabelas_preco_tenant
  BEFORE INSERT OR UPDATE OF group_id, empresa_id ON tabelas_preco
  FOR EACH ROW EXECUTE PROCEDURE assert_tabela_preco_same_tenant();

DROP TRIGGER IF EXISTS trg_tabelas_preco_updated_at ON tabelas_preco;
CREATE TRIGGER trg_tabelas_preco_updated_at
  BEFORE UPDATE ON tabelas_preco
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

CREATE INDEX IF NOT EXISTS idx_tabelas_preco_scope
  ON tabelas_preco(group_id, empresa_id, ativo);
CREATE INDEX IF NOT EXISTS idx_tabelas_preco_updated
  ON tabelas_preco(group_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_tabelas_preco_nome
  ON tabelas_preco(group_id, lower(nome));
CREATE INDEX IF NOT EXISTS idx_tabelas_preco_vigencia
  ON tabelas_preco(group_id, vigencia_inicio, vigencia_fim);

ALTER TABLE tabelas_preco ENABLE ROW LEVEL SECURITY;
ALTER TABLE tabelas_preco FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE tabelas_preco FROM PUBLIC;

CREATE TABLE IF NOT EXISTS tabela_preco_empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id),
  tabela_preco_id UUID NOT NULL REFERENCES tabelas_preco(id),
  empresa_id UUID NOT NULL REFERENCES empresas(id),
  eh_padrao BOOLEAN NOT NULL DEFAULT false,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now())),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now())),
  UNIQUE (tabela_preco_id, empresa_id),
  CHECK (eh_padrao = false OR ativo = true),
  FOREIGN KEY (tabela_preco_id, group_id) REFERENCES tabelas_preco(id, group_id)
);

-- No máximo um padrão ativo por Empresa.
CREATE UNIQUE INDEX IF NOT EXISTS uq_tabela_preco_empresas_padrao_ativo
  ON tabela_preco_empresas (empresa_id)
  WHERE eh_padrao = true AND ativo = true;

CREATE OR REPLACE FUNCTION assert_tabela_preco_empresa_same_tenant()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM tabelas_preco t
    WHERE t.id = NEW.tabela_preco_id AND t.group_id = NEW.group_id
  ) THEN
    RAISE EXCEPTION 'TENANT_FK_MISMATCH: tabela_preco_id % does not belong to group_id %',
      NEW.tabela_preco_id, NEW.group_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM empresas e
    WHERE e.id = NEW.empresa_id AND e.group_id = NEW.group_id
  ) THEN
    RAISE EXCEPTION 'TENANT_FK_MISMATCH: empresa_id % does not belong to group_id %',
      NEW.empresa_id, NEW.group_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tabela_preco_empresas_tenant ON tabela_preco_empresas;
CREATE TRIGGER trg_tabela_preco_empresas_tenant
  BEFORE INSERT OR UPDATE OF group_id, tabela_preco_id, empresa_id ON tabela_preco_empresas
  FOR EACH ROW EXECUTE PROCEDURE assert_tabela_preco_empresa_same_tenant();

DROP TRIGGER IF EXISTS trg_tabela_preco_empresas_updated_at ON tabela_preco_empresas;
CREATE TRIGGER trg_tabela_preco_empresas_updated_at
  BEFORE UPDATE ON tabela_preco_empresas
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

CREATE INDEX IF NOT EXISTS idx_tabela_preco_empresas_empresa
  ON tabela_preco_empresas(group_id, empresa_id, ativo);
CREATE INDEX IF NOT EXISTS idx_tabela_preco_empresas_tabela
  ON tabela_preco_empresas(tabela_preco_id, ativo);

ALTER TABLE tabela_preco_empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE tabela_preco_empresas FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE tabela_preco_empresas FROM PUBLIC;

CREATE TABLE IF NOT EXISTS tabela_preco_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id),
  tabela_preco_id UUID NOT NULL REFERENCES tabelas_preco(id),
  produto_id UUID NOT NULL REFERENCES produtos(id),
  unidade_medida_id UUID NOT NULL REFERENCES unidades_medida(id),
  preco NUMERIC(18, 6) NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now())),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now())),
  UNIQUE (tabela_preco_id, produto_id, unidade_medida_id),
  CHECK (preco >= 0),
  FOREIGN KEY (tabela_preco_id, group_id) REFERENCES tabelas_preco(id, group_id)
);

CREATE OR REPLACE FUNCTION assert_tabela_preco_item_same_tenant()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM tabelas_preco t
    WHERE t.id = NEW.tabela_preco_id AND t.group_id = NEW.group_id
  ) THEN
    RAISE EXCEPTION 'TENANT_FK_MISMATCH: tabela_preco_id % does not belong to group_id %',
      NEW.tabela_preco_id, NEW.group_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM produtos p
    WHERE p.id = NEW.produto_id AND p.group_id = NEW.group_id
  ) THEN
    RAISE EXCEPTION 'TENANT_FK_MISMATCH: produto_id % does not belong to group_id %',
      NEW.produto_id, NEW.group_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM unidades_medida u
    WHERE u.id = NEW.unidade_medida_id AND u.group_id = NEW.group_id
  ) THEN
    RAISE EXCEPTION 'TENANT_FK_MISMATCH: unidade_medida_id % does not belong to group_id %',
      NEW.unidade_medida_id, NEW.group_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tabela_preco_itens_tenant ON tabela_preco_itens;
CREATE TRIGGER trg_tabela_preco_itens_tenant
  BEFORE INSERT OR UPDATE OF group_id, tabela_preco_id, produto_id, unidade_medida_id
  ON tabela_preco_itens
  FOR EACH ROW EXECUTE PROCEDURE assert_tabela_preco_item_same_tenant();

DROP TRIGGER IF EXISTS trg_tabela_preco_itens_updated_at ON tabela_preco_itens;
CREATE TRIGGER trg_tabela_preco_itens_updated_at
  BEFORE UPDATE ON tabela_preco_itens
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

CREATE INDEX IF NOT EXISTS idx_tabela_preco_itens_tabela
  ON tabela_preco_itens(tabela_preco_id, ativo);
CREATE INDEX IF NOT EXISTS idx_tabela_preco_itens_produto
  ON tabela_preco_itens(group_id, produto_id);
CREATE INDEX IF NOT EXISTS idx_tabela_preco_itens_unidade
  ON tabela_preco_itens(produto_id, unidade_medida_id);

ALTER TABLE tabela_preco_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE tabela_preco_itens FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE tabela_preco_itens FROM PUBLIC;

-- Slot comercial no vínculo Cliente × Empresa (não no Cliente master).
ALTER TABLE cliente_empresas
  ADD COLUMN IF NOT EXISTS tabela_preco_id UUID;

CREATE OR REPLACE FUNCTION assert_cliente_empresa_tabela_preco()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tabela_preco_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM tabelas_preco t
    JOIN tabela_preco_empresas te
      ON te.tabela_preco_id = t.id
     AND te.group_id = t.group_id
    WHERE t.id = NEW.tabela_preco_id
      AND t.group_id = NEW.group_id
      AND te.empresa_id = NEW.empresa_id
      AND te.ativo = true
  ) THEN
    RAISE EXCEPTION
      'TABELA_PRECO_NOT_AUTHORIZED: tabela_preco_id % not authorized for empresa_id % in group_id %',
      NEW.tabela_preco_id, NEW.empresa_id, NEW.group_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cliente_empresas_tabela_preco ON cliente_empresas;
CREATE TRIGGER trg_cliente_empresas_tabela_preco
  BEFORE INSERT OR UPDATE OF tabela_preco_id, group_id, empresa_id ON cliente_empresas
  FOR EACH ROW EXECUTE PROCEDURE assert_cliente_empresa_tabela_preco();

CREATE INDEX IF NOT EXISTS idx_cliente_empresas_tabela_preco
  ON cliente_empresas (group_id, tabela_preco_id)
  WHERE tabela_preco_id IS NOT NULL;

COMMENT ON TABLE tabelas_preco IS
  'ERP-RUNTIME-07B TabelaPreco. Ownership group+empresa origem; uso via tabela_preco_empresas.';
COMMENT ON TABLE tabela_preco_empresas IS
  'ERP-RUNTIME-07B autorização N:N + eh_padrao único ativo por empresa.';
COMMENT ON TABLE tabela_preco_itens IS
  'ERP-RUNTIME-07B item = produto + unidade; NUMERIC(18,6); sem master duplicado.';
COMMENT ON COLUMN cliente_empresas.tabela_preco_id IS
  'Tabela específica do vínculo; NULL = fallback para padrão da Empresa.';
