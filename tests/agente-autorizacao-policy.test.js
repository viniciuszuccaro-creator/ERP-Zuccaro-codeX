import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  AGENTES,
  assertAgentMayAct,
  assertMappedAgentFunction,
} from '../src/components/lib/agenteAutorizacaoPolicy.js';

test('agente herda permissao do usuario e nao amplia', () => {
  assert.equal(Object.keys(AGENTES).length, 12);
  assert.throws(
    () => assertAgentMayAct({ agent: 'comercial', userAllowed: false, action: 'visualizar' }),
    /herda a permissao/,
  );
  const ok = assertAgentMayAct({ agent: 'atendimento', userAllowed: true, action: 'visualizar' });
  assert.equal(ok.modo, 'heranca_usuario');
});

test('acao critica do agente exige confirmacao humana', () => {
  assert.throws(
    () => assertMappedAgentFunction({ functionName: 'productPriceOptimizer', userAllowed: true, confirmed: false }),
    /confirmacao humana/,
  );
  const ok = assertMappedAgentFunction({
    functionName: 'productPriceOptimizer',
    userAllowed: true,
    confirmed: true,
  });
  assert.equal(ok.agent, 'comercial');
});

test('scan de anomalia nao exige confirmacao e orquestrador deixa de ser admin-only', async () => {
  const scan = assertMappedAgentFunction({
    functionName: 'iaFinanceAnomalyScan',
    userAllowed: true,
  });
  assert.equal(scan.agent, 'financeiro');

  const orchestrator = await readFile(new URL('../base44/functions/optimizerOrchestrator/entry.ts', import.meta.url), 'utf8');
  const optimizer = await readFile(new URL('../base44/functions/productPriceOptimizer/entry.ts', import.meta.url), 'utf8');
  const precos = await readFile(new URL('../src/components/cadastros/produto/PrecosSection.jsx', import.meta.url), 'utf8');
  assert.match(orchestrator, /assertPermission/);
  assert.doesNotMatch(orchestrator, /user\.role !== 'admin'/);
  assert.match(optimizer, /Unauthorized/);
  assert.doesNotMatch(optimizer, /permitir usuário final OU execução em lote/);
  assert.match(precos, /confirmado: true/);
});
