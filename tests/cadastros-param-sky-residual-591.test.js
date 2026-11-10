/**
 * #591 — sky residual params fora branches reservadas.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

const FORMS = [
  'ParametroPortalClienteForm.jsx',
  'ParametroCaixaDiarioForm.jsx',
  'ParametroConciliacaoBancariaForm.jsx',
  'ParametroRecebimentoNFeForm.jsx',
  'ParametroOrigemPedidoForm.jsx',
];

for (const name of FORMS) {
  test(`${name}: windowMode sky chrome (sem redesign paralelo)`, () => {
    const src = read(`src/components/cadastros/${name}`);
    assert.match(src, /from-sky-50 to-sky-100/);
    assert.match(src, /windowMode/);
    assert.match(src, /data-cadastro-visual="sky-param-/);
  });
}

test('reservas WIP não foram editadas neste lote', () => {
  for (const name of ['ApiExternaForm.jsx', 'ParametroRoteirizacaoForm.jsx', 'ChatbotCanalForm.jsx']) {
    const src = read(`src/components/cadastros/${name}`);
    assert.doesNotMatch(src, /data-cadastro-visual="sky-param-/);
  }
});

test('UsuarioForm/CadastroFiscalForm: sem sky estrutural neste tip (CANAL/ID-only)', () => {
  const usuario = read('src/components/cadastros/UsuarioForm.jsx');
  const fiscal = read('src/components/cadastros/CadastroFiscalForm.jsx');
  assert.doesNotMatch(usuario, /data-cadastro-visual="sky-usuario"/);
  assert.doesNotMatch(fiscal, /data-cadastro-visual="sky-cadastro-fiscal"/);
  assert.doesNotMatch(fiscal, /windowMode/);
  assert.match(fiscal, /border-purple-200 bg-purple-50/);
});
