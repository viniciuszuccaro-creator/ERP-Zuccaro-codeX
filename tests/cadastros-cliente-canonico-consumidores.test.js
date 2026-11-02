/**
 * Unificação overlaps: CadastroClienteCompleto é o runtime canônico.
 * comercial/ClienteForm* permanecem (não apagar) mas sem consumidores de montagem.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');

const consumers = [
  'src/components/comercial/ClientesTab.jsx',
  'src/components/cadastros/VisualizadorUniversalEntidadeV24.jsx',
  'src/components/AcoesRapidasGlobal.jsx',
  'src/components/cadastros/PainelDinamicoCliente.jsx',
  'src/components/cadastros/blocks/Bloco1Pessoas.jsx',
];

test('consumidores runtime montam CadastroClienteCompleto (não comercial/ClienteForm*)', () => {
  for (const path of consumers) {
    const source = read(path);
    assert.match(source, /CadastroClienteCompleto/, `${path} deve importar/usar CadastroClienteCompleto`);
    assert.doesNotMatch(
      source,
      /from ["']@\/components\/comercial\/ClienteFormCompleto["']/,
      `${path} não deve montar ClienteFormCompleto`,
    );
    assert.doesNotMatch(
      source,
      /from ["']@\/components\/comercial\/ClienteForm["']/,
      `${path} não deve montar ClienteForm simples`,
    );
  }
});

test('comercial/ClienteForm* marcados não-canônicos e preservados', () => {
  const completo = read('src/components/comercial/ClienteFormCompleto.jsx');
  const simples = read('src/components/comercial/ClienteForm.jsx');
  assert.match(completo, /NÃO-CANÔNICO/);
  assert.match(completo, /CadastroClienteCompleto/);
  assert.match(simples, /NÃO-CANÔNICO/);
  assert.match(simples, /CadastroClienteCompleto/);
  assert.match(completo, /export default/);
  assert.match(simples, /export default/);
});
