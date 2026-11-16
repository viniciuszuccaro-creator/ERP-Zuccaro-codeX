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
  assert.doesNotMatch(source, /Grupo ·/);
  assert.match(source, /Grupo Corporativo/);
  assert.match(source, /Grupos Corporativos/);
  assert.match(source, /Empresa · \{/);
  assert.match(source, /data-scope=["']grupo["']/);
  assert.match(source, /data-scope=["']empresa["']/);
  assert.match(source, /Empresa operacional/);
});

test('EmpresaSwitcher renderiza o nome do Grupo sem prefixo e preserva IDs', async () => {
  const { build } = await import('esbuild');
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const result = await build({
    entryPoints: ['src/components/EmpresaSwitcher.jsx'], bundle: true, write: false,
    format: 'cjs', platform: 'node', external: ['react'],
    plugins: [{ name: 'switcher-render-boundaries', setup(b) {
      b.onResolve({ filter: /^@\/|^@tanstack\/|^lucide-react$/ }, a => ({ path: a.path, namespace: 'fixture' }));
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, a => {
        let contents;
        if (a.path.endsWith('useContextoGrupoEmpresa')) contents = 'export default()=>globalThis.__switcherRender;';
        else if (a.path === '@tanstack/react-query') contents = "export const useQuery=({queryKey})=>({data:queryKey[0]==='grupos-usuario'?[globalThis.__switcherRender.grupoAtual]:[]});";
        else if (a.path.endsWith('base44Client')) contents = 'export const base44={},isHttpBackendMode=true;';
        else if (a.path.endsWith('erpHttpSession')) contents = 'export const readErpHttpSession=()=>null;';
        else contents = `import React from 'react'; const Box=({children,...p})=>React.createElement('div',{'data-scope':p['data-scope'],'data-group-id':p['data-group-id'],'data-value':p.value},children);
          export {Box as Select,Box as SelectContent,Box as SelectGroup,Box as SelectItem,Box as SelectLabel,Box as SelectTrigger,Box as SelectValue,Box as Badge,Box as Input,Box as Building2,Box as Users,Box as ChevronDown};`;
        return { contents, loader: 'js' };
      });
    } }],
  });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', result.outputFiles[0].text)(require, module, module.exports);
  try {
    for (const name of ['Grupo CPA', 'Consorcio Teste']) {
      globalThis.__switcherRender = { user: { id: 'actor' }, contexto: 'grupo',
        grupoAtual: { id: 'same-group-id', nome_do_grupo: name }, empresasDoGrupo: [],
        podeOperarEmGrupo: true, isLoading: false };
      const html = renderToStaticMarkup(React.createElement(module.exports.default));
      assert.equal(html.split(name).length - 1, 2, 'nome original no seletor e na opcao');
      assert.doesNotMatch(html, /Grupo ·/);
      assert.match(html, /data-group-id="same-group-id"/);
      assert.match(html, /data-value="grupo:same-group-id"/);
      assert.match(html, /Grupo Corporativo/);
    }
  } finally { delete globalThis.__switcherRender; }
});

test('Empresas view expõe origem do CNPJ', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../src/pages/Empresas.jsx', import.meta.url), 'utf8');
  assert.match(source, /data-field=["']empresa-cnpj-origem["']/);
  assert.match(source, /sessão HTTP/);
  assert.match(source, /cadastro local/);
});
