import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  assertEntregaMotoristaOnUpdate,
  buildChegadaPatch,
  buildConfirmacaoPatch,
  buildOcorrenciaPatch,
  buildReversaPatch,
  enqueueMotoristaAction,
  filtrarEntregasDoMotorista,
  isMotoristaIdempotencyKey,
  ordenarEntregasRota,
  proximaParada,
  readMotoristaQueue,
  resolveMotoristaIdsForUser,
  writeMotoristaQueue,
} from '../src/components/lib/appMotoristaPolicy.js';
import { classifyEntregaStatusTransition } from '../src/components/lib/expedicaoEntregaPolicy.js';

const memoryStorage = () => {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
  };
};

test('lista so entregas atribuídas, ordena rota e indica proxima parada', () => {
  const user = { id: 'u1', full_name: 'Joao Motorista', email: 'joao@x.com' };
  const motoristas = [{ id: 'm1', usuario_id: 'u1', email: 'joao@x.com' }];
  const entregas = [
    { id: 'e2', motorista_id: 'm1', status: 'Em Trânsito', sequencia_rota: 2, cliente_nome: 'B' },
    { id: 'e1', motorista_id: 'm1', status: 'Saiu para Entrega', sequencia_rota: 1, cliente_nome: 'A' },
    { id: 'e3', motorista_id: 'outro', status: 'Em Trânsito', sequencia_rota: 1, cliente_nome: 'C' },
  ];
  const minhas = filtrarEntregasDoMotorista(entregas, user, motoristas);
  assert.equal(minhas.length, 2);
  assert.equal(ordenarEntregasRota(minhas)[0].id, 'e1');
  assert.equal(proximaParada(entregas, user, motoristas).id, 'e1');
  assert.ok(resolveMotoristaIdsForUser(user, motoristas).includes('m1'));
});

test('confirmacao, chegada, ocorrencia e reversa validam motorista e prova', () => {
  const user = { id: 'm1', full_name: 'Joao' };
  const entrega = { id: 'e1', motorista_id: 'm1', status: 'Em Trânsito', historico_status: [] };

  assert.equal(buildChegadaPatch({ entrega, user }).status, 'Chegada no Cliente');
  assert.ok(isMotoristaIdempotencyKey(buildChegadaPatch({ entrega, user }).idempotency_key));

  assert.throws(
    () => buildConfirmacaoPatch({
      entrega,
      user,
      comprovante: { nome_recebedor: 'Ana' },
    }),
    /comprovante/,
  );

  const ok = buildConfirmacaoPatch({
    entrega,
    user,
    comprovante: { nome_recebedor: 'Ana', foto_comprovante: 'img' },
  });
  assert.equal(ok.status, 'Entregue');
  assert.match(ok.idempotency_key, /confirmacao/);

  const parcial = buildConfirmacaoPatch({
    entrega,
    user,
    parcial: true,
    quantidade_entregue: 2,
    comprovante: { nome_recebedor: 'Ana', assinatura_digital: 'sig' },
  });
  assert.equal(parcial.status, 'Entrega Parcial');

  assert.throws(
    () => buildOcorrenciaPatch({ entrega: { ...entrega, motorista_id: 'x' }, user, motivo: 'Ausente' }),
    /nao atribuida/,
  );
  assert.equal(buildOcorrenciaPatch({ entrega, user, motivo: 'Ausente' }).status, 'Entrega Frustrada');

  assert.throws(
    () => buildReversaPatch({ entrega, user, motivo: 'Avaria' }),
    /quantidade ou valor/,
  );
  assert.equal(buildReversaPatch({ entrega, user, motivo: 'Avaria', quantidade: 1 }).status, 'Devolvido');
});

test('fila offline grava escopo e e idempotente', () => {
  const storage = memoryStorage();
  writeMotoristaQueue([], storage);
  const first = enqueueMotoristaAction({
    tipo: 'confirmacao',
    entrega_id: 'e1',
    patch: { status: 'Entregue' },
    idempotency_key: 'motorista|confirmacao|e1|x',
    group_id: 'g1',
    empresa_id: 'e1',
    usuario_id: 'u1',
  }, storage);
  const retry = enqueueMotoristaAction({
    tipo: 'confirmacao',
    entrega_id: 'e1',
    patch: { status: 'Entregue' },
    idempotency_key: 'motorista|confirmacao|e1|x',
    group_id: 'g1',
    empresa_id: 'e1',
    usuario_id: 'u1',
  }, storage);
  assert.equal(first.reused, false);
  assert.equal(retry.reused, true);
  assert.equal(readMotoristaQueue(storage).length, 1);
  assert.equal(first.action.group_id, 'g1');
  assert.equal(first.action.empresa_id, 'e1');
});

test('assert motorista e chegada mapeia para entregar', () => {
  assert.equal(classifyEntregaStatusTransition('Em Trânsito', 'Chegada no Cliente'), 'entregar');
  const before = { id: 'e1', motorista_id: 'm1', empresa_id: 'emp1', status: 'Em Trânsito' };
  assert.throws(
    () => assertEntregaMotoristaOnUpdate({
      before,
      patch: { status: 'Chegada no Cliente', idempotency_key: 'motorista|chegada|e1|x' },
      user: { id: 'outro' },
    }),
    /nao atribuida/,
  );
  const ok = assertEntregaMotoristaOnUpdate({
    before,
    patch: { status: 'Chegada no Cliente', idempotency_key: 'motorista|chegada|e1|x' },
    user: { id: 'm1' },
  });
  assert.equal(ok.status, 'Chegada no Cliente');
});

test('app motorista usa policy, fila e proxima parada', async () => {
  const app = await readFile(new URL('../src/components/mobile/AppEntregasMotorista.jsx', import.meta.url), 'utf8');
  const romaneio = await readFile(new URL('../src/components/expedicao/RomaneioForm.jsx', import.meta.url), 'utf8');
  const client = await readFile(new URL('../src/api/localBase44Client.js', import.meta.url), 'utf8');
  const expedicao = await readFile(new URL('../src/components/lib/expedicaoEntregaPolicy.js', import.meta.url), 'utf8');
  assert.match(app, /appMotoristaPolicy/);
  assert.match(app, /proximaParada/);
  assert.match(app, /enqueueMotoristaAction/);
  assert.match(app, /buildChegadaPatch/);
  assert.match(app, /updateInContext/);
  assert.match(app, /Motorista\.chegada/);
  assert.match(app, /Entrega parcial/);
  assert.match(romaneio, /motorista_id/);
  assert.match(romaneio, /sequencia_rota/);
  assert.match(client, /assertEntregaMotoristaOnUpdate/);
  assert.match(expedicao, /Entrega parcial exige comprovante/);
  assert.match(expedicao, /Devolucao exige motivo/);
});
