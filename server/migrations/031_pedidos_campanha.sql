-- Comercial 360 Onda 5 — campanha no Pedido canônico (aditiva).
-- Alinha ao Orçamento 028; sem módulo paralelo.

ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS campanha TEXT;

ALTER TABLE pedidos DROP CONSTRAINT IF EXISTS pedidos_campanha_len_check;
ALTER TABLE pedidos
  ADD CONSTRAINT pedidos_campanha_len_check
  CHECK (campanha IS NULL OR char_length(btrim(campanha)) BETWEEN 1 AND 120);

CREATE INDEX IF NOT EXISTS idx_pedidos_campanha
  ON pedidos (group_id, empresa_id, campanha, numero DESC)
  WHERE campanha IS NOT NULL;
