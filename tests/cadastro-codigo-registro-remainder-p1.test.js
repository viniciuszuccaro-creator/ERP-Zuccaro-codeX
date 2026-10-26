import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  CADASTRO_CODIGO_REGISTRO_AUTHORIZED_FILES,
  cadastroCodigoRegistroRemainder,
} from './helpers/cadastroCodigoRegistroRemainder.js';

const TABELA = 'src/components/cadastros/TabelaPrecoForm.jsx';

function read(path) {
  return readFileSync(path, 'utf8');
}

function injectAfterHasId(source, injection) {
  const marker = 'hasId={Boolean(dadosIniciais?.id)}';
  assert.equal(source.split(marker).length, 2, 'marker hasId único');
  return source.replace(marker, `${marker}\n        ${injection}`);
}

test('remainder autorizado: TabelaPreco/RotaPadrao/Completo normalizam sem alterar contrato', () => {
  for (const file of CADASTRO_CODIGO_REGISTRO_AUTHORIZED_FILES) {
    const source = read(file);
    const normalized = cadastroCodigoRegistroRemainder(file, source);
    assert.equal(normalized.includes('CadastroCodigoRegistroField'), false, file);
    assert.equal(normalized.includes('@/components/cadastros/CadastroCodigoRegistroField'), false, file);
    // Campos de negócio (nome) permanecem — só o delta CodigoField foi removido.
    assert.match(normalized, /formData\.nome|formData\.nome_rota|Nome da Tabela|Nome da Rota/);
  }
});

test('P1 Object.assign no CodigoField: ANTES aceito; DEPOIS rejeitado (não mascara mutação de rascunho)', () => {
  const original = read(TABELA);
  const clean = cadastroCodigoRegistroRemainder(TABELA, original);

  const attacked = injectAfterHasId(
    original,
    '{...Object.assign(formData, { nome: "FORGED_RENDER_SIDE_EFFECT" })}',
  );
  assert.match(attacked, /Object\.assign\(formData/);

  // Envelope frouxo (histórico): strip cego produziria bytes idênticos ao clean.
  // Envelope estrito: DEVE lançar — não normalizar o ataque.
  assert.throws(
    () => cadastroCodigoRegistroRemainder(TABELA, attacked),
    /spread|attr\[|mutar rascunho|Object\.assign/i,
  );

  // Controle: sem ataque, normalização estável.
  assert.equal(cadastroCodigoRegistroRemainder(TABELA, original), clean);
});

test('mutação externa (fora do CodigoField) permanece visível após remainder', () => {
  const original = read(TABELA);
  const clean = cadastroCodigoRegistroRemainder(TABELA, original);
  const external = original.replace(
    'placeholder="Ex: Atacado SP, Varejo Nacional"',
    'placeholder="Ex: FORGED_EXTERNAL"',
  );
  const normalizedExternal = cadastroCodigoRegistroRemainder(TABELA, external);
  assert.notEqual(normalizedExternal, clean);
  assert.match(normalizedExternal, /FORGED_EXTERNAL/);
});

test('omissão do CodigoField é rejeitada', () => {
  const original = read(TABELA);
  const withoutField = original
    .replace(/import CadastroCodigoRegistroField from "@\/components\/cadastros\/CadastroCodigoRegistroField";\n/, '')
    .replace(/\n\s*<CadastroCodigoRegistroField[\s\S]*?\/>\n/, '\n');
  assert.equal(withoutField.includes('CadastroCodigoRegistroField'), false);
  assert.throws(() => cadastroCodigoRegistroRemainder(TABELA, withoutField));
});

test('repetição do CodigoField é rejeitada', () => {
  const original = read(TABELA);
  const field = original.match(/<CadastroCodigoRegistroField[\s\S]*?\/>/)[0];
  const duplicated = original.replace(field, `${field}\n      ${field}`);
  assert.throws(() => cadastroCodigoRegistroRemainder(TABELA, duplicated));
});

test('children no CodigoField são rejeitados', () => {
  const original = read(TABELA);
  const withChildren = original.replace(
    /<CadastroCodigoRegistroField([\s\S]*?)\/>/,
    '<CadastroCodigoRegistroField$1>extra</CadastroCodigoRegistroField>',
  );
  assert.throws(() => cadastroCodigoRegistroRemainder(TABELA, withChildren), /children/);
});

test('atributo extra no CodigoField é rejeitado', () => {
  const original = read(TABELA);
  const extra = injectAfterHasId(original, 'data-forged="x"');
  assert.throws(() => cadastroCodigoRegistroRemainder(TABELA, extra));
});

test('arquivo fora da allowlist não é alterado', () => {
  const path = 'src/components/cadastros/MarcaForm.jsx';
  const source = read(path);
  assert.equal(cadastroCodigoRegistroRemainder(path, source), source);
});
