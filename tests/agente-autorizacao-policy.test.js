import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  AGENTES,
  AGENT_FUNCTION_MAP,
  assertAgentMayAct,
  assertAgentMutationConfirmed,
  assertMappedAgentFunction,
  buildAgentInvokePayload,
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
  assert.throws(() => assertAgentMutationConfirmed({ confirmed: false }), /confirmacao humana/);
  assert.equal(assertAgentMutationConfirmed({ simulate: true }).modo, 'simulacao');
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
  assert.doesNotMatch(optimizer, /simulate !== true/);
  assert.match(precos, /requireAgentHumanConfirm/);
  assert.match(precos, /buildAgentInvokePayload/);
  assert.match(precos, /confirmed: true/);
});

test('P2 agentes: permissionOptimizer e oportunidadeScorer exigem usuario e confirmacao', async () => {
  assert.equal(AGENT_FUNCTION_MAP.permissionOptimizer.critical, true);
  assert.equal(AGENT_FUNCTION_MAP.oportunidadeScorer.critical, true);
  assert.equal(AGENT_FUNCTION_MAP.iaChurnAnalyzer.agent, 'atendimento');

  const stamp = buildAgentInvokePayload({
    functionName: 'permissionOptimizer',
    confirmed: true,
    groupId: 'g1',
    empresaId: 'e1',
  });
  assert.equal(stamp.agente, 'seguranca');
  assert.equal(stamp.confirmado, true);
  assert.equal(stamp.group_id, 'g1');

  const permOpt = await readFile(new URL('../base44/functions/permissionOptimizer/entry.ts', import.meta.url), 'utf8');
  const oppScorer = await readFile(new URL('../base44/functions/oportunidadeScorer/entry.ts', import.meta.url), 'utf8');
  const scan = await readFile(new URL('../base44/functions/iaFinanceAnomalyScan/entry.ts', import.meta.url), 'utf8');

  assert.match(permOpt, /Unauthorized/);
  assert.match(permOpt, /assertPermission/);
  assert.match(permOpt, /confirmacao humana/);
  assert.doesNotMatch(permOpt, /Admin required/);
  assert.match(permOpt, /modo: 'sugestao'/);

  assert.match(oppScorer, /Unauthorized/);
  assert.match(oppScorer, /assertPermission/);
  assert.match(oppScorer, /confirmacao humana/);
  assert.match(oppScorer, /modo: 'sugestao'/);

  assert.match(scan, /podePersistirAlertas/);
  assert.match(scan, /confirmado === true/);
});

test('P2.8 Gate17: funcoes AGENT_FUNCTION_MAP nao elevam com asServiceRole', async () => {
  const mapped = Object.keys(AGENT_FUNCTION_MAP);
  for (const name of mapped) {
    const src = await readFile(new URL(`../base44/functions/${name}/entry.ts`, import.meta.url), 'utf8');
    assert.match(src, /assertPermission|auth\.me|requireEntityGuard/, `${name} sem guard de usuario/permissao`);
    if (name === 'iaFinanceAnomalyScan') {
      assert.match(src, /entitiesApi = user \? base44\.entities : base44\.asServiceRole\.entities/);
      assert.match(src, /confirmado === true/);
      continue;
    }
    assert.doesNotMatch(src, /asServiceRole/, `${name} ainda usa asServiceRole`);
  }

  const sod = await readFile(new URL('../base44/functions/sodValidator/entry.ts', import.meta.url), 'utf8');
  assert.match(sod, /modo: 'sugestao'/);
  assert.doesNotMatch(sod, /PerfilAcesso\.update/);
});
