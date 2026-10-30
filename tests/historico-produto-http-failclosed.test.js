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
  // Codex: cada consulta Pedido/OP/Mov deve usar legadoConsultaHabilitada (não só uma ocorrência).
  assert.equal((src.match(/enabled:\s*legadoConsultaHabilitada/g) || []).length, 3);
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
  // P1: painel Uso em Produção não chama toFixed em null.
  assert.doesNotMatch(src, /totalUsadoProducao\.toFixed/);
  assert.match(src, /fmtAgregado\(totalUsadoProducao\)/);
  // P2: série/tendência/projeção HTTP ≠ vazio/estável inventado.
  assert.match(src, /tendenciaCusto = httpMode\s*\n\s*\? 'indisponivel'/);
  assert.match(src, /Série de custo por movimentação indisponível em HTTP/);
  assert.match(src, /tendenciaCusto === 'indisponivel' \? '—'/);
  // Legado path preservado (não apagar filterInContext).
  assert.match(src, /filterInContext\('Pedido'/);
  assert.match(src, /filterInContext\('OrdemProducao'/);
  assert.match(src, /filterInContext\('MovimentacaoEstoque'/);
});
