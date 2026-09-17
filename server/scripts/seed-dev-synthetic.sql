-- Seed DEV sintetico (ERP-RUNTIME-03 seed reconciliation fix)
-- Sem dados reais CPA.
-- Aplicar SOMENTE apos migrations 001-008.
--
-- REGRA: nomes "A"/"B"/"TESTE B" NAO definem tenant.
-- Tenant = group_id + empresa_id exclusivamente.
--
-- Idempotencia:
--   Groups/Empresas/Marcas/Unidades/Grupos/Setores: ON CONFLICT DO NOTHING
--     (Marca LEGACY ffffffff NUNCA tem tenant alterado).
--   Produto A/B (IDs sinteticos fixos): ON CONFLICT DO UPDATE (UPSERT)
--     para convergir estado parcial (ex.: Produto B com marca_id legado).
--   SOMENTE os IDs deterministicos abaixo sofrem UPSERT de produto.
--   Registros reais / IDs nao listados NUNCA sao tocados.
--
-- IDs canonicos:
--   Grupo A:    aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa
--   Grupo B:    bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb
--   Empresa A:  cccccccc-cccc-4ccc-8ccc-cccccccccccc
--   Empresa B:  dddddddd-dddd-4ddd-8ddd-dddddddddddd
--   Marca A:    eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee  (Grupo A)
--   Marca LEGACY id ffffffff-ffff-4fff-8fff-ffffffffffff:
--     historico RUNTIME-01/02 em DEV pode existir como Grupo A
--     (nome "MARCA TESTE B" NAO implica Grupo B). NAO mover tenant.
--     Neste seed: se ainda nao existir, cria como Grupo A (legado).
--   Marca B REAL: b0b0b0b0-bbbb-4bbb-8bbb-b0b0b0b0b0b0 (Grupo B)
--     Usada por Produto B. Nunca reutilizar ffffffff para Grupo B.
--   Unidade A/B, GrupoProduto A/B, Setor A/B: IDs abaixo, tenant correto.
--   Produto A: 77777777-aaaa-4aaa-8aaa-777777777777  FKs somente Grupo A
--   Produto B: 88888888-bbbb-4bbb-8bbb-888888888888  FKs somente Grupo B
--
-- Ordem: Groups → Empresas → Marcas → Unidades → GruposProduto → Setores → Produtos.
-- Protecao 008 (assert_produto_fk_same_tenant) permanece ativa; sem bypass.

INSERT INTO groups (id, nome_do_grupo, status, observacoes)
VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Grupo DEV Sintetico A',
  'Ativo',
  'ERP-RUNTIME-03 seed'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO groups (id, nome_do_grupo, status, observacoes)
VALUES (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'Grupo DEV Sintetico B',
  'Ativo',
  'ERP-RUNTIME-03 seed isolamento'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO empresas (id, group_id, razao_social, nome_fantasia, cnpj, status)
VALUES (
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Empresa DEV Sintetica A LTDA',
  'Empresa DEV A',
  NULL,
  'Ativa'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO empresas (id, group_id, razao_social, nome_fantasia, cnpj, status)
VALUES (
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'Empresa DEV Sintetica B LTDA',
  'Empresa DEV B',
  NULL,
  'Ativa'
)
ON CONFLICT (id) DO NOTHING;

-- Marca A (Grupo A)
INSERT INTO marcas (
  id, group_id, empresa_id, nome_marca, descricao, pais_origem, ativo
) VALUES (
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'MARCA TESTE A',
  'Seed sintetico A — tenant Grupo A',
  'Brasil',
  true
)
ON CONFLICT (id) DO NOTHING;

-- Marca LEGACY id ffffffff: permanece/cria no Grupo A.
-- Nome historico "MARCA TESTE B" NAO define tenant. NUNCA UPSERT de tenant.
INSERT INTO marcas (
  id, group_id, empresa_id, nome_marca, descricao, pais_origem, ativo
) VALUES (
  'ffffffff-ffff-4fff-8fff-ffffffffffff',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'MARCA TESTE B LEGACY',
  'LEGADO: id ffffffff no Grupo A. Nao usar em Produto B. Nao mover tenant.',
  'Brasil',
  true
)
ON CONFLICT (id) DO NOTHING;

-- Marca B REAL (Grupo B) — ID novo deterministico
INSERT INTO marcas (
  id, group_id, empresa_id, nome_marca, descricao, pais_origem, ativo
) VALUES (
  'b0b0b0b0-bbbb-4bbb-8bbb-b0b0b0b0b0b0',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'MARCA DEV SINTETICA B',
  'Seed sintetico B — tenant Grupo B (nao confundir com ffffffff legado)',
  'Brasil',
  true
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO unidades_medida (
  id, group_id, empresa_id, sigla, nome_completo, tipo_grandeza, ativo
) VALUES (
  '11111111-aaaa-4aaa-8aaa-111111111111',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'KG',
  'Quilograma',
  'Massa',
  true
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO unidades_medida (
  id, group_id, empresa_id, sigla, nome_completo, tipo_grandeza, ativo
) VALUES (
  '22222222-bbbb-4bbb-8bbb-222222222222',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'KG',
  'Quilograma',
  'Massa',
  true
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO grupos_produto (
  id, group_id, empresa_id, nome_grupo, codigo, natureza, ativo
) VALUES (
  '33333333-aaaa-4aaa-8aaa-333333333333',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'Longos Sintetico A',
  'LG-A',
  'Revenda',
  true
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO grupos_produto (
  id, group_id, empresa_id, nome_grupo, codigo, natureza, ativo
) VALUES (
  '44444444-bbbb-4bbb-8bbb-444444444444',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'Longos Sintetico B',
  'LG-B',
  'Revenda',
  true
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO setores_atividade (
  id, group_id, empresa_id, nome, tipo_operacao, ativo
) VALUES (
  '55555555-aaaa-4aaa-8aaa-555555555555',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'Construcao Civil A',
  'Revenda',
  true
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO setores_atividade (
  id, group_id, empresa_id, nome, tipo_operacao, ativo
) VALUES (
  '66666666-bbbb-4bbb-8bbb-666666666666',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'Construcao Civil B',
  'Revenda',
  true
)
ON CONFLICT (id) DO NOTHING;

-- Produto A: UPSERT apenas no ID sintetico 77777777-...
INSERT INTO produtos (
  id, group_id, empresa_id, codigo, descricao, nome, tipo_item, eh_bitola,
  unidade_medida_id, unidade_principal, grupo_produto_id, marca_id, setor_atividade_id,
  peso_teorico_kg_m, bitola_diametro_mm, status, ativo
) VALUES (
  '77777777-aaaa-4aaa-8aaa-777777777777',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'PROD-A-001',
  'PRODUTO DEV SINTETICO A',
  'PRODUTO DEV SINTETICO A',
  'Revenda',
  true,
  '11111111-aaaa-4aaa-8aaa-111111111111',
  'KG',
  '33333333-aaaa-4aaa-8aaa-333333333333',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  '55555555-aaaa-4aaa-8aaa-555555555555',
  0.963,
  12.5,
  'Ativo',
  true
)
ON CONFLICT (id) DO UPDATE SET
  group_id = EXCLUDED.group_id,
  empresa_id = EXCLUDED.empresa_id,
  codigo = EXCLUDED.codigo,
  descricao = EXCLUDED.descricao,
  nome = EXCLUDED.nome,
  tipo_item = EXCLUDED.tipo_item,
  eh_bitola = EXCLUDED.eh_bitola,
  unidade_medida_id = EXCLUDED.unidade_medida_id,
  unidade_principal = EXCLUDED.unidade_principal,
  grupo_produto_id = EXCLUDED.grupo_produto_id,
  marca_id = EXCLUDED.marca_id,
  setor_atividade_id = EXCLUDED.setor_atividade_id,
  peso_teorico_kg_m = EXCLUDED.peso_teorico_kg_m,
  bitola_diametro_mm = EXCLUDED.bitola_diametro_mm,
  status = EXCLUDED.status,
  ativo = EXCLUDED.ativo,
  updated_at = timezone('utc', now())
WHERE produtos.id = '77777777-aaaa-4aaa-8aaa-777777777777';

-- Produto B: UPSERT apenas no ID sintetico 88888888-...
-- Reconcilia partial-state (marca_id legado ffffffff → Marca B REAL).
INSERT INTO produtos (
  id, group_id, empresa_id, codigo, descricao, nome, tipo_item, eh_bitola,
  unidade_medida_id, unidade_principal, grupo_produto_id, marca_id, setor_atividade_id,
  peso_teorico_kg_m, bitola_diametro_mm, status, ativo
) VALUES (
  '88888888-bbbb-4bbb-8bbb-888888888888',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'PROD-B-001',
  'PRODUTO DEV SINTETICO B',
  'PRODUTO DEV SINTETICO B',
  'Revenda',
  true,
  '22222222-bbbb-4bbb-8bbb-222222222222',
  'KG',
  '44444444-bbbb-4bbb-8bbb-444444444444',
  'b0b0b0b0-bbbb-4bbb-8bbb-b0b0b0b0b0b0',
  '66666666-bbbb-4bbb-8bbb-666666666666',
  0.963,
  12.5,
  'Ativo',
  true
)
ON CONFLICT (id) DO UPDATE SET
  group_id = EXCLUDED.group_id,
  empresa_id = EXCLUDED.empresa_id,
  codigo = EXCLUDED.codigo,
  descricao = EXCLUDED.descricao,
  nome = EXCLUDED.nome,
  tipo_item = EXCLUDED.tipo_item,
  eh_bitola = EXCLUDED.eh_bitola,
  unidade_medida_id = EXCLUDED.unidade_medida_id,
  unidade_principal = EXCLUDED.unidade_principal,
  grupo_produto_id = EXCLUDED.grupo_produto_id,
  marca_id = EXCLUDED.marca_id,
  setor_atividade_id = EXCLUDED.setor_atividade_id,
  peso_teorico_kg_m = EXCLUDED.peso_teorico_kg_m,
  bitola_diametro_mm = EXCLUDED.bitola_diametro_mm,
  status = EXCLUDED.status,
  ativo = EXCLUDED.ativo,
  updated_at = timezone('utc', now())
WHERE produtos.id = '88888888-bbbb-4bbb-8bbb-888888888888';
