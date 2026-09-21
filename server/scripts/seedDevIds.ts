/**
 * Constantes do seed sintetico DEV (espelho de server/scripts/seed-dev-synthetic.sql).
 * Nomes "A"/"B" NAO definem tenant — apenas group_id/empresa_id.
 */
export const SEED_IDS = Object.freeze({
  groupA: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  groupB: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  empresaA: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  empresaA2: 'c2c2c2c2-cccc-4ccc-8ccc-c2c2c2c2c2c2',
  empresaB: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  marcaA: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  /** LEGADO: historicamente nomeado "TESTE B" mas tenant = Grupo A. Nao usar em Produto B. */
  marcaLegacyFalselyNamedB: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
  /** Marca B REAL (Grupo B). */
  marcaB: 'b0b0b0b0-bbbb-4bbb-8bbb-b0b0b0b0b0b0',
  unidadeA: '11111111-aaaa-4aaa-8aaa-111111111111',
  unidadeB: '22222222-bbbb-4bbb-8bbb-222222222222',
  grupoProdutoA: '33333333-aaaa-4aaa-8aaa-333333333333',
  grupoProdutoB: '44444444-bbbb-4bbb-8bbb-444444444444',
  setorA: '55555555-aaaa-4aaa-8aaa-555555555555',
  setorB: '66666666-bbbb-4bbb-8bbb-666666666666',
  produtoA: '77777777-aaaa-4aaa-8aaa-777777777777',
  produtoB: '88888888-bbbb-4bbb-8bbb-888888888888',
  /** Cliente MASTER DATA (RUNTIME-04) — documentos sintéticos válidos, nunca reais. */
  clientePjA: '99999999-aaaa-4aaa-8aaa-999999999991',
  clientePfA: '99999999-aaaa-4aaa-8aaa-999999999992',
  clientePjB: '99999999-bbbb-4bbb-8bbb-999999999993',
  runtimeActorA: 'a4a4a4a4-aaaa-4aaa-8aaa-a4a4a4a4a4a4',
  runtimeActorB: 'b4b4b4b4-bbbb-4bbb-8bbb-b4b4b4b4b4b4',
  clienteLocalA: 'a6a6a6a6-aaaa-4aaa-8aaa-a6a6a6a6a6a6',
  clienteLocalB: 'b6b6b6b6-aaaa-4aaa-8aaa-b6b6b6b6b6b6',
  clienteLocalC: 'c6c6c6c6-aaaa-4aaa-8aaa-c6c6c6c6c6c6',
  clienteLocalB1: 'd6d6d6d6-bbbb-4bbb-8bbb-d6d6d6d6d6d6',
  obraA: 'e6e6e6e6-aaaa-4aaa-8aaa-e6e6e6e6e6e6',
  obraB: 'f6f6f6f6-bbbb-4bbb-8bbb-f6f6f6f6f6f6',
  unidadeUnA: '12121212-aaaa-4aaa-8aaa-121212121212',
  tabelaPrecoA: 'a7a7a7a7-aaaa-4aaa-8aaa-a7a7a7a7a7a7',
  tabelaPrecoB: 'b7b7b7b7-bbbb-4bbb-8bbb-b7b7b7b7b7b7',
  tabelaPrecoItemAKg: 'c7c7c7c7-aaaa-4aaa-8aaa-c7c7c7c7c7c7',
  tabelaPrecoItemAUn: 'd7d7d7d7-aaaa-4aaa-8aaa-d7d7d7d7d7d7',
  tabelaPrecoItemBKg: 'e7e7e7e7-bbbb-4bbb-8bbb-e7e7e7e7e7e7',
  condicaoPagamentoA: 'a8a8a8a8-aaaa-4aaa-8aaa-a8a8a8a8a8a8',
  condicaoPagamentoB: 'b8b8b8b8-bbbb-4bbb-8bbb-b8b8b8b8b8b8',
});

/** Documentos sintéticos do seed (normalizados). */
export const SEED_DOCS = Object.freeze({
  clientePjA: '11222333000181',
  clientePfA: '52998224725',
  clientePjB: '34028316000103',
});

/** Somente estes IDs de produto recebem ON CONFLICT DO UPDATE no seed. */
export const SEED_UPSERTABLE_PRODUTO_IDS = Object.freeze([
  SEED_IDS.produtoA,
  SEED_IDS.produtoB,
] as const);

/** Somente estes IDs de cliente recebem ON CONFLICT DO UPDATE no seed. */
export const SEED_UPSERTABLE_CLIENTE_IDS = Object.freeze([
  SEED_IDS.clientePjA,
  SEED_IDS.clientePfA,
  SEED_IDS.clientePjB,
] as const);
