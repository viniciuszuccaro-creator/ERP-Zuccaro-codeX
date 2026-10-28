/**
 * #397 — chrome sky nos forms de entrada (Bloco1/organizacional) já com código+reopen.
 * Não altera RBAC nem gera código no browser.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const FORMS = [
  'MarcaForm.jsx',
  'CargoForm.jsx',
  'DepartamentoForm.jsx',
  'SetorAtividadeForm.jsx',
  'GrupoProdutoForm.jsx',
  'RepresentanteForm.jsx',
  'TurnoForm.jsx',
  'RegiaoAtendimentoForm.jsx',
  'CentroCustoForm.jsx',
  'FormaPagamentoForm.jsx',
  'PlanoContasForm.jsx',
  'ServicoForm.jsx',
  'TipoFreteForm.jsx',
  'LocalEstoqueForm.jsx',
  'SegmentoClienteForm.jsx',
  'KitProdutoForm.jsx',
  'TabelaPrecoForm.jsx',
];

for (const name of FORMS) {
  test(`${name}: windowMode usa sky chrome (azul-claro aprovado)`, async () => {
    const src = await readFile(new URL(`../src/components/cadastros/${name}`, import.meta.url), 'utf8');
    assert.match(src, /from-sky-50/);
    assert.match(src, /to-sky-100/);
    assert.doesNotMatch(src, /from-purple-50 to-pink-50/);
    assert.doesNotMatch(src, /from-blue-50 to-purple-50/);
  });
}
