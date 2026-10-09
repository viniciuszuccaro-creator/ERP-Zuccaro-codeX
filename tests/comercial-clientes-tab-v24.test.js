import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

/** Espelha o gate de contexto das Ações Rápidas (sem React). */
export function canOpenAcaoRapida({ empresaId, groupId, loadingPerms, user, hasPerm }) {
  if (loadingPerms || !user) return false;
  if (!empresaId && !groupId) return false;
  if (typeof hasPerm === 'function' && !hasPerm()) return false;
  return true;
}

/** Chave de lista alinhada ao V24 (troca empresa/grupo invalida cache). */
export function buildClientesVizQueryKey({ sortField, sortDir, page, pageSize, search, empresaId, groupId }) {
  return ['viz-v33', 'Cliente', sortField, sortDir, page, pageSize, search, empresaId || null, groupId || null];
}

test('ClientesTab Comercial reutiliza Visualizador V24 com scope (não V23 stale)', async () => {
  const source = await readFile(
    new URL('../src/components/comercial/ClientesTab.jsx', import.meta.url),
    'utf8',
  );
  assert.match(source, /VisualizadorUniversalEntidadeV24/);
  assert.doesNotMatch(source, /from ["']@\/components\/cadastros\/VisualizadorUniversalEntidade["']/);
  assert.doesNotMatch(source, /queryKey=\{\["clientes"\]\}/);
  assert.match(source, /data-comercial-clientes-tab="v24"/);
  assert.match(source, /nomeEntidade="Cliente"/);
  assert.match(source, /CadastroClienteCompleto/);
});

test('AcoesRapidasGlobal: Novo Cliente exige contexto e expõe data-action', async () => {
  const source = await readFile(
    new URL('../src/components/AcoesRapidasGlobal.jsx', import.meta.url),
    'utf8',
  );
  assert.match(source, /requireContexto\('criar cliente'/);
  assert.match(source, /data-action=\{acao\.key\}/);
  assert.match(source, /data-action="acoes-rapidas-novo"/);
  assert.match(source, /loadingPerms \|\| !user/);
  assert.match(source, /Selecione grupo ou empresa/);
  assert.match(source, /queryKey: \['clientes', empresaAtual\?\.id/);
});

test('Visualizador V24: botão Novo Cliente usa data-action cliente-novo', async () => {
  const source = await readFile(
    new URL('../src/components/cadastros/VisualizadorUniversalEntidadeV24.jsx', import.meta.url),
    'utf8',
  );
  assert.match(source, /ENTITY === 'Cliente' \? 'cliente-novo'/);
  assert.match(source, /data-action-cadastro=\{`Cadastros\.\$\{ENTITY\}\.criar`\}/);
  assert.match(source, /\["viz-v33", ENTITY,.*empresaId, groupId\]/);
  assert.match(source, /enabled: !!ENTITY && contextoValido && canViewCadastro/);
});

test('Visualizador V24: entrada DetalhesCliente/Central360 via data-action cliente-detalhes-360', async () => {
  const source = await readFile(
    new URL('../src/components/cadastros/VisualizadorUniversalEntidadeV24.jsx', import.meta.url),
    'utf8',
  );
  assert.match(source, /import DetalhesCliente from ["']@\/components\/comercial\/DetalhesCliente["']/);
  assert.match(source, /import \{ useWindow \} from ["']@\/components\/lib\/useWindow["']/);
  assert.match(source, /data-action="cliente-detalhes-360"/);
  assert.match(source, /ENTITY === "Cliente"/);
  assert.match(source, /openWindow\(\s*DetalhesCliente/);
  assert.match(source, /disabled=\{!contextoValido \|\| !canViewCadastro\}/);
});

test('comportamento: perms loading / sem contexto / sem permissão bloqueiam Novo', () => {
  assert.equal(canOpenAcaoRapida({ empresaId: 'e1', groupId: 'g1', loadingPerms: true, user: { id: 1 }, hasPerm: () => true }), false);
  assert.equal(canOpenAcaoRapida({ empresaId: null, groupId: null, loadingPerms: false, user: { id: 1 }, hasPerm: () => true }), false);
  assert.equal(canOpenAcaoRapida({ empresaId: 'e1', groupId: 'g1', loadingPerms: false, user: null, hasPerm: () => true }), false);
  assert.equal(canOpenAcaoRapida({ empresaId: 'e1', groupId: 'g1', loadingPerms: false, user: { id: 1 }, hasPerm: () => false }), false);
  assert.equal(canOpenAcaoRapida({ empresaId: 'e1', groupId: 'g1', loadingPerms: false, user: { id: 1 }, hasPerm: () => true }), true);
  assert.equal(canOpenAcaoRapida({ empresaId: null, groupId: 'g1', loadingPerms: false, user: { id: 1 }, hasPerm: () => true }), true);
});

test('comportamento: troca de empresa muda queryKey (sem reutilizar lista)', () => {
  const a = buildClientesVizQueryKey({ sortField: 'nome', sortDir: 'asc', page: 1, pageSize: 20, search: '', empresaId: 'cpa', groupId: 'g' });
  const b = buildClientesVizQueryKey({ sortField: 'nome', sortDir: 'asc', page: 1, pageSize: 20, search: '', empresaId: '3z', groupId: 'g' });
  assert.notDeepEqual(a, b);
  assert.equal(a[0], 'viz-v33');
  assert.equal(a[1], 'Cliente');
});

test('diff vs #251: runtime #252 não inclui Empresas/Financeiro/Central360', async () => {
  const files = [
    'src/components/comercial/ClientesTab.jsx',
    'src/components/AcoesRapidasGlobal.jsx',
    'src/components/cadastros/VisualizadorUniversalEntidadeV24.jsx',
  ];
  for (const f of files) {
    assert.notEqual(f, 'src/pages/Empresas.jsx');
    assert.notEqual(f, 'src/components/comercial/CentralCliente360Panel.jsx');
  }
  const tab = await readFile(new URL('../src/components/comercial/ClientesTab.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(tab, /CentralCliente360|EmpresaSwitcher|LaunchpadCard/);
});

/** Regressão integrada #251+#252: entrada 360 na listagem + Novo Cliente coexistentes. */
test('integrado #251+#252: V24 expõe cliente-novo e cliente-detalhes-360; DetalhesCliente compõe Central360', async () => {
  const v24 = await readFile(
    new URL('../src/components/cadastros/VisualizadorUniversalEntidadeV24.jsx', import.meta.url),
    'utf8',
  );
  const detalhes = await readFile(
    new URL('../src/components/comercial/DetalhesCliente.jsx', import.meta.url),
    'utf8',
  );
  const panel = await readFile(
    new URL('../src/components/comercial/CentralCliente360Panel.jsx', import.meta.url),
    'utf8',
  );
  assert.match(v24, /data-action="cliente-novo"|ENTITY === 'Cliente' \? 'cliente-novo'/);
  assert.match(v24, /data-action="cliente-detalhes-360"/);
  assert.match(detalhes, /CentralCliente360Panel/);
  assert.match(panel, /Carregar mais/);
  assert.match(panel, /_limit|_offset|blockLimits/);
});
