import assert from 'node:assert/strict';
import test from 'node:test';
import { createHttpApiClient } from '../../src/api/httpApiClient.js';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config/env.ts';
import { createDbClient } from '../src/db/client.ts';
import { InMemoryRbacGuard } from '../src/db/rbacGuard.ts';
import { InMemoryTenantGuard } from '../src/db/tenantGuard.ts';

const groupId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const empresaId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const actorId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

test('cliente HTTP Expedicao (bridge) percorre fluxo sintetico com retry e falha intermediaria', async () => {
  const config = loadConfig({ NODE_ENV: 'test', ERP_ENV: 'dev', REQUIRE_DATABASE: 'false' });
  const tenant = new InMemoryTenantGuard();
  tenant.link(empresaId, groupId);
  const rbac = new InMemoryRbacGuard();
  rbac.link({
    actorId,
    groupId,
    permissions: {
      Expedicao: {
        entrega: ['visualizar', 'criar', 'editar', 'conferir', 'expedir', 'entregar', 'ocorrencia'],
        romaneio: ['visualizar', 'criar'],
        separacao: ['visualizar', 'criar', 'conferir'],
      },
    },
  });

  let failEstoque = false;
  const runtime = createApp({
    config,
    db: createDbClient(config),
    useMemory: true,
    tenantGuard: tenant,
    rbacGuard: rbac,
    expedicaoEstoquePort: {
      async onDespacho() { return failEstoque ? 'failed' : 'reserved'; },
      async onDevolucao() { return 'reserved'; },
    },
  });

  const server = runtime.app.listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    // Sem Bearer: X-Actor-Id para authMode header em testes (≠ SPA local).
    const client = createHttpApiClient({
      baseUrl,
      getScope: () => ({ groupId, empresaId, actorId }),
    });

    const entrega = await client.expedicao.createEntrega({
      cliente_nome: 'Nav Syn',
      cidade: 'Campinas',
      itens: [{ descricao: 'Item', unidade_sigla: 'UN', quantidade_pedida: '3' }],
      idempotency_key: 'nav-ent-1',
    });
    assert.ok(entrega.id);

    const sep = await client.expedicao.separacao(entrega.id, {
      confirmed: true,
      checklist: {
        conferiu_quantidade: true,
        conferiu_qualidade: true,
        conferiu_embalagem: true,
        conferiu_etiquetas: true,
        conferiu_documentos: true,
      },
      itens: [{ descricao: 'Item', unidade_sigla: 'UN', quantidade_pedida: '3', quantidade_separada: '3' }],
      idempotency_key: 'nav-sep-1',
    });
    assert.equal(sep.entrega.status, 'Pronto para Expedir');

    failEstoque = true;
    await assert.rejects(
      () => client.expedicao.criarRomaneio({
        confirmed: true,
        motorista_nome: 'Mot',
        veiculo: 'V',
        placa: 'NAV1A11',
        checklist_saida: { documentos_ok: true, veiculo_ok: true, carga_conferida: true, combustivel_ok: true },
        entregas_ids: [entrega.id],
        despachar: true,
        idempotency_key: 'nav-rom-fail',
      }),
      (err: any) => err?.status === 502,
    );
    const afterFail = await client.expedicao.getEntrega(entrega.id);
    assert.equal(afterFail.status, 'Pronto para Expedir');

    failEstoque = false;
    const rom = await client.expedicao.criarRomaneio({
      confirmed: true,
      motorista_nome: 'Mot',
      veiculo: 'V',
      placa: 'NAV1A11',
      checklist_saida: { documentos_ok: true, veiculo_ok: true, carga_conferida: true, combustivel_ok: true },
      entregas_ids: [entrega.id],
      despachar: true,
      idempotency_key: 'nav-rom-ok',
    });
    assert.equal(rom.reused, false);
    assert.equal(rom.entregas[0].status, 'Saiu para Entrega');

    const retry = await client.expedicao.criarRomaneio({
      confirmed: true,
      motorista_nome: 'Mot',
      veiculo: 'V',
      placa: 'NAV1A11',
      checklist_saida: { documentos_ok: true, veiculo_ok: true, carga_conferida: true, combustivel_ok: true },
      entregas_ids: [entrega.id],
      despachar: true,
      idempotency_key: 'nav-rom-ok',
    });
    assert.equal(retry.reused, true);

    const parcial = await client.expedicao.registrar(entrega.id, {
      confirmed: true,
      modo: 'parcial',
      quantidade_entregue: '1',
      comprovante: { nome_recebedor: 'R', documento_recebedor: '1' },
      idempotency_key: 'nav-par',
    });
    assert.equal(parcial.entrega.status, 'Entrega Parcial');

    const list = await client.expedicao.listEntregas({ limit: 10 });
    assert.ok((list.data || []).some((row: { id: string }) => row.id === entrega.id));
  } finally {
    await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
  }
});
