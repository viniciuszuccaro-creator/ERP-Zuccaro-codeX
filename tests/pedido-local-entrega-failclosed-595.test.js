/**
 * Pedido canônico: ENTREGA exige cliente_local_id operacional (explore gap + alinhamento).
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const panel = readFileSync('src/components/comercial/PedidoCanonicoPanel.jsx', 'utf8');
const seletor = readFileSync('src/components/comercial/SeletorEnderecoEntregaPedido.jsx', 'utf8');
const picker = readFileSync('src/components/comercial/comercialMasterPicker.js', 'utf8');

test('PedidoCanonico: ENTREGA bloqueia save sem local operacional', () => {
  assert.match(panel, /form\.tipo_operacao==='ENTREGA'/);
  assert.match(panel, /Entrega exige local operacional ativo com finalidade ENTREGA e identidade canônica/);
  assert.match(panel, /filter\(isLocalEntregaOperacional\)/);
  assert.match(panel, /endereco_incompleto===false/);
  assert.match(panel, /data-action="pedido-selecionar-cliente-local"/);
  // NENHUM só fora de ENTREGA
  assert.match(panel, /form\.tipo_operacao!=='ENTREGA'&&<SelectItem value="NENHUM">/);
});

test('PedidoCanonico: filtro compartilhado UI/save rejeita fiscal-only e incompleto', () => {
  const start = panel.indexOf('const isLocalEntregaOperacional =');
  const end = panel.indexOf('\nconst money =', start);
  assert.ok(start >= 0 && end > start);
  const allowed = vm.runInNewContext(panel.slice(start, end) + '\nisLocalEntregaOperacional;');
  // Identidade/cliente/escopo/ativo já passam pelo resolver canônico de mestres;
  // aqui se verifica a finalidade operacional adicional usada por UI e save.
  const row = { id: '11111111-1111-4111-8111-111111111111', ativo: true,
    endereco_incompleto: false, finalidades: [{ ativo: true, finalidade: 'ENTREGA' }] };
  assert.equal(allowed(row), true);
  assert.equal(allowed({ ...row, ativo: false }), false);
  assert.equal(allowed({ ...row, endereco_incompleto: true }), false);
  assert.equal(allowed({ ...row, endereco_incompleto: undefined }), false);
  assert.equal(allowed({ ...row, finalidades: [{ ativo: true, finalidade: 'FISCAL' }] }), false);
  assert.equal(allowed({ ...row, finalidades: [{ ativo: false, finalidade: 'ENTREGA' }] }), false);
  assert.equal(allowed({ ...row, finalidades: [] }), false);
});

test('Auxiliar Central360 locais exige ativo; seletor legado HTTP alinhado', () => {
  assert.match(picker, /row\.ativo !== true/);
  // Continuity: Seletor usa snapshotLocais (listLocais array fica no Completo/Cadastros).
  assert.match(seletor, /snapshotLocais/);
  assert.match(seletor, /api\.clientes\.snapshotLocais/);
  assert.match(seletor, /fins\.includes\("ENTREGA"\)/);
});
