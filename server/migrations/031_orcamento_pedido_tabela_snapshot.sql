-- ERP-COMERCIAL-360: snapshot imutavel de TabelaPreco (codigo+nome) em Orcamento/Pedido.
-- Aditiva; sem DROP/TRUNCATE. Executar somente em CI ate gate de VPS proprio.
-- Numeracao 031: 029=condicao, 030=promocao; evita colisao com #50/#92 (025-028).
-- Snapshot: id (FK ja existente) + codigo + nome no momento da gravacao.

ALTER TABLE orcamentos
  ADD COLUMN IF NOT EXISTS tabela_preco_codigo_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS tabela_preco_nome_snapshot TEXT;

ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS tabela_preco_codigo_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS tabela_preco_nome_snapshot TEXT;

-- Novos documentos: snapshot obrigatorio quando tabela_preco_id estiver preenchido
-- (legado pre-031 permanece nullable; pair all-null permitido).
ALTER TABLE orcamentos
  DROP CONSTRAINT IF EXISTS orcamentos_tabela_snapshot_pair;
ALTER TABLE orcamentos
  ADD CONSTRAINT orcamentos_tabela_snapshot_pair CHECK (
    (
      tabela_preco_codigo_snapshot IS NULL
      AND tabela_preco_nome_snapshot IS NULL
    )
    OR (
      btrim(tabela_preco_codigo_snapshot) <> ''
      AND btrim(tabela_preco_nome_snapshot) <> ''
    )
  );

ALTER TABLE pedidos
  DROP CONSTRAINT IF EXISTS pedidos_tabela_snapshot_pair;
ALTER TABLE pedidos
  ADD CONSTRAINT pedidos_tabela_snapshot_pair CHECK (
    (
      tabela_preco_codigo_snapshot IS NULL
      AND tabela_preco_nome_snapshot IS NULL
    )
    OR (
      btrim(tabela_preco_codigo_snapshot) <> ''
      AND btrim(tabela_preco_nome_snapshot) <> ''
    )
  );

COMMENT ON COLUMN orcamentos.tabela_preco_codigo_snapshot IS 'Snapshot imutavel do codigo da TabelaPreco no momento da gravacao.';
COMMENT ON COLUMN orcamentos.tabela_preco_nome_snapshot IS 'Snapshot imutavel do nome da TabelaPreco no momento da gravacao.';
COMMENT ON COLUMN pedidos.tabela_preco_codigo_snapshot IS 'Snapshot imutavel do codigo da TabelaPreco no momento da gravacao.';
COMMENT ON COLUMN pedidos.tabela_preco_nome_snapshot IS 'Snapshot imutavel do nome da TabelaPreco no momento da gravacao.';

-- Rollback somente com backup/gate:
-- ALTER TABLE orcamentos DROP COLUMN IF EXISTS tabela_preco_codigo_snapshot, DROP COLUMN IF EXISTS tabela_preco_nome_snapshot;
-- ALTER TABLE pedidos DROP COLUMN IF EXISTS tabela_preco_codigo_snapshot, DROP COLUMN IF EXISTS tabela_preco_nome_snapshot;
