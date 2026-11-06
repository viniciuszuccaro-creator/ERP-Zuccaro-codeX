import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  resolvePainelFornecedorKpiState,
  isPainelFornecedorScopeCurrent,
  sumPainelFornecedorTotalCompras,
} from '../src/components/cadastros/painelDinamicoFornecedorScope.js';

test('PainelDinamicoFornecedor usa filterInContext sem entities unscoped', () => {
  const src = readFileSync('src/components/cadastros/PainelDinamicoFornecedor.jsx', 'utf8');
  assert.match(src, /filterInContext\(\s*'OrdemCompra'/);
  assert.match(src, /PAINEL_FORNECEDOR_ORDENS_STALE_SCOPE/);
  assert.match(src, /Erro ≠ R\$ 0 \/ 0 ordens/);
  assert.doesNotMatch(src, /entities\.OrdemCompra\.filter\(/);
  assert.doesNotMatch(src, /data:\s*ordensCompra\s*=\s*\[\]/);
  assert.doesNotMatch(src, /from ['"]@\/api\/base44Client['"]/);
});

test('KPI e total compras', () => {
  assert.equal(resolvePainelFornecedorKpiState({
    painelAberto: true, contextoValido: true, fornecedorId: 'f1',
    isLoading: true, isError: false, isFetching: false, dataDefined: false,
  }), 'loading');
  assert.equal(resolvePainelFornecedorKpiState({
    painelAberto: true, contextoValido: true, fornecedorId: 'f1',
    isLoading: false, isError: true, isFetching: false, dataDefined: false,
  }), 'error');
  assert.equal(sumPainelFornecedorTotalCompras([
    { status: 'Recebida', valor_total: 10 },
    { status: 'Cancelada', valor_total: 99 },
  ]), 10);
  assert.equal(isPainelFornecedorScopeCurrent(
    { actorId: 'a', sessionKey: 's' },
    { actorId: 'a', sessionKey: 's' },
  ), true);
});
