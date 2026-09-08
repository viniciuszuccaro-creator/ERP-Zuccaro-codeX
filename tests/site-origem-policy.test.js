import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  applySiteOrigemOnCreate,
  assertSiteCheckout,
  assertSiteContato,
  buildSiteLeadPayload,
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

const contatoOk = { nome: 'Ana Site', email: 'ana@site.test' };

test('checkout do site exige empresa e itens', () => {
  assert.throws(() => assertSiteCheckout({ empresaId: '', itens: [{ id: 1 }], contato: contatoOk }), /Empresa obrigatoria/);
  assert.throws(() => assertSiteCheckout({ empresaId: 'e1', itens: [], contato: contatoOk }), /Carrinho vazio/);
});

test('checkout exige contato com nome e email ou documento', () => {
  assert.throws(() => assertSiteContato({}), /Nome obrigatorio/);
  assert.throws(() => assertSiteContato({ nome: 'Ana' }), /e-mail ou CPF/);
  assert.throws(() => assertSiteContato({ nome: 'Ana', email: 'x' }), /E-mail invalido/);
  assert.equal(assertSiteContato({ nome: 'Ana', documento: '12345678901' }), true);
  assert.throws(
    () => assertSiteCheckout({
      empresaId: 'e1',
      itens: [{ produto: { id: 'p1', exibir_no_site: true, estoque_disponivel: 3, preco_venda: 12 }, qty: 1, precoUnit: 12 }],
      contato: { nome: 'Ana' },
    }),
    /e-mail ou CPF/,
  );
});

test('checkout bloqueia item sem preco ou sem estoque online', () => {
  assert.throws(
    () => assertSiteCheckout({
      empresaId: 'e1',
      itens: [{ produto: { id: 'p1', exibir_no_site: true, estoque_disponivel: 5, preco_venda: 0 }, qty: 1 }],
      contato: contatoOk,
    }),
    /preco/,
  );
  assert.throws(
    () => assertSiteCheckout({
      empresaId: 'e1',
      itens: [{ produto: { id: 'p1', exibir_no_site: true, estoque_disponivel: 0, preco_venda: 10 }, qty: 1 }],
      contato: contatoOk,
    }),
    /indisponivel/,
  );
  assert.equal(
    assertSiteCheckout({
      empresaId: 'e1',
      itens: [{ produto: { id: 'p1', exibir_no_site: true, estoque_disponivel: 3, preco_venda: 12 }, qty: 2, precoUnit: 12 }],
      contato: contatoOk,
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

test('lead do site exige empresa e contato', () => {
  assert.throws(() => buildSiteLeadPayload({ nome: 'Ana', email: 'ana@site.test' }), /Empresa obrigatoria/);
  const lead = buildSiteLeadPayload({
    nome: 'Ana',
    email: 'ana@site.test',
    empresaId: 'e1',
    groupId: 'g1',
    valor: 50,
  });
  assert.equal(lead.empresa_id, 'e1');
  assert.equal(lead.group_id, 'g1');
  assert.equal(lead.origem, SITE_ORIGEM);
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

test('pagamento placeholder nao marca gerado sem link e status inclui entrega', () => {
  const semGateway = buildSitePagamentoPlaceholder({
    pedidoId: 'ped-1',
    contaId: 'cr-1',
    valor: 100,
    gatewayAtivo: false,
  });
  assert.equal(semGateway.status, 'pendente_configuracao');
  assert.equal(semGateway.url, null);

  const gatewaySemLink = buildSitePagamentoPlaceholder({
    pedidoId: 'ped-1',
    contaId: 'cr-1',
    valor: 100,
    gatewayAtivo: true,
  });
  assert.equal(gatewaySemLink.status, 'aguardando_configuracao_link');
  assert.doesNotMatch(gatewaySemLink.status, /gerado/);

  const comLink = buildSitePagamentoPlaceholder({
    pedidoId: 'ped-1',
    contaId: 'cr-1',
    valor: 100,
    gatewayAtivo: true,
    pagamentoUrl: 'https://pay.example/x',
  });
  assert.equal(comLink.status, 'aguardando_gateway');
  assert.equal(comLink.url, 'https://pay.example/x');

  const resumo = buildSitePedidoStatusResumo({
    pedido: { id: 'ped-1', numero_pedido: 'P-1', tipo: 'Orçamento', valor_total: 100, pode_ver_no_portal: true },
    conta: { id: 'cr-1', valor: 100 },
    pagamento: semGateway,
  });
  assert.equal(resumo.numero_pedido, 'P-1');
  assert.equal(resumo.pagamento.referencia, semGateway.referencia);
  assert.equal(resumo.entrega.status, 'Aguardando expedicao');
  assert.match(resumo.portal_url, /PortalCliente/);
});

test('catalogo do site grava origem site, lead e nao depende de gateway', async () => {
  const page = await readFile(new URL('../src/pages/OrcamentoSite.jsx', import.meta.url), 'utf8');
  const ia = await readFile(new URL('../src/components/site/OrcamentoAutomaticoIA.jsx', import.meta.url), 'utf8');
  const aba = await readFile(new URL('../src/components/cadastros/AbaEcommerceProduto.jsx', import.meta.url), 'utf8');
  const catalogo = await readFile(new URL('../src/components/cadastros/CatalogoWebForm.jsx', import.meta.url), 'utf8');
  const widget = await readFile(new URL('../src/components/chatbot/ChatbotWidget.jsx', import.meta.url), 'utf8');
  assert.match(page, /stampSiteOrigem/);
  assert.match(page, /buildSiteLeadPayload/);
  assert.match(page, /filtrarProdutosSite/);
  assert.match(page, /buildSitePedidoStatusResumo/);
  assert.match(page, /assertSiteCheckout/);
  assert.match(page, /createInContext\("AuditLog"/);
  assert.match(page, /OrcamentoAutomaticoIA/);
  assert.doesNotMatch(page, /origem_pedido: "E-commerce"/);
  assert.doesNotMatch(page, /throw new Error\("Gateway/);
  assert.doesNotMatch(page, /status_integracao: "gerado"/);
  assert.match(page, /canal="Site"/);
  assert.match(page, /PortalCliente/);
  assert.match(ia, /createInContext\('OrcamentoSite'/);
  assert.match(ia, /createInContext\('AuditoriaIA'/);
  assert.match(ia, /empresaId: empresaAtual\?\.id/);
  assert.match(ia, /stampSiteOrigem/);
  assert.doesNotMatch(ia, /Site Base44/);
  assert.match(aba, /exibir_site: v/);
  assert.match(catalogo, /syncFlagsCatalogoProduto/);
  assert.match(catalogo, /Empresa obrigatoria para catalogo do site/);
  assert.match(widget, /isSiteCanal/);
  assert.match(widget, /Canal Site sem ConfiguracaoCanal/);
});
