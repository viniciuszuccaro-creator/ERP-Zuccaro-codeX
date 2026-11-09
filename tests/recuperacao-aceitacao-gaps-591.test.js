/**
 * Aceite profundo recuperações #591 — gaps fechados (não só atalho visível).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(p, 'utf8');

test('Separação clássica: launchpad envia candidatas; componente tem seletor', () => {
  const exp = read('src/pages/Expedicao.jsx');
  const sep = read('src/components/expedicao/SeparacaoConferencia.jsx');
  assert.match(exp, /entregasCandidatas:\s*entregasFiltradas/);
  assert.match(exp, /pedidosCandidatos:\s*pedidosLista/);
  assert.match(sep, /entregasCandidatas/);
  assert.match(sep, /Selecione uma entrega para conferência/);
  assert.match(sep, /data-action="separacao-selecionar-entrega"/);
});

test('ConfigFinanceiroLogistica: contexto exige grupo E empresa', () => {
  const src = read('src/components/expedicao/financeiro/ConfigFinanceiroLogistica.jsx');
  assert.match(src, /Boolean\(effectiveGroupId && effectiveEmpresaId\)/);
  assert.doesNotMatch(src, /Boolean\(effectiveGroupId \|\| effectiveEmpresaId\)/);
});

test('Widget Fechamento: não abre dashboard sem permissão', () => {
  const src = read('src/components/comercial/WidgetFechamentoPedidos.jsx');
  assert.match(src, /canOpenFechamento/);
  assert.match(src, /disabled=\{!canOpenFechamento\}/);
  assert.match(src, /Comercial.*Fechamento.*visualizar/);
});

test('ConfiguracoesUsuario: falha de save não é silenciosa', () => {
  const src = read('src/pages/ConfiguracoesUsuario.jsx');
  assert.match(src, /onError:\s*\(error\)\s*=>/);
  assert.match(src, /toast\.error/);
});
