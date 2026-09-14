import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  assertEntregaOnCreate,
  assertEntregaOnDelete,
  assertEntregaOnUpdate,
  assertRomaneioOnCreate,
  classifyEntregaStatusTransition,
  entregaAtribuidaAoMotorista,
  entregaStatusPermissionActions,
  hasProvaEntrega,
} from '../src/components/lib/expedicaoEntregaPolicy.js';
import {
  resolveEntregaContext,
  sanitizeEntregaPayload,
  summarizeGeolocationAudit,
  summarizePredictionAudit,
} from '../src/components/expedicao/formulario-entrega/entregaFormPolicy.js';

test('formulario exige Grupo e empresa autorizada no contexto', () => {
  assert.deepEqual(resolveEntregaContext({ grupoAtual: { id: 'g1' }, estaNoGrupo: true }), {
    groupId: 'g1', empresaId: null, empresaPertence: false, contextoValido: false,
  });

  const externo = resolveEntregaContext({
    grupoAtual: { id: 'g1' }, empresaSelecionadaId: 'e2',
    empresasDoGrupo: [{ id: 'e1' }], estaNoGrupo: true,
  });
  assert.equal(externo.contextoValido, false);
  assert.equal(externo.empresaPertence, false);

  const autorizado = resolveEntregaContext({
    grupoAtual: { id: 'g1' }, empresaSelecionadaId: 'e1',
    empresasDoGrupo: [{ id: 'e1' }], estaNoGrupo: true,
  });
  assert.equal(autorizado.contextoValido, true);
});

test('formulario ignora empresa adulterada no registro em contexto de empresa', () => {
  const contexto = resolveEntregaContext({
    empresaAtual: { id: 'e1', group_id: 'g1' },
    empresaSelecionadaId: 'empresa-externa',
    estaNoGrupo: false,
  });
  assert.equal(contexto.groupId, 'g1');
  assert.equal(contexto.empresaId, 'e1');
  assert.equal(contexto.contextoValido, true);
});

test('formulario sanitiza payload e resume auditoria de IA', () => {
  const sanitized = sanitizeEntregaPayload({ observacoes: '<script>javascript:alert(1)</script>' });
  assert.equal(sanitized.observacoes, 'scriptalert(1)/script');
  assert.deepEqual(summarizePredictionAudit({ data_prevista: '2026-09-20', confianca_percentual: 90 }), {
    sugestao_recebida: true, confianca_faixa: 'alta',
  });
  assert.deepEqual(summarizeGeolocationAudit({ link_google_maps: 'https://maps.test', latitude: -23, longitude: -46 }), {
    coordenadas_recebidas: true, link_recebido: true,
  });
});

test('formulario usa contrato vigente do CEP e nao confia no registro para contexto', async () => {
  const formulario = await readFile(new URL('../src/components/expedicao/FormularioEntrega.jsx', import.meta.url), 'utf8');
  const secoes = await readFile(new URL('../src/components/expedicao/formulario-entrega/EntregaFormSections.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(formulario, /Boolean\(groupId \|\| empresaId\)/);
  assert.doesNotMatch(formulario, /formData\?\.group_id/);
  assert.match(secoes, /onEnderecoEncontrado=/);
  assert.match(secoes, /enderecoAtual=/);
  assert.doesNotMatch(secoes, /onCEPFound=/);
});

test('entrega exige empresa e nao marca entregue sem prova', () => {
  assert.throws(() => assertEntregaOnCreate({ record: { pedido_id: 'p1' }, entregas: [] }), /Empresa obrigatoria/);
  assert.throws(
    () => assertEntregaOnCreate({ record: { empresa_id: 'e1', status: 'Entregue' }, entregas: [] }),
    /comprovante/,
  );
});

test('retirada com recebedor e prova suficiente', () => {
  assert.equal(hasProvaEntrega({
    tipo_frete: 'Retirada',
    comprovante_entrega: { nome_recebedor: 'Joao' },
  }), true);
  const created = assertEntregaOnCreate({
    record: {
      empresa_id: 'e1',
      pedido_id: 'p1',
      tipo_frete: 'Retirada',
      status: 'Entregue',
      comprovante_entrega: { nome_recebedor: 'Joao', documento_recebedor: '123' },
    },
    entregas: [],
  });
  assert.equal(created.reuse, null);
});

test('retry do mesmo pedido reusa a entrega', () => {
  const existing = { id: 'ent-1', empresa_id: 'e1', pedido_id: 'p1', status: 'Pronto para Expedir' };
  const decision = assertEntregaOnCreate({
    record: { empresa_id: 'e1', pedido_id: 'p1' },
    entregas: [existing],
  });
  assert.equal(decision.reuse.id, 'ent-1');
});

test('romaneio exige motorista, veiculo e empresa', () => {
  assert.throws(
    () => assertRomaneioOnCreate({ record: { empresa_id: 'e1', entregas_ids: ['a'] }, romaneios: [] }),
    /Motorista/,
  );
  const retry = assertRomaneioOnCreate({
    record: { empresa_id: 'e1', motorista: 'Ana', placa: 'ABC1D23', entregas_ids: ['a', 'b'] },
    romaneios: [{ id: 'r1', empresa_id: 'e1', motorista: 'Ana', placa: 'ABC1D23', entregas_ids: ['b', 'a'] }],
  });
  assert.equal(retry.reuse.id, 'r1');
});

test('update nao entrega sem comprovante e nao troca empresa', () => {
  assert.throws(
    () => assertEntregaOnUpdate({ before: { empresa_id: 'e1', status: 'Em Trânsito' }, patch: { status: 'Entregue' } }),
    /comprovante/,
  );
  assert.throws(
    () => assertEntregaOnUpdate({ before: { empresa_id: 'e1' }, patch: { empresa_id: 'e2' } }),
    /nao pode ser alterada/,
  );
  const next = assertEntregaOnUpdate({
    before: { empresa_id: 'e1', status: 'Em Trânsito' },
    patch: { status: 'Entregue', comprovante_entrega: { nome_recebedor: 'Maria', foto_comprovante: 'https://img' } },
  });
  assert.equal(next.record.status, 'Entregue');
  assert.equal(next.action, 'entregar');
});

test('classifica transicao e alçada de status', () => {
  assert.equal(classifyEntregaStatusTransition('Em Trânsito', 'Entregue'), 'entregar');
  assert.equal(classifyEntregaStatusTransition('Separacao', 'Conferido'), 'conferir');
  assert.equal(classifyEntregaStatusTransition('Pronto', 'Em Trânsito'), 'expedir');
  assert.equal(classifyEntregaStatusTransition('Em Trânsito', 'Frustrada'), 'ocorrencia');
  assert.deepEqual(entregaStatusPermissionActions('entregar'), ['entregar', 'confirmar']);
  assert.deepEqual(entregaStatusPermissionActions('conferir'), ['conferir', 'editar']);
});

test('delete bloqueia entrega finalizada ou em transito', () => {
  assert.throws(
    () => assertEntregaOnDelete({ status: 'Entregue', comprovante_entrega: { nome_recebedor: 'A', foto_comprovante: 'x' } }),
    /Nao excluir/,
  );
  assert.throws(() => assertEntregaOnDelete({ status: 'Em Trânsito' }), /transito/);
  assert.doesNotThrow(() => assertEntregaOnDelete({ status: 'Aguardando', empresa_id: 'e1' }));
});

test('ocorrencia exige motivo e frustrada congela campos-chave', () => {
  assert.throws(
    () => assertEntregaOnUpdate({ before: { empresa_id: 'e1', status: 'Em Trânsito' }, patch: { status: 'Frustrada' } }),
    /Ocorrencia exige motivo/,
  );
  const ok = assertEntregaOnUpdate({
    before: { empresa_id: 'e1', status: 'Em Trânsito' },
    patch: { status: 'Frustrada', entrega_frustrada: { motivo: 'Cliente ausente' } },
  });
  assert.equal(ok.action, 'ocorrencia');
});

test('motorista so ve entrega atribuida', () => {
  const user = { id: 'u1', full_name: 'Carlos Motorista', email: 'carlos@local' };
  assert.equal(entregaAtribuidaAoMotorista({ id: '1', motorista_id: 'u1' }, user), true);
  assert.equal(entregaAtribuidaAoMotorista({ id: '2', motorista: 'Carlos Motorista' }, user), true);
  assert.equal(entregaAtribuidaAoMotorista({ id: '3', motorista_id: 'outro' }, user), false);
});

test('expedicao existente reserva numero e o app nao lista todas as entregas', async () => {
  const cadastro = await readFile(new URL('../src/api/localCadastroMasterPolicy.js', import.meta.url), 'utf8');
  const romaneio = await readFile(new URL('../src/components/expedicao/RomaneioForm.jsx', import.meta.url), 'utf8');
  const app = await readFile(new URL('../src/components/mobile/AppEntregasMotorista.jsx', import.meta.url), 'utf8');
  const fluxo = await readFile(new URL('../src/components/lib/useFluxoPedido.jsx', import.meta.url), 'utf8');
  const client = await readFile(new URL('../src/api/localBase44Client.js', import.meta.url), 'utf8');
  const pedidos = await readFile(new URL('../src/components/comercial/PedidosEntregaTab.jsx', import.meta.url), 'utf8');
  const separacao = await readFile(new URL('../src/components/expedicao/SeparacaoConferencia.jsx', import.meta.url), 'utf8');
  assert.match(cadastro, /Romaneio: \{ field: 'numero_romaneio'/);
  assert.match(cadastro, /Entrega: \{ field: 'qr_code'/);
  assert.doesNotMatch(romaneio, /ROM-" \+ Date\.now/);
  assert.doesNotMatch(fluxo, /ENT-\$\{Date\.now\(\)\}/);
  assert.match(app, /filterInContext\('Entrega'/);
  assert.doesNotMatch(app, /Entrega\.list\(/);
  assert.match(app, /appMotoristaPolicy/);
  assert.match(app, /buildConfirmacaoPatch/);
  assert.match(client, /Entrega: \{ module: 'Expedicao', section: 'Entrega' \}/);
  assert.match(client, /assertEntregaOnDelete/);
  assert.match(client, /entregaStatusPermissionActions/);
  assert.match(pedidos, /canEntregar/);
  assert.match(separacao, /Separacao", "conferir"/);
});
