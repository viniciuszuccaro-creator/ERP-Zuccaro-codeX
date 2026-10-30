/**
 * Recuperação indep. — Produto V22 windowMode sky + ID; Endereços embed sky.
 * Base #445 Boletos; fora candidata #401 / cadeia #441/#442/#446.
 * V22 é o form canônico (legado ProdutoForm keep-both intocado).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const PRODUTO = 'src/components/cadastros/ProdutoFormV22_Completo.jsx';
const ENDERECOS = 'src/components/cadastros/GerenciarEnderecosClienteForm.jsx';

test('ProdutoFormV22: sky windowMode + ID técnico (sem data-action novo; sem count+1)', () => {
  const source = readFileSync(PRODUTO, 'utf8');
  assert.match(source, /windowMode\s*=\s*false/);
  assert.match(source, /if\s*\(\s*windowMode\s*\)/);
  assert.match(source, /from-sky-50 to-sky-100/);
  assert.match(source, /ID técnico/);
  assert.match(source, /data-action="id-tecnico-produto"/); // já existia no form
  assert.doesNotMatch(source, /data-action="id-tecnico-produto-sky/);
  assert.doesNotMatch(source, /count\s*\+\s*1/);
  assert.doesNotMatch(source, /from-purple-50/);
});

test('GerenciarEnderecosClienteForm: chrome sky embed + RBAC (sem count+1)', () => {
  const source = readFileSync(ENDERECOS, 'utf8');
  assert.match(source, /from-sky-50 to-sky-100/);
  assert.match(source, /bg-sky-600/);
  assert.match(source, /text-sky-600/);
  assert.match(source, /data-action="cliente-enderecos-embed"/);
  assert.match(source, /data-permission="Cadastros\.Cliente\.editar"/);
  assert.match(source, /podeEditar/);
  assert.doesNotMatch(source, /count\s*\+\s*1/);
  assert.doesNotMatch(source, /hover:border-blue-500/);
});
