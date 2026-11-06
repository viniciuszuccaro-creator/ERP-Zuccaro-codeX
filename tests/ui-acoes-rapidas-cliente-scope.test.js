import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { QueryClient } from '@tanstack/react-query';
import {
  resolveAcoesRapidasClientesKpiState,
  isAcoesRapidasScopeCurrent,
  buildAcoesRapidasClientesQueryKey,
  resolveClientesParaNovoPedido,
} from '../src/components/acoesRapidasScope.js';

test('AcoesRapidasGlobal: filterInContext + actor/session na queryKey + STALE + fail-closed novoPedido', () => {
  const src = readFileSync('src/components/AcoesRapidasGlobal.jsx', 'utf8');
  assert.match(src, /filterInContext\(\s*'Cliente'/);
  assert.match(src, /ACOES_RAPIDAS_STALE_SCOPE/);
  assert.match(src, /buildAcoesRapidasClientesQueryKey/);
  assert.match(src, /resolveClientesParaNovoPedido/);
  assert.match(src, /isHttpBackendMode/);
  assert.match(src, /erro de carga ≠ zero/);
  assert.doesNotMatch(src, /entities\.Cliente\.list\(/);
  assert.doesNotMatch(src, /base44\.auth\.me\(/);
  assert.doesNotMatch(src, /data:\s*clientes\s*=\s*\[\]/);
  // queryKey legado sem ator/sessão
  assert.doesNotMatch(src, /queryKey:\s*\[\s*'clientes'\s*,\s*empresaAtual/);
});

test('KPI e resolveClientesParaNovoPedido: loading/erro/stale ≠ lista pronta', () => {
  assert.equal(resolveAcoesRapidasClientesKpiState({
    contextoValido: true, isLoading: true, isError: false, isFetching: false, dataDefined: false,
  }), 'loading');
  assert.equal(resolveAcoesRapidasClientesKpiState({
    contextoValido: true, isLoading: false, isError: true, isFetching: false, dataDefined: false,
  }), 'error');

  const scopeA = { actorId: 'ator-a', sessionKey: 'sess-a', groupId: 'g1', empresaId: 'e1' };
  const scopeB = { actorId: 'ator-b', sessionKey: 'sess-b', groupId: 'g1', empresaId: 'e1' };
  assert.equal(isAcoesRapidasScopeCurrent(scopeA, scopeA), true);
  assert.equal(isAcoesRapidasScopeCurrent(scopeA, scopeB), false);

  const clientesA = [{ id: 'cli-a', nome: 'Cliente A' }];
  assert.equal(
    resolveClientesParaNovoPedido({
      kpiState: 'ready', clientes: clientesA, scopeExpected: scopeA, scopeLive: scopeA,
    }),
    clientesA,
  );
  assert.equal(
    resolveClientesParaNovoPedido({
      kpiState: 'ready', clientes: clientesA, scopeExpected: scopeA, scopeLive: scopeB,
    }),
    null,
  );
  assert.equal(
    resolveClientesParaNovoPedido({
      kpiState: 'loading', clientes: clientesA, scopeExpected: scopeA, scopeLive: scopeA,
    }),
    null,
  );
  assert.equal(
    resolveClientesParaNovoPedido({
      kpiState: 'error', clientes: [], scopeExpected: scopeA, scopeLive: scopeA,
    }),
    null,
  );
});

test('Negativo QueryClient: atorA→atorB mesmo Grupo/Empresa não reutiliza clientes; EmpresaB chave separada', () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const keyA = buildAcoesRapidasClientesQueryKey({
    groupId: 'g1', empresaId: 'e1', actorId: 'ator-a', sessionKey: 'sess-a',
  });
  const keyB = buildAcoesRapidasClientesQueryKey({
    groupId: 'g1', empresaId: 'e1', actorId: 'ator-b', sessionKey: 'sess-b',
  });
  const keyEmpresaB = buildAcoesRapidasClientesQueryKey({
    groupId: 'g1', empresaId: 'e2', actorId: 'ator-a', sessionKey: 'sess-a',
  });

  assert.notDeepEqual(keyA, keyB);
  assert.notDeepEqual(keyA, keyEmpresaB);

  qc.setQueryData(keyA, [{ id: 'cli-a' }]);
  assert.deepEqual(qc.getQueryData(keyA), [{ id: 'cli-a' }]);
  assert.equal(qc.getQueryData(keyB), undefined);
  assert.equal(qc.getQueryData(keyEmpresaB), undefined);

  // Troca de ator: novoPedido só abre com dados do escopo live
  const opened = [];
  const tryOpen = (kpiState, clientes, expected, live) => {
    const resolved = resolveClientesParaNovoPedido({
      kpiState, clientes, scopeExpected: expected, scopeLive: live,
    });
    if (resolved) opened.push(resolved);
    return resolved;
  };

  const scopeA = { actorId: 'ator-a', sessionKey: 'sess-a', groupId: 'g1', empresaId: 'e1' };
  const scopeB = { actorId: 'ator-b', sessionKey: 'sess-b', groupId: 'g1', empresaId: 'e1' };

  // Ator A ready → abre com cli-a
  assert.ok(tryOpen('ready', qc.getQueryData(keyA), scopeA, scopeA));
  // Ator B no mesmo G/E com transporte pendente (sem data) → NÃO abre com cli-a
  assert.equal(tryOpen('loading', qc.getQueryData(keyA), scopeA, scopeB), null);
  // Ator B ready mas scopeExpected ainda A (resposta tardia) → NÃO abre
  assert.equal(tryOpen('ready', [{ id: 'cli-a' }], scopeA, scopeB), null);
  // Ator B ready com própria chave → abre só com seus clientes
  qc.setQueryData(keyB, [{ id: 'cli-b' }]);
  assert.deepEqual(tryOpen('ready', qc.getQueryData(keyB), scopeB, scopeB), [{ id: 'cli-b' }]);

  assert.deepEqual(opened.map((rows) => rows[0].id), ['cli-a', 'cli-b']);
  qc.clear();
});
