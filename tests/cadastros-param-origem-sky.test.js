/**
 * Residual: sky windowMode + ID técnico em ParametroOrigemPedido.
 * Preserva useCadastroRecordState; sem count+1.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

test('ParametroOrigemPedido: sky windowMode + ID técnico residual (sem count+1)', () => {
  const source = fs.readFileSync('src/components/cadastros/ParametroOrigemPedidoForm.jsx', 'utf8');
  assert.match(source, /from-sky-50 to-sky-100/);
  assert.match(source, /ID técnico/);
  assert.match(source, /useCadastroRecordState/);
  assert.doesNotMatch(source, /count\s*\+\s*1/);
});
