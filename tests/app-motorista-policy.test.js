import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  buildChegadaPatch,
  buildConfirmacaoPatch,
  buildOcorrenciaPatch,
  buildReversaPatch,
  enqueueMotoristaAction,
  filtrarEntregasDoMotorista,
  ordenarEntregasRota,
  proximaParada,
  readMotoristaQueue,
  writeMotoristaQueue,
} from '../src/components/lib/appMotoristaPolicy.js';

const memoryStorage = () => {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
  };
};

test('lista so entregas atribuídas, ordena rota e indica proxima parada', () => {
  const user = { id: 'm1', full_name: 'Joao Motorista' };
  const entregas = [
    { id: 'e2', motorista_id: 'm1', status: 'Em Trânsito', sequencia_rota: 2, cliente_nome: 'B' },
    { id: 'e1', motorista_id: 'm1', status: 'Saiu para Entrega', sequencia_rota: 1, cliente_nome: 'A' },
    { id: 'e3', motorista_id: 'outro', status: 'Em Trânsito', sequencia_rota: 1, cliente_nome: 'C' },
  ];
  const minhas = filtrarEntregasDoMotorista(entregas, user);
  assert.equal(minhas.length, 2);
  assert.equal(ordenarEntregasRota(minhas)[0].id, 'e1');
  assert.equal(proximaParada(entregas, user).id, 'e1');
});

test('confirmacao, chegada, ocorrencia e reversa validam motorista e prova', () => {
  const user = { id: 'm1', full_name: 'Joao' };
  const entrega = { id: 'e1', motorista_id: 'm1', status: 'Em Trânsito', historico_status: [] };

  assert.equal(buildChegadaPatch({ entrega, user }).status, 'Chegada no Cliente');

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

test('fila offline e idempotente', () => {
  const storage = memoryStorage();
  writeMotoristaQueue([], storage);
  const first = enqueueMotoristaAction({
    tipo: 'confirmacao',
    entrega_id: 'e1',
    patch: { status: 'Entregue' },
    idempotency_key: 'motorista|confirmacao|e1|x',
  }, storage);
  const retry = enqueueMotoristaAction({
    tipo: 'confirmacao',
    entrega_id: 'e1',
    patch: { status: 'Entregue' },
    idempotency_key: 'motorista|confirmacao|e1|x',
  }, storage);
  assert.equal(first.reused, false);
  assert.equal(retry.reused, true);
  assert.equal(readMotoristaQueue(storage).length, 1);
});

test('app motorista usa policy, fila e proxima parada', async () => {
  const app = await readFile(new URL('../src/components/mobile/AppEntregasMotorista.jsx', import.meta.url), 'utf8');
  const expedicao = await readFile(new URL('../src/components/lib/expedicaoEntregaPolicy.js', import.meta.url), 'utf8');
  assert.match(app, /appMotoristaPolicy/);
  assert.match(app, /proximaParada/);
  assert.match(app, /enqueueMotoristaAction/);
  assert.match(app, /buildChegadaPatch/);
  assert.match(app, /Entrega parcial/);
  assert.match(expedicao, /Entrega parcial exige comprovante/);
  assert.match(expedicao, /Devolucao exige motivo/);
});
