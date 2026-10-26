/**
 * Contatos Cliente via contrato HTTP MASTER existente (email/telefone/celular).
 * BFF .strict continua rejeitando `contatos[]` cru — projeção no adapter.
 * Dados sintéticos / isolados.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyContatosProjection,
  hydrateContatosFromScalars,
  toClienteMasterHttpPayload,
  withHydratedContatos,
} from '../src/api/clienteHttpPayload.js';
import { createHttpApiClient } from '../src/api/httpApiClient.js';

test('projeção: adicionar E-mail/Telefone/WhatsApp → escalares; contatos ausente no wire', () => {
  const payload = toClienteMasterHttpPayload({
    tipo: 'Pessoa Jurídica',
    documento: '11.222.333/0001-81',
    razao_social: 'Sintético Contatos LTDA',
    contatos: [
      { nome: 'Fiscal', tipo: 'E-mail', valor: 'fiscal@sintetico.dev', principal: true },
      { nome: 'Compras', tipo: 'Telefone', valor: '1133334444', principal: false },
      { nome: 'Logística', tipo: 'WhatsApp', valor: '11999998888', principal: false },
    ],
  });
  assert.equal(payload.email, 'fiscal@sintetico.dev');
  assert.equal(payload.telefone, '1133334444');
  assert.equal(payload.celular, '11999998888');
  assert.equal(payload.contatos, undefined);
});

test('projeção: editar principal do canal (dois e-mails) usa o marcado principal', () => {
  const out = {};
  applyContatosProjection({
    contatos: [
      { tipo: 'E-mail', valor: 'old@sintetico.dev', principal: false },
      { tipo: 'E-mail', valor: 'novo@sintetico.dev', principal: true },
    ],
  }, out);
  assert.equal(out.email, 'novo@sintetico.dev');
});

test('projeção: remover canal (array sem telefone) limpa telefone=null', () => {
  const payload = toClienteMasterHttpPayload({
    tipo: 'Pessoa Física',
    documento: '529.982.247-25',
    nome: 'PF Contatos',
    telefone: '1133334444',
    contatos: [
      { tipo: 'E-mail', valor: 'pf@sintetico.dev', principal: true },
    ],
  });
  // telefone explícito no src tem precedência — limpar via só contatos:
  const cleared = toClienteMasterHttpPayload({
    tipo: 'Pessoa Física',
    documento: '529.982.247-25',
    nome: 'PF Contatos',
    contatos: [
      { tipo: 'E-mail', valor: 'pf@sintetico.dev', principal: true },
    ],
  });
  assert.equal(cleared.telefone, null);
  assert.equal(cleared.email, 'pf@sintetico.dev');
  assert.equal(payload.telefone, '1133334444', 'escalar explícito vence projeção');
});

test('hidratação: escalares → contatos[] para reabertura UI', () => {
  const contatos = hydrateContatosFromScalars({
    email: 'reabrir@sintetico.dev',
    telefone: '1144445555',
    celular: '11988887777',
  });
  assert.equal(contatos.length, 3);
  assert.equal(contatos[0].tipo, 'E-mail');
  assert.equal(contatos[0].valor, 'reabrir@sintetico.dev');
  assert.equal(contatos[0].principal, true);
  assert.equal(contatos[1].tipo, 'Telefone');
  assert.equal(contatos[2].tipo, 'WhatsApp');
});

test('withHydratedContatos: não sobrescreve array já presente', () => {
  const row = withHydratedContatos({
    email: 'a@b.c',
    contatos: [{ tipo: 'E-mail', valor: 'kept@sintetico.dev', principal: true }],
  });
  assert.equal(row.contatos[0].valor, 'kept@sintetico.dev');
});

test('HttpApiClient Cliente.update: projeta contatos e hidrata resposta', async () => {
  /** @type {Record<string, unknown>|null} */
  let body = null;
  const client = createHttpApiClient({
    baseUrl: 'http://localhost:3080',
    getScope: () => ({ groupId: 'grupo-sintetico', empresaId: 'empresa-sintetica', token: 'tok' }),
    fetchImpl: async (_url, init) => {
      body = JSON.parse(init.body);
      return new Response(JSON.stringify({
        data: {
          id: 'cli-1',
          email: body.email,
          telefone: body.telefone,
          celular: body.celular,
          razao_social: 'CLIENTE DEV SINTETICO PJ A LTDA',
        },
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    },
  });
  const updated = await client.entities.Cliente.update('cli-1', {
    tipo: 'Pessoa Jurídica',
    documento: '11.222.333/0001-81',
    razao_social: 'CLIENTE DEV SINTETICO PJ A LTDA',
    contatos: [
      { tipo: 'E-mail', valor: 'a@b.c', principal: true },
      { tipo: 'Telefone', valor: '1133334444', principal: false },
    ],
  });
  assert.equal(body.contatos, undefined);
  assert.equal(body.email, 'a@b.c');
  assert.equal(body.telefone, '1133334444');
  assert.ok(Array.isArray(updated.contatos));
  assert.equal(updated.contatos[0].valor, 'a@b.c');
});

test('HttpApiClient Cliente.get: hidrata contatos a partir de escalares do BFF', async () => {
  const client = createHttpApiClient({
    baseUrl: 'http://localhost:3080',
    getScope: () => ({ groupId: 'grupo-sintetico', empresaId: 'empresa-sintetica', token: 'tok' }),
    fetchImpl: async () => new Response(JSON.stringify({
      data: {
        id: 'cli-get',
        email: 'get@sintetico.dev',
        telefone: '1155556666',
        celular: null,
      },
    }), { status: 200, headers: { 'content-type': 'application/json' } }),
  });
  const row = await client.entities.Cliente.get('cli-get');
  assert.equal(row.contatos.length, 2);
  assert.equal(row.contatos[0].tipo, 'E-mail');
  assert.equal(row.contatos[1].valor, '1155556666');
});

test('HttpApiClient: resposta tardia após troca de sessão não é responsabilidade do adapter de payload', async () => {
  // Scope capturado no request; adapter só projeta body — sessão/revogação é fail-closed no BFF.
  let scopes = [];
  let scope = { groupId: 'g-a', empresaId: 'e-a', token: 'tok-a' };
  const client = createHttpApiClient({
    baseUrl: 'http://localhost:3080',
    getScope: () => {
      scopes.push({ ...scope });
      return scope;
    },
    fetchImpl: async (_url, init) => {
      // Simula latência: sessão já rotacionou quando a resposta chega; body ainda reflete request.
      scope = { groupId: 'g-b', empresaId: 'e-b', token: 'tok-b' };
      const body = JSON.parse(init.body);
      return new Response(JSON.stringify({
        data: { id: 'cli-late', email: body.email, telefone: body.telefone, celular: body.celular },
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    },
  });
  const result = await client.entities.Cliente.update('cli-late', {
    tipo: 'Pessoa Física',
    documento: '529.982.247-25',
    nome: 'Late',
    contatos: [{ tipo: 'E-mail', valor: 'late@sintetico.dev', principal: true }],
  });
  assert.equal(scopes[0].token, 'tok-a');
  assert.equal(scope.token, 'tok-b');
  assert.equal(result.email, 'late@sintetico.dev');
  // UI deve usar assertScopeCurrent (já coberto em cadastros-contatos-enderecos-rbac);
  // aqui provamos que o wire usou o scope do momento do envio.
});
