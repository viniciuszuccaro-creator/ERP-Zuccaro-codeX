-- Seed DEV sintetico (ERP-RUNTIME-04 Cliente MASTER DATA)
-- Sem dados reais CPA.
-- Aplicar SOMENTE apos migrations 001-009.
--
-- REGRA: nomes "A"/"B"/"TESTE B" NAO definem tenant.
-- Tenant = group_id + empresa_id exclusivamente.
--
-- Idempotencia:
--   Groups/Empresas/Marcas/Unidades/Grupos/Setores: ON CONFLICT DO NOTHING
--     (Marca LEGACY ffffffff NUNCA tem tenant alterado).
--   Produto A/B (IDs sinteticos fixos): ON CONFLICT DO UPDATE (UPSERT)
--     para convergir estado parcial (ex.: Produto B com marca_id legado).
--   Cliente PJ/PF A e PJ B: ON CONFLICT DO UPDATE somente nos IDs sinteticos abaixo.
--   SOMENTE os IDs deterministicos listados sofrem UPSERT.
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
--   Cliente PJ A: 99999999-aaaa-4aaa-8aaa-999999999991  CNPJ sintetico 11222333000181
--   Cliente PF A: 99999999-aaaa-4aaa-8aaa-999999999992  CPF sintetico 52998224725
--   Cliente PJ B: 99999999-bbbb-4bbb-8bbb-999999999993  CNPJ sintetico 34028316000103
--
-- Ordem: Groups → Empresas → Marcas → Unidades → GruposProduto → Setores → Produtos → Clientes.
-- Protecao 008 (assert_produto_fk_same_tenant) permanece ativa; sem bypass.
-- Documentos: exclusivamente sintéticos/válidos para teste — NUNCA CPF/CNPJ real.

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

-- =====================================================================
-- CLIENTES MASTER DATA (ERP-RUNTIME-04)
-- Documentos sintéticos válidos (nunca reais). UPSERT só nos IDs abaixo.
-- =====================================================================

-- Sequência de código Cliente: alinhar next_value após seeds (A=2 clientes → 3; B=1 → 2)
INSERT INTO entity_code_sequences (group_id, entity_name, next_value)
VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Cliente', 3),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Cliente', 2)
ON CONFLICT (group_id, entity_name) DO UPDATE
  SET next_value = GREATEST(entity_code_sequences.next_value, EXCLUDED.next_value),
      updated_at = timezone('utc', now());

-- Cliente PJ A (Grupo A)
INSERT INTO clientes (
  id, group_id, empresa_id, codigo, tipo, documento, documento_normalizado,
  nome, razao_social, nome_fantasia, email, telefone, status, origem, ativo
) VALUES (
  '99999999-aaaa-4aaa-8aaa-999999999991',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  '000001',
  'Pessoa Jurídica',
  '11.222.333/0001-81',
  '11222333000181',
  NULL,
  'CLIENTE DEV SINTETICO PJ A LTDA',
  'Cliente PJ A',
  'cliente.pj.a@dev.synthetic.local',
  '1130000001',
  'Ativo',
  'ERP',
  true
)
ON CONFLICT (id) DO UPDATE SET
  group_id = EXCLUDED.group_id,
  empresa_id = EXCLUDED.empresa_id,
  codigo = EXCLUDED.codigo,
  tipo = EXCLUDED.tipo,
  documento = EXCLUDED.documento,
  documento_normalizado = EXCLUDED.documento_normalizado,
  razao_social = EXCLUDED.razao_social,
  nome_fantasia = EXCLUDED.nome_fantasia,
  email = EXCLUDED.email,
  telefone = EXCLUDED.telefone,
  status = EXCLUDED.status,
  origem = EXCLUDED.origem,
  ativo = EXCLUDED.ativo,
  updated_at = timezone('utc', now())
WHERE clientes.id = '99999999-aaaa-4aaa-8aaa-999999999991';

-- Cliente PF A (Grupo A)
INSERT INTO clientes (
  id, group_id, empresa_id, codigo, tipo, documento, documento_normalizado,
  nome, razao_social, nome_fantasia, email, celular, status, origem, ativo
) VALUES (
  '99999999-aaaa-4aaa-8aaa-999999999992',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  '000002',
  'Pessoa Física',
  '529.982.247-25',
  '52998224725',
  'CLIENTE DEV SINTETICO PF A',
  NULL,
  NULL,
  'cliente.pf.a@dev.synthetic.local',
  '11990000002',
  'Ativo',
  'ERP',
  true
)
ON CONFLICT (id) DO UPDATE SET
  group_id = EXCLUDED.group_id,
  empresa_id = EXCLUDED.empresa_id,
  codigo = EXCLUDED.codigo,
  tipo = EXCLUDED.tipo,
  documento = EXCLUDED.documento,
  documento_normalizado = EXCLUDED.documento_normalizado,
  nome = EXCLUDED.nome,
  email = EXCLUDED.email,
  celular = EXCLUDED.celular,
  status = EXCLUDED.status,
  origem = EXCLUDED.origem,
  ativo = EXCLUDED.ativo,
  updated_at = timezone('utc', now())
WHERE clientes.id = '99999999-aaaa-4aaa-8aaa-999999999992';

-- Cliente PJ B (Grupo B)
INSERT INTO clientes (
  id, group_id, empresa_id, codigo, tipo, documento, documento_normalizado,
  nome, razao_social, nome_fantasia, email, telefone, status, origem, ativo
) VALUES (
  '99999999-bbbb-4bbb-8bbb-999999999993',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  '000001',
  'Pessoa Jurídica',
  '34.028.316/0001-03',
  '34028316000103',
  NULL,
  'CLIENTE DEV SINTETICO PJ B LTDA',
  'Cliente PJ B',
  'cliente.pj.b@dev.synthetic.local',
  '1130000003',
  'Ativo',
  'ERP',
  true
)
ON CONFLICT (id) DO UPDATE SET
  group_id = EXCLUDED.group_id,
  empresa_id = EXCLUDED.empresa_id,
  codigo = EXCLUDED.codigo,
  tipo = EXCLUDED.tipo,
  documento = EXCLUDED.documento,
  documento_normalizado = EXCLUDED.documento_normalizado,
  razao_social = EXCLUDED.razao_social,
  nome_fantasia = EXCLUDED.nome_fantasia,
  email = EXCLUDED.email,
  telefone = EXCLUDED.telefone,
  status = EXCLUDED.status,
  origem = EXCLUDED.origem,
  ativo = EXCLUDED.ativo,
  updated_at = timezone('utc', now())
WHERE clientes.id = '99999999-bbbb-4bbb-8bbb-999999999993';

INSERT INTO cliente_empresas (group_id, cliente_id, empresa_id, ativo)
VALUES
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '99999999-aaaa-4aaa-8aaa-999999999991',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    true
  ),
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '99999999-aaaa-4aaa-8aaa-999999999992',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    true
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '99999999-bbbb-4bbb-8bbb-999999999993',
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    true
  )
ON CONFLICT (cliente_id, empresa_id) DO NOTHING;
