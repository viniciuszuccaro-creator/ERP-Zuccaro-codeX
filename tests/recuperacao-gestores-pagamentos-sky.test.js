/**
 * Recuperação indep. — Gestores Formas/Gateways/Despesas sky windowMode.
 * Base #447 Produto/Endereços; fora #401/#446. Visual≠registros.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const FORMAS = 'src/components/cadastros/GestorFormasPagamento.jsx';
const GATEWAYS = 'src/components/cadastros/GestorGatewaysPagamento.jsx';
const DESPESAS = 'src/components/cadastros/GestorDespesasRecorrentes.jsx';

for (const [label, file] of [
  ['GestorFormasPagamento', FORMAS],
  ['GestorGatewaysPagamento', GATEWAYS],
  ['GestorDespesasRecorrentes', DESPESAS],
]) {
  test(`${label}: sky windowMode chrome + windowMode prop (sem count+1)`, () => {
    const source = readFileSync(file, 'utf8');
    assert.match(source, /windowMode\s*=\s*false/);
    assert.match(source, /from-sky-50 to-sky-100/);
    assert.match(source, /text-sky-600/);
    assert.doesNotMatch(source, /count\s*\+\s*1/);
    assert.doesNotMatch(source, /from-purple-50/);
  });
}

test('GestorFormasPagamento: abas e Nova Forma preservados com RBAC', () => {
  const source = readFileSync(FORMAS, 'utf8');
  assert.match(source, /TabsTrigger value="gestao"/);
  assert.match(source, /TabsTrigger value="analytics"/);
  assert.match(source, /TabsTrigger value="gateways"/);
  assert.match(source, /TabsTrigger value="integracao"/);
  assert.match(source, /data-action="gestor-formas-nova"/);
  assert.match(source, /podeCriar/);
  assert.match(source, /contextoValido/);
});
