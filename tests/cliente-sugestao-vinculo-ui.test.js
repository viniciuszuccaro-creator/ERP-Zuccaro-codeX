import assert from 'node:assert/strict';
import test from 'node:test';
import { createHttpApiClient } from '../src/api/httpApiClient.js';
import {
  buildClienteSugestaoVinculoBanner,
  buildClienteSugestaoVinculoRaceKey,
  digitsDocumento,
  documentoProntoParaSugestao,
  shouldApplyClienteSugestaoVinculoBanner,
} from '../src/components/cadastros/clienteSugestaoVinculoUi.js';

test('documentoProntoParaSugestao aceita CPF/CNPJ e rejeita incompleto', () => {
  assert.equal(digitsDocumento('12.345.678/0001-99'), '12345678000199');
  assert.equal(documentoProntoParaSugestao('123.456.789-09'), '12345678909');
  assert.equal(documentoProntoParaSugestao('12.345.678/0001-99'), '12345678000199');
  assert.equal(documentoProntoParaSugestao('123'), null);
  assert.equal(documentoProntoParaSugestao(''), null);
});

test('banner match: mostra máscara e proíbe mescla automática', () => {
  const banner = buildClienteSugestaoVinculoBanner({
    ok: true,
    data: {
      sugestao: true,
      motivo: 'documento_igual_no_grupo',
      mescla: 'revisao_humana_obrigatoria',
      codigo: 'C-001',
      nome: 'Cliente Sintetico',
      documento_mascarado: '***.456.789-**',
      cliente_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    },
  });
  assert.equal(banner.visible, true);
  assert.equal(banner.tone, 'match');
  assert.match(banner.detail, /revisão humana/i);
  assert.match(banner.detail, /C-001/);
  assert.equal(banner.mescla, 'revisao_humana_obrigatoria');
  assert.doesNotMatch(banner.detail, /mesclar automaticamente/i);
});

test('race key: resposta atrasada de outro documento/escopo é descartada', () => {
  const a = buildClienteSugestaoVinculoRaceKey({
    documento: '12345678909',
    groupId: 'g1',
    empresaId: 'e1',
  });
  const b = buildClienteSugestaoVinculoRaceKey({
    documento: '12345678909',
    groupId: 'g1',
    empresaId: 'e2',
  });
  const c = buildClienteSugestaoVinculoRaceKey({
    documento: '98765432100',
    groupId: 'g1',
    empresaId: 'e1',
  });
  assert.notEqual(a, b);
  assert.notEqual(a, c);
  assert.equal(shouldApplyClienteSugestaoVinculoBanner(a, a), true);
  assert.equal(shouldApplyClienteSugestaoVinculoBanner(a, b), false);
  assert.equal(shouldApplyClienteSugestaoVinculoBanner('', a), false);
});

test('banner fail-closed: 401/403 e sem_match não liberam create', () => {
  const denied = buildClienteSugestaoVinculoBanner({ ok: false, status: 403 });
  assert.equal(denied.visible, true);
  assert.equal(denied.tone, 'blocked');
  const idle = buildClienteSugestaoVinculoBanner({
    ok: true,
    data: { sugestao: false, motivo: 'sem_match', mescla: 'proibida' },
  });
  assert.equal(idle.visible, false);
  assert.equal(idle.tone, 'idle');
});

test('HttpApiClient.clientes.sugestaoVinculo consulta rota canônica com documento', async () => {
  /** @type {string[]} */
  const urls = [];
  const client = createHttpApiClient({
    baseUrl: 'https://erp.synthetic.test',
    getScope: () => ({
      token: 'tok',
      actorId: '22222222-2222-4222-8222-222222222222',
      groupId: '33333333-3333-4333-8333-333333333333',
      empresaId: '44444444-4444-4444-8444-444444444444',
    }),
    fetchImpl: async (url, init) => {
      urls.push(String(url));
      assert.equal(init.headers.Authorization, 'Bearer tok');
      assert.equal(init.headers['X-Group-Id'], '33333333-3333-4333-8333-333333333333');
      return new Response(JSON.stringify({
        data: {
          sugestao: true,
          mescla: 'revisao_humana_obrigatoria',
          documento_mascarado: '***.456.789-**',
          codigo: 'C-9',
          nome: 'Dup',
        },
      }), { status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
    },
  });
  const body = await client.clientes.sugestaoVinculo({ documento: '12345678909' });
  assert.match(urls[0], /\/api\/v1\/clientes\/sugestao-vinculo/);
  assert.match(urls[0], /documento=12345678909/);
  assert.equal(body.data.sugestao, true);
  const empty = await client.clientes.sugestaoVinculo({ documento: '  ' });
  assert.equal(empty.data.motivo, 'documento_ausente');
  assert.equal(urls.length, 1);
});
