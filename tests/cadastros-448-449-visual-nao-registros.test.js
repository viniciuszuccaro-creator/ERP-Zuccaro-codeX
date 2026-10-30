/**
 * #448/#449: chrome sky ≠ recuperação de registros.
 * Contatos embed não inventa lista fictícia como substituto de dados.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(p, 'utf8');

test('#449 Contatos embed: sky presente; sem seed fictício de contatos', () => {
  const src = read('src/components/cadastros/GerenciarContatosClienteForm.jsx');
  assert.match(src, /from-sky-50 to-sky-100/);
  assert.match(src, /data-action="cliente-contatos-embed"/);
  // Defaults vazios — não inventar contatos de demonstração.
  assert.match(src, /contatos\s*=\s*\[\]/);
  assert.doesNotMatch(src, /contatos\s*=\s*\[\s*\{\s*nome:\s*['"]João/);
  assert.doesNotMatch(src, /SEED_CONTATOS_DEMO|contatosFicticios|fakeContatos/);
});

test('#448 Gestores: sky windowMode; evidência declara visual≠registros', () => {
  const formas = read('src/components/cadastros/GestorFormasPagamento.jsx');
  assert.match(formas, /windowMode/);
  const evidence = read('docs/evidence/cadastros-448-449-visual-nao-registros-20261030.txt');
  assert.match(evidence, /NÃO recuperação de registros/);
  assert.match(evidence, /#448/);
  assert.match(evidence, /#449/);
  assert.match(evidence, /sem seed fictício/i);
});

test('pin Fiscal: CadastroFiscal sem sky estrutural (lote visual Contatos)', () => {
  const fiscal = read('src/components/cadastros/CadastroFiscalForm.jsx');
  assert.doesNotMatch(fiscal, /from-sky-50 to-sky-100/);
  assert.match(fiscal, /CadastroCodigoRegistroField/);
  assert.match(fiscal, /idOnly/);
});
