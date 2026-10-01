import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import type { DbClient, DbQueryExecutor } from '../src/db/client.ts';
import { PostgresPedidoRepository } from '../src/repositories/postgresPedidoRepository.ts';

test('PostgreSQL efemero: leitura de Pedido para Expedição trava linha e isola Empresa', async () => {
  const pg = new PGlite();
  const groupId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const empresaId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const pedidoId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  try {
    await pg.exec(`
      CREATE TABLE pedidos (
        id uuid PRIMARY KEY, group_id uuid NOT NULL, empresa_id uuid NOT NULL,
        numero text NOT NULL, status text NOT NULL, ativo boolean NOT NULL,
        cliente_empresa_id uuid NOT NULL, cliente_local_id uuid, obra_id uuid,
        tabela_preco_id uuid, condicao_pagamento_id uuid NOT NULL, orcamento_id uuid,
        vendedor_id uuid NOT NULL, tipo_operacao text NOT NULL, data_entrega_solicitada timestamptz NOT NULL,
        observacoes text, subtotal numeric NOT NULL, desconto numeric NOT NULL, total numeric NOT NULL,
        created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL
      );
      CREATE TABLE pedido_itens (
        id uuid PRIMARY KEY, pedido_id uuid NOT NULL, group_id uuid NOT NULL, empresa_id uuid NOT NULL,
        produto_id uuid NOT NULL, unidade_id uuid NOT NULL, descricao_snapshot text NOT NULL,
        unidade_snapshot text NOT NULL, quantidade numeric NOT NULL, preco_unitario numeric NOT NULL,
        desconto numeric NOT NULL, subtotal numeric NOT NULL, total numeric NOT NULL,
        requer_producao boolean NOT NULL, created_at timestamptz NOT NULL
      );
    `);
    await pg.query(`INSERT INTO pedidos VALUES
      ($1,$2,$3,'00000042','PRONTO_ENTREGA',true,$4,null,null,null,$5,null,$6,
       'ENTREGA','2027-04-01T12:00:00Z',null,10,0,10,now(),now())`,
    [pedidoId, groupId, empresaId, '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333']);
    const repo = new PostgresPedidoRepository(pg as unknown as DbClient);
    const executor = pg as unknown as DbQueryExecutor;
    const own = await repo.getForExpedicao({ groupId, empresaId }, pedidoId, executor);
    assert.equal(own?.numero, '00000042');
    assert.equal(own?.status, 'PRONTO_ENTREGA');
    assert.equal(await repo.getForExpedicao({ groupId, empresaId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' }, pedidoId, executor), null);
    assert.equal(await repo.getForExpedicao({ groupId: 'ffffffff-ffff-4fff-8fff-ffffffffffff', empresaId }, pedidoId, executor), null);
  } finally {
    await pg.close();
  }
});
