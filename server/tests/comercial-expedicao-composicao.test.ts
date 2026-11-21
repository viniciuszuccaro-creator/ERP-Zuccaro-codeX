import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { localCrmFixture } from './helpers/crmFixture.ts';
import { realCrmFixture } from './helpers/crmPostgresFixture.ts';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config/env.ts';
import { SEED_IDS as ID } from '../scripts/seedDevIds.ts';
import { PostgresExpedicaoEstoquePort, PostgresExpedicaoPedidoPort } from '../src/integrations/expedicaoPersistentPorts.ts';
import { projetarParcelasFaturamento, quantizarTotalPedidoParaFaturamento } from '../src/services/faturamentoParcelasPolicy.ts';
import { PostgresAuditRepository } from '../src/audit/auditRepository.ts';
import type { DbClient, DbQueryExecutor } from '../src/db/client.ts';

// The same synthetic journey runs locally and in the mandatory isolated PostgreSQL job.
async function journey(f: Awaited<ReturnType<typeof localCrmFixture>>, postgres?: Awaited<ReturnType<typeof realCrmFixture>>) {
  const config = loadConfig({ NODE_ENV: 'test', ERP_ENV: 'dev', REQUIRE_DATABASE: 'false', DATABASE_URL: 'postgresql://synthetic@localhost/erp_test', ENABLE_CRM_HTTP: 'true' });
  const runtime = createApp({ config, db: f.admin, useMemory: false,
    expedicaoPedidoPort: new PostgresExpedicaoPedidoPort(), expedicaoEstoquePort: new PostgresExpedicaoEstoquePort() });
  const ctx = { groupId: ID.groupA, empresaId: ID.empresaA, actorId: ID.runtimeActorA, requestId: 'synthetic-composition' };
  const denied = { ...ctx, actorId: randomUUID() };
  // Existing, proven synthetic Cliente master and company link; no operational import.
  const client = await runtime.clienteService.get(ctx, ID.clientePjA);
  assert.equal(client.id, ID.clientePjA);
  const link = await runtime.clienteService.getEmpresaLink(ctx, client.id, ID.empresaA);
  const input = { cliente_empresa_id: link.id, condicao_pagamento_id: ID.condicaoPagamentoA,
    validade_em: '2027-06-01T00:00:00.000Z', itens: [{ produto_id: ID.produtoA, unidade_id: ID.unidadeA,
      descricao: 'Synthetic composition', unidade_sigla: 'KG', quantidade: '2', preco_unitario: '999', desconto: '0' }] };
  const quote = await runtime.orcamentoService.create(ctx, input);
  assert.notEqual(quote.itens[0].preco_unitario, '999.000000');
  const edited = await runtime.orcamentoService.update(ctx, quote.id, { ...input, itens: [{ ...input.itens[0], quantidade: '3' }] });
  const conversion = { tipo_operacao: 'ENTREGA', data_entrega_solicitada: '2027-06-01T00:00:00.000Z' };
  const attempts = await Promise.allSettled(Array.from({ length: 3 }, () => runtime.pedidoService.convert(ctx, quote.id, conversion)));
  assert.equal(attempts.filter(r => r.status === 'fulfilled').length, 1);
  for (const r of attempts) if (r.status === 'rejected') assert.equal(r.reason.statusCode, 409);
  const order = (attempts.find(r => r.status === 'fulfilled') as PromiseFulfilledResult<any>).value;
  assert.equal(order.total, edited.total);
  assert.equal(order.itens[0].preco_unitario, edited.itens[0].preco_unitario);
  await runtime.pedidoService.update(ctx, order.id, { cliente_empresa_id: link.id, condicao_pagamento_id: ID.condicaoPagamentoA, ...conversion, orcamento_id: quote.id,
    itens: order.itens.map(({ produto_id, unidade_id, descricao, unidade_sigla, quantidade, preco_unitario, desconto, requer_producao }) =>
      ({ produto_id, unidade_id, descricao, unidade_sigla, quantidade, preco_unitario, desconto, requer_producao })) });
  assert.equal(order.itens.some(i => i.requer_producao), false);
  await runtime.pedidoService.transition(ctx, order.id, 'PRONTO_ENTREGA');
  const deliveryInput = { pedido_id: order.id, pedido_numero: order.numero, cliente_empresa_id: link.id,
    tipo_frete: 'ENTREGA', data_entrega_solicitada: conversion.data_entrega_solicitada, idempotency_key: 'composition-delivery',
    itens: order.itens.map(i => ({ produto_id: i.produto_id, descricao: i.descricao, unidade_sigla: i.unidade_sigla, quantidade_pedida: i.quantidade })) };
  await assert.rejects(() => runtime.expedicaoService.createEntrega(denied, deliveryInput), (e: any) => e.statusCode === 403);
  await assert.rejects(() => runtime.expedicaoService.createEntrega({ ...ctx, empresaId: ID.empresaB }, deliveryInput));
  const count = async (table: string) => Number((await f.admin.query('SELECT count(*)::text AS n FROM ' + table)).rows[0].n);
  const before = await count('entregas');
  const revokedRuntime = createApp({ config, useMemory: false, db: { ...f.admin,
    withTransaction: fn => f.admin.withTransaction(async executor => {
      await executor.query("UPDATE profiles SET permissoes='{}'::jsonb WHERE id=$1", [ctx.actorId]);
      return fn(executor);
    }) } });
  await assert.rejects(() => revokedRuntime.expedicaoService.createEntrega(ctx, deliveryInput), (e: any) => e.statusCode === 403);
  assert.equal(await count('entregas'), before);
  await f.exec("CREATE FUNCTION composition_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.entity='Entrega' AND NEW.action='create' THEN RAISE EXCEPTION 'synthetic audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER composition_audit_failure BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE PROCEDURE composition_audit_failure();");
  await assert.rejects(() => runtime.expedicaoService.createEntrega(ctx, deliveryInput));
  assert.equal(await count('entregas'), before);
  await f.exec('DROP TRIGGER composition_audit_failure ON audit_logs; DROP FUNCTION composition_audit_failure();');
  const delivery = await runtime.expedicaoService.createEntrega(ctx, deliveryInput);
  const replay = await runtime.expedicaoService.createEntrega(ctx, deliveryInput);
  assert.equal(replay.id, delivery.id);
  assert.equal(await count('entregas'), before + 1);
  const persisted = await runtime.expedicaoService.getEntrega(ctx, delivery.id);
  const checklist = { conferiu_quantidade: true, conferiu_qualidade: true, conferiu_embalagem: true, conferiu_etiquetas: true, conferiu_documentos: true };
  await runtime.expedicaoService.concluirSeparacao(ctx, delivery.id, { confirmed: true, checklist,
    itens: persisted.itens.map(i => ({ item_id: i.id, produto_id: i.produto_id, descricao: i.descricao,
      unidade_sigla: i.unidade_sigla, quantidade_pedida: i.quantidade_pedida, quantidade_separada: i.quantidade_pedida })),
    idempotency_key: 'composition-separation' });
  // Explicit synthetic opening balance only in this disposable fixture.
  await f.admin.query('INSERT INTO expedicao_estoque_saldos(group_id,empresa_id,produto_id,quantidade) VALUES($1,$2,$3,20)', [ID.groupA, ID.empresaA, ID.produtoA]);
  const manifestInput = { confirmed: true, motorista_nome: 'Synthetic driver', veiculo: 'Synthetic vehicle', placa: 'SYN0000',
    checklist_saida: { documentos_ok: true, veiculo_ok: true, carga_conferida: true, combustivel_ok: true },
    entregas_ids: [delivery.id], despachar: true, idempotency_key: 'composition-manifest' };
  const manifest = await runtime.expedicaoService.criarRomaneioDespacho(ctx, manifestInput);
  const repeated = await runtime.expedicaoService.criarRomaneioDespacho(ctx, manifestInput);
  assert.equal(repeated.romaneio.id, manifest.romaneio.id);
  const balance = async () => String((await f.admin.query('SELECT quantidade::text AS n FROM expedicao_estoque_saldos WHERE group_id=$1 AND empresa_id=$2 AND produto_id=$3', [ID.groupA, ID.empresaA, ID.produtoA])).rows[0].n);
  assert.equal(Number(await balance()), 17);
  const partial = { confirmed: true, modo: 'parcial', quantidade_entregue: '1.000001', comprovante: { nome_recebedor: 'Synthetic receiver', documento_recebedor: 'synthetic-proof' }, idempotency_key: 'composition-partial' };
  const revokedAfterLock = createApp({ config, useMemory: false, db: { ...f.admin,
    withTransaction: fn => f.admin.withTransaction(executor => fn({
      query: async (sql, params) => {
        const result = await executor.query(sql, params);
        if (/SELECT \* FROM entregas.*FOR UPDATE/.test(sql)) {
          await executor.query("UPDATE profiles SET permissoes='{}'::jsonb WHERE id=$1", [ctx.actorId]);
        }
        return result;
      },
    })) } });
  await assert.rejects(() => revokedAfterLock.expedicaoService.registrarFinal(ctx, delivery.id, partial), (e: any) => e.statusCode === 403);
  assert.equal((await runtime.expedicaoService.getEntrega(ctx, delivery.id)).status, 'Saiu para Entrega');
  await runtime.expedicaoService.registrarFinal(ctx, delivery.id, partial);
  await runtime.expedicaoService.registrarFinal(ctx, delivery.id, partial);
  assert.equal((await runtime.expedicaoService.getEntrega(ctx, delivery.id)).itens[0].quantidade_entregue, '1.000001');
  await assert.rejects(() => runtime.expedicaoService.devolucao(ctx, delivery.id, { confirmed: true, motivo: 'Synthetic excessive return', acao: 'repor',
    itens: [{ item_id: persisted.itens[0].id, quantidade_devolvida: '2' }], idempotency_key: 'composition-excess-return' }), (e: any) => e.code === 'DEVOLUCAO_ITEM_QTY_INVALIDA');
  await runtime.expedicaoService.devolucao(ctx, delivery.id, { confirmed: true, motivo: 'Synthetic return', acao: 'repor',
    itens: [{ item_id: persisted.itens[0].id, quantidade_devolvida: '1' }], idempotency_key: 'composition-return' });
  assert.equal(Number(await balance()), 18);
  const direct = { ...conversion, cliente_empresa_id: link.id, condicao_pagamento_id: ID.condicaoPagamentoA,
    idempotency_key: randomUUID(), itens: [{ ...input.itens[0], requer_producao: false }] };
  const draft = await runtime.pedidoService.create(ctx, direct);
  assert.equal((await runtime.pedidoService.create(ctx, direct)).id, draft.id);
  const cancelled = await runtime.pedidoService.cancel(ctx, draft.id, 'Synthetic cancellation');
  assert.equal(cancelled.status, 'CANCELADO');
  assert.equal(cancelled.itens[0].preco_unitario, draft.itens[0].preco_unitario);
  const central = await runtime.clienteCentral360Service.get(ctx, client.id);
  assert.ok(central);
  assert.deepEqual((await runtime.pedidoService.history(ctx, order.id)).map(h => h.status_novo), ['EM_ABERTO', 'PRONTO_ENTREGA']);
  assert.ok((await runtime.auditRepo.listByEntity('Pedido', order.id)).length >= 3);
  if (postgres) {
    const listener = runtime.app.listen(0, '127.0.0.1');
    try {
      await once(listener, 'listening');
      const address = listener.address();
      assert.ok(address && typeof address !== 'string');
      const endpoint = `http://127.0.0.1:${address.port}/api/v1/pedidos/${order.id}`;
      const headers = { 'x-group-id': ctx.groupId, 'x-empresa-id': ctx.empresaId, 'x-actor-id': ctx.actorId };
      const request = (suffix: string, method = 'GET') => fetch(endpoint + suffix, {
        method, headers, signal: AbortSignal.timeout(5000),
      });
      const before = await runtime.pedidoService.get(ctx, order.id);
      const condition = await runtime.condicaoPagamentoService.get(ctx, before.condicao_pagamento_id);
      const terms = condition.parcelas.map(({ ordem, dias, percentual }) => ({ ordem, dias, percentual }));
      assert.ok(terms.length > 0);
      assert.throws(() => projetarParcelasFaturamento(before.total, '2027-06-01', terms), {
        code: 'FATURAMENTO_TOTAL_NAO_EXPRESSO_EM_CENTAVOS',
      });
      const invoiceTotal = quantizarTotalPedidoParaFaturamento(before.total);
      const projected = projetarParcelasFaturamento(invoiceTotal, '2027-06-01', terms);
      const asCents = (amount: string) => BigInt(amount.replace('.', ''));
      assert.equal(projected.reduce((sum, parcela) => sum + asCents(parcela.valor), 0n), asCents(invoiceTotal));
      const auditBefore = await runtime.auditRepo.listByEntity('Pedido', order.id);
      assert.equal((await request('')).status, 200);
      // Replace this boundary with the positive contract when billing is wired.
      assert.equal((await request('/faturar', 'POST')).status, 404);
      assert.deepEqual(await runtime.pedidoService.get(ctx, order.id), before);
      assert.deepEqual(await runtime.auditRepo.listByEntity('Pedido', order.id), auditBefore);
      await rehearseSettlement(postgres, ctx, order.id, projected);
    } finally {
      await new Promise<void>((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
    }
  }
}

// Disposable SQL model only; not a migration, HTTP handler or ContaReceber replacement.
async function rehearseSettlement(f: Awaited<ReturnType<typeof realCrmFixture>>, ctx: { groupId: string; empresaId: string; actorId: string; requestId: string },
  orderId: string, installments: ReturnType<typeof projetarParcelasFaturamento>) {
  const identity = [orderId, ctx.groupId, ctx.empresaId];
  const accounting = [randomUUID(), randomUUID()];
  const otherAccounting = [randomUUID(), randomUUID()];
  assert.match(f.role, /^crm_test_role_[a-f0-9]{18}$/);
  await f.admin.withTransaction(async tx => {
    const { rows: [scope] } = await tx.query('SELECT current_schemas(false)::text[] AS schemas');
    assert.match(scope.schemas[0], /^crm_test_[a-f0-9]{18}$/);
    assert.deepEqual(scope.schemas.slice(1), ['pg_catalog']);
    await tx.query(`CREATE TABLE rehearsal_cost_centers (
      id uuid, group_id uuid, empresa_id uuid, PRIMARY KEY(id,group_id,empresa_id));
      CREATE TABLE rehearsal_accounts (
      id uuid, group_id uuid, empresa_id uuid, PRIMARY KEY(id,group_id,empresa_id));
      CREATE TABLE rehearsal_titles (
      pedido_id uuid, group_id uuid NOT NULL, empresa_id uuid NOT NULL,
      parcela int, vencimento date NOT NULL, valor numeric(16,2) NOT NULL CHECK (valor > 0),
      centro_custo_id uuid NOT NULL, plano_contas_id uuid NOT NULL,
      recebido numeric(16,2) DEFAULT 0 CHECK (recebido BETWEEN 0 AND valor),
      FOREIGN KEY(pedido_id,group_id,empresa_id) REFERENCES pedidos(id,group_id,empresa_id),
      FOREIGN KEY(centro_custo_id,group_id,empresa_id) REFERENCES rehearsal_cost_centers,
      FOREIGN KEY(plano_contas_id,group_id,empresa_id) REFERENCES rehearsal_accounts,
      PRIMARY KEY (pedido_id,group_id,empresa_id,parcela));
      CREATE TABLE rehearsal_receipts (
      pedido_id uuid, group_id uuid, empresa_id uuid, parcela int, evento text,
      valor numeric(16,2) NOT NULL CHECK (valor > 0),
      PRIMARY KEY (pedido_id,group_id,empresa_id,parcela,evento),
      FOREIGN KEY (pedido_id,group_id,empresa_id,parcela) REFERENCES rehearsal_titles)`);
    const policy = "group_id=NULLIF(current_setting('app.group_id',true),'')::uuid AND empresa_id=NULLIF(current_setting('app.empresa_id',true),'')::uuid";
    for (const [table, index] of [['rehearsal_cost_centers', 0], ['rehearsal_accounts', 1]] as const) {
      await tx.query(`INSERT INTO ${table} VALUES ($1,$2,$3),($4,$2,$5)`,
        [accounting[index], ctx.groupId, ctx.empresaId, otherAccounting[index], ID.empresaB]);
    }
    for (const table of ['rehearsal_titles', 'rehearsal_receipts']) {
      await tx.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;
        ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;
        CREATE POLICY rehearsal_scope ON ${table} TO "${f.role}" USING (${policy}) WITH CHECK (${policy});
        GRANT SELECT, INSERT ON ${table} TO "${f.role}"`);
    }
    await tx.query(`GRANT UPDATE(recebido) ON rehearsal_titles TO "${f.role}"`);
  });
  const inCompany = <T>(company: string, fn: (tx: DbQueryExecutor) => Promise<T>) => f.data.withTransaction(async tx => {
    await tx.query("SELECT set_config('app.group_id',$1,true),set_config('app.empresa_id',$2,true)", [ctx.groupId, company]);
    return fn(tx);
  });
  const db: DbClient = { ...f.data,
    withTransaction: fn => inCompany(ctx.empresaId, fn),
    query: (sql, params) => inCompany(ctx.empresaId, tx => tx.query(sql, params)),
  };
  const audit = new PostgresAuditRepository(db);
  const { rows: [role] } = await db.query('SELECT current_user AS name,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user');
  assert.deepEqual(role, { name: f.role, rolsuper: false, rolbypassrls: false });
  const scoped = 'pedido_id=$1 AND group_id=$2 AND empresa_id=$3';
  const bill = (fail = false, costCenter: string | null = accounting[0], account: string | null = accounting[1]) => db.withTransaction(async tx => {
    assert.equal((await tx.query('SELECT id FROM pedidos WHERE id=$1 AND group_id=$2 AND empresa_id=$3 FOR UPDATE', identity)).rowCount, 1);
    if ((await tx.query('SELECT 1 FROM rehearsal_titles WHERE ' + scoped, identity)).rowCount) return false;
    for (const part of installments) await tx.query('INSERT INTO rehearsal_titles VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      [...identity, part.ordem, part.vencimento, part.valor, costCenter, account]);
    await audit.append({ ...ctx, entity: 'FaturamentoEnsaio', entityId: orderId, action: 'create' }, tx);
    if (fail) throw new Error('REHEARSAL_BILLING_ROLLBACK');
    return true;
  });
  await assert.rejects(bill(false, null), { code: '23502' });
  await assert.rejects(bill(false, accounting[0], null), { code: '23502' });
  await assert.rejects(bill(false, otherAccounting[0]), { code: '23503' });
  await assert.rejects(bill(false, accounting[0], otherAccounting[1]), { code: '23503' });
  await assert.rejects(bill(true), /REHEARSAL_BILLING_ROLLBACK/);
  assert.equal((await db.query('SELECT 1 FROM rehearsal_titles WHERE ' + scoped, identity)).rowCount, 0);
  assert.equal((await audit.listByEntity('FaturamentoEnsaio', orderId)).length, 0);
  assert.deepEqual((await Promise.all([bill(), bill()])).sort(), [false, true]);
  assert.equal((await db.query('SELECT 1 FROM rehearsal_titles WHERE ' + scoped, identity)).rowCount, installments.length);
  assert.equal((await audit.listByEntity('FaturamentoEnsaio', orderId)).length, 1);
  await inCompany(ID.empresaB, async tx => {
    assert.equal((await tx.query('SELECT * FROM rehearsal_titles')).rowCount, 0);
    assert.equal((await tx.query('UPDATE rehearsal_titles SET recebido=0')).rowCount, 0);
  });
  await assert.rejects(inCompany(ID.empresaB, tx => tx.query(
    'INSERT INTO rehearsal_receipts VALUES ($1,$2,$3,$4,$5,$6)', [...identity, installments[0].ordem, 'cross-company', '0.01'],
  )), { code: '42501' });

  const receive = (part: number, event: string, amount: string, company = ctx.empresaId, fail = false) => db.withTransaction(async tx => {
    const key = [orderId, ctx.groupId, company, part];
    if (!(await tx.query('SELECT 1 FROM rehearsal_titles WHERE ' + scoped + ' AND parcela=$4 FOR UPDATE', key)).rowCount)
      throw new Error('REHEARSAL_TITLE_NOT_FOUND');
    const prior = await tx.query('SELECT valor::text FROM rehearsal_receipts WHERE ' + scoped + ' AND parcela=$4 AND evento=$5', [...key, event]);
    if (prior.rows[0]) {
      if (prior.rows[0].valor !== amount) throw new Error('REHEARSAL_EVENT_CONFLICT');
      return false;
    }
    await tx.query('INSERT INTO rehearsal_receipts VALUES ($1,$2,$3,$4,$5,$6)', [...key, event, amount]);
    await tx.query('UPDATE rehearsal_titles SET recebido=recebido+$5 WHERE ' + scoped + ' AND parcela=$4', [...key, amount]);
    await audit.append({ ...ctx, entity: 'RecebimentoEnsaio', entityId: orderId, action: 'create', afterData: { part, event, amount } }, tx);
    if (fail) throw new Error('REHEARSAL_RECEIPT_ROLLBACK');
    return true;
  });
  const balance = async () => (await db.query('SELECT sum(valor-recebido)::text AS amount FROM rehearsal_titles WHERE ' + scoped, identity)).rows[0].amount;
  const opening = await balance();
  const first = installments[0];
  const asCents = (value: string) => BigInt(value.replace('.', ''));
  const money = (cents: bigint) => `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`;
  assert.ok(asCents(first.valor) > 1n);
  await assert.rejects(receive(first.ordem, 'partial', '0.01', ID.empresaB), /REHEARSAL_TITLE_NOT_FOUND/);
  await assert.rejects(receive(first.ordem, 'partial', '0.01', ctx.empresaId, true), /REHEARSAL_RECEIPT_ROLLBACK/);
  assert.equal(await balance(), opening);
  assert.equal((await audit.listByEntity('RecebimentoEnsaio', orderId)).length, 0);
  assert.deepEqual((await Promise.all([receive(first.ordem, 'partial', '0.01'), receive(first.ordem, 'partial', '0.01')])).sort(), [false, true]);
  assert.equal(await balance(), money(asCents(opening) - 1n));
  await assert.rejects(receive(first.ordem, 'partial', '0.02'), /REHEARSAL_EVENT_CONFLICT/);
  for (const part of installments) {
    const amount = part === first ? money(asCents(part.valor) - 1n) : part.valor;
    assert.equal(await receive(part.ordem, 'settle', amount), true);
    assert.equal(await receive(part.ordem, 'settle', amount), false);
  }
  assert.equal(await balance(), '0.00');
  assert.equal((await audit.listByEntity('RecebimentoEnsaio', orderId)).length, installments.length + 1);
}

test('Composição persistida: Cliente→Orçamento→Pedido→Expedição, rollback, replay, parcial, devolução e cancelamento', async () => {
  const f = await localCrmFixture();
  try { await journey(f); } finally { await f.close(); }
});

if (process.env.DATABASE_URL) test('Composição PostgreSQL real isolado executa o mesmo percurso canônico', async () => {
  const f = await realCrmFixture(process.env.DATABASE_URL!, { restrictedLogin: true });
  try { await journey(f, f); } finally { await f.close(); }
});

test('Leitores comerciais persistidos nao promovem ator nem tenant trocados durante validacao SQL', async () => {
  const f = await localCrmFixture();
  const config = loadConfig({ NODE_ENV: 'test', ERP_ENV: 'dev', REQUIRE_DATABASE: 'false', DATABASE_URL: 'postgresql://synthetic@localhost/erp_test' });
  const ctx = { groupId: ID.groupA, empresaId: ID.empresaA, actorId: ID.runtimeActorA, requestId: 'synthetic-read-context' };
  let afterTenant: (() => void) | undefined;
  let mutations = 0;
  const db: typeof f.admin = { ...f.admin, query: async (sql, params) => {
    const result = await f.admin.query(sql, params);
    if (afterTenant && sql === 'SELECT 1 AS ok FROM empresas WHERE id = $1 AND group_id = $2 LIMIT 1') {
      const mutate = afterTenant;
      afterTenant = undefined;
      mutations++;
      mutate();
    }
    return result;
  } };
  try {
    const runtime = createApp({ config, db, useMemory: false });
    const link = await runtime.clienteService.getEmpresaLink(ctx, ID.clientePjA, ID.empresaA);
    const quote = await runtime.orcamentoService.create(ctx, { cliente_empresa_id: link.id,
      condicao_pagamento_id: ID.condicaoPagamentoA, validade_em: '2027-06-01T00:00:00.000Z',
      itens: [{ produto_id: ID.produtoA, unidade_id: ID.unidadeA, descricao: 'Synthetic immutable read',
        unidade_sigla: 'KG', quantidade: '2', preco_unitario: '999', desconto: '0' }] });
    const order = await runtime.pedidoService.convert(ctx, quote.id,
      { tipo_operacao: 'RETIRADA', data_entrega_solicitada: '2027-06-01T00:00:00.000Z' });
    const snapshot = async () => (await f.admin.query(`SELECT
      (SELECT jsonb_agg(to_jsonb(q) ORDER BY id) FROM orcamentos q) quotes,
      (SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM orcamento_itens i) quote_items,
      (SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM pedidos p) orders,
      (SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM pedido_itens i) order_items,
      (SELECT jsonb_agg(to_jsonb(h) ORDER BY id) FROM pedido_historico h) history,
      (SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM audit_logs a) audit,
      (SELECT jsonb_agg(to_jsonb(s) ORDER BY group_id,entity_name) FROM entity_code_sequences s) sequences`)).rows;
    const before = await snapshot();
    const readers = [
      async (input: typeof ctx) => [await runtime.orcamentoService.get(input, quote.id)],
      async (input: typeof ctx) => (await runtime.orcamentoService.list(input)).data,
      async (input: typeof ctx) => [await runtime.pedidoService.get(input, order.id)],
      async (input: typeof ctx) => (await runtime.pedidoService.list(input)).data,
      async (input: typeof ctx) => runtime.pedidoService.history(input, order.id),
    ];
    for (const read of readers) {
      const unauthorized = { ...ctx, actorId: randomUUID() };
      afterTenant = () => Object.assign(unauthorized, ctx);
      await assert.rejects(() => read(unauthorized), (error: unknown) =>
        typeof error === 'object' && error !== null && 'statusCode' in error && error.statusCode === 403);
      assert.equal(afterTenant, undefined);
      const initial = await read({ ...ctx });
      assert.ok(Array.isArray(initial) && initial.length > 0);
      assert.ok(initial.every(row => row.group_id === ctx.groupId && row.empresa_id === ctx.empresaId));
      assert.ok(initial.some(row => 'pedido_id' in row ? row.pedido_id === order.id : row.id === quote.id || row.id === order.id));
      const mutable = { ...ctx };
      afterTenant = () => Object.assign(mutable, { groupId: ID.groupB, empresaId: ID.empresaB, actorId: ID.runtimeActorB });
      assert.deepEqual(await read(mutable), initial);
      assert.equal(afterTenant, undefined);
    }
    assert.equal(mutations, 10);
    assert.deepEqual(await snapshot(), before);
    await assert.rejects(() => runtime.pedidoService.get({ ...ctx, empresaId: ID.empresaB }, order.id));
    await assert.rejects(() => runtime.orcamentoService.get({ ...ctx, actorId: randomUUID() }, quote.id));
    assert.deepEqual(await snapshot(), before);
  } finally { await f.close(); }
});
