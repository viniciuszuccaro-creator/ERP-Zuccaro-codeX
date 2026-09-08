import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  assertEntregaOnCreate,
  assertEntregaOnUpdate,
  assertRomaneioOnCreate,
  entregaAtribuidaAoMotorista,
  hasProvaEntrega,
} from '../src/components/lib/expedicaoEntregaPolicy.js';

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
  assert.equal(next.status, 'Entregue');
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
  assert.match(cadastro, /Romaneio: \{ field: 'numero_romaneio'/);
  assert.match(cadastro, /Entrega: \{ field: 'qr_code'/);
  assert.doesNotMatch(romaneio, /ROM-" \+ Date\.now/);
  assert.doesNotMatch(fluxo, /ENT-\$\{Date\.now\(\)\}/);
  assert.match(app, /filterInContext\('Entrega'/);
  assert.doesNotMatch(app, /Entrega\.list\(/);
  assert.match(app, /appMotoristaPolicy/);
  assert.match(app, /buildConfirmacaoPatch/);
});
