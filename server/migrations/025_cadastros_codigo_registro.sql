-- Código de registro numérico (sequência canônica por grupo) para auxiliares Cadastros Gerais.
-- Preserva códigos alfanuméricos já existentes; atribui numérico determinístico aos sem código.
-- Escopo: group_id (Grupo). Não renumerar silenciosamente.

-- marcas
ALTER TABLE marcas ADD COLUMN IF NOT EXISTS codigo TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_marcas_group_codigo
  ON marcas (group_id, lower(codigo))
  WHERE codigo IS NOT NULL AND btrim(codigo) <> '';

-- setores_atividade
ALTER TABLE setores_atividade ADD COLUMN IF NOT EXISTS codigo TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_setores_atividade_group_codigo
  ON setores_atividade (group_id, lower(codigo))
  WHERE codigo IS NOT NULL AND btrim(codigo) <> '';

-- unidades_medida (sigla permanece chave de negócio; codigo = registro sequencial)
ALTER TABLE unidades_medida ADD COLUMN IF NOT EXISTS codigo TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_unidades_medida_group_codigo
  ON unidades_medida (group_id, lower(codigo))
  WHERE codigo IS NOT NULL AND btrim(codigo) <> '';

-- Backfill determinístico: só linhas sem código; ordem created_at, id.
-- Usa high-water por grupo a partir do maior código numérico puro já existente.
WITH max_marca AS (
  SELECT group_id,
         COALESCE(MAX(CASE WHEN codigo ~ '^[0-9]+$' THEN codigo::bigint END), 0) AS hw
  FROM marcas
  GROUP BY group_id
),
ranked_marca AS (
  SELECT m.id, m.group_id,
         ROW_NUMBER() OVER (PARTITION BY m.group_id ORDER BY m.created_at, m.id) AS rn,
         COALESCE(mx.hw, 0) AS hw
  FROM marcas m
  LEFT JOIN max_marca mx ON mx.group_id = m.group_id
  WHERE m.codigo IS NULL OR btrim(m.codigo) = ''
)
UPDATE marcas m
SET codigo = lpad((r.hw + r.rn)::text, 6, '0')
FROM ranked_marca r
WHERE m.id = r.id;

WITH max_setor AS (
  SELECT group_id,
         COALESCE(MAX(CASE WHEN codigo ~ '^[0-9]+$' THEN codigo::bigint END), 0) AS hw
  FROM setores_atividade
  GROUP BY group_id
),
ranked_setor AS (
  SELECT s.id, s.group_id,
         ROW_NUMBER() OVER (PARTITION BY s.group_id ORDER BY s.created_at, s.id) AS rn,
         COALESCE(mx.hw, 0) AS hw
  FROM setores_atividade s
  LEFT JOIN max_setor mx ON mx.group_id = s.group_id
  WHERE s.codigo IS NULL OR btrim(s.codigo) = ''
)
UPDATE setores_atividade s
SET codigo = lpad((r.hw + r.rn)::text, 6, '0')
FROM ranked_setor r
WHERE s.id = r.id;

WITH max_um AS (
  SELECT group_id,
         COALESCE(MAX(CASE WHEN codigo ~ '^[0-9]+$' THEN codigo::bigint END), 0) AS hw
  FROM unidades_medida
  GROUP BY group_id
),
ranked_um AS (
  SELECT u.id, u.group_id,
         ROW_NUMBER() OVER (PARTITION BY u.group_id ORDER BY u.created_at, u.id) AS rn,
         COALESCE(mx.hw, 0) AS hw
  FROM unidades_medida u
  LEFT JOIN max_um mx ON mx.group_id = u.group_id
  WHERE u.codigo IS NULL OR btrim(u.codigo) = ''
)
UPDATE unidades_medida u
SET codigo = lpad((r.hw + r.rn)::text, 6, '0')
FROM ranked_um r
WHERE u.id = r.id;

-- High-water em entity_code_sequences (não retrocede)
INSERT INTO entity_code_sequences (group_id, entity_name, next_value)
SELECT group_id, 'Marca',
       COALESCE(MAX(CASE WHEN codigo ~ '^[0-9]+$' THEN codigo::bigint END), 0) + 1
FROM marcas
GROUP BY group_id
ON CONFLICT (group_id, entity_name) DO UPDATE
SET next_value = GREATEST(entity_code_sequences.next_value, EXCLUDED.next_value),
    updated_at = timezone('utc', now());

INSERT INTO entity_code_sequences (group_id, entity_name, next_value)
SELECT group_id, 'SetorAtividade',
       COALESCE(MAX(CASE WHEN codigo ~ '^[0-9]+$' THEN codigo::bigint END), 0) + 1
FROM setores_atividade
GROUP BY group_id
ON CONFLICT (group_id, entity_name) DO UPDATE
SET next_value = GREATEST(entity_code_sequences.next_value, EXCLUDED.next_value),
    updated_at = timezone('utc', now());

INSERT INTO entity_code_sequences (group_id, entity_name, next_value)
SELECT group_id, 'UnidadeMedida',
       COALESCE(MAX(CASE WHEN codigo ~ '^[0-9]+$' THEN codigo::bigint END), 0) + 1
FROM unidades_medida
GROUP BY group_id
ON CONFLICT (group_id, entity_name) DO UPDATE
SET next_value = GREATEST(entity_code_sequences.next_value, EXCLUDED.next_value),
    updated_at = timezone('utc', now());

INSERT INTO entity_code_sequences (group_id, entity_name, next_value)
SELECT group_id, 'GrupoProduto',
       COALESCE(MAX(CASE WHEN codigo ~ '^[0-9]+$' THEN codigo::bigint END), 0) + 1
FROM grupos_produto
GROUP BY group_id
ON CONFLICT (group_id, entity_name) DO UPDATE
SET next_value = GREATEST(entity_code_sequences.next_value, EXCLUDED.next_value),
    updated_at = timezone('utc', now());
