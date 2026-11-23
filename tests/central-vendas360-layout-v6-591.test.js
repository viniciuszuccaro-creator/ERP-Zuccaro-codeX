/**
 * #591 — Central de Vendas360° layout versão 6 (decisão 10/11).
 * Sem central paralela: Pedidos → shell; Orçamentos embutido.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  CENTRAL_VENDAS360_COLUMNS,
  CENTRAL_VENDAS360_DEFAULT_SITUACAO,
  CENTRAL_VENDAS360_FLUXO_STEPS,
  CENTRAL_VENDAS360_SITUACOES,
  CENTRAL_VENDAS360_TITLE,
  centralColumnPrefsStorageKey,
  invokeCentralDataAction,
  isCentralVendas360Module,
  partitionCentralItens,
  readCentralColumnHiddenKeys,
  resolveCentralFluxoState,
  sumCentralPesoKg,
  writeCentralColumnHiddenKeys,
} from '../src/components/comercial/centralVendas360Layout.js';

const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

test('Shell invalida callback antigo apos negar e restaurar permissao no mesmo contexto', () => {
  const source = read('src/components/comercial/CentralVendas360Shell.jsx');
  const effect = source.match(/useEffect\(\(\) => \{\n(    if \(canViewDocument\) return;[\s\S]*?)\n  \}, \[canViewDocument\]\);/);
  const callback = source.match(/const onSelectDocument = useCallback\((\(row, meta = \{\}\) => \{[\s\S]*?\n  \}), \[\]\);/);
  assert.ok(effect && callback, 'Executa o efeito e callback existentes, sem duplicar regra');
  let selected = { id: 'old' }, cliente = 'old-client', renderedEpoch = 7;
  const scope = { selectionEpochRef: { current: 7 }, canViewDocumentRef: { current: true },
    setSelected: (row) => { selected = row; }, setSelectedClienteId: (id) => { cliente = id; },
    setSelectionEpoch: (epoch) => { renderedEpoch = epoch; } };
  const dispatch = runInNewContext(`(${callback[1]})`, scope);
  const permissionEffect = runInNewContext(`(canViewDocument) => {${effect[1]}}`, scope);
  scope.canViewDocumentRef.current = false;
  permissionEffect(false);
  assert.equal(selected, null); assert.equal(cliente, null);
  scope.canViewDocumentRef.current = true;
  permissionEffect(true);
  dispatch({ id: 'stale', cliente_id: 'stale-client' }, { selectionEpoch: 7 });
  assert.equal(selected, null, 'restaurar permissão não ressuscita operação da geração revogada');
  assert.ok(renderedEpoch > 7);
  dispatch({ id: 'fresh', cliente_id: 'fresh-client' }, { selectionEpoch: renderedEpoch });
  assert.equal(selected.id, 'fresh'); assert.equal(cliente, 'fresh-client');
});

test('Shell real oculta selecao carregada sem permissao da entidade ativa', async () => {
  const require = createRequire(import.meta.url);
  const source = read('src/components/comercial/CentralVendas360Shell.jsx');
  const partsSrc = read('src/components/comercial/CentralVendas360ShellParts.jsx');
  const marker = 'const [selected, setSelected] = useState(null);';
  assert.ok(source.includes(marker));
  // Seed somente do estado previamente carregado; render e policies continuam reais.
  const seeded = source.replace(marker, 'const [selected, setSelected] = useState(globalThis.__centralFixture.row);')
    .replace('useState(CENTRAL_VENDAS360_DEFAULT_SITUACAO)', 'useState(globalThis.__centralFixture.situacao)');
  const uiNames = [...new Set([...`${source}\n${partsSrc}`.matchAll(/import\s*\{([^}]+)\}\s*from\s*'@\/components\/ui\/[^']+'/g)]
    .flatMap((m) => m[1].split(',').map((s) => s.trim()).filter(Boolean)))];
  const icons = [...new Set([...`${source}\n${partsSrc}`.matchAll(/import\s*\{([^}]+)\}\s*from\s*'lucide-react'/g)]
    .flatMap((m) => m[1].split(',').map((s) => s.trim()).filter(Boolean)))];
  const mocks = {
    ui: `import React from 'react';const leaf=({children})=>React.createElement('div',null,children);${uiNames.map((n) => `export const ${n}=leaf;`).join('')}`,
    icons: icons.map((n) => `export const ${n}=()=>null;`).join(''),
    context: "export const useContextoVisual=()=>({grupoAtual:{id:'synthetic-group'},contexto:'empresa'});",
    window: "export const useWindow=()=>({openWindow:()=>{throw Error('Unexpected external action')}});",
    session: "export const readErpHttpSession=()=>({token:'synthetic-token'});",
    sonner: 'export const toast={message(){},error(){},success(){}};',
    leaf: 'export default()=>null;',
  };
  const built = await build({
    stdin: { contents: seeded, loader: 'jsx', resolveDir: `${process.cwd()}/src/components/comercial` },
    bundle: true, write: false, platform: 'node', format: 'cjs', logLevel: 'silent',
    plugins: [{ name: 'real-shell-synthetic-leaves', setup(b) {
      b.onResolve({ filter: /^react$/ }, () => ({ path: require.resolve('react'), external: true }));
      b.onResolve({ filter: /^lucide-react$/ }, () => ({ path: 'icons', namespace: 'fixture' }));
      b.onResolve({ filter: /^sonner$/ }, () => ({ path: 'sonner', namespace: 'fixture' }));
      b.onResolve({ filter: /^\.\/(OrcamentosTab|PedidoCanonicoPanel|CentralCliente360Panel|CentralAprovacoesManager|PedidosEntregaTab)$/ }, () => ({ path: 'leaf', namespace: 'fixture' }));
      b.onResolve({ filter: /^@\// }, (a) => ({
        path: a.path.includes('/ui/') ? 'ui' : a.path.includes('useContextoVisual') ? 'context'
          : a.path.includes('useWindow') ? 'window' : a.path.includes('erpHttpSession') ? 'session' : 'leaf',
        namespace: 'fixture',
      }));
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, (a) => ({ contents: mocks[a.path], loader: 'jsx', resolveDir: process.cwd() }));
    } }],
  });
  for (const [situacao, allowedSection, visible] of [
    [CENTRAL_VENDAS360_DEFAULT_SITUACAO, null, false],
    [CENTRAL_VENDAS360_DEFAULT_SITUACAO, 'orcamento', true],
    [CENTRAL_VENDAS360_DEFAULT_SITUACAO, 'pedido', false],
    ['PRODUCAO', 'pedido', true],
    ['PRODUCAO', 'orcamento', false],
  ]) {
    const module = { exports: {} };
    runInNewContext(built.outputFiles[0].text, { module, exports: module.exports, require, console, process,
      __centralFixture: { situacao, row: { id: 'PRIVATE-SELECTION', numero: 'PRIVATE-SELECTION',
        condicao_pagamento_id: 'PRIVATE-CONDITION-ID', condicao_pagamento_nome: 'PRIVATE-CONDITION',
        tabela_preco_id: 'PRIVATE-TABLE-ID', tabela_preco_nome: 'PRIVATE-TABLE',
        itens: [{ descricao: 'PRIVATE-ITEM', quantidade: 1, unidade_sigla: 'KG', total: 100 }] } },
    });
    const html = renderToStaticMarkup(React.createElement(module.exports.default, {
      groupId: 'synthetic-group', empresaId: 'synthetic-company', actorId: 'synthetic-actor',
      hasPermission: (_module, section, action) => section === allowedSection && action === 'visualizar',
    }));
    assert.equal(html.includes('PRIVATE-ITEM'), visible, `${situacao}/${allowedSection}`);
    assert.equal(html.includes('PRIVATE-SELECTION'), visible, `${situacao}/${allowedSection}`);
    assert.equal(html.includes('PRIVATE-CONDITION'), visible, `${situacao}/${allowedSection}/condition`);
    assert.equal(html.includes('PRIVATE-TABLE'), visible, `${situacao}/${allowedSection}/table`);
  }
});

test('contrato visual v6: 12 colunas na ordem aprovada', () => {
  assert.equal(CENTRAL_VENDAS360_COLUMNS.length, 12);
  assert.deepEqual(CENTRAL_VENDAS360_COLUMNS.map((c) => c.label), [
    'Nº Orçamento',
    'Data',
    'Cod Cliente',
    'Nome Cliente',
    'Origem',
    'Nome Vendedor',
    'Peso',
    'Valor',
    'Cidade',
    'Condição Pagamento',
    'Situação',
    'Prazo',
  ]);
  assert.equal(CENTRAL_VENDAS360_DEFAULT_SITUACAO, 'ORCAMENTOS_ABERTOS');
  assert.ok(CENTRAL_VENDAS360_SITUACOES.some((s) => s.id === 'VENCIDOS'));
  assert.match(CENTRAL_VENDAS360_TITLE, /Central de Vendas360/);
});

test('partitionCentralItens: grades simultâneas sem inventar tipo', () => {
  const { corte, revenda } = partitionCentralItens([
    { id: '1', requer_producao: true, descricao: 'Vergalhão' },
    { id: '2', tipo: 'Corte e Dobra', descricao: 'Chapa' },
    { id: '3', descricao: 'Parafuso' },
  ]);
  assert.equal(corte.length, 2);
  assert.equal(revenda.length, 1);
  assert.equal(sumCentralPesoKg([{ peso_kg: 10 }, { peso: 2.5 }]), 12.5);
  assert.equal(sumCentralPesoKg([{ descricao: 'sem peso' }]), null);
});

test('isCentralVendas360Module: tile Central liberado na proposta', () => {
  assert.equal(isCentralVendas360Module({ title: 'Central de Vendas360°', sectionKey: 'pedido' }), true);
  assert.equal(isCentralVendas360Module({ title: 'Orçamentos', sectionKey: 'orcamento' }), true);
  assert.equal(isCentralVendas360Module({ title: 'Comissões', sectionKey: 'Comissoes' }), false);
});

test('Comercial: Pedidos vira Central; tile Orçamentos retirado; sem paralelo', () => {
  const src = read('src/pages/Comercial.jsx');
  assert.match(src, /title: 'Central de Vendas360°'/);
  assert.match(src, /accessKeys: \['pedido', 'orcamento'\]/);
  assert.match(src, /proposalMode: propostaIntegrada/);
  assert.match(src, /Central de Vendas360° \(orçamentos\)/);
  assert.doesNotMatch(src, /title: 'Orçamentos'/);
  assert.doesNotMatch(src, /title: 'Pedidos'/);
  assert.doesNotMatch(src, /OrcamentosV2|CentralVendas360Nova|OrcamentosNovo/);
  assert.match(src, /component: CentralVendas360Shell/);
});

test('Comercial launchpad monta CentralVendas360Shell; PedidosTab HTTP permanece PedidoCanonicoPanel', () => {
  const comercial = read('src/pages/Comercial.jsx');
  const tab = read('src/components/comercial/PedidosTab.jsx');
  assert.match(comercial, /CentralVendas360Shell/);
  assert.match(comercial, /component: CentralVendas360Shell/);
  assert.match(tab, /canonicalHttp\) return <PedidoCanonicoPanel/);
  assert.doesNotMatch(tab, /CentralVendas360Shell/);
});

test('CentralVendas360Shell: faixa, situações, grades dual, Cliente360', () => {
  const src = read('src/components/comercial/CentralVendas360Shell.jsx');
  const parts = read('src/components/comercial/CentralVendas360ShellParts.jsx');
  assert.match(src, /data-layout="versao6"/);
  assert.match(src, /central360-faixa-compacta/);
  assert.match(src, /central360-situacoes/);
  assert.match(src, /central360-contexto-venda/);
  assert.match(src, /central360-fluxo-pedido/);
  assert.match(src, /central360-proxima-acao/);
  assert.match(src, /central360-superficie-unica/);
  // Uma única montagem do painel operacional (sem cópia lg:hidden + hidden lg:block).
  assert.equal((src.match(/\{mainPanel\}/g) || []).length, 1);
  assert.doesNotMatch(src, /lg:hidden[\s\S]{0,80}\{mainPanel\}/);
  assert.match(parts, /central360-grades-simultaneas/);
  assert.match(parts, /central360-grade-corte/);
  assert.match(parts, /central360-grade-revenda/);
  assert.match(parts, /central360-acoes-rapidas/);
  assert.match(parts, /central360-qa-desmembrar/);
  // Desmembrar no aside abre Mais Ações (item do menu não está no DOM fechado).
  assert.match(parts, /runCentralAction\('central360-mais-acoes'/);
  assert.match(parts, /CentralCliente360Panel/);
  assert.match(src, /meta\.clienteNome/);
  assert.match(src, /sem nome na seleção/);
  assert.match(src, /OrcamentosTab/);
  assert.match(src, /PedidoCanonicoPanel/);
  assert.match(src, /Atendimento Unificado/);
  assert.match(src, /Bot Vendas/);
  assert.match(src, /Entregas do Dia/);
  assert.match(src, /Aprovações pendentes/);
  assert.doesNotMatch(src, /CentralVendas360Nova|OrcamentosV2/);
  assert.doesNotMatch(parts, /CentralVendas360Nova|OrcamentosV2/);
});

test('resolveCentralFluxoState mapeia situação sem inventar status', () => {
  assert.equal(CENTRAL_VENDAS360_FLUXO_STEPS.length, 6);
  const aberto = resolveCentralFluxoState({ id: 'ORCAMENTOS_ABERTOS', kind: 'orcamento' }, { status: 'EM_ABERTO' });
  assert.equal(aberto.activeIndex, 0);
  assert.match(aberto.nextLabel, /Validação/);
  const producao = resolveCentralFluxoState({ id: 'PRODUCAO', kind: 'pedido' }, { status: 'EM_PRODUCAO' });
  assert.equal(producao.activeIndex, 3);
  const entregues = resolveCentralFluxoState({ id: 'ENTREGUES', kind: 'pedido' }, { status: 'ENTREGUE' });
  assert.equal(entregues.activeIndex, 5);
  // RETIRA / PRONTO_RETIRADA → Entrega/Retira (5), não Expedição (4)
  const retira = resolveCentralFluxoState({ id: 'RETIRA', kind: 'pedido' }, { status: 'PRONTO_RETIRADA' });
  assert.equal(retira.activeIndex, 5);
  const entregaSit = resolveCentralFluxoState({ id: 'ENTREGA', kind: 'pedido' }, { status: 'PRONTO_ENTREGA' });
  assert.equal(entregaSit.activeIndex, 5);
  const soExped = resolveCentralFluxoState({ id: '', kind: 'pedido' }, { status: 'ROMANEIO' });
  assert.equal(soExped.activeIndex, 4);
});

test('invokeCentralDataAction só clica botão habilitado existente', () => {
  const root = {
    querySelector(sel) {
      if (sel === '[data-action="central360-imprimir"]') {
        return { disabled: false, getAttribute: () => null, click() { this.clicked = true; }, clicked: false };
      }
      if (sel === '[data-action="central360-fechar-orcamento"]') {
        return { disabled: true, getAttribute: () => null, click() { this.clicked = true; }, clicked: false };
      }
      return null;
    },
  };
  assert.equal(invokeCentralDataAction('central360-imprimir', root), true);
  assert.equal(invokeCentralDataAction('central360-fechar-orcamento', root), false);
  assert.equal(invokeCentralDataAction('central360-inexistente', root), false);
});

test('TabelaReceber exibe Recebido/Saldo fail-closed; ContasReceber informa gate HTTP', () => {
  const tabela = read('src/components/financeiro/contas-receber/TabelaReceber.jsx');
  const tab = read('src/components/financeiro/ContasReceberTab.jsx');
  assert.match(tabela, /key: 'valor_recebido'/);
  assert.match(tabela, /key: 'saldo'/);
  assert.match(tabela, /≠ zero/);
  assert.match(tabela, /missing\(r\.valor\) \|\| missing\(r\.valor_recebido\)/);
  assert.match(tab, /contas-receber-pedido-http-gate/);
  assert.match(tab, /titulos\/baixa/);
});

test('OrcamentosTab: tabela 12 colunas no centralLayout; seleção sem gravação', () => {
  const src = read('src/components/comercial/OrcamentosTab.jsx');
  assert.match(src, /centralLayout/);
  assert.match(src, /central360-tabela-12/);
  assert.match(src, /CENTRAL_VENDAS360_COLUMNS/);
  assert.match(src, /onDoubleClick/);
  assert.match(src, /notifyCentralSelect/);
  assert.match(src, /clienteNome: resolvedClienteNome/);
  assert.match(src, /cliente_nome: resolvedClienteNome/);
  assert.match(src, /Validade do orçamento \(≠ prazo de entrega\)/);
  assert.match(src, /central360-prefs-colunas/);
  assert.match(src, /writeCentralColumnHiddenKeys/);
  assert.match(src, /readCentralColumnHiddenKeys/);
});

test('OrcamentosTab ABERTO: Imprimir/Enviar/Fechar/Mais sem fingir sucesso', () => {
  const src = read('src/components/comercial/OrcamentosTab.jsx');
  assert.match(src, /central360-novo-orcamento/);
  assert.match(src, /data-action="central360-imprimir"/);
  assert.match(src, /data-action="central360-enviar"/);
  assert.match(src, /data-action="central360-fechar-orcamento"/);
  assert.match(src, /data-action="central360-mais-acoes"/);
  assert.match(src, /data-action="central360-duplicar"/);
  assert.match(src, /data-action="central360-itens-anteriores"/);
  assert.match(src, /data-action="central360-desmembrar"/);
  assert.match(src, /mapOrcamentoRowToCreateDraft/);
  assert.match(src, /revalidateOrcamentoDraftAgainstMasters/);
  assert.match(src, /Desmembrar orçamento ainda não está disponível/);
  assert.doesNotMatch(src, /desmembrar com sucesso|Desmembramento concluído/i);
});

test('Fechar Orçamento ≠ Cancelar: conversão backend, cancel separado', () => {
  const src = read('src/components/comercial/OrcamentosTab.jsx');
  // Fechar abre fluxo de conversão (não api.cancel).
  assert.match(src, /Fechar Orçamento ≠ Cancelar/);
  assert.match(src, /setPendingConversion\(detail\)/);
  assert.match(src, /data-permission="Comercial\.pedido\.converter-pedido"/);
  assert.match(src, /data-block="central360-fechar-conversao"/);
  assert.match(src, /data-action="central360-cancelar"/);
  assert.match(src, /Cancelar orçamento \(≠ Fechar\)/);
  assert.match(src, /orcamento-fechar-janela/);
  // Regressão: botão Fechar Orçamento não pode chamar cancel(row) diretamente.
  const fecharFn = src.match(/const fecharOrcamentoCentral = async \(\) => \{[\s\S]*?\n  \};/);
  assert.ok(fecharFn, 'fecharOrcamentoCentral deve existir');
  assert.doesNotMatch(fecharFn[0], /\bcancel\(row\)/);
  assert.match(fecharFn[0], /openFecharConversao\(detail/);
  const openFechar = src.match(/const openFecharConversao = \(detail, scope\) => \{[\s\S]*?\n  \};/);
  assert.ok(openFechar, 'Central e detalhe reutilizam o mesmo fechamento validado');
  assert.match(openFechar[0], /assertOrcamentoProntoParaFechar\(detail\)/);
  assert.match(openFechar[0], /setPendingConversion\(detail\)/);
  assert.match(fecharFn[0], /canConvert/);
});

test('preferências de colunas: escopo usuário+grupo+empresa; sem cruzar contexto', () => {
  assert.equal(centralColumnPrefsStorageKey({}), null);
  assert.equal(centralColumnPrefsStorageKey({ actorId: 'a', groupId: 'g' }), null);
  const keyA = centralColumnPrefsStorageKey({ actorId: 'actor-a', groupId: 'grp-1', empresaId: 'emp-1' });
  const keyB = centralColumnPrefsStorageKey({ actorId: 'actor-b', groupId: 'grp-1', empresaId: 'emp-1' });
  const keyC = centralColumnPrefsStorageKey({ actorId: 'actor-a', groupId: 'grp-1', empresaId: 'emp-2' });
  assert.ok(keyA && keyB && keyC);
  assert.notEqual(keyA, keyB);
  assert.notEqual(keyA, keyC);

  /** @type {Map<string, string>} */
  const mem = new Map();
  const storage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => { mem.set(k, String(v)); },
  };
  assert.equal(writeCentralColumnHiddenKeys({ actorId: 'actor-a', groupId: 'grp-1', empresaId: 'emp-1' }, ['origem', 'numero', 'hack'], storage), true);
  assert.deepEqual(
    readCentralColumnHiddenKeys({ actorId: 'actor-a', groupId: 'grp-1', empresaId: 'emp-1' }, storage),
    ['origem'],
  );
  // Outro usuário/empresa não lê as prefs.
  assert.deepEqual(
    readCentralColumnHiddenKeys({ actorId: 'actor-b', groupId: 'grp-1', empresaId: 'emp-1' }, storage),
    [],
  );
  assert.equal(writeCentralColumnHiddenKeys({ actorId: 'x' }, ['origem'], storage), false);
});

test('ModulosGridComercial: proposta libera Central (não só título Orçamentos)', () => {
  const grid = read('src/components/comercial/comercial-launchpad/ModulosGridComercial.jsx');
  assert.match(grid, /isCentralVendas360Module/);
  assert.match(grid, /Central de Vendas360°/);
  assert.match(grid, /liberatedByProposal/);
  assert.doesNotMatch(grid, /function isOrcamentosModule/);
});
