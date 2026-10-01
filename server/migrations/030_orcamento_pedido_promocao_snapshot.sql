-- ERP-COMERCIAL-360: snapshot fail-closed de promoção em Orçamento/Pedido.
-- Aditiva; sem DROP/TRUNCATE. Executar somente em CI ate gate de VPS proprio.
-- Numeracao 030: 029 = condição snapshot; 025-028 reservados por #50/#92.
-- Refs: promocao_bps + cupom + aplicada (reutiliza comercialPromocaoPolicy na API).

ALTER TABLE orcamentos
  ADD COLUMN IF NOT EXISTS promocao_bps INTEGER,
  ADD COLUMN IF NOT EXISTS promocao_cupom TEXT,
  ADD COLUMN IF NOT EXISTS promocao_aplicada BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS promocao_bps INTEGER,
  ADD COLUMN IF NOT EXISTS promocao_cupom TEXT,
  ADD COLUMN IF NOT EXISTS promocao_aplicada BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE orcamentos
  DROP CONSTRAINT IF EXISTS orcamentos_promocao_snapshot_pair;
ALTER TABLE orcamentos
  ADD CONSTRAINT orcamentos_promocao_snapshot_pair CHECK (
    (
      promocao_aplicada = false
      AND promocao_bps IS NULL
      AND promocao_cupom IS NULL
    )
    OR (
      promocao_aplicada = true
      AND promocao_bps IS NOT NULL
      AND promocao_bps > 0
      AND promocao_bps <= 10000
      AND (promocao_cupom IS NULL OR (btrim(promocao_cupom) <> '' AND char_length(promocao_cupom) <= 64))
    )
  );

ALTER TABLE pedidos
  DROP CONSTRAINT IF EXISTS pedidos_promocao_snapshot_pair;
ALTER TABLE pedidos
  ADD CONSTRAINT pedidos_promocao_snapshot_pair CHECK (
    (
      promocao_aplicada = false
      AND promocao_bps IS NULL
      AND promocao_cupom IS NULL
    )
    OR (
      promocao_aplicada = true
      AND promocao_bps IS NOT NULL
      AND promocao_bps > 0
      AND promocao_bps <= 10000
      AND (promocao_cupom IS NULL OR (btrim(promocao_cupom) <> '' AND char_length(promocao_cupom) <= 64))
    )
  );

COMMENT ON COLUMN orcamentos.promocao_bps IS 'Snapshot do desconto promocional em basis points no momento da gravacao.';
COMMENT ON COLUMN orcamentos.promocao_cupom IS 'Cupom promocional autorizado no momento da gravacao (opcional).';
COMMENT ON COLUMN orcamentos.promocao_aplicada IS 'True quando a promocao foi validada fail-closed e persistida.';
COMMENT ON COLUMN pedidos.promocao_bps IS 'Snapshot do desconto promocional em basis points no momento da gravacao.';
COMMENT ON COLUMN pedidos.promocao_cupom IS 'Cupom promocional autorizado no momento da gravacao (opcional).';
COMMENT ON COLUMN pedidos.promocao_aplicada IS 'True quando a promocao foi validada fail-closed e persistida.';

-- Rollback somente com backup/gate:
-- ALTER TABLE orcamentos DROP COLUMN IF EXISTS promocao_bps, DROP COLUMN IF EXISTS promocao_cupom, DROP COLUMN IF EXISTS promocao_aplicada;
-- ALTER TABLE pedidos DROP COLUMN IF EXISTS promocao_bps, DROP COLUMN IF EXISTS promocao_cupom, DROP COLUMN IF EXISTS promocao_aplicada;
