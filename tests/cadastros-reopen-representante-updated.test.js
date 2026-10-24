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

test('UnidadeMedida, GrupoProduto e SetorAtividade reabrem por updated_date com código/ID', async () => {
  for (const [rel, action] of [
    ['src/components/cadastros/UnidadeMedidaForm.jsx', 'codigo-registro-unidade-medida'],
    ['src/components/cadastros/GrupoProdutoForm.jsx', 'codigo-registro-grupo-produto'],
    ['src/components/cadastros/SetorAtividadeForm.jsx', 'codigo-registro-setor-atividade'],
  ]) {
    const text = await source(rel);
    assert.match(text, /prevIdRef/);
    assert.match(text, /prevUpdatedRef/);
    assert.match(text, /idChanged \|\| updatedChanged/);
    assert.match(text, /dadosIniciais\?\.updated_date/);
    assert.match(text, /CadastroCodigoRegistroField/);
    assert.match(text, new RegExp(action));
    assert.match(text, /isSubmitting/);
  }
});

test('Banco, Cargo e Departamento reabrem por updated_date com código/ID', async () => {
  for (const [rel, action] of [
    ['src/components/cadastros/BancoForm.jsx', 'codigo-registro-banco'],
    ['src/components/cadastros/CargoForm.jsx', 'codigo-registro-cargo'],
    ['src/components/cadastros/DepartamentoForm.jsx', 'codigo-registro-departamento'],
  ]) {
    const text = await source(rel);
    assert.match(text, /prevIdRef/);
    assert.match(text, /prevUpdatedRef/);
    assert.match(text, /idChanged \|\| updatedChanged/);
    assert.match(text, /dadosIniciais\?\.updated_date/);
    assert.match(text, /CadastroCodigoRegistroField/);
    assert.match(text, new RegExp(action));
    assert.match(text, /isSubmitting/);
  }
});

test('Turno, Veiculo, Motorista e TipoDespesa reabrem por updated_date com código/ID', async () => {
  for (const [rel, action] of [
    ['src/components/cadastros/TurnoForm.jsx', 'codigo-registro-turno'],
    ['src/components/cadastros/VeiculoForm.jsx', 'codigo-registro-veiculo'],
    ['src/components/cadastros/MotoristaForm.jsx', 'codigo-registro-motorista'],
    ['src/components/cadastros/TipoDespesaForm.jsx', 'codigo-registro-tipo-despesa'],
  ]) {
    const text = await source(rel);
    assert.match(text, /prevIdRef/);
    assert.match(text, /prevUpdatedRef/);
    assert.match(text, /idChanged \|\| updatedChanged/);
    assert.match(text, /dadosIniciais\?\.updated_date/);
    assert.match(text, /CadastroCodigoRegistroField/);
    assert.match(text, new RegExp(action));
    assert.match(text, /isSubmitting/);
  }
});

test('MoedaIndice, OperadorCaixa e CentroCusto reabrem por updated_date', async () => {
  for (const [rel, action, updatedNeedle] of [
    ['src/components/cadastros/MoedaIndiceForm.jsx', 'id-tecnico-moeda-indice', 'dadosIniciais?.updated_date'],
    ['src/components/cadastros/OperadorCaixaForm.jsx', 'id-tecnico-operador-caixa', 'dadosIniciais?.updated_date'],
    ['src/components/cadastros/CentroCustoForm.jsx', 'codigo-registro-centro-custo', 'dadosCentroCusto?.updated_date'],
  ]) {
    const text = await source(rel);
    assert.match(text, /prevIdRef/);
    assert.match(text, /prevUpdatedRef/);
    assert.match(text, /idChanged \|\| updatedChanged/);
    assert.match(text, new RegExp(updatedNeedle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(text, /CadastroCodigoRegistroField/);
    assert.match(text, new RegExp(action));
    assert.match(text, /isSubmitting/);
  }
});
