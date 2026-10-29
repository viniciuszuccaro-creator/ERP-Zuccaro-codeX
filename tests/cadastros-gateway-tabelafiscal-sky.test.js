import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

for (const [file, label, pin] of [
  ['src/components/cadastros/GatewayPagamentoForm.jsx', 'GatewayPagamento', 'useCadastroRecordState'],
  ['src/components/cadastros/TabelaFiscalForm.jsx', 'TabelaFiscal', 'useCadastroRecordState'],
  ['src/components/cadastros/ConfiguracaoNFeForm.jsx', 'ConfiguracaoNFe', 'useCadastroRecordState'],
]) {
  test(`${label}: sky windowMode + ID técnico residual (sem count+1)`, () => {
    const source = fs.readFileSync(file, 'utf8');
    assert.match(source, /from-sky-50 to-sky-100/);
    assert.match(source, /ID técnico/);
    assert.doesNotMatch(source, /count\s*\+\s*1/);
    assert.match(source, new RegExp(pin));
  });
}
