import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildCalcularComissoesInvalidateKey,
  isCalcularComissoesScopeCurrent,
  filtrarPedidosPeriodoComissao,
  agruparComissoesPorVendedor,
} from '../src/components/comercial/calcularComissoesScope.js';

test('CalcularComissoesForm usa createInContext e remove Comissao.create unscoped', () => {
  const src = readFileSync('src/components/comercial/CalcularComissoesForm.jsx', 'utf8');
  assert.match(src, /createInContext\(\s*'Comissao'/);
  assert.match(src, /CALCULAR_COMISSOES_STALE_SCOPE/);
  assert.match(src, /contexto obrigatório/);
  assert.doesNotMatch(src, /entities\.Comissao\.create\(/);
  assert.doesNotMatch(src, /from ['"]@\/api\/base44Client['"]/);
});

test('invalidateKey separa Grupo, Empresa, ator e sessão', () => {
  const base = { groupId: 'g1', empresaId: 'e1', actorId: 'a1', sessionKey: 's1' };
  const k = buildCalcularComissoesInvalidateKey(base);
  assert.deepEqual(k, ['comissoes', 'g1', 'e1', 'a1', 's1']);
  assert.notDeepEqual(
    buildCalcularComissoesInvalidateKey({ ...base, sessionKey: 's2' }),
    k,
  );
});

test('filtrarPedidosPeriodoComissao preserva contrato de status', () => {
  const inicio = new Date('2026-01-01');
  const fim = new Date('2026-01-31');
  const rows = [
    { status: 'Aprovado', data_pedido: '2026-01-10', valor_total: 100, vendedor: 'A' },
    { status: 'Rascunho', data_pedido: '2026-01-10', valor_total: 50, vendedor: 'A' },
    { status: 'Entregue', data_pedido: '2025-12-01', valor_total: 80, vendedor: 'B' },
  ];
  const out = filtrarPedidosPeriodoComissao(rows, inicio, fim);
  assert.equal(out.length, 1);
  assert.equal(out[0].valor_total, 100);
});

test('agruparComissoesPorVendedor aplica percentual padrão 5%', () => {
  const agrupadas = agruparComissoesPorVendedor([
    { vendedor: 'Ana', vendedor_id: 'u1', valor_total: 200, id: 'p1' },
    { vendedor: 'Ana', vendedor_id: 'u1', valor_total: 100, id: 'p2' },
  ], 5);
  assert.equal(agrupadas.length, 1);
  assert.equal(agrupadas[0].total_vendas, 300);
  assert.equal(agrupadas[0].valor_comissao, 15);
});

test('resposta tardia: troca ator/sessão invalida escopo', () => {
  const expected = { actorId: 'a1', sessionKey: 's1' };
  assert.equal(isCalcularComissoesScopeCurrent(expected, { actorId: 'a1', sessionKey: 's1' }), true);
  assert.equal(isCalcularComissoesScopeCurrent(expected, { actorId: 'a2', sessionKey: 's1' }), false);
});
