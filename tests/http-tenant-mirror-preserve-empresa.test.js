import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

/**
 * Remirror da sessão HTTP não pode apagar cadastro local de Empresa
 * (nome fantasia, regime, endereço) após save no IndexedDB.
 */
test('upsertHttpTenantLocalMirror preserva campos ricos e nome local', async () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(String(key)) ?? null,
    setItem: (key, value) => values.set(String(key), String(value)),
    removeItem: (key) => values.delete(String(key)),
  };
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage: storage },
  });

  const server = await createServer({
    root: fileURLToPath(new URL('../', import.meta.url)),
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
  });

  try {
    const mod = await server.ssrLoadModule(
      `/src/api/localBase44Client.js?mirror-preserve=${Date.now()}`,
    );
    const { localBase44, upsertHttpTenantLocalMirror } = mod;
    localBase44.__local.reset();

    const groupId = '11111111-1111-4111-8111-111111111111';
    const empresaId = '22222222-2222-4222-8222-222222222222';

    upsertHttpTenantLocalMirror({
      groupId,
      empresaId,
      groupName: 'Grupo CPA',
      empresas: [
        {
          id: empresaId,
          nome_fantasia: '3Z LTDA',
          razao_social: '3Z LTDA',
          cnpj: '12.345.678/0001-99',
          status: 'Ativa',
        },
      ],
    });

    const afterMirror = await localBase44.entities.Empresa.filter({ id: empresaId });
    assert.equal(afterMirror.length, 1);
    assert.equal(afterMirror[0].nome_fantasia, '3Z LTDA');
    assert.equal(afterMirror[0]._cnpj_origem, 'sessao_http');

    await localBase44.entities.Empresa.update(empresaId, {
      nome_fantasia: '3Z TRACE SAVE',
      regime_tributario: 'Lucro Presumido',
      endereco: { cidade: 'Sao Paulo', estado: 'SP' },
      contato: { telefone: '11999999999' },
    });

    const afterSave = await localBase44.entities.Empresa.filter({ id: empresaId });
    assert.equal(afterSave[0].nome_fantasia, '3Z TRACE SAVE');
    assert.equal(afterSave[0].regime_tributario, 'Lucro Presumido');

    upsertHttpTenantLocalMirror({
      groupId,
      empresaId,
      groupName: 'Grupo CPA',
      empresas: [
        {
          id: empresaId,
          nome_fantasia: '3Z LTDA',
          razao_social: '3Z LTDA',
          cnpj: '12.345.678/0001-99',
          status: 'Ativa',
        },
      ],
    });

    const afterRemirror = await localBase44.entities.Empresa.filter({ id: empresaId });
    assert.equal(afterRemirror[0].nome_fantasia, '3Z TRACE SAVE');
    assert.equal(afterRemirror[0].razao_social, '3Z LTDA');
    assert.equal(afterRemirror[0].regime_tributario, 'Lucro Presumido');
    assert.equal(afterRemirror[0].endereco?.cidade, 'Sao Paulo');
    assert.equal(afterRemirror[0].cnpj, '12.345.678/0001-99');
    assert.equal(afterRemirror[0]._cnpj_origem, 'sessao_http');
  } finally {
    await server.close();
  }
});

test('Input: onChange/onBlur/ref vêm depois do spread (RHF não perde digitação)', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../src/components/ui/input.jsx', import.meta.url), 'utf8');
  const spreadIdx = source.indexOf('{...forwardedProps}');
  const onChangeIdx = source.indexOf('onChange={auditedOnChange}');
  const onBlurIdx = source.indexOf('onBlur={auditedOnBlur}');
  assert.ok(spreadIdx > 0, 'spread forwardedProps presente');
  assert.ok(onChangeIdx > spreadIdx, 'onChange deve vencer o spread');
  assert.ok(onBlurIdx > spreadIdx, 'onBlur deve vencer o spread');
});

test('EmpresaSwitcher distingue Grupo vs Empresa operacional', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../src/components/EmpresaSwitcher.jsx', import.meta.url), 'utf8');
  assert.match(source, /Grupo · \$\{/);
  assert.match(source, /Empresa · \{/);
  assert.match(source, /data-scope=["']grupo["']/);
  assert.match(source, /data-scope=["']empresa["']/);
  assert.match(source, /Empresa operacional/);
});

test('Empresas view expõe origem do CNPJ', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../src/pages/Empresas.jsx', import.meta.url), 'utf8');
  assert.match(source, /data-field=["']empresa-cnpj-origem["']/);
  assert.match(source, /sessão HTTP/);
  assert.match(source, /cadastro local/);
});
