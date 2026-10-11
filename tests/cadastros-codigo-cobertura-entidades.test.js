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
      assert.match(joined, /TabelaPreco[\s\S]{0,400}codigo_tabela_legado/);
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

test('CadastroCodigoRegistroField expõe ID técnico quando entityId informado', async () => {
  const fieldSrc = await readFile(new URL('../src/components/cadastros/CadastroCodigoRegistroField.jsx', import.meta.url), 'utf8');
  assert.match(fieldSrc, /entityId/);
  assert.match(fieldSrc, /ID técnico/);
  assert.match(fieldSrc, /id-tecnico-/);
  assert.match(fieldSrc, /idOnly/);
});

test('ContatoB2B e CondicaoComercial expõem ID técnico (idOnly) sem fingir MASTER_CODE', async () => {
  const contato = await readFile(new URL('../src/components/cadastros/ContatoB2BForm.jsx', import.meta.url), 'utf8');
  const condicao = await readFile(new URL('../src/components/cadastros/CondicaoComercialForm.jsx', import.meta.url), 'utf8');
  const bloco1 = await readFile(new URL('../src/components/cadastros/blocks/Bloco1Pessoas.jsx', import.meta.url), 'utf8');
  const bloco3 = await readFile(new URL('../src/components/cadastros/blocks/Bloco3Financeiro.jsx', import.meta.url), 'utf8');
  const viz = await readFile(new URL('../src/components/cadastros/VisualizadorUniversalEntidadeV24.jsx', import.meta.url), 'utf8');
  assert.match(contato, /idOnly/);
  assert.match(contato, /id-tecnico-contato-b2b/);
  assert.match(condicao, /idOnly/);
  assert.match(condicao, /id-tecnico-condicao-comercial/);
  assert.match(bloco1, /k:\s*'ContatoB2B'[\s\S]{0,200}\bid\b/);
  assert.match(bloco3, /k:\s*'CondicaoComercial'[\s\S]{0,200}\bid\b/);
  assert.match(viz, /id:\s*"ID técnico"/);
});

test('Empresa, Grupo, CentroOperacao e TabelaPreco expõem ID técnico; grades sem fingir codigo', async () => {
  const empresa = await readFile(new URL('../src/components/cadastros/EmpresaForm.jsx', import.meta.url), 'utf8');
  const empresaCompleto = await readFile(new URL('../src/components/cadastros/EmpresaFormCompleto.jsx', import.meta.url), 'utf8');
  const filial = await readFile(new URL('../src/components/cadastros/FilialForm.jsx', import.meta.url), 'utf8');
  const grupo = await readFile(new URL('../src/components/cadastros/GrupoEmpresarialForm.jsx', import.meta.url), 'utf8');
  const centro = await readFile(new URL('../src/components/cadastros/CentroOperacaoForm.jsx', import.meta.url), 'utf8');
  const tabela = await readFile(new URL('../src/components/cadastros/TabelaPrecoFormCompleto.jsx', import.meta.url), 'utf8');
  const bloco2 = await readFile(new URL('../src/components/cadastros/blocks/Bloco2Produtos.jsx', import.meta.url), 'utf8');
  const bloco5 = await readFile(new URL('../src/components/cadastros/blocks/Bloco5Organizacional.jsx', import.meta.url), 'utf8');
  const viz = await readFile(new URL('../src/components/cadastros/VisualizadorUniversalEntidadeV24.jsx', import.meta.url), 'utf8');
  assert.match(empresaCompleto, /EmpresaForm/);
  assert.match(empresaCompleto, /Adapter legado/);
  assert.match(filial, /EmpresaForm/);
  assert.match(filial, /tipo:\s*["']Filial["']/);
  for (const [src, action] of [
    [empresa, 'id-tecnico-empresa'],
    [grupo, 'id-tecnico-grupo-empresarial'],
    [centro, 'id-tecnico-centro-operacao'],
    [tabela, 'id-tecnico-tabela-preco'],
  ]) {
    assert.match(src, /CadastroCodigoRegistroField/);
    assert.match(src, /idOnly/);
    assert.match(src, new RegExp(action));
  }
  assert.match(empresa, /id-tecnico-empresa/);
  assert.match(empresa, /selecionar-tipo-empresa/);
  assert.match(bloco5, /k:\s*'Empresa'[\s\S]{0,220}\bid\b/);
  assert.match(bloco5, /k:\s*'GrupoEmpresarial'[\s\S]{0,220}\bid\b/);
  assert.doesNotMatch(bloco5, /k:\s*'Empresa'[\s\S]{0,120}\bcodigo\b/);
  assert.doesNotMatch(bloco5, /k:\s*'GrupoEmpresarial'[\s\S]{0,120}\bcodigo\b/);
  assert.match(bloco2, /TabelaPreco[\s\S]{0,220}codigo_tabela_legado/);
  assert.match(viz, /codigo_tabela_legado:\s*"Código legado"/);
  assert.equal(MASTER_CODE_SPECS.Empresa?.field === 'codigo', false);
  assert.equal(MASTER_CODE_SPECS.GrupoEmpresarial?.field === 'codigo', false);
  assert.equal(MASTER_CODE_SPECS.CentroOperacao?.field === 'codigo', false);
});

test('Representante grade tem codigo+id e Colaborador grade/form têm ID técnico', async () => {
  const bloco1 = await readFile(new URL('../src/components/cadastros/blocks/Bloco1Pessoas.jsx', import.meta.url), 'utf8');
  const colaborador = await readFile(new URL('../src/components/rh/ColaboradorForm.jsx', import.meta.url), 'utf8');
  assert.match(bloco1, /k:\s*'Representante'[\s\S]{0,220}\bcodigo\b[\s\S]{0,80}\bid\b/);
  assert.match(bloco1, /k:\s*'Colaborador'[\s\S]{0,200}\bid\b/);
  assert.match(colaborador, /idOnly/);
  assert.match(colaborador, /id-tecnico-colaborador/);
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
    ['FormaPagamentoFormCompleto.jsx', 'codigo-registro-forma-pagamento-completo'],
    ['RotaPadraoForm.jsx', 'codigo-registro-rota-padrao'],
  ]) {
    const src = await readFile(new URL(`../src/components/cadastros/${file}`, import.meta.url), 'utf8');
    assert.match(src, new RegExp(action));
    assert.match(src, /CadastroCodigoRegistroField/);
    assert.match(src, /entityId=\{/, `${file} deve passar entityId ao campo codigo/ID`);
  }
});

test('FormaPagamentoForm é adapter canônico do Completo (sem store paralelo)', async () => {
  const simple = await readFile(new URL('../src/components/cadastros/FormaPagamentoForm.jsx', import.meta.url), 'utf8');
  const bloco3 = await readFile(new URL('../src/components/cadastros/blocks/Bloco3Financeiro.jsx', import.meta.url), 'utf8');
  assert.match(simple, /FormaPagamentoFormCompleto/);
  assert.match(simple, /formaPagamento \|\| forma \|\| item/);
  assert.doesNotMatch(simple, /createTable|FormaPagamentoStore/);
  assert.match(bloco3, /FormaPagamentoForm/);
  assert.doesNotMatch(bloco3, /FormaPagamentoFormCompleto/);
});

test('TabelaPrecoForm é adapter canônico do Completo (sem store paralelo)', async () => {
  const simple = await readFile(new URL('../src/components/cadastros/TabelaPrecoForm.jsx', import.meta.url), 'utf8');
  const bloco2 = await readFile(new URL('../src/components/cadastros/blocks/Bloco2Produtos.jsx', import.meta.url), 'utf8');
  assert.match(simple, /TabelaPrecoFormCompleto/);
  assert.match(simple, /tabela \|\| item \|\| data/);
  assert.doesNotMatch(simple, /createTable|TabelaPrecoStore/);
  assert.match(bloco2, /TabelaPrecoForm/);
  assert.doesNotMatch(bloco2, /TabelaPrecoFormCompleto/);
});

test('RepresentanteForm é adapter canônico do Completo (sem store paralelo)', async () => {
  const simple = await readFile(new URL('../src/components/cadastros/RepresentanteForm.jsx', import.meta.url), 'utf8');
  const bloco1 = await readFile(new URL('../src/components/cadastros/blocks/Bloco1Pessoas.jsx', import.meta.url), 'utf8');
  const v24 = await readFile(new URL('../src/components/cadastros/VisualizadorUniversalEntidadeV24.jsx', import.meta.url), 'utf8');
  const tab = await readFile(new URL('../src/components/cadastros/RepresentantesTab.jsx', import.meta.url), 'utf8');
  assert.match(simple, /RepresentanteFormCompleto/);
  assert.match(simple, /representante \|\| item \|\| data/);
  assert.match(simple, /isSelfManagedCadastro = true/);
  assert.doesNotMatch(simple, /createTable|RepresentanteStore/);
  assert.match(bloco1, /RepresentanteForm/);
  assert.doesNotMatch(bloco1, /RepresentanteFormCompleto/);
  assert.match(v24, /Representante:\s*RepresentanteForm/);
  assert.match(v24, /"RepresentanteForm"/);
  assert.match(tab, /from "\.\/RepresentanteForm"/);
  assert.doesNotMatch(tab, /RepresentanteFormCompleto/);
});

test('forms fora de MASTER_CODE.codigo expõem ID técnico idOnly + grades com id', async () => {
  const bloco3 = await readFile(new URL('../src/components/cadastros/blocks/Bloco3Financeiro.jsx', import.meta.url), 'utf8');
  const bloco4 = await readFile(new URL('../src/components/cadastros/blocks/Bloco4Logistica.jsx', import.meta.url), 'utf8');
  const bloco5 = await readFile(new URL('../src/components/cadastros/blocks/Bloco5Organizacional.jsx', import.meta.url), 'utf8');
  const bloco6 = await readFile(new URL('../src/components/cadastros/blocks/Bloco6Tecnologia.jsx', import.meta.url), 'utf8');
  for (const [file, action] of [
    ['PerfilAcessoForm.jsx', 'id-tecnico-perfil-acesso'],
    ['MoedaIndiceForm.jsx', 'id-tecnico-moeda-indice'],
    ['OperadorCaixaForm.jsx', 'id-tecnico-operador-caixa'],
    ['ConfiguracaoDespesaRecorrenteForm.jsx', 'id-tecnico-despesa-recorrente'],
    ['TabelaFiscalForm.jsx', 'id-tecnico-tabela-fiscal'],
    ['ModeloDocumentoForm.jsx', 'id-tecnico-modelo-documento'],
    ['ApiExternaForm.jsx', 'id-tecnico-api-externa'],
    ['ChatbotCanalForm.jsx', 'id-tecnico-chatbot-canal'],
    ['ChatbotIntentForm.jsx', 'id-tecnico-chatbot-intent'],
    ['GatewayPagamentoForm.jsx', 'id-tecnico-gateway-pagamento'],
    ['JobAgendadoForm.jsx', 'id-tecnico-job-agendado'],
    ['WebhookForm.jsx', 'id-tecnico-webhook'],
    ['ConfiguracaoNFeForm.jsx', 'id-tecnico-configuracao-nfe'],
    ['EventoNotificacaoForm.jsx', 'id-tecnico-evento-notificacao'],
    ['PlanoContasForm.jsx', 'id-tecnico-plano-contas'],
    ['UsuarioForm.jsx', 'id-tecnico-usuario'],
    ['ParametroCaixaDiarioForm.jsx', 'id-tecnico-parametro-caixa-diario'],
    ['ParametroConciliacaoBancariaForm.jsx', 'id-tecnico-parametro-conciliacao-bancaria'],
    ['ParametroPortalClienteForm.jsx', 'id-tecnico-parametro-portal-cliente'],
    ['ParametroRecebimentoNFeForm.jsx', 'id-tecnico-parametro-recebimento-nfe'],
    ['ParametroRoteirizacaoForm.jsx', 'id-tecnico-parametro-roteirizacao'],
    ['ParametroOrigemPedidoForm.jsx', 'id-tecnico-parametro-origem-pedido'],
    ['ConfiguracaoBoletosForm.jsx', 'id-tecnico-configuracao-boletos'],
    ['ConfiguracaoWhatsAppForm.jsx', 'id-tecnico-configuracao-whatsapp'],
    ['ConfiguracaoIntegracaoForm.jsx', 'id-tecnico-configuracao-integracao'],
  ]) {
    const src = await readFile(new URL(`../src/components/cadastros/${file}`, import.meta.url), 'utf8');
    assert.match(src, /CadastroCodigoRegistroField/);
    assert.match(src, /idOnly/);
    assert.match(src, new RegExp(action));
  }
  assert.match(bloco5, /k:\s*'PerfilAcesso'[\s\S]{0,200}\bid\b/);
  assert.match(bloco3, /k:\s*'MoedaIndice'[\s\S]{0,200}\bid\b/);
  assert.match(bloco3, /k:\s*'OperadorCaixa'[\s\S]{0,200}\bid\b/);
  assert.match(bloco4, /k:\s*'ModeloDocumento'[\s\S]{0,200}\bid\b/);
  for (const entity of [
    'ApiExterna', 'ChatbotCanal', 'ChatbotIntent', 'GatewayPagamento',
    'JobAgendado', 'Webhook', 'ConfiguracaoNFe', 'EventoNotificacao',
  ]) {
    assert.match(bloco6, new RegExp(`k:\\s*'${entity}'[\\s\\S]{0,200}\\bid\\b`));
  }
});

test('ClienteCompleto e Produto V22 expõem código e ID técnico na edição', async () => {
  const cliente = await readFile(new URL('../src/components/cadastros/CadastroClienteCompleto.jsx', import.meta.url), 'utf8');
  const produto = await readFile(new URL('../src/components/cadastros/ProdutoFormV22_Completo.jsx', import.meta.url), 'utf8');
  const produtoCompleto = await readFile(new URL('../src/components/cadastros/ProdutoFormCompleto.jsx', import.meta.url), 'utf8');
  const clienteComercial = await readFile(new URL('../src/components/comercial/ClienteFormCompleto.jsx', import.meta.url), 'utf8');
  const clienteForm = await readFile(new URL('../src/components/comercial/ClienteForm.jsx', import.meta.url), 'utf8');
  assert.match(cliente, /CadastroCodigoRegistroField/);
  assert.match(cliente, /codigo-registro-cliente-completo/);
  assert.match(cliente, /entityId=\{cliente\?\.id\}/);
  assert.match(produto, /data-action="id-tecnico-produto"/);
  assert.match(produto, /readOnly=\{Boolean\(produto\?\.id\)\}/);
  assert.match(produtoCompleto, /ProdutoFormV22_Completo/);
  assert.match(produtoCompleto, /isSelfManagedCadastro = true/);
  assert.doesNotMatch(produtoCompleto, /createTable|useState|TabsList/);
  assert.match(clienteComercial, /CadastroClienteCompleto/);
  assert.match(clienteComercial, /isSelfManagedCadastro = true/);
  assert.doesNotMatch(clienteComercial, /createTable|useState|defaultFormData/);
  assert.match(clienteForm, /CadastroClienteCompleto/);
  assert.doesNotMatch(clienteForm, /clienteSchema|useForm\(/);
});

test('FornecedorCompleto e RepresentanteCompleto expõem código e ID técnico', async () => {
  const fornecedor = await readFile(new URL('../src/components/cadastros/CadastroFornecedorCompleto.jsx', import.meta.url), 'utf8');
  const representante = await readFile(new URL('../src/components/cadastros/RepresentanteFormCompleto.jsx', import.meta.url), 'utf8');
  assert.match(fornecedor, /codigo-registro-fornecedor-completo/);
  assert.match(fornecedor, /entityId=\{fornecedor\?\.id\}/);
  assert.match(representante, /codigo-registro-representante-completo/);
  assert.match(representante, /entityId=\{representante\?\.id\}/);
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
