import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function source(rel) {
  return readFile(new URL(`../${rel}`, import.meta.url), 'utf8');
}

test('RepresentanteForm reabre por id ou updated_date e não limpa edição suja do mesmo registro', async () => {
  const text = await source('src/components/cadastros/RepresentanteForm.jsx');
  assert.match(text, /prevIdRef/);
  assert.match(text, /prevUpdatedRef/);
  assert.match(text, /idChanged \|\| updatedChanged/);
  assert.match(text, /dadosIniciais\?\.updated_date/);
  assert.match(text, /CadastroCodigoRegistroField/);
  assert.match(text, /codigo-registro-representante/);
});

test('RepresentanteFormCompleto reabre por id ou updated_date preservando abas/relações', async () => {
  const text = await source('src/components/cadastros/RepresentanteFormCompleto.jsx');
  assert.match(text, /prevIdRef/);
  assert.match(text, /prevUpdatedRef/);
  assert.match(text, /idChanged \|\| updatedChanged/);
  assert.match(text, /representante\?\.updated_date/);
  assert.match(text, /CadastroCodigoRegistroField/);
  assert.match(text, /codigo-registro-representante-completo/);
});

test('FormaPagamentoForm e Completo reidratam por updated_date', async () => {
  for (const rel of [
    'src/components/cadastros/FormaPagamentoForm.jsx',
    'src/components/cadastros/FormaPagamentoFormCompleto.jsx',
  ]) {
    const text = await source(rel);
    assert.match(text, /prevUpdatedRef/);
    assert.match(text, /updatedChanged/);
    assert.match(text, /updated_date/);
  }
});

test('RegiaoAtendimentoForm reidrata props por updated_date sem apagar carga assíncrona', async () => {
  const text = await source('src/components/cadastros/RegiaoAtendimentoForm.jsx');
  assert.match(text, /prevUpdatedRef/);
  assert.match(text, /propsUpdatedChanged/);
  assert.match(text, /dadosIniciaisProps\?\.updated_date/);
  assert.match(text, /CadastroCodigoRegistroField/);
});
