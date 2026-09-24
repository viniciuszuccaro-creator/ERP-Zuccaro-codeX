-- Campos universais do Produto mestre. Sem backfill ou alteracao de registros legados.
ALTER TABLE produtos
  ADD COLUMN IF NOT EXISTS material TEXT,
  ADD COLUMN IF NOT EXISTS liga TEXT,
  ADD COLUMN IF NOT EXISTS norma_tecnica TEXT;

ALTER TABLE produtos ADD CONSTRAINT produtos_material_length_check
  CHECK (material IS NULL OR length(material) BETWEEN 1 AND 120);
ALTER TABLE produtos ADD CONSTRAINT produtos_liga_length_check
  CHECK (liga IS NULL OR length(liga) BETWEEN 1 AND 80);
ALTER TABLE produtos ADD CONSTRAINT produtos_norma_tecnica_length_check
  CHECK (norma_tecnica IS NULL OR length(norma_tecnica) BETWEEN 1 AND 120);
