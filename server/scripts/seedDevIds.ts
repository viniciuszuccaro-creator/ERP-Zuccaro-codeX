/**
 * Constantes do seed sintetico DEV (espelho de server/scripts/seed-dev-synthetic.sql).
 * Nomes "A"/"B" NAO definem tenant — apenas group_id/empresa_id.
 */
export const SEED_IDS = Object.freeze({
  groupA: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  groupB: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  empresaA: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
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
});
