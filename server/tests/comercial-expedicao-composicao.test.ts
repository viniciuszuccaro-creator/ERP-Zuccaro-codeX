import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { localCrmFixture } from './helpers/crmFixture.ts';
import { realCrmFixture } from './helpers/crmPostgresFixture.ts';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config/env.ts';
import { SEED_IDS as ID } from '../scripts/seedDevIds.ts';
import { PostgresExpedicaoEstoquePort, PostgresExpedicaoPedidoPort } from '../src/integrations/expedicaoPersistentPorts.ts';

// The same synthetic journey runs locally and in the mandatory isolated PostgreSQL job.
async function journey(f: Awaited<ReturnType<typeof localCrmFixture>>) {
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
}

test('Composição persistida: Cliente→Orçamento→Pedido→Expedição, rollback, replay, parcial, devolução e cancelamento', async () => {
  const f = await localCrmFixture();
  try { await journey(f); } finally { await f.close(); }
});

if (process.env.DATABASE_URL) test('Composição PostgreSQL real isolado executa o mesmo percurso canônico', async () => {
  const f = await realCrmFixture(process.env.DATABASE_URL!);
  try { await journey(f); } finally { await f.close(); }
});
