import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { canViewFinanceLaunchpadModule, FINANCEIRO_LAUNCHPAD_MODULE_TITLES } from '../src/components/financeiro/financeiroLaunchpadAccess.js';

/**
 * Fluxo real via localBase44 (não é asserção de texto-fonte).
 * Prova isolamento de consultas ContaReceber por empresa no mesmo grupo.
 */
test('Financeiro: consultas ContaReceber isoladas por empresa (fluxo real localBase44)', async () => {
  const values = new Map();
  const storage = {
    getItem: (k) => values.get(String(k)) ?? null,
    setItem: (k, v) => values.set(String(k), String(v)),
    removeItem: (k) => values.delete(String(k)),
  };
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: storage } });
  const server = await createServer({
    root: fileURLToPath(new URL('../', import.meta.url)),
    appType: 'custom', logLevel: 'silent', server: { middlewareMode: true },
  });
  try {
    const { localBase44 } = await server.ssrLoadModule(`/src/api/localBase44Client.js?fin-ctx=${Date.now()}`);
    localBase44.__local.reset();
    const db = localBase44.__local.export();
    const empresas = db.Empresa || [];
    assert.ok(empresas.length >= 2, 'seed precisa de >=2 empresas');
    const a = empresas[0];
    const b = empresas[1];
    const groupId = a.group_id || a.grupo_id;
    assert.equal(String(b.group_id || b.grupo_id), String(groupId));

    db.PerfilAcesso = db.PerfilAcesso || [];
    db.PerfilAcesso.push({
      id: 'perfil-fin-fluxo',
      ativo: true,
      group_id: groupId,
      permissoes: { Financeiro: ['visualizar'], Cadastros: { Organizacional: ['visualizar'] } },
    });
    const idA = `cr-fin-a-${Date.now()}`;
    const idB = `cr-fin-b-${Date.now()}`;
    db.ContaReceber = [
      ...(db.ContaReceber || []),
      {
        id: idA, group_id: groupId, empresa_id: a.id,
        valor: 111, status: 'Aberto', data_vencimento: '2099-01-15',
        cliente_nome: 'Cliente Sintetico A',
      },
      {
        id: idB, group_id: groupId, empresa_id: b.id,
        valor: 222, status: 'Aberto', data_vencimento: '2099-02-15',
        cliente_nome: 'Cliente Sintetico B',
      },
    ];
    storage.setItem('erp_integra_local_db_v1', JSON.stringify(db));
    storage.setItem('erp_integra_local_user_v1', JSON.stringify({
      id: 'usuario-fin-fluxo', role: 'user', mestre_local: false,
      perfil_acesso_id: 'perfil-fin-fluxo',
      contexto_atual: 'empresa', grupo_atual_id: groupId, empresa_atual_id: a.id,
      grupo_padrao_id: groupId, empresa_padrao_id: a.id,
      grupos_vinculados: [{ grupo_id: groupId, ativo: true }],
      empresas_vinculadas: [{ empresa_id: a.id, ativo: true }, { empresa_id: b.id, ativo: true }],
    }));
    storage.setItem('contexto_atual', 'empresa');
    storage.setItem('empresa_atual_id', a.id);
    storage.setItem('group_atual_id', groupId);

    const client = (await server.ssrLoadModule(`/src/api/localBase44Client.js?fin-ctx-reopen=${Date.now()}`)).localBase44;
    const rowsA = await client.entities.ContaReceber.filter({ empresa_id: a.id }, '-data_vencimento', 50);
    const rowsB = await client.entities.ContaReceber.filter({ empresa_id: b.id }, '-data_vencimento', 50);
    const idsA = new Set(rowsA.map((r) => r.id));
    const idsB = new Set(rowsB.map((r) => r.id));
    assert.equal(idsA.has(idA), true);
    assert.equal(idsA.has(idB), false, 'empresa A nao deve ver titulo da B');
    assert.equal(idsB.has(idB), true);
    assert.equal(idsB.has(idA), false, 'empresa B nao deve ver titulo da A');

    // Grant plano: 15 cards liberados; secao granular sem grant esconde.
    const hasPlano = (mod, sec, act) => mod === 'Financeiro' && sec == null && (act === 'ver' || act === 'visualizar');
    assert.equal(FINANCEIRO_LAUNCHPAD_MODULE_TITLES.length, 15);
    assert.equal(
      FINANCEIRO_LAUNCHPAD_MODULE_TITLES.every((title) => canViewFinanceLaunchpadModule(hasPlano, { title, sectionKey: title })),
      true,
    );
    const hasGranular = (mod, sec, act) => (
      mod === 'Financeiro' && sec === 'Contas a Receber' && (act === 'ver' || act === 'visualizar')
    );
    assert.equal(canViewFinanceLaunchpadModule(hasGranular, { title: 'Contas a Receber' }), true);
    assert.equal(canViewFinanceLaunchpadModule(hasGranular, { title: 'Contas a Pagar' }), false);
  } finally {
    await server.close();
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else delete globalThis.window;
  }
});
