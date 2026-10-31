/**
 * Lacuna integra: Parametro* sky windowMode + ID técnico idOnly.
 * RecordState pin e36231b3 preservado (sem dadosIniciais/aliases nos 4 pinned).
 * OrigemPedido (fora pin) mantém aliases Visualizador. Sem count+1.
 * Fora: ParametroRoteirizacao / ApiExterna / ChatbotCanal.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

const PINNED = [
  ['src/components/cadastros/ParametroPortalClienteForm.jsx', 'ParametroPortalCliente', 'id-tecnico-parametro-portal-cliente'],
  ['src/components/cadastros/ParametroCaixaDiarioForm.jsx', 'ParametroCaixaDiario', 'id-tecnico-parametro-caixa-diario'],
  ['src/components/cadastros/ParametroConciliacaoBancariaForm.jsx', 'ParametroConciliacaoBancaria', 'id-tecnico-parametro-conciliacao-bancaria'],
  ['src/components/cadastros/ParametroRecebimentoNFeForm.jsx', 'ParametroRecebimentoNFe', 'id-tecnico-parametro-recebimento-nfe'],
];

for (const [file, label, action] of PINNED) {
  test(`${label}: sky + ID técnico idOnly (RecordState pin-safe; sem count+1)`, () => {
    const source = fs.readFileSync(file, 'utf8');
    assert.match(source, /from-sky-50/);
    assert.match(source, /to-sky-100/);
    assert.match(source, /CadastroCodigoRegistroField/);
    assert.match(source, /idOnly/);
    assert.match(source, new RegExp(action.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(source, /useCadastroRecordState/);
    assert.doesNotMatch(source, /const dadosIniciais/);
    assert.doesNotMatch(source, /count\s*\+\s*1/);
    assert.doesNotMatch(source, /from-purple-50/);
  });
}

test('ParametroOrigemPedido: sky + idOnly + aliases Visualizador (fora pin RecordState)', () => {
  const source = fs.readFileSync('src/components/cadastros/ParametroOrigemPedidoForm.jsx', 'utf8');
  assert.match(source, /from-sky-50/);
  assert.match(source, /CadastroCodigoRegistroField/);
  assert.match(source, /idOnly/);
  assert.match(source, /id-tecnico-parametro-origem-pedido/);
  assert.match(source, /\bitem\b/);
  assert.match(source, /\binitialData\b/);
  assert.match(source, /updated_at\s*\?\?\s*.*updated_date/);
  assert.doesNotMatch(source, /count\s*\+\s*1/);
});

test('ParametroRoteirizacao: fora deste lote (reserva #399)', () => {
  const source = fs.readFileSync('src/components/cadastros/ParametroRoteirizacaoForm.jsx', 'utf8');
  assert.doesNotMatch(source, /from-sky-50/);
});
