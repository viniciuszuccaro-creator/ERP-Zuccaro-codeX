-- Seed DEV sintetico (ERP-RUNTIME-02)
-- Sem dados reais CPA.
-- Aplicar SOMENTE apos migrations 001-008.
-- IDs fixos para facilitar testes manuais.
-- Idempotente via ON CONFLICT DO NOTHING.

INSERT INTO groups (id, nome_do_grupo, status, observacoes)
VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Grupo DEV Sintetico A',
  'Ativo',
  'ERP-RUNTIME-02 seed'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO groups (id, nome_do_grupo, status, observacoes)
VALUES (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'Grupo DEV Sintetico B',
  'Ativo',
  'ERP-RUNTIME-02 seed isolamento'
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

INSERT INTO marcas (
  id, group_id, empresa_id, nome_marca, descricao, pais_origem, ativo
) VALUES (
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'MARCA TESTE A',
  'Seed sintetico A',
  'Brasil',
  true
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO marcas (
  id, group_id, empresa_id, nome_marca, descricao, pais_origem, ativo
) VALUES (
  'ffffffff-ffff-4fff-8fff-ffffffffffff',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'MARCA TESTE B',
  'Seed sintetico B',
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
ON CONFLICT (id) DO NOTHING;

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
  'ffffffff-ffff-4fff-8fff-ffffffffffff',
  '66666666-bbbb-4bbb-8bbb-666666666666',
  0.963,
  12.5,
  'Ativo',
  true
)
ON CONFLICT (id) DO NOTHING;
