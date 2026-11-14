/**
 * Pedido canônico: ENTREGA exige cliente_local_id operacional (explore gap + alinhamento).
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const panel = readFileSync('src/components/comercial/PedidoCanonicoPanel.jsx', 'utf8');
const seletor = readFileSync('src/components/comercial/SeletorEnderecoEntregaPedido.jsx', 'utf8');
const picker = readFileSync('src/components/comercial/comercialMasterPicker.js', 'utf8');

test('PedidoCanonico: ENTREGA bloqueia save sem local operacional', () => {
  assert.match(panel, /form\.tipo_operacao==='ENTREGA'/);
  assert.match(panel, /Entrega exige local operacional ativo com identidade canônica/);
  assert.match(panel, /endereco_incompleto!==true/);
  assert.match(panel, /data-action="pedido-selecionar-cliente-local"/);
  // NENHUM só fora de ENTREGA
  assert.match(panel, /form\.tipo_operacao!=='ENTREGA'&&<SelectItem value="NENHUM">/);
});

test('Auxiliar Central360 locais exige ativo; seletor legado HTTP alinhado', () => {
  assert.match(picker, /row\.ativo !== true/);
  assert.match(seletor, /listLocais/);
  assert.match(seletor, /fins\.includes\("ENTREGA"\)/);
});
