-- Preserves the source product code independently of the canonical ERP code.
-- Intentionally not unique: legacy collisions require explicit reconciliation.
ALTER TABLE produtos ADD COLUMN codigo_legado TEXT;
ALTER TABLE produtos ADD CONSTRAINT produtos_codigo_legado_nonblank
  CHECK (codigo_legado IS NULL OR (length(btrim(codigo_legado)) BETWEEN 1 AND 80));
CREATE INDEX produtos_group_codigo_legado_idx
  ON produtos (group_id, codigo_legado) WHERE codigo_legado IS NOT NULL;
