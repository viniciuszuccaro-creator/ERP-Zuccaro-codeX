import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { toProdutoHttpPayload, validateProdutoPimQuantities, prepareProdutoMediaFile, CAD_FORMAT_POLICY, getProdutoWorkflowActions, getProdutoMediaScanLabel, getProdutoMediaLiberacaoActions, getProdutoMediaPrincipalAction, getProdutoMediaDeactivateAction, getProdutoMediaDownloadAction, getProdutoEquivalentApproveAction } from '../src/components/cadastros/produto/produtoHttpPolicy.js';

test('V22 apresenta varredura sem confundir CLEAN com liberacao', async () => {
  assert.match(getProdutoMediaScanLabel({ status: 'QUARENTENA' }), /pendente.*quarentena/i);
  assert.match(getProdutoMediaScanLabel({ status: 'QUARENTENA', scan_verdict: 'CLEAN' }), /ainda em quarentena/i);
  assert.match(getProdutoMediaScanLabel({ status: 'QUARENTENA', scan_verdict: 'INFECTED' }), /ameaca.*quarentena/i);
  assert.match(getProdutoMediaScanLabel({ status: 'QUARENTENA', scan_verdict: 'INCONCLUSIVE' }), /pendente.*quarentena/i);
  assert.match(getProdutoMediaScanLabel({ status: 'APROVADO' }), /liberada internamente/i);
  const section = await readFile(new URL('../src/components/cadastros/produto/ProdutoRelationsDamSection.jsx', import.meta.url), 'utf8');
  const canalSection = await readFile(new URL('../src/components/cadastros/produto/ProdutoCanalRascunhoSection.jsx', import.meta.url), 'utf8');
  assert.match(section, /getProdutoMediaScanLabel\(row\)/);
  assert.match(section, /getProdutoMediaLiberacaoActions\(row/);
  assert.match(section, /midiaApprove|midiaRejectContent|midiaScan/);
  assert.match(section, /midiaSetPrincipal|getProdutoMediaPrincipalAction/);
  assert.match(section, /midiaDeactivate|getProdutoMediaDeactivateAction/);
  assert.match(section, /midiaDownload|getProdutoMediaDownloadAction/);
  assert.match(section, /midiaReconcileExpired|midiaReconcileInfected/);
  assert.match(section, /midiaDamStatus/);
  assert.match(section, /produto-midia-reconciliar-vencidas|produto-midia-reconciliar-infectadas/);
  assert.match(section, /produto-dam-readiness|produto-midia-principal|produto-midia-inativar|produto-midia-download/);
  assert.match(section, /ProdutoCanalRascunhoSection|api\.canais\.(list|create|update|deactivate)/);
  assert.match(canalSection, /api\.canais|produto-canal-salvar|produto-canal-editar|produto-canal-inativar/);
  assert.match(canalSection, /Conteudo por canal \(rascunho\)|Somente RASCUNHO/);
  assert.match(canalSection, /produto-canal-descricao|Descricao do canal/);
  assert.match(section, /getProdutoEquivalentApproveAction|produto-equivalente-aprovar/);
  assert.match(section, /produto-equivalente-direcional|direcional/);
  assert.match(section, /aprovado:\s*false/);
  assert.match(section, /PRODUTO_PUBLICACAO_REQUIRES_MEDIA_LIBERACAO/);
  assert.doesNotMatch(section + canalSection, /storage_key|scan_sha256|scan_scanner|CLAMD_SOCKET|serviceRole/);
});

test('V22 expoe aprovar equivalente so com aprovar-conteudo e pendente', () => {
  assert.equal(getProdutoEquivalentApproveAction({ aprovado: false }, { canApprove: false }), null);
  assert.equal(getProdutoEquivalentApproveAction({ aprovado: true }, { canApprove: true }), null);
  assert.equal(getProdutoEquivalentApproveAction({ aprovado: false, ativo: false }, { canApprove: true }), null);
  assert.deepEqual(getProdutoEquivalentApproveAction({ aprovado: false }, { canApprove: true }),
    { action: 'approve', label: 'Aprovar relacao' });
});

test('V22 expoe liberacao DAM somente com aprovar-conteudo e estado de quarentena', () => {
  assert.deepEqual(getProdutoMediaLiberacaoActions({ status: 'QUARENTENA' }, { canApprove: false }), []);
  assert.deepEqual(getProdutoMediaLiberacaoActions({ status: 'APROVADO', scan_verdict: 'CLEAN' }, { canApprove: true }), []);
  assert.deepEqual(
    getProdutoMediaLiberacaoActions({ status: 'QUARENTENA' }, { canApprove: true }).map((a) => a.action),
    ['scan', 'reject'],
  );
  assert.deepEqual(
    getProdutoMediaLiberacaoActions({ status: 'QUARENTENA', scan_verdict: 'CLEAN' }, { canApprove: true }).map((a) => a.action),
    ['approve', 'reject'],
  );
  assert.deepEqual(
    getProdutoMediaLiberacaoActions({ status: 'QUARENTENA', scan_verdict: 'INFECTED' }, { canApprove: true }).map((a) => a.action),
    ['reject'],
  );
});

test('V22 expoe tornar principal so para midia APROVADA com editar', () => {
  assert.equal(getProdutoMediaPrincipalAction({ status: 'APROVADO' }, { canEdit: false }), null);
  assert.equal(getProdutoMediaPrincipalAction({ status: 'QUARENTENA' }, { canEdit: true }), null);
  assert.equal(getProdutoMediaPrincipalAction({ status: 'APROVADO', principal: true }, { canEdit: true }), null);
  assert.deepEqual(getProdutoMediaPrincipalAction({ status: 'APROVADO', principal: false }, { canEdit: true }),
    { action: 'principal', label: 'Tornar principal' });
});

test('V22 expoe inativar midia so com editar e estado ativo liberavel', () => {
  assert.equal(getProdutoMediaDeactivateAction({ status: 'APROVADO' }, { canEdit: false }), null);
  assert.equal(getProdutoMediaDeactivateAction({ status: 'PENDENTE_UPLOAD' }, { canEdit: true }), null);
  assert.equal(getProdutoMediaDeactivateAction({ status: 'REJEITADO' }, { canEdit: true }), null);
  assert.equal(getProdutoMediaDeactivateAction({ status: 'INATIVO' }, { canEdit: true }), null);
  assert.deepEqual(getProdutoMediaDeactivateAction({ status: 'QUARENTENA' }, { canEdit: true }),
    { action: 'deactivate', label: 'Inativar midia' });
  assert.deepEqual(getProdutoMediaDeactivateAction({ status: 'APROVADO', principal: true }, { canEdit: true }),
    { action: 'deactivate', label: 'Inativar midia' });
});

test('V22 expoe download so com visualizar e midia em quarentena ou aprovada', () => {
  assert.equal(getProdutoMediaDownloadAction({ status: 'APROVADO' }, { canView: false }), null);
  assert.equal(getProdutoMediaDownloadAction({ status: 'PENDENTE_UPLOAD' }, { canView: true }), null);
  assert.equal(getProdutoMediaDownloadAction({ status: 'REJEITADO' }, { canView: true }), null);
  assert.deepEqual(getProdutoMediaDownloadAction({ status: 'QUARENTENA' }, { canView: true }),
    { action: 'download', label: 'Baixar' });
  assert.deepEqual(getProdutoMediaDownloadAction({ status: 'APROVADO' }, { canView: true }),
    { action: 'download', label: 'Baixar' });
});

test('workflow V22 expõe somente transicoes permitidas ao perfil e estado atual', () => {
  const denied = { canEdit: false, canApprove: false, canPublish: false, canDeactivate: false };
  assert.deepEqual(getProdutoWorkflowActions('RASCUNHO', denied), []);
  assert.deepEqual(getProdutoWorkflowActions('EM_REVISAO', denied), []);
  assert.deepEqual(getProdutoWorkflowActions('DESCONHECIDO', { canEdit: true }), []);
  assert.deepEqual(getProdutoWorkflowActions('RASCUNHO', { canEdit: true }).map((a) => a.target), ['EM_REVISAO']);
  assert.deepEqual(getProdutoWorkflowActions('EM_REVISAO', { canApprove: true }).map((a) => a.target), ['APROVADO']);
  assert.deepEqual(getProdutoWorkflowActions('APROVADO', { canPublish: true }).map((a) => a.target), ['PUBLICADO']);
  assert.deepEqual(getProdutoWorkflowActions('PUBLICADO', { canDeactivate: true }).map((a) => a.target), ['INATIVO']);
  assert.deepEqual(getProdutoWorkflowActions('INATIVO', { canEdit: true }).map((a) => a.target), ['RASCUNHO']);
});

test('formulario V22 usa RBAC por acao e confirma workflow somente pela resposta do ERP', async () => {
  const form = await readFile(new URL('../src/components/cadastros/ProdutoFormV22_Completo.jsx', import.meta.url), 'utf8');
  const section = await readFile(new URL('../src/components/cadastros/produto/ProdutoRelationsDamSection.jsx', import.meta.url), 'utf8');
  for (const action of ['aprovar-conteudo', 'publicar', 'inativar']) assert.match(form, new RegExp(`hasPermission\\('Cadastros', 'Produto', '${action}'\\)`));
  assert.match(section, /updated\?\.workflow_status !== target/);
  assert.match(section, /onWorkflowChanged\?\.\(updated\.workflow_status\)/);
  assert.match(section, /target === 'PUBLICADO'/);
  assert.match(section, /media\.some\(\(row\) => row\.status === 'QUARENTENA'\)/);
  assert.match(section, /window\.confirm/);
  assert.match(section, /Cadastros\.Produto\.inativar/);
  assert.match(section, /Cadastros\.Produto\.aprovar-conteudo/);
  assert.match(section, /canDeactivate &&/);
});


test('formulario canonico integra secao PIM sem criar tela paralela', async () => {
  const form = await readFile(
    new URL('../src/components/cadastros/ProdutoFormV22_Completo.jsx', import.meta.url),
    'utf8',
  );
  const section = await readFile(
    new URL('../src/components/cadastros/produto/ProdutoPimSection.jsx', import.meta.url),
    'utf8',
  );
  assert.match(form, /ProdutoPimSection/);
  assert.match(form, /descricao_tecnica/);
  assert.match(form, /workflow_status: produto\.workflow_status \|\| 'RASCUNHO'/);
  for (const field of [
    'material',
    'liga',
    'norma_tecnica',
    'descricao_tecnica',
    'descricao_comercial',
    'titulo_seo',
    'embalagem_tipo',
    'multiplo_venda',
    'quantidade_minima_venda',
    'permite_fracionamento',
  ]) {
    assert.match(section, new RegExp(field));
  }
});

test('V22 nao substitui silenciosamente multiplo ou minimo vazios', async () => {
  const section = await readFile(new URL('../src/components/cadastros/produto/ProdutoPimSection.jsx', import.meta.url), 'utf8');
  const form = await readFile(new URL('../src/components/cadastros/ProdutoFormV22_Completo.jsx', import.meta.url), 'utf8');
  assert.match(section, /if \(value === ""\) return ""/);
  assert.match(form, /validateProdutoPimQuantities\(formData\)/);
  assert.match(form, /setAbaAtiva\('ecommerce'\)/);
  for (const [multiple, minimum] of [[1, 0], ['2', '3.5']]) {
    assert.doesNotThrow(() => validateProdutoPimQuantities({ multiplo_venda: multiple, quantidade_minima_venda: minimum }));
  }
  for (const multiple of ['', null, 0, -1, 'abc', Infinity]) {
    assert.throws(() => validateProdutoPimQuantities({ multiplo_venda: multiple, quantidade_minima_venda: 0 }), /Multiplo/);
  }
  for (const minimum of ['', null, -1, 'abc', Infinity]) {
    assert.throws(() => validateProdutoPimQuantities({ multiplo_venda: 1, quantidade_minima_venda: minimum }), /Quantidade minima/);
  }
});

test('Produto V22 bloqueia upload legado quando backend HTTP usa Storage oficial', async () => {
  const form = await readFile(
    new URL('../src/components/cadastros/ProdutoFormV22_Completo.jsx', import.meta.url),
    'utf8',
  );
  const upload = form.slice(form.indexOf('const handleUploadFoto'), form.indexOf('const toggleUnidadeSecundaria'));
  assert.match(form, /import \{ base44, getHttpProdutoApi, isHttpBackendMode, isHttpProdutoEnabled \} from "@\/api\/base44Client"/);
  assert.match(upload, /if \(isHttpBackendMode\)[\s\S]*return;[\s\S]*base44\.integrations\.Core\.UploadFile/);
  assert.match(form, /onChange=\{handleUploadFoto\}[\s\S]*disabled=\{isHttpBackendMode\}/);
  assert.match(form, /disabled=\{isHttpBackendMode \|\| uploadingFoto/);
  assert.match(form, /disabled=\{isHttpBackendMode \|\| gerandoImagem/);
  assert.match(form, /if \(!url\) throw new Error\('Imagem nao gerada'\)/);
});
test('V22 projeta material, liga e norma tecnica sem tenant no body', () => {
  const body = toProdutoHttpPayload({ descricao: 'Chapa sintetica', material: 'Aco',
    liga: 'SAE 1020', norma_tecnica: 'ASTM A36', groupId: 'forjado', empresaId: 'forjada' });
  assert.deepEqual(body, { descricao: 'Chapa sintetica', material: 'Aco',
    liga: 'SAE 1020', norma_tecnica: 'ASTM A36' });
});

test('V22 envia null ao limpar campos PIM no update HTTP, sem alterar o create ou outros dominios', () => {
  const cleared = {
    descricao: 'Chapa sintetica', material: '', liga: '', norma_tecnica: '',
    descricao_tecnica: '', descricao_comercial: '', titulo_seo: '',
    descricao_seo: '', embalagem_tipo: '', ncm: '', groupId: 'forjado',
    estoque_atual: 5, preco_venda: 100,
  };
  assert.deepEqual(toProdutoHttpPayload(cleared, { update: true }), {
    descricao: 'Chapa sintetica', material: null, liga: null, norma_tecnica: null,
    descricao_tecnica: null, descricao_comercial: null, titulo_seo: null,
    descricao_seo: null, embalagem_tipo: null,
  });
  assert.deepEqual(toProdutoHttpPayload(cleared), { descricao: 'Chapa sintetica' });
  assert.deepEqual(toProdutoHttpPayload({ descricao: 'Chapa', liga: 'SAE 1020' }, { update: true }),
    { descricao: 'Chapa', liga: 'SAE 1020' });
  assert.deepEqual(toProdutoHttpPayload({ descricao: 'Chapa' }, { update: true }),
    { descricao: 'Chapa' });
});

test('V22 usa API explicita para UUID canonico e preserva operacoes locais para legado', async () => {
  const form = await readFile(new URL('../src/components/cadastros/ProdutoFormV22_Completo.jsx', import.meta.url), 'utf8');
  const client = await readFile(new URL('../src/api/base44Client.js', import.meta.url), 'utf8');
  assert.match(form, /produtoHttp \? await getHttpProdutoApi\(\)\.update\(produto\.id, dadosSubmit\) : await updateInContext\('Produto'/);
  assert.match(form, /produtoHttp \? await getHttpProdutoApi\(\)\.create\(dadosSubmit\) : await createInContext\('Produto'/);
  assert.match(form, /produtoHttp \? getHttpProdutoApi\(\)\.delete\(produto\.id\) : deleteInContext\('Produto'/);
  assert.doesNotMatch(client, /if \(prop === 'Produto'\) return http\.preparedEntities\.Produto/);
});
test('V22 projeta somente master data no HTTP e nao envia tenant, estoque, preco ou fiscal operacional', () => {
  const body = toProdutoHttpPayload({ descricao: 'Chapa sintetica', tipo_item: 'Revenda', multiplo_venda: '2',
    fatores_conversao: { kg_por_ton: 1000, kg_por_peca: 0 }, groupId: 'forjado', empresa_id: 'forjada',
    estoque_atual: 25, preco_venda: 100, ncm: '00000000', foto_produto_url: 'local://nao-enviar' });
  assert.deepEqual(body, { descricao: 'Chapa sintetica', tipo_item: 'Revenda', multiplo_venda: 2,
    ncm: '00000000', fatores_conversao: { kg_por_ton: 1000 } });
  assert.equal(JSON.stringify(body).includes('local://'), false);
  assert.throws(() => toProdutoHttpPayload({ descricao: 'Teste', multiplo_venda: 0 }), /Valor invalido/);
  assert.throws(() => toProdutoHttpPayload({ descricao: 'Teste', fatores_conversao: { kg_por_ton: -1 } }), /Fator invalido/);
});

test('DAM prepara apenas formatos homologados; CAD continua bloqueado', () => {
  const scope = { groupId: '11111111-1111-4111-8111-111111111111',
    empresaId: '22222222-2222-4222-8222-222222222222',
    produtoId: '33333333-3333-4333-8333-333333333333' };
  const image = prepareProdutoMediaFile({ name: 'peca.png', type: 'image/png', size: 8 }, scope);
  assert.match(image.storage_key, /^groups\/11111111.*\/companies\/22222222.*\/products\/33333333.*\/images\//);
  assert.equal(image.categoria, 'IMAGEM');
  assert.equal(image.sha256, undefined);
  const accented = prepareProdutoMediaFile({ name: 'Pe\u00e7a 01.png', type: 'image/png', size: 8 }, scope);
  assert.equal(accented.nome_arquivo, 'Pe\u00e7a 01.png');
  assert.match(accented.storage_key, /\/images\/[0-9a-f-]+-Pec-a-01\.png$/);
  assert.throws(() => prepareProdutoMediaFile({ name: 'foto\\mal.png', type: 'image/png', size: 8 }, scope), /Nome de arquivo invalido/);
  assert.throws(() => prepareProdutoMediaFile({ name: 'foto\u202Egnp.png', type: 'image/png', size: 8 }, scope), /Nome de arquivo invalido/);
  assert.equal(CAD_FORMAT_POLICY.enabled, false);
  assert.throws(() => prepareProdutoMediaFile({ name: 'peca.dwg', type: 'application/acad', size: 8 }, scope), /Formato nao permitido/);
  assert.throws(() => prepareProdutoMediaFile({ name: 'virus.exe', type: 'application/octet-stream', size: 8 }, scope), /Formato nao permitido/);
  assert.throws(() => prepareProdutoMediaFile({ name: 'peca.png', type: 'image/png', size: 0 }, scope), /Tamanho/);
  assert.throws(() => prepareProdutoMediaFile({ name: 'peca.png', type: 'image/png', size: 8 }, { ...scope, empresaId: null }), /canonicos/);
});
