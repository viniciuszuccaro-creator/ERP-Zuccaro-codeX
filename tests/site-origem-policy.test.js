import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  applySiteOrigemOnCreate,
  assertSiteCheckout,
  buildSitePagamentoPlaceholder,
  buildSitePedidoStatusResumo,
  filtrarProdutosSite,
  isProdutoDisponivelSite,
  matchClienteSite,
  resolvePrecoSite,
  SITE_ORIGEM,
  stampSiteOrigem,
  syncFlagsCatalogoProduto,
} from '../src/components/lib/siteOrigemPolicy.js';

test('checkout do site exige empresa e itens', () => {
  assert.throws(() => assertSiteCheckout({ empresaId: '', itens: [{ id: 1 }] }), /Empresa obrigatoria/);
  assert.throws(() => assertSiteCheckout({ empresaId: 'e1', itens: [] }), /Carrinho vazio/);
});

test('checkout bloqueia item sem preco ou sem estoque online', () => {
  assert.throws(
    () => assertSiteCheckout({
      empresaId: 'e1',
      itens: [{ produto: { id: 'p1', exibir_no_site: true, estoque_disponivel: 5, preco_venda: 0 }, qty: 1 }],
    }),
    /preco/,
  );
  assert.throws(
    () => assertSiteCheckout({
      empresaId: 'e1',
      itens: [{ produto: { id: 'p1', exibir_no_site: true, estoque_disponivel: 0, preco_venda: 10 }, qty: 1 }],
    }),
    /indisponivel/,
  );
  assert.equal(
    assertSiteCheckout({
      empresaId: 'e1',
      itens: [{ produto: { id: 'p1', exibir_no_site: true, estoque_disponivel: 3, preco_venda: 12 }, qty: 2, precoUnit: 12 }],
    }),
    true,
  );
});

test('lead, orcamento e pedido do site ficam com origem site', () => {
  const stamped = stampSiteOrigem({ origem_pedido: 'E-commerce' });
  assert.equal(stamped.origem, SITE_ORIGEM);
  assert.equal(stamped.origem_pedido, SITE_ORIGEM);
  assert.equal(applySiteOrigemOnCreate('Pedido', { origem_pedido: 'E-commerce' }).origem, SITE_ORIGEM);
  assert.equal(applySiteOrigemOnCreate('OrcamentoSite', { origem: 'Site Base44' }).origem, SITE_ORIGEM);
  assert.equal(applySiteOrigemOnCreate('Pedido', { origem_pedido: 'Manual' }).origem_pedido, 'Manual');
});

test('casa cliente do site por email ou documento', () => {
  const clientes = [
    { id: 'c1', email: 'ana@site.test', cpf_cnpj: '123.456.789-00' },
  ];
  assert.equal(matchClienteSite({ clientes, email: 'ana@site.test' }).id, 'c1');
  assert.equal(matchClienteSite({ clientes, documento: '12345678900' }).id, 'c1');
  assert.equal(matchClienteSite({ clientes, email: 'outro@site.test' }), null);
});

test('catalogo unifica flags, preco e disponibilidade', () => {
  const flags = syncFlagsCatalogoProduto({ exibir_site: true });
  assert.equal(flags.exibir_no_site, true);
  assert.equal(flags.exibir_site, true);

  const map = new Map([['p1', 25]]);
  assert.equal(resolvePrecoSite({ id: 'p1', preco_venda: 10 }, map), 25);
  assert.equal(resolvePrecoSite({ id: 'p2', preco_venda: 10 }, map), 10);

  const list = filtrarProdutosSite(
    [
      { id: 'p1', descricao: 'Viga', exibir_no_site: true, estoque_disponivel: 5, preco_venda: 10, status: 'Ativo' },
      { id: 'p2', descricao: 'Inativo', exibir_no_site: true, estoque_disponivel: 5, preco_venda: 10, status: 'Inativo' },
      { id: 'p3', descricao: 'Via catalogo', estoque_disponivel: 2, preco_venda: 8 },
    ],
    {
      catalogos: [{ produto_id: 'p3', exibir_site: true, ativo: true }],
      precoMap: map,
    },
  );
  assert.deepEqual(list.map((item) => item.id).sort(), ['p1', 'p3']);
  assert.equal(isProdutoDisponivelSite({ id: 'p1', exibir_no_site: true, estoque_disponivel: 1, estoque_minimo_online: 2, preco_venda: 10 }), false);
});

test('pagamento placeholder e status do pedido sao estaveis', () => {
  const pagamento = buildSitePagamentoPlaceholder({
    pedidoId: 'ped-1',
    contaId: 'cr-1',
    valor: 100,
    gatewayAtivo: false,
  });
  assert.equal(pagamento.status, 'pendente_configuracao');
  assert.match(pagamento.referencia, /site\|ped-1\|cr-1/);

  const resumo = buildSitePedidoStatusResumo({
    pedido: { id: 'ped-1', numero_pedido: 'P-1', tipo: 'Orçamento', valor_total: 100, pode_ver_no_portal: true },
    conta: { id: 'cr-1', valor: 100 },
    pagamento,
  });
  assert.equal(resumo.numero_pedido, 'P-1');
  assert.equal(resumo.pagamento.referencia, pagamento.referencia);
  assert.match(resumo.portal_url, /PortalCliente/);
});

test('catalogo do site grava origem site, lead e nao depende de gateway', async () => {
  const page = await readFile(new URL('../src/pages/OrcamentoSite.jsx', import.meta.url), 'utf8');
  const ia = await readFile(new URL('../src/components/site/OrcamentoAutomaticoIA.jsx', import.meta.url), 'utf8');
  const aba = await readFile(new URL('../src/components/cadastros/AbaEcommerceProduto.jsx', import.meta.url), 'utf8');
  const catalogo = await readFile(new URL('../src/components/cadastros/CatalogoWebForm.jsx', import.meta.url), 'utf8');
  assert.match(page, /stampSiteOrigem/);
  assert.match(page, /buildSiteLeadPayload/);
  assert.match(page, /filtrarProdutosSite/);
  assert.match(page, /buildSitePedidoStatusResumo/);
  assert.match(page, /OrcamentoAutomaticoIA/);
  assert.doesNotMatch(page, /origem_pedido: "E-commerce"/);
  assert.doesNotMatch(page, /throw new Error\("Gateway/);
  assert.match(page, /canal="Site"/);
  assert.match(page, /PortalCliente/);
  assert.match(ia, /createInContext\('OrcamentoSite'/);
  assert.match(ia, /stampSiteOrigem/);
  assert.doesNotMatch(ia, /Site Base44/);
  assert.match(aba, /exibir_site: v/);
  assert.match(catalogo, /syncFlagsCatalogoProduto/);
});
