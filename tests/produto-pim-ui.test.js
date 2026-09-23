import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { toProdutoHttpPayload, prepareProdutoMediaFile, CAD_FORMAT_POLICY } from '../src/components/cadastros/produto/produtoHttpPolicy.js';


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
  assert.equal(CAD_FORMAT_POLICY.enabled, false);
  assert.throws(() => prepareProdutoMediaFile({ name: 'peca.dwg', type: 'application/acad', size: 8 }, scope), /Formato nao permitido/);
  assert.throws(() => prepareProdutoMediaFile({ name: 'virus.exe', type: 'application/octet-stream', size: 8 }, scope), /Formato nao permitido/);
  assert.throws(() => prepareProdutoMediaFile({ name: 'peca.png', type: 'image/png', size: 0 }, scope), /Tamanho/);
  assert.throws(() => prepareProdutoMediaFile({ name: 'peca.png', type: 'image/png', size: 8 }, { ...scope, empresaId: null }), /canonicos/);
});
