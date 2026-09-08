import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  assertAutomacaoContext,
  isEmitirAutomaticoEnabled,
  resolveCobrancaScanScope,
  stampAutomacaoResult,
} from '../src/components/lib/automacaoAvancadaPolicy.js';

test('automacao exige contexto grupo/empresa', () => {
  assert.throws(() => assertAutomacaoContext({ groupId: '', empresaId: 'e1' }), /Grupo/);
  assert.throws(() => assertAutomacaoContext({ groupId: 'g1', empresaId: '', scopeType: 'empresa' }), /Empresa/);
  const ok = assertAutomacaoContext({ groupId: 'g1', empresaId: 'e1' });
  assert.equal(ok.group_id, 'g1');
});

test('cobranca nao varre sem escopo explicito', () => {
  assert.throws(() => resolveCobrancaScanScope({}), /group_id ou empresa_id/);
  const scoped = resolveCobrancaScanScope({ groupId: 'g1' });
  assert.equal(scoped.modo, 'escopo_explicito');
  assert.equal(scoped.group_id, 'g1');
});

test('emitir_automatico so com flag ativa', () => {
  assert.equal(isEmitirAutomaticoEnabled([]), false);
  assert.equal(isEmitirAutomaticoEnabled([{ ativo: true, emitir_automatico: false }]), false);
  assert.equal(isEmitirAutomaticoEnabled([{ ativo: true, emitir_automatico: true }]), true);
  assert.equal(isEmitirAutomaticoEnabled([{ ativo: false, emitir_automatico: true }]), false);
});

test('P2 automacoes: backends e UIs no contrato seguro', async () => {
  const stamped = stampAutomacaoResult({ executado: false, reason: 'emitir_automatico_desligado' });
  assert.equal(stamped.modo, 'sugestao');
  assert.equal(stamped.executado, false);

  const nfe = await readFile(new URL('../base44/functions/onPedidoReadyToInvoice/entry.ts', import.meta.url), 'utf8');
  const pay = await readFile(new URL('../base44/functions/paymentStatusManager/entry.ts', import.meta.url), 'utf8');
  const form = await readFile(new URL('../src/components/cadastros/ConfiguracaoNFeForm.jsx', import.meta.url), 'utf8');
  const regua = await readFile(new URL('../src/components/financeiro/ReguaCobrancaIA.jsx', import.meta.url), 'utf8');
  const fin = await readFile(new URL('../src/pages/Financeiro.jsx', import.meta.url), 'utf8');
  const mon = await readFile(new URL('../src/components/administracao-sistema/MonitoramentoManutencaoIndex.jsx', import.meta.url), 'utf8');
  const notif = await readFile(new URL('../src/components/sistema/ConfiguracaoNotificacoes.jsx', import.meta.url), 'utf8');

  assert.match(nfe, /emitir_automatico_desligado/);
  assert.match(nfe, /ConfiguracaoNFe\.filter/);
  assert.match(pay, /group_id ou empresa_id obrigatorio/);
  assert.match(pay, /modo: 'escopo_explicito'/);
  assert.match(pay, /lembretes_cobranca exige internal_token/);
  assert.doesNotMatch(pay, /empsAll/);
  assert.match(form, /requireAutomacaoHumanConfirm/);
  assert.match(regua, /requireAutomacaoHumanConfirm/);
  assert.doesNotMatch(regua, /setInterval/);
  assert.match(fin, /ReguaCobrancaIA/);
  assert.match(mon, /ConfiguracaoNotificacoes/);
  assert.match(mon, /HistoricoBackups/);
  assert.doesNotMatch(notif, /localStorage\.getItem\('group_atual_id'\)/);
});
