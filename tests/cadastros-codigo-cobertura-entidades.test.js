import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { MASTER_CODE_SPECS } from '../src/api/localCadastroMasterPolicy.js';

const BLOCO_FILES = [
  'src/components/cadastros/blocks/Bloco1Pessoas.jsx',
  'src/components/cadastros/blocks/Bloco2Produtos.jsx',
  'src/components/cadastros/blocks/Bloco3Financeiro.jsx',
  'src/components/cadastros/blocks/Bloco4Logistica.jsx',
  'src/components/cadastros/blocks/Bloco5Organizacional.jsx',
  'src/components/cadastros/blocks/Bloco6Tecnologia.jsx',
];

/** Entidades de cadastro geral com código numérico no MASTER_CODE (exclui CRM/logística prefixada). */
const CADASTRO_CODE_ENTITIES = Object.keys(MASTER_CODE_SPECS).filter((name) => {
  const spec = MASTER_CODE_SPECS[name];
  return spec.field === 'codigo' || name === 'TabelaPreco' || name === 'Colaborador';
});

test('MASTER_CODE_SPECS cobre as entidades de Cadastros Gerais esperadas', () => {
  for (const required of [
    'Cliente', 'Fornecedor', 'Transportadora', 'Produto', 'Marca', 'GrupoProduto',
    'SetorAtividade', 'UnidadeMedida', 'Servico', 'KitProduto', 'CatalogoWeb',
    'SegmentoCliente', 'RegiaoAtendimento', 'Banco', 'FormaPagamento', 'TipoDespesa',
    'CentroCusto', 'CentroResultado', 'PlanoDeContas', 'TipoFrete', 'LocalEstoque',
    'Veiculo', 'Motorista', 'Departamento', 'Cargo', 'Turno',
  ]) {
    assert.ok(MASTER_CODE_SPECS[required], `faltando MASTER_CODE_SPECS.${required}`);
  }
});

test('Blocos 1–6 listam codigo nos campos principais das entidades MASTER_CODE', async () => {
  const sources = await Promise.all(BLOCO_FILES.map((path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')));
  const joined = sources.join('\n');
  const produtos = await readFile(new URL('../src/components/cadastros/VisualizadorProdutos.jsx', import.meta.url), 'utf8');
  const missing = [];
  for (const entity of CADASTRO_CODE_ENTITIES) {
    if (entity === 'PlanoContas') continue; // alias de PlanoDeContas
    if (entity === 'Colaborador') continue; // codigo_vendedor_legado
    if (entity === 'Produto') {
      assert.match(produtos, /camposPrincipais:[\s\S]{0,200}codigo/);
      continue;
    }
    if (entity === 'TabelaPreco') {
      assert.match(joined, /TabelaPreco[\s\S]{0,400}codigo/);
      continue;
    }
    // Blocos usam `campos:` (Bloco2) ou `c:` (demais)
    const re = new RegExp(`k:\\s*'${entity}'[\\s\\S]{0,320}(?:campos|c):\\s*\\[[^\\]]*\\bcodigo\\b`);
    if (!re.test(joined)) missing.push(entity);
  }
  assert.deepEqual(missing, [], `entidades sem codigo na grade: ${missing.join(', ')}`);
});

test('openCadastroEntityWindow cobre todos os blocos com uniqueKey', async () => {
  const open = await readFile(new URL('../src/components/cadastros/openCadastroWindow.js', import.meta.url), 'utf8');
  assert.match(open, /uniqueKey/);
  assert.match(open, /Cadastros\.\$\{entity\}\.visualizador/);
  for (const file of BLOCO_FILES) {
    const src = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.match(src, /openCadastroEntityWindow/, `${file} deve usar openCadastroEntityWindow`);
  }
});

test('forms auxiliares MASTER_CODE expoem codigo-registro readonly', async () => {
  const fieldSrc = await readFile(new URL('../src/components/cadastros/CadastroCodigoRegistroField.jsx', import.meta.url), 'utf8');
  assert.match(fieldSrc, /readOnly/);
  assert.match(fieldSrc, /Código de registro/);
  for (const [file, action] of [
    ['MarcaForm.jsx', 'codigo-registro-marca'],
    ['GrupoProdutoForm.jsx', 'codigo-registro-grupo-produto'],
    ['SetorAtividadeForm.jsx', 'codigo-registro-setor-atividade'],
    ['UnidadeMedidaForm.jsx', 'codigo-registro-unidade-medida'],
    ['ServicoForm.jsx', 'codigo-registro-servico'],
    ['SegmentoClienteForm.jsx', 'codigo-registro-segmento-cliente'],
    ['BancoForm.jsx', 'codigo-registro-banco'],
    ['TransportadoraForm.jsx', 'codigo-registro-transportadora'],
    ['TipoDespesaForm.jsx', 'codigo-registro-tipo-despesa'],
    ['CentroCustoForm.jsx', 'codigo-registro-centro-custo'],
    ['CentroResultadoForm.jsx', 'codigo-registro-centro-resultado'],
    ['RegiaoAtendimentoForm.jsx', 'codigo-registro-regiao-atendimento'],
    ['DepartamentoForm.jsx', 'codigo-registro-departamento'],
    ['CargoForm.jsx', 'codigo-registro-cargo'],
    ['TurnoForm.jsx', 'codigo-registro-turno'],
    ['TipoFreteForm.jsx', 'codigo-registro-tipo-frete'],
    ['LocalEstoqueForm.jsx', 'codigo-registro-local-estoque'],
    ['KitProdutoForm.jsx', 'codigo-registro-kit-produto'],
    ['CatalogoWebForm.jsx', 'codigo-registro-catalogo-web'],
    ['VeiculoForm.jsx', 'codigo-registro-veiculo'],
    ['MotoristaForm.jsx', 'codigo-registro-motorista'],
    ['FormaPagamentoForm.jsx', 'codigo-registro-forma-pagamento'],
  ]) {
    const src = await readFile(new URL(`../src/components/cadastros/${file}`, import.meta.url), 'utf8');
    assert.match(src, new RegExp(action));
    assert.match(src, /CadastroCodigoRegistroField/);
  }
});

test('Bloco 6 Tecnologia lista entidades fora de MASTER_CODE field=codigo', async () => {
  const src = await readFile(new URL('../src/components/cadastros/blocks/Bloco6Tecnologia.jsx', import.meta.url), 'utf8');
  for (const entity of [
    'ApiExterna', 'ChatbotCanal', 'ChatbotIntent', 'GatewayPagamento',
    'JobAgendado', 'Webhook', 'ConfiguracaoNFe', 'EventoNotificacao',
  ]) {
    assert.match(src, new RegExp(`k:\\s*'${entity}'`));
    assert.equal(MASTER_CODE_SPECS[entity]?.field === 'codigo', false, `${entity} não deve exigir codigo numérico Cadastros`);
  }
});
