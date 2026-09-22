import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

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
  assert.match(form, /import \{ base44, isHttpBackendMode \} from "@\/api\/base44Client"/);
  assert.match(upload, /if \(isHttpBackendMode\)[\s\S]*return;[\s\S]*base44\.integrations\.Core\.UploadFile/);
  assert.match(form, /onChange=\{handleUploadFoto\}[\s\S]*disabled=\{isHttpBackendMode\}/);
  assert.match(form, /disabled=\{isHttpBackendMode \|\| uploadingFoto/);
  assert.match(form, /disabled=\{isHttpBackendMode \|\| gerandoImagem/);
  assert.match(form, /if \(!url\) throw new Error\('Imagem nao gerada'\)/);
});
