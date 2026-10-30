/**
 * Recuperação: HistoricoProduto (cadastros) — HTTP fail-closed.
 * Não usar filterInContext('Pedido') em HTTP nem inventar zeros como “sem vendas”.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  historicoProdutoHttpIndisponivelMessage,
  historicoProdutoLegadoConsultaEnabled,
  isHistoricoProdutoHttpMode,
} from '../src/components/cadastros/historicoProdutoConsultaPolicy.js';

const formPath = new URL('../src/components/cadastros/HistoricoProduto.jsx', import.meta.url);

test('política: HTTP mode detectado; legado só fora de HTTP', () => {
  assert.equal(isHistoricoProdutoHttpMode({ VITE_ERP_BACKEND: 'http' }), true);
  assert.equal(isHistoricoProdutoHttpMode({ VITE_ERP_BACKEND: 'local' }), false);
  assert.equal(
    historicoProdutoLegadoConsultaEnabled({
      produtoId: 'p1',
      contextoValido: true,
      httpMode: true,
    }),
    false,
  );
  assert.equal(
    historicoProdutoLegadoConsultaEnabled({
      produtoId: 'p1',
      contextoValido: true,
      httpMode: false,
    }),
    true,
  );
  assert.equal(
    historicoProdutoLegadoConsultaEnabled({
      produtoId: null,
      contextoValido: true,
      httpMode: false,
    }),
    false,
  );
  assert.match(historicoProdutoHttpIndisponivelMessage(), /indisponíveis em HTTP/);
  assert.match(historicoProdutoHttpIndisponivelMessage(), /Não use zeros/);
});

test('HistoricoProduto: HTTP não habilita filterInContext Pedido/OP/Mov; banner + null≠0', async () => {
  const src = await readFile(formPath, 'utf8');
  assert.match(src, /isHistoricoProdutoHttpMode/);
  assert.match(src, /legadoConsultaHabilitada/);
  assert.match(src, /enabled:\s*legadoConsultaHabilitada/);
  assert.doesNotMatch(
    src,
    /enabled:\s*!!produtoId\s*&&\s*contextoValido/,
  );
  assert.match(src, /data-historico-produto-http-indisponivel/);
  assert.match(src, /historicoProdutoHttpIndisponivelMessage/);
  assert.match(src, /httpMode \? null : pedidos\.reduce/);
  assert.match(src, /httpMode \? null : ordensProducao\.reduce/);
  assert.match(src, /fmtAgregado/);
  assert.match(src, /Number\.isFinite\(value\) \? value\.toFixed\(0\) : '—'/);
  // Legado path preservado (não apagar filterInContext).
  assert.match(src, /filterInContext\('Pedido'/);
  assert.match(src, /filterInContext\('OrdemProducao'/);
  assert.match(src, /filterInContext\('MovimentacaoEstoque'/);
});
