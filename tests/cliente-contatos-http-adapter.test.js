import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Execute the real form's mapper/payload, not a test-only substitute.
/**
 * Fidelidade contatos[] ↔ escalares MASTER (email/telefone/celular).
 * Sem descarte silencioso; hidratação não finge lista completa.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CONTATOS_SCALAR_OVERFLOW,
  assessContatosScalarFidelity,
  applyContatosProjection,
  createContatosScalarOverflowError,
  scalarContactSummary,
  toClienteMasterHttpPayload,
  withHydratedContatos,
} from '../src/api/clienteHttpPayload.js';
function actualClienteFormPayload() {
  const source = readFileSync(new URL('../src/components/cadastros/CadastroClienteCompleto.jsx', import.meta.url), 'utf8');
  const tree = ts.createSourceFile('form.jsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
  let payload, mapper;
  const visit = node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === 'buildPayload') payload = node.initializer.getText(tree);
    if (ts.isCallExpression(node) && node.expression.getText(tree) === 'useCadastroReopenOnIdentity') {
      mapper = node.arguments[1].properties.find(p => p.name?.getText(tree) === 'mapToForm')?.initializer?.getText(tree);
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  assert.ok(payload && mapper, 'real payload and reopen mapper must exist');
  const helpers = source.slice(source.indexOf('const sanitizeText ='), source.indexOf('export default function'));
  return vm.runInNewContext(`${helpers}; ({ buildPayload: ${payload}, mapToForm: ${mapper} })`, {
    empresaAtual: { id: 'synthetic-company' }, groupId: 'synthetic-group', calcularSituacaoCredito: () => 'OK',
  });
}

test('form real: ausencia de contatos HTTP nao vira intencao de apagar escalares', () => {
  const { buildPayload, mapToForm } = actualClienteFormPayload();
  const record = { id: 'synthetic-client', tipo: 'Pessoa Jurídica', razao_social: 'SYNTHETIC', email: 'kept@example.test', telefone: '1133334444' };
  const draft = mapToForm(record);
  assert.equal(Object.hasOwn(draft, 'contatos'), false);
  const uiPayload = buildPayload({ ...draft, nome_fantasia: 'SYNTHETIC EDIT' });
  assert.equal(Object.hasOwn(uiPayload, 'contatos'), false);
  const wire = toClienteMasterHttpPayload(uiPayload);
  assert.equal(wire.email, record.email);
  assert.equal(wire.telefone, record.telefone);
  assert.equal(wire.nome_fantasia, 'SYNTHETIC EDIT');
  assert.equal(Object.hasOwn(record, 'contatos'), false);
});

test('form real: lista explicita divergente e metadata continuam bloqueadas', () => {
  const { buildPayload, mapToForm } = actualClienteFormPayload();
  for (const contatos of [[], [{ tipo: 'Telefone', valor: '', observacao: 'preservar' }]]) {
    const draft = mapToForm({ id: 'synthetic-client', email: 'kept@example.test', contatos });
    assert.equal(Object.hasOwn(draft, 'contatos'), true);
    assert.throws(() => toClienteMasterHttpPayload(buildPayload(draft)), error => error.code === CONTATOS_SCALAR_OVERFLOW);
  }
});
import { createHttpApiClient } from '../src/api/httpApiClient.js';

test('fidelidade ok: um contato por canal sem nome/obs e sem principal → projeta', () => {
  const payload = toClienteMasterHttpPayload({
    tipo: 'Pessoa Jurídica',
    documento: '11.222.333/0001-81',
    razao_social: 'Sintético Contatos LTDA',
    contatos: [
      { tipo: 'E-mail', valor: 'fiscal@sintetico.dev', principal: false },
      { tipo: 'Telefone', valor: '1133334444', principal: false },
      { tipo: 'WhatsApp', valor: '11999998888', principal: false },
    ],
  });
  assert.equal(payload.email, 'fiscal@sintetico.dev');
  assert.equal(payload.telefone, '1133334444');
  assert.equal(payload.celular, '11999998888');
  assert.equal(payload.contatos, undefined);
});

test('fidelidade: E-mail(principal=false)+Telefone(principal=true) → overflow (preferência entre canais)', () => {
  const assessment = assessContatosScalarFidelity([
    { tipo: 'E-mail', valor: 'fiscal@sintetico.dev', principal: false },
    { tipo: 'Telefone', valor: '1133334444', principal: true },
  ]);
  assert.equal(assessment.ok, false);
  assert.ok(assessment.losses.includes('principal_nao_representavel'));
  assert.throws(
    () => toClienteMasterHttpPayload({
      tipo: 'Pessoa Jurídica',
      documento: '11.222.333/0001-81',
      razao_social: 'X',
      contatos: [
        { tipo: 'E-mail', valor: 'fiscal@sintetico.dev', principal: false },
        { tipo: 'Telefone', valor: '1133334444', principal: true },
      ],
    }),
    (err) => err?.code === CONTATOS_SCALAR_OVERFLOW
      && err.losses.includes('principal_nao_representavel'),
  );
});

test('fidelidade: valor vazio com nome/obs/id/ordem → overflow (não descartar antes)', () => {
  for (const extra of [
    { nome: 'Fiscal' },
    { observacao: 'ramal 10' },
    { id: 'c-meta' },
    { ordem: 3 },
  ]) {
    const assessment = assessContatosScalarFidelity([
      { tipo: 'Telefone', valor: '   ', principal: false, ...extra },
    ]);
    assert.equal(assessment.ok, false, JSON.stringify(extra));
    assert.ok(
      assessment.losses.includes('metadata_sem_valor:0'),
      JSON.stringify(assessment.losses),
    );
  }
  // rascunho vazio sem metadata: tratamento vigente (ok)
  const emptyDraft = assessContatosScalarFidelity([
    { tipo: 'E-mail', valor: '', principal: false },
  ]);
  assert.equal(emptyDraft.ok, true);
});

test('fidelidade: múltiplos e-mails → CONTATOS_SCALAR_OVERFLOW (não descarta)', () => {
  const assessment = assessContatosScalarFidelity([
    { tipo: 'E-mail', valor: 'a@sintetico.dev', principal: false },
    { tipo: 'E-mail', valor: 'b@sintetico.dev', principal: true },
  ]);
  assert.equal(assessment.ok, false);
  assert.ok(assessment.losses.includes('multiplo_email'));
  assert.throws(
    () => toClienteMasterHttpPayload({
      tipo: 'Pessoa Física',
      documento: '529.982.247-25',
      nome: 'PF',
      contatos: [
        { tipo: 'E-mail', valor: 'a@sintetico.dev' },
        { tipo: 'E-mail', valor: 'b@sintetico.dev', principal: true },
      ],
    }),
    (err) => err?.code === CONTATOS_SCALAR_OVERFLOW && err?.status === 422,
  );
});

test('fidelidade: nome/observação/id/ordem → overflow (campos perdidos no escalar)', () => {
  for (const extra of [
    { nome: 'Fiscal' },
    { observacao: 'ramal 10' },
    { id: 'c-1' },
    { ordem: 2 },
  ]) {
    const assessment = assessContatosScalarFidelity([
      { tipo: 'Telefone', valor: '1133334444', principal: true, ...extra },
    ]);
    assert.equal(assessment.ok, false, JSON.stringify(extra));
  }
});

test('fidelidade: tipo não mapeável com valor → overflow', () => {
  const assessment = assessContatosScalarFidelity([
    { tipo: 'LinkedIn', valor: 'https://linkedin.com/in/x', principal: false },
  ]);
  assert.equal(assessment.ok, false);
  assert.ok(assessment.losses.some((l) => l.startsWith('tipo_nao_mapeavel')));
});

test('fidelidade: divergência array vs escalar explícito → overflow', () => {
  const out = { email: 'keep@sintetico.dev' };
  assert.throws(
    () => applyContatosProjection({
      contatos: [{ tipo: 'E-mail', valor: 'other@sintetico.dev', principal: true }],
    }, out),
    (err) => err?.code === CONTATOS_SCALAR_OVERFLOW
      && err.losses.includes('divergencia_email'),
  );
});

test('fidelidade: esvaziar canal (array sem telefone) limpa telefone=null quando ok', () => {
  const payload = toClienteMasterHttpPayload({
    tipo: 'Pessoa Física',
    documento: '529.982.247-25',
    nome: 'PF Contatos',
    contatos: [{ tipo: 'E-mail', valor: 'pf@sintetico.dev', principal: true }],
  });
  assert.equal(payload.email, 'pf@sintetico.dev');
  assert.equal(payload.telefone, null);
  assert.equal(payload.celular, null);
});

test('ausência de chave contatos ≠ null array: não altera escalares', () => {
  const payload = toClienteMasterHttpPayload({
    tipo: 'Pessoa Física',
    documento: '529.982.247-25',
    nome: 'PF',
    email: 'keep@sintetico.dev',
    telefone: '1155556666',
  });
  assert.equal(payload.email, 'keep@sintetico.dev');
  assert.equal(payload.telefone, '1155556666');
  assert.equal(payload.celular, undefined);
});

test('resumo escalar: complete=false; NÃO vira contatos[] na hidratação', () => {
  const summary = scalarContactSummary({
    email: 'reabrir@sintetico.dev',
    telefone: '1144445555',
    celular: '11988887777',
  });
  assert.equal(summary.source, 'scalars');
  assert.equal(summary.complete, false);
  assert.equal(summary.items.length, 3);

  const row = withHydratedContatos({
    id: 'cli-1',
    email: 'reabrir@sintetico.dev',
    telefone: '1144445555',
  });
  assert.equal(row.contatos, undefined, 'não fabricar contatos[] como lista completa');
  assert.equal(row.contatos_escalares.complete, false);
  assert.equal(row.contatos_escalares.items[0].valor, 'reabrir@sintetico.dev');
});

test('withHydratedContatos: preserva contatos[] já presentes (transporte Base44)', () => {
  const row = withHydratedContatos({
    email: 'a@b.c',
    contatos: [{ tipo: 'E-mail', valor: 'kept@sintetico.dev', nome: 'A', principal: true }],
  });
  assert.equal(row.contatos[0].valor, 'kept@sintetico.dev');
  assert.equal(row.contatos[0].nome, 'A');
  assert.equal(row.contatos_escalares.complete, false);
});

test('HttpApiClient Cliente.update: overflow não chama fetch', async () => {
  let fetches = 0;
  const client = createHttpApiClient({
    baseUrl: 'http://localhost:3080',
    getScope: () => ({ groupId: 'grupo-sintetico', empresaId: 'empresa-sintetica', token: 'tok' }),
    fetchImpl: async () => {
      fetches += 1;
      return new Response(JSON.stringify({ data: { id: 'x' } }), { status: 200 });
    },
  });
  await assert.rejects(
    () => client.entities.Cliente.update('cli-1', {
      tipo: 'Pessoa Jurídica',
      documento: '11.222.333/0001-81',
      razao_social: 'X',
      contatos: [
        { tipo: 'E-mail', valor: 'a@sintetico.dev' },
        { tipo: 'E-mail', valor: 'b@sintetico.dev' },
      ],
    }),
    (err) => err?.code === CONTATOS_SCALAR_OVERFLOW,
  );
  assert.equal(fetches, 0);
});

test('HttpApiClient Cliente.update: projeção segura envia escalares; resposta não finge contatos[]', async () => {
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
      { tipo: 'E-mail', valor: 'a@b.c', principal: false },
      { tipo: 'Telefone', valor: '1133334444', principal: false },
    ],
  });
  assert.equal(body.contatos, undefined);
  assert.equal(body.email, 'a@b.c');
  assert.equal(body.telefone, '1133334444');
  assert.equal(updated.contatos, undefined);
  assert.equal(updated.contatos_escalares.complete, false);
  assert.equal(updated.contatos_escalares.items[0].valor, 'a@b.c');
});

test('HttpApiClient Cliente.update: principal entre canais NÃO chama fetch', async () => {
  let fetches = 0;
  const client = createHttpApiClient({
    baseUrl: 'http://localhost:3080',
    getScope: () => ({ groupId: 'grupo-sintetico', empresaId: 'empresa-sintetica', token: 'tok' }),
    fetchImpl: async () => {
      fetches += 1;
      return new Response(JSON.stringify({ data: { id: 'x' } }), { status: 200 });
    },
  });
  await assert.rejects(
    () => client.entities.Cliente.update('cli-1', {
      tipo: 'Pessoa Jurídica',
      documento: '11.222.333/0001-81',
      razao_social: 'X',
      contatos: [
        { tipo: 'E-mail', valor: 'a@sintetico.dev', principal: false },
        { tipo: 'Telefone', valor: '1133334444', principal: true },
      ],
    }),
    (err) => err?.code === CONTATOS_SCALAR_OVERFLOW
      && err.losses.includes('principal_nao_representavel'),
  );
  assert.equal(fetches, 0);
});

test('HttpApiClient Cliente.update: metadata sem valor NÃO chama fetch', async () => {
  let fetches = 0;
  const client = createHttpApiClient({
    baseUrl: 'http://localhost:3080',
    getScope: () => ({ groupId: 'grupo-sintetico', empresaId: 'empresa-sintetica', token: 'tok' }),
    fetchImpl: async () => {
      fetches += 1;
      return new Response(JSON.stringify({ data: { id: 'x' } }), { status: 200 });
    },
  });
  await assert.rejects(
    () => client.entities.Cliente.update('cli-1', {
      tipo: 'Pessoa Física',
      documento: '529.982.247-25',
      nome: 'PF',
      contatos: [
        { tipo: 'Telefone', valor: '', nome: 'Compras', principal: false },
      ],
    }),
    (err) => err?.code === CONTATOS_SCALAR_OVERFLOW
      && err.losses.includes('metadata_sem_valor:0'),
  );
  assert.equal(fetches, 0);
});

test('HttpApiClient Cliente.get: contatos_escalares incompleto; sem contatos[] fabricado', async () => {
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
  assert.equal(row.contatos, undefined);
  assert.equal(row.contatos_escalares.complete, false);
  assert.equal(row.contatos_escalares.items.length, 2);
});

test('createContatosScalarOverflowError expõe losses para UI/auditoria', () => {
  const err = createContatosScalarOverflowError(['multiplo_email', 'nome_perdido:0']);
  assert.equal(err.code, CONTATOS_SCALAR_OVERFLOW);
  assert.deepEqual(err.losses, ['multiplo_email', 'nome_perdido:0']);
});

test('overflow: mensagem NÃO anuncia salvamento; rascunho do caller permanece intacto', async () => {
  const draft = {
    tipo: 'Pessoa Jurídica',
    documento: '11.222.333/0001-81',
    razao_social: 'Rascunho Contatos LTDA',
    contatos: [
      { tipo: 'E-mail', valor: 'a@sintetico.dev', principal: false },
      { tipo: 'Telefone', valor: '1133334444', principal: true, nome: 'Compras' },
    ],
  };
  const snapshot = JSON.stringify(draft);
  let fetches = 0;
  const client = createHttpApiClient({
    baseUrl: 'http://localhost:3080',
    getScope: () => ({ groupId: 'grupo-sintetico', empresaId: 'empresa-sintetica', token: 'tok' }),
    fetchImpl: async () => {
      fetches += 1;
      return new Response(JSON.stringify({ data: { id: 'x' } }), { status: 200 });
    },
  });
  let caught;
  try {
    await client.entities.Cliente.update('cli-draft', draft);
  } catch (error) {
    caught = error;
  }
  assert.ok(caught);
  assert.equal(caught.code, CONTATOS_SCALAR_OVERFLOW);
  assert.equal(fetches, 0, 'bloqueio antes do fetch');
  assert.match(String(caught.message), /rascunho não foi enviado/i);
  assert.doesNotMatch(String(caught.message), /salvo|sucesso|completo/i);
  assert.ok(caught.losses.includes('principal_nao_representavel'));
  assert.ok(caught.losses.some((l) => String(l).startsWith('nome_perdido')));
  assert.equal(JSON.stringify(draft), snapshot, 'caller conserva contatos[] integralmente');
});

test('GET escalares: complete=false — não declarar lista de contatos salva/reaberta', async () => {
  const client = createHttpApiClient({
    baseUrl: 'http://localhost:3080',
    getScope: () => ({ groupId: 'grupo-sintetico', empresaId: 'empresa-sintetica', token: 'tok' }),
    fetchImpl: async () => new Response(JSON.stringify({
      data: { id: 'cli-reopen', email: 'a@b.c', telefone: '1133334444', celular: null },
    }), { status: 200, headers: { 'content-type': 'application/json' } }),
  });
  const row = await client.entities.Cliente.get('cli-reopen');
  assert.equal(row.contatos, undefined);
  assert.equal(row.contatos_escalares?.complete, false);
  assert.notEqual(row.contatos_escalares?.complete, true);
});

test('CadastroClienteCompleto: onError de overflow mostra mensagem e não limpa fluxo de sucesso', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../src/components/cadastros/CadastroClienteCompleto.jsx', import.meta.url), 'utf8');
  assert.match(source, /onError:\s*\(error\)\s*=>\s*\{/);
  assert.match(source, /error\?\.message/);
  assert.doesNotMatch(source, /onError:[\s\S]{0,400}setFormData\(\s*\{/);
  assert.doesNotMatch(source, /onError:[\s\S]{0,400}contatos:\s*\[\]/);
});
