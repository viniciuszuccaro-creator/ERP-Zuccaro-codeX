/**
 * #591 — grade Cadastros/Comercial Cliente deve exibir campos do contrato HTTP
 * (documento/email/telefone/celular), não só nome.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {clienteNavigationRemainder,clienteDocumentDisplayHunks} from './helpers/clienteNavigationRemainder.js';

const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

test('Grade: peel exato preserva guarda ancestral e rejeita adulteracao',()=>{
  const source=read('src/components/cadastros/VisualizadorUniversalEntidadeV24.jsx');
  const original=clienteNavigationRemainder(source);
  for(const [after]of clienteDocumentDisplayHunks)
    for(const forged of ['',after+after,after.replace(/\S/,'!')])
      assert.throws(()=>clienteNavigationRemainder(source.replace(after,forged)));
  assert.notEqual(clienteNavigationRemainder(source+'\n// OUTSIDE_DISPLAY\n'),original);
});

test('Bloco1 Pessoas: Cliente lista documento + contatos escalares', () => {
  const src = read('src/components/cadastros/blocks/Bloco1Pessoas.jsx');
  assert.match(src, /k: 'Cliente'/);
  assert.match(src, /documento/);
  assert.match(src, /email/);
  assert.match(src, /telefone/);
  assert.match(src, /celular/);
});

test('ClientesTab Comercial: colunas alinhadas ao MASTER HTTP', () => {
  const src = read('src/components/comercial/ClientesTab.jsx');
  assert.match(src, /documento/);
  assert.match(src, /email/);
  assert.match(src, /telefone/);
  assert.match(src, /celular/);
});

test('V24: documento unificado nao transforma CNPJ em CPF nem repete tres colunas', () => {
  const src = read('src/components/cadastros/VisualizadorUniversalEntidadeV24.jsx');
  const start=src.indexOf('function buildFieldVariants('),end=src.indexOf('// ─── helpers',start);
  assert.ok(start>0&&end>start);
  const display=Function('LABEL_FALLBACKS',src.slice(start,end)+';return getDisplayValue;')([]);
  assert.equal(display({documento:'00000000000000'},{field:'documento'},false),'00000000000000');
  assert.equal(display({documento:'00000000000000'},{field:'cpf'},false),undefined);
  assert.equal(display({documento:'00000000000'},{field:'cnpj'},false),undefined);
  assert.equal(display({cpf:'00000000000',cnpj:null},{field:'cpf'},false),'00000000000');
  assert.equal(display({cnpj:'00000000000000',cpf:null},{field:'cnpj'},false),'00000000000000');
  const block=read('src/components/cadastros/blocks/Bloco1Pessoas.jsx');
  const fields=block.match(/k: 'Cliente'[^\n]+c: \[([^\]]+)\]/)[1].match(/'[^']+'/g).map(x=>x.slice(1,-1));
  assert.deepEqual(fields.filter(f=>['documento','cpf','cnpj','cpf_cnpj'].includes(f)),['documento']);
  assert.ok(fields.includes('cidade')&&fields.includes('uf'));
  assert.match(src, /documento: "CPF\/CNPJ"/);
  assert.match(src, /variants\.concat\(\['documento'/);
  assert.match(src, /telefone\|fone\|celular\|whatsapp/);
});

test('HTTP client hidrata UI a partir do MASTER', () => {
  const src = read('src/api/httpApiClient.js');
  assert.match(src, /hydrateClienteHttpRowForUi/);
  assert.doesNotMatch(src, /withHydratedContatos\(await base\.get/);
});

test('Completo: mapToForm espelha documento; Contatos mostra escalares sem wipe', () => {
  const src = read('src/components/cadastros/CadastroClienteCompleto.jsx');
  assert.match(src, /record\?\.documento \?\? record\?\.cpf_cnpj/);
  assert.match(src, /contatosViewForUi/);
  assert.match(src, /data-fonte="contatos-escalares-http"/);
});
