import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildWizardEtapa1ParametrosOrigemQueryKey,
  buildWizardEtapa1EnderecosClienteQueryKey,
  isWizardEtapa1ScopeCurrent,
  resolveWizardEtapa1ParametrosKpiState,
  pickLocaisEntregaFromCliente,
} from '../src/components/comercial/wizard/wizardEtapa1ClienteScope.js';

test('WizardEtapa1Cliente usa filterInContext/getInContext e remove list/get unscoped', () => {
  const src = readFileSync('src/components/comercial/wizard/WizardEtapa1Cliente.jsx', 'utf8');
  assert.match(src, /filterInContext\(\s*'ParametroOrigemPedido'/);
  assert.match(src, /getInContext\(\s*'Cliente'/);
  assert.match(src, /WIZARD_ETAPA1_PARAMETROS_STALE_SCOPE/);
  assert.match(src, /WIZARD_ETAPA1_ENDERECOS_STALE_SCOPE/);
  assert.match(src, /erro ≠ 0 canais/);
  assert.match(src, /Carregando canais de origem/);
  assert.doesNotMatch(src, /entities\.ParametroOrigemPedido\.list\(/);
  assert.doesNotMatch(src, /entities\.Cliente\.get\(/);
  assert.doesNotMatch(src, /initialData:\s*\[\]/);
  assert.doesNotMatch(src, /data:\s*parametrosOrigem\s*=\s*\[\]/);
  assert.doesNotMatch(src, /from ['"]@\/api\/base44Client['"]/);
});

test('queryKey separa Grupo, Empresa, ator e sessão', () => {
  const base = { groupId: 'g1', empresaId: 'e1', actorId: 'a1', sessionKey: 's1' };
  const k = buildWizardEtapa1ParametrosOrigemQueryKey(base);
  assert.deepEqual(k, ['wizard-etapa1-parametros-origem', 'g1', 'e1', 'a1', 's1']);
  assert.notDeepEqual(
    buildWizardEtapa1ParametrosOrigemQueryKey({ ...base, sessionKey: 's2' }),
    k,
  );
  const e = buildWizardEtapa1EnderecosClienteQueryKey({ ...base, clienteId: 'c9' });
  assert.deepEqual(e, ['wizard-etapa1-enderecos-cliente', 'g1', 'e1', 'a1', 's1', 'c9']);
});

test('KPI loading/erro nunca é ready (≠ 0 canais)', () => {
  assert.equal(resolveWizardEtapa1ParametrosKpiState({
    contextoValido: true, isLoading: true, isError: false, isFetching: false, dataDefined: false,
  }), 'loading');
  assert.equal(resolveWizardEtapa1ParametrosKpiState({
    contextoValido: true, isLoading: false, isError: true, isFetching: false, dataDefined: false,
  }), 'error');
  assert.equal(resolveWizardEtapa1ParametrosKpiState({
    contextoValido: true, isLoading: false, isError: false, isFetching: false, dataDefined: true,
  }), 'ready');
  assert.equal(resolveWizardEtapa1ParametrosKpiState({
    contextoValido: false, isLoading: false, isError: false, isFetching: false, dataDefined: false,
  }), 'unavailable');
});

test('pickLocaisEntregaFromCliente preserva contrato locais_entrega', () => {
  assert.deepEqual(pickLocaisEntregaFromCliente(null), []);
  assert.deepEqual(pickLocaisEntregaFromCliente({ id: 'c1' }), []);
  assert.deepEqual(
    pickLocaisEntregaFromCliente({ id: 'c1', locais_entrega: [{ id: 'o1', apelido: 'Obra' }] }),
    [{ id: 'o1', apelido: 'Obra' }],
  );
});

test('resposta tardia: troca ator/sessão invalida escopo', () => {
  const expected = { actorId: 'a1', sessionKey: 's1' };
  assert.equal(isWizardEtapa1ScopeCurrent(expected, { actorId: 'a1', sessionKey: 's1' }), true);
  assert.equal(isWizardEtapa1ScopeCurrent(expected, { actorId: 'a2', sessionKey: 's1' }), false);
});
