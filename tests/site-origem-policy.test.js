import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  applySiteOrigemOnCreate,
  assertSiteCheckout,
  matchClienteSite,
  SITE_ORIGEM,
  stampSiteOrigem,
} from '../src/components/lib/siteOrigemPolicy.js';

test('checkout do site exige empresa e itens', () => {
  assert.throws(() => assertSiteCheckout({ empresaId: '', itens: [{ id: 1 }] }), /Empresa obrigatoria/);
  assert.throws(() => assertSiteCheckout({ empresaId: 'e1', itens: [] }), /Carrinho vazio/);
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

test('catalogo do site grava origem site, lead e nao depende de gateway', async () => {
  const page = await readFile(new URL('../src/pages/OrcamentoSite.jsx', import.meta.url), 'utf8');
  const ia = await readFile(new URL('../src/components/site/OrcamentoAutomaticoIA.jsx', import.meta.url), 'utf8');
  assert.match(page, /stampSiteOrigem/);
  assert.match(page, /buildSiteLeadPayload/);
  assert.doesNotMatch(page, /origem_pedido: "E-commerce"/);
  assert.doesNotMatch(page, /throw new Error\("Gateway/);
  assert.match(page, /canal="Site"/);
  assert.match(page, /PortalCliente/);
  assert.match(ia, /createInContext\('OrcamentoSite'/);
  assert.match(ia, /stampSiteOrigem/);
  assert.doesNotMatch(ia, /Site Base44/);
});
