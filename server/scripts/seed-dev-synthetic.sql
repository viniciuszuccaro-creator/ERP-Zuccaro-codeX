-- Seed DEV sintetico (ERP-DEV-DEPLOY-01)
-- Sem dados reais CPA.
-- Aplicar SOMENTE apos migrations 001-003.
-- IDs fixos para facilitar testes manuais.

INSERT INTO groups (id, nome_do_grupo, status, observacoes)
VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Grupo DEV Sintetico A',
  'Ativo',
  'ERP-DEV-DEPLOY-01 seed'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO groups (id, nome_do_grupo, status, observacoes)
VALUES (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'Grupo DEV Sintetico B',
  'Ativo',
  'ERP-DEV-DEPLOY-01 seed isolamento'
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
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'MARCA TESTE B',
  'Seed sintetico B',
  'Brasil',
  true
)
ON CONFLICT (id) DO NOTHING;
