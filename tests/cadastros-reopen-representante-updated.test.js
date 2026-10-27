import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function source(rel) {
  return readFile(new URL(`../${rel}`, import.meta.url), 'utf8');
}

const coorteHook = [
  'src/components/cadastros/RepresentanteForm.jsx',
  'src/components/cadastros/RepresentanteFormCompleto.jsx',
  'src/components/cadastros/FormaPagamentoForm.jsx',
  'src/components/cadastros/FormaPagamentoFormCompleto.jsx',
  'src/components/cadastros/UnidadeMedidaForm.jsx',
  'src/components/cadastros/GrupoProdutoForm.jsx',
  'src/components/cadastros/SetorAtividadeForm.jsx',
  'src/components/cadastros/MarcaForm.jsx',
  'src/components/cadastros/BancoForm.jsx',
  'src/components/cadastros/CargoForm.jsx',
  'src/components/cadastros/DepartamentoForm.jsx',
  'src/components/cadastros/TurnoForm.jsx',
  'src/components/cadastros/VeiculoForm.jsx',
  'src/components/cadastros/MotoristaForm.jsx',
  'src/components/cadastros/TipoDespesaForm.jsx',
  'src/components/cadastros/CentroCustoForm.jsx',
  'src/components/cadastros/PlanoContasForm.jsx',
  'src/components/cadastros/CadastroClienteCompleto.jsx',
  'src/components/cadastros/CadastroFornecedorCompleto.jsx',
];

test('coorte #351 usa useCadastroReopenOnIdentity (política canônica anti-wipe)', async () => {
  for (const rel of coorteHook) {
    const text = await source(rel);
    assert.match(text, /useCadastroReopenOnIdentity/, rel);
    assert.doesNotMatch(text, /idChanged \|\| updatedChanged/, rel);
  }
});


test('coorte reopen captura boundId e usa no vínculo de salvamento/código', async () => {
  const precisaBound = [
    'src/components/cadastros/BancoForm.jsx',
    'src/components/cadastros/CargoForm.jsx',
    'src/components/cadastros/DepartamentoForm.jsx',
    'src/components/cadastros/FormaPagamentoForm.jsx',
    'src/components/cadastros/UnidadeMedidaForm.jsx',
    'src/components/cadastros/GrupoProdutoForm.jsx',
    'src/components/cadastros/SetorAtividadeForm.jsx',
    'src/components/cadastros/MarcaForm.jsx',
    'src/components/cadastros/CentroCustoForm.jsx',
    'src/components/cadastros/PlanoContasForm.jsx',
    'src/components/cadastros/TurnoForm.jsx',
    'src/components/cadastros/VeiculoForm.jsx',
    'src/components/cadastros/MotoristaForm.jsx',
    'src/components/cadastros/TipoDespesaForm.jsx',
    'src/components/cadastros/RepresentanteForm.jsx',
    'src/components/cadastros/FormaPagamentoFormCompleto.jsx',
  ];
  for (const rel of precisaBound) {
    const text = await source(rel);
    assert.match(text, /boundId:\s*\w+BoundId/, `${rel} deve capturar boundId`);
    assert.match(text, /\w+BoundId \? \{ id: \w+BoundId \}|updateInContext\([^,]+,\s*\w+BoundId|entityId=\{\w+BoundId\}/, `${rel} deve vincular salvamento/código ao boundId`);
  }
});

test('RepresentanteForm preserva código/ID e hook de reopen', async () => {
  const text = await source('src/components/cadastros/RepresentanteForm.jsx');
  assert.match(text, /useCadastroReopenOnIdentity/);
  assert.match(text, /CadastroCodigoRegistroField/);
  assert.match(text, /codigo-registro-representante/);
});

test('RepresentanteFormCompleto preserva abas/relações e hook de reopen', async () => {
  const text = await source('src/components/cadastros/RepresentanteFormCompleto.jsx');
  assert.match(text, /useCadastroReopenOnIdentity/);
  assert.match(text, /CadastroCodigoRegistroField/);
  assert.match(text, /codigo-registro-representante-completo/);
  assert.match(text, /clearOnNull:\s*false/);
});

test('RegiaoAtendimentoForm reidrata props por updated_date com confirmação de rascunho sujo', async () => {
  const text = await source('src/components/cadastros/RegiaoAtendimentoForm.jsx');
  assert.match(text, /prevUpdatedRef/);
  assert.match(text, /propsUpdatedChanged/);
  assert.match(text, /decideCadastroReopen/);
  assert.match(text, /CADASTRO_DIRTY_REOPEN_CONFIRM/);
  assert.match(text, /dadosIniciaisProps\?\.updated_date/);
  assert.match(text, /CadastroCodigoRegistroField/);
});

test('UnidadeMedida, GrupoProduto e SetorAtividade mantêm código/ID + isSubmitting', async () => {
  for (const [rel, action] of [
    ['src/components/cadastros/UnidadeMedidaForm.jsx', 'codigo-registro-unidade-medida'],
    ['src/components/cadastros/GrupoProdutoForm.jsx', 'codigo-registro-grupo-produto'],
    ['src/components/cadastros/SetorAtividadeForm.jsx', 'codigo-registro-setor-atividade'],
  ]) {
    const text = await source(rel);
    assert.match(text, /useCadastroReopenOnIdentity/);
    assert.match(text, /CadastroCodigoRegistroField/);
    assert.match(text, new RegExp(action));
    assert.match(text, /isSubmitting/);
  }
});

test('Banco, Cargo e Departamento mantêm código/ID + isSubmitting', async () => {
  for (const [rel, action] of [
    ['src/components/cadastros/BancoForm.jsx', 'codigo-registro-banco'],
    ['src/components/cadastros/CargoForm.jsx', 'codigo-registro-cargo'],
    ['src/components/cadastros/DepartamentoForm.jsx', 'codigo-registro-departamento'],
  ]) {
    const text = await source(rel);
    assert.match(text, /useCadastroReopenOnIdentity/);
    assert.match(text, /CadastroCodigoRegistroField/);
    assert.match(text, new RegExp(action));
    assert.match(text, /isSubmitting/);
  }
});

test('Turno, Veiculo, Motorista e TipoDespesa mantêm código/ID + isSubmitting', async () => {
  for (const [rel, action] of [
    ['src/components/cadastros/TurnoForm.jsx', 'codigo-registro-turno'],
    ['src/components/cadastros/VeiculoForm.jsx', 'codigo-registro-veiculo'],
    ['src/components/cadastros/MotoristaForm.jsx', 'codigo-registro-motorista'],
    ['src/components/cadastros/TipoDespesaForm.jsx', 'codigo-registro-tipo-despesa'],
  ]) {
    const text = await source(rel);
    assert.match(text, /useCadastroReopenOnIdentity/);
    assert.match(text, /CadastroCodigoRegistroField/);
    assert.match(text, new RegExp(action));
    assert.match(text, /isSubmitting/);
  }
});

test('CentroCusto e PlanoContas na política canônica', async () => {
  const centro = await source('src/components/cadastros/CentroCustoForm.jsx');
  assert.match(centro, /useCadastroReopenOnIdentity/);
  assert.match(centro, /codigo-registro-centro-custo/);
  assert.match(centro, /isSubmitting/);
  const plano = await source('src/components/cadastros/PlanoContasForm.jsx');
  assert.match(plano, /useCadastroReopenOnIdentity/);
  assert.match(plano, /isSubmitting/);
  // Conta hierárquica permanece editável; CodigoField só em idOnly (≠ MASTER_CODE numérico).
  assert.match(plano, /CadastroCodigoRegistroField/);
  assert.match(plano, /idOnly/);
  assert.match(plano, /id-tecnico-plano-contas/);
  assert.match(plano, /editar-codigo-plano-contas/);
  assert.doesNotMatch(plano, /codigo-registro-plano/);
});

test('MoedaIndice graduou para reopen canônico (boundId; sem prevUpdatedRef manual)', async () => {
  const text = await source('src/components/cadastros/MoedaIndiceForm.jsx');
  assert.match(text, /CadastroCodigoRegistroField/);
  assert.match(text, /useCadastroReopenOnIdentity/);
  assert.match(text, /moedaBoundId/);
  assert.doesNotMatch(text, /prevIdRef/);
  assert.doesNotMatch(text, /prevUpdatedRef/);
  assert.doesNotMatch(text, /useCadastroRecordState/);
});

test('OperadorCaixa graduou para reopen canônico (boundId; sem prevUpdatedRef manual)', async () => {
  const text = await source('src/components/cadastros/OperadorCaixaForm.jsx');
  assert.match(text, /CadastroCodigoRegistroField/);
  assert.match(text, /useCadastroReopenOnIdentity/);
  assert.match(text, /operadorBoundId/);
  assert.doesNotMatch(text, /prevUpdatedRef/);
  assert.doesNotMatch(text, /useCadastroRecordState/);
});

test('CondicaoComercial graduou para reopen canônico (boundId; sem prevUpdatedRef manual)', async () => {
  const text = await source('src/components/cadastros/CondicaoComercialForm.jsx');
  assert.match(text, /CadastroCodigoRegistroField/);
  assert.match(text, /useCadastroReopenOnIdentity/);
  assert.match(text, /condicaoBoundId/);
  assert.doesNotMatch(text, /prevUpdatedRef/);
  assert.doesNotMatch(text, /useCadastroRecordState/);
});

test('ContatoB2B graduou para reopen canônico (boundId; preserva preferencias)', async () => {
  const text = await source('src/components/cadastros/ContatoB2BForm.jsx');
  assert.match(text, /CadastroCodigoRegistroField/);
  assert.match(text, /useCadastroReopenOnIdentity/);
  assert.match(text, /contatoBoundId/);
  assert.match(text, /preferencias_comunicacao/);
  assert.doesNotMatch(text, /prevUpdatedRef/);
  assert.doesNotMatch(text, /useCadastroRecordState/);
});
