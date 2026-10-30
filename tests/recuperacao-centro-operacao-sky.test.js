/**
 * Recuperação indep. — CentroOperacaoForm sky windowMode + ID técnico.
 * Padrão #407 Filial/configs: chrome azul-claro, sem CodigoField/count+1 no browser.
 * Fora da candidata #401; sem misturar contagens/#434.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const SRC = 'src/components/cadastros/CentroOperacaoForm.jsx';

test('CentroOperacao: sky windowMode + ID técnico (sem count+1)', () => {
  const source = readFileSync(SRC, 'utf8');
  assert.match(source, /windowMode\s*=\s*false/);
  assert.match(source, /if\s*\(\s*windowMode\s*\)/);
  assert.match(source, /from-sky-50 to-sky-100/);
  assert.match(source, /bg-sky-600/);
  assert.match(source, /ID técnico/);
  assert.match(source, /CadastroCodigoRegistroField/);
  assert.match(source, /idOnly/);
  assert.match(source, /action="id-tecnico-centro-operacao"/);
  assert.match(source, /data-permission="Cadastros\.CentroOperacao/);
  assert.match(source, /useCadastroRecordState/);
  assert.doesNotMatch(source, /count\s*\+\s*1/);
  assert.doesNotMatch(source, /from-purple-50/);
  assert.doesNotMatch(source, /bg-blue-600 hover:bg-blue-700/);
});
