/**
 * #591 — Central de Vendas360° layout versão 6 (decisão 10/11).
 * Sem central paralela: Pedidos → shell; Orçamentos embutido.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  CENTRAL_VENDAS360_COLUMNS,
  CENTRAL_VENDAS360_DEFAULT_SITUACAO,
  CENTRAL_VENDAS360_SITUACOES,
  CENTRAL_VENDAS360_TITLE,
  centralColumnPrefsStorageKey,
  isCentralVendas360Module,
  partitionCentralItens,
  readCentralColumnHiddenKeys,
  sumCentralPesoKg,
  writeCentralColumnHiddenKeys,
} from '../src/components/comercial/centralVendas360Layout.js';

const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

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
  assert.match(src, /data-layout="versao6"/);
  assert.match(src, /central360-faixa-compacta/);
  assert.match(src, /central360-situacoes/);
  assert.match(src, /central360-grades-simultaneas/);
  assert.match(src, /central360-grade-corte/);
  assert.match(src, /central360-grade-revenda/);
  assert.match(src, /CentralCliente360Panel/);
  assert.match(src, /OrcamentosTab/);
  assert.match(src, /PedidoCanonicoPanel/);
  assert.match(src, /Atendimento Unificado/);
  assert.match(src, /Bot Vendas/);
  assert.match(src, /Entregas do Dia/);
  assert.match(src, /Aprovações pendentes/);
  assert.doesNotMatch(src, /CentralVendas360Nova|OrcamentosV2/);
});

test('OrcamentosTab: tabela 12 colunas no centralLayout; seleção sem gravação', () => {
  const src = read('src/components/comercial/OrcamentosTab.jsx');
  assert.match(src, /centralLayout/);
  assert.match(src, /central360-tabela-12/);
  assert.match(src, /CENTRAL_VENDAS360_COLUMNS/);
  assert.match(src, /onDoubleClick/);
  assert.match(src, /notifyCentralSelect/);
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

test('Fechar Orçamento: diálogo oferece ENTREGA e RETIRADA (Produção/Entrega/Retira via pedido)', () => {
  const src = read('src/components/comercial/OrcamentosTab.jsx');
  assert.match(src, /SelectItem value="ENTREGA">Entrega/);
  assert.match(src, /SelectItem value="RETIRADA">Retirada/);
  assert.match(src, /convertOrcamento/);
  assert.match(src, /tipo_operacao/);
  const layout = read('src/components/comercial/centralVendas360Layout.js');
  assert.match(layout, /id: 'PRODUCAO'/);
  assert.match(layout, /id: 'ENTREGA'/);
  assert.match(layout, /id: 'RETIRA'/);
  assert.match(layout, /tipoOperacao: 'RETIRADA'/);
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
  assert.match(fecharFn[0], /setPendingConversion/);
  assert.match(fecharFn[0], /canConvert/);
  // Parecer 6796010811: captura identidade antes do await; conversionScope = opened (não rendered pós-troca).
  assert.match(fecharFn[0], /documentId:\s*row\.id/);
  assert.match(fecharFn[0], /conversionScope\.current\s*=\s*opened/);
  assert.match(fecharFn[0], /sameOrcamentoScope\(opened/);
  assert.doesNotMatch(fecharFn[0], /conversionScope\.current\s*=\s*renderedScope\.current/);
});

test('Parecer 6796010811: loadCentralDetail revalida escopo; Pedidos403 ≠ aborta Orçamentos', () => {
  const src = read('src/components/comercial/OrcamentosTab.jsx');
  const loadFn = src.match(/const loadCentralDetail = async \(row[\s\S]*?\n  \};/);
  assert.ok(loadFn, 'loadCentralDetail deve existir');
  assert.match(loadFn[0], /documentId/);
  assert.match(loadFn[0], /sameOrcamentoScope\(opened/);
  assert.match(loadFn[0], /detail\.id !== opened\.documentId/);
  // Fast path também exige escopo estável (não retorna row cego).
  assert.match(loadFn[0], /fast/);
  const itensFn = src.match(/const incluirItensAnterioresCentral = async \(\) => \{[\s\S]*?\n  \};/);
  assert.ok(itensFn, 'incluirItensAnterioresCentral deve existir');
  assert.doesNotMatch(itensFn[0], /Promise\.all\(\[\s*pedidosApi\.list/);
  assert.match(itensFn[0], /pedidosDenied/);
  assert.match(itensFn[0], /status === 403/);
  assert.match(itensFn[0], /usando apenas orçamentos/);
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
