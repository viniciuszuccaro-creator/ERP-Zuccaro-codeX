import { clienteConferenciaRemainder } from './helpers/consolidation81Remainder.js';
import {
  PUBLICATION_BASE,
  REOPEN_AUTHORIZED_CURRENT_SHA,
  REOPEN_AUTHORIZED_MANIFEST_ENTRY,
  REOPEN_AUTHORIZED_REFERENCES,
  REOPEN_CONSOLIDACAO_PATH,
  REOPEN_HISTORICAL_BEFORE_SHA,
  loadHistoricalReopenConsolidacao,
  normalizePublicationSource,
  publicationRestoredHash,
  restoreAuthorizedReopenConsolidacao,
} from './helpers/publicationReopenAuthorizedDelta.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';

const manifest=JSON.parse(fs.readFileSync(new URL('./helpers/publicationBaselineManifest.json',import.meta.url),'utf8'));
const base=PUBLICATION_BASE;
test('publication baseline is the verified composition commit and is available in Git history',()=>{
 assert.equal(manifest.base,base);
 assert.equal(execFileSync('git',['rev-parse',`${base}^{commit}`],{encoding:'utf8'}).trim(),base);
 execFileSync('git',['merge-base','--is-ancestor',base,'HEAD']);
 assert.equal(manifest.cases.length,18);
});
const previousBulkEnumeration = "  assert.deepEqual([...newMembers.keys()].filter(name => !oldMembers.has(name)), ['export', 'restoreBulkSnapshot']);";
const approvedBulkDelta = `  assert.deepEqual([...newMembers.keys()].filter(name => !oldMembers.has(name)),
    ['export', 'correctInactiveLegacyName', 'restoreBulkSnapshot']);
  // Keep the old-method invariant; the authorized lifecycle addition must remain a pure delegation.
  const expected = members(parse(\`class Expected {
  correctInactiveLegacyName(ctx: RequestContext, input: unknown) {
    return correctInactiveLegacyName({ repo: this.repo, audit: this.audit, rbac: this.rbacGuard }, ctx, input);
  }
}\`));
  assert.equal(newMembers.get('correctInactiveLegacyName'), expected.get('correctInactiveLegacyName'));
  assert(after.statements.some(statement => ts.isImportDeclaration(statement)
    && statement.moduleSpecifier.getText(after) === "'./clienteLegacyNameCorrection.js'"));`;
function restoreApprovedBulkDelta(source) {
 assert.equal(source.split(approvedBulkDelta).length,2,'Only the exact authorized lifecycle delta may be normalized');
 return source.replace(approvedBulkDelta,previousBulkEnumeration);
}
const previousCallbackAfter = "  const after = parse(file, fs.readFileSync(file, 'utf8'));\n";
const approvedCallbackImport = "import {cadastroCodigoRegistroRemainder} from './helpers/cadastroCodigoRegistroRemainder.js';\n";
const approvedCallbackAfter = "  // #353: CodigoField autorizado em RotaPadrao/TabelaPreco — remainder restaura pin e36231b3.\n  const after = parse(file, cadastroCodigoRegistroRemainder(file, fs.readFileSync(file, 'utf8')));\n";
function restoreApprovedCodigoFieldCallbackDelta(source) {
 assert.equal(source.split(approvedCallbackImport).length,2,'Only the exact CodigoField import delta may be normalized');
 assert.equal(source.split(approvedCallbackAfter).length,2,'Only the exact CodigoField after-parse delta may be normalized');
 return source.replace(approvedCallbackImport,'').replace(approvedCallbackAfter,previousCallbackAfter);
}
/** #353 ContatoB2B: saiu do pin RecordState → reopen canônico; reverse restaura names+omissão do teste de graduação. */
const previousCallbackNames = "  'SegmentoCliente', 'Servico', 'TabelaPreco', 'TipoFrete', 'CadastroFiscal', 'ContatoB2B',\n  'GrupoEmpresarial', 'Usuario', 'ConfiguracaoBoletos', 'Webhook'];\n";
const approvedCallbackNames = "  'SegmentoCliente', 'Servico', 'TabelaPreco', 'TipoFrete', 'CadastroFiscal',\n  'GrupoEmpresarial', 'Usuario', 'ConfiguracaoBoletos', 'Webhook'];\n// ContatoB2B graduou para useCadastroReopenOnIdentity — cobertos no teste seguinte (não no pin RecordState).\n";
const approvedContatoB2BGraduationTest = "\ntest('ContatoB2B graduou do pin RecordState para useCadastroReopenOnIdentity com contatoBoundId', () => {\n  const file = 'src/components/cadastros/ContatoB2BForm.jsx';\n  const source = fs.readFileSync(file, 'utf8');\n  assert.equal(names.includes('ContatoB2B'), false);\n  assert.match(source, /useCadastroReopenOnIdentity/);\n  assert.match(source, /contatoBoundId/);\n  assert.match(source, /preferencias_comunicacao/);\n  assert.doesNotMatch(source, /useCadastroRecordState/);\n  assert.doesNotMatch(source, /prevUpdatedRef/);\n});\n\n";
function restoreApprovedContatoB2BCallbackDelta(source) {
 assert.equal(source.split(approvedCallbackNames).length,2,'Only the exact ContatoB2B names graduation delta may be normalized');
 assert.equal(source.split(approvedContatoB2BGraduationTest).length,2,'Only the exact ContatoB2B graduation test delta may be normalized');
 return source.replace(approvedContatoB2BGraduationTest,'\n').replace(approvedCallbackNames,previousCallbackNames);
}
/** #353 Servico+TipoFrete: saíram do pin após ContatoB2B; reverse restaura names intermediários + testes. */
const previousServicoTipoFreteNames = approvedCallbackNames;
const approvedServicoTipoFreteNames = "  'SegmentoCliente', 'TabelaPreco', 'CadastroFiscal',\n  'GrupoEmpresarial', 'Usuario', 'ConfiguracaoBoletos', 'Webhook'];\n// ContatoB2B graduou para useCadastroReopenOnIdentity — cobertos no teste seguinte (não no pin RecordState).\n// Servico e TipoFrete graduaram para useCadastroReopenOnIdentity — cobertos nos testes seguintes.\n";
const approvedServicoTipoFreteGraduationTests = "\ntest('Servico graduou do pin RecordState para useCadastroReopenOnIdentity com servicoBoundId', () => {\n  const file = 'src/components/cadastros/ServicoForm.jsx';\n  const source = fs.readFileSync(file, 'utf8');\n  assert.equal(names.includes('Servico'), false);\n  assert.match(source, /useCadastroReopenOnIdentity/);\n  assert.match(source, /servicoBoundId/);\n  assert.doesNotMatch(source, /useCadastroRecordState/);\n  assert.doesNotMatch(source, /prevUpdatedRef/);\n});\n\ntest('TipoFrete graduou do pin RecordState para useCadastroReopenOnIdentity com tipoFreteBoundId', () => {\n  const file = 'src/components/cadastros/TipoFreteForm.jsx';\n  const source = fs.readFileSync(file, 'utf8');\n  assert.equal(names.includes('TipoFrete'), false);\n  assert.match(source, /useCadastroReopenOnIdentity/);\n  assert.match(source, /tipoFreteBoundId/);\n  assert.doesNotMatch(source, /useCadastroRecordState/);\n  assert.doesNotMatch(source, /prevUpdatedRef/);\n});\n\n";
function restoreApprovedServicoTipoFreteCallbackDelta(source) {
 assert.equal(source.split(approvedServicoTipoFreteNames).length,2,'Only the exact Servico/TipoFrete names graduation delta may be normalized');
 assert.equal(source.split(approvedServicoTipoFreteGraduationTests).length,2,'Only the exact Servico/TipoFrete graduation tests delta may be normalized');
 return source.replace(approvedServicoTipoFreteGraduationTests,'\n').replace(approvedServicoTipoFreteNames,previousServicoTipoFreteNames);
}
/** #353 SegmentoCliente: saiu do pin após Servico/TipoFrete; reverse restaura names intermediários + teste. */
const previousSegmentoClienteNames = approvedServicoTipoFreteNames;
const approvedSegmentoClienteNames = "  'TabelaPreco', 'CadastroFiscal',\n  'GrupoEmpresarial', 'Usuario', 'ConfiguracaoBoletos', 'Webhook'];\n// ContatoB2B graduou para useCadastroReopenOnIdentity — cobertos no teste seguinte (não no pin RecordState).\n// Servico e TipoFrete graduaram para useCadastroReopenOnIdentity — cobertos nos testes seguintes.\n// SegmentoCliente graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.\n";
const approvedSegmentoClienteGraduationTest = "\ntest('SegmentoCliente graduou do pin RecordState para useCadastroReopenOnIdentity com segmentoBoundId', () => {\n  const file = 'src/components/cadastros/SegmentoClienteForm.jsx';\n  const source = fs.readFileSync(file, 'utf8');\n  assert.equal(names.includes('SegmentoCliente'), false);\n  assert.match(source, /useCadastroReopenOnIdentity/);\n  assert.match(source, /segmentoBoundId/);\n  assert.doesNotMatch(source, /useCadastroRecordState/);\n  assert.doesNotMatch(source, /prevUpdatedRef/);\n});\n\n";
function restoreApprovedSegmentoClienteCallbackDelta(source) {
 assert.equal(source.split(approvedSegmentoClienteNames).length,2,'Only the exact SegmentoCliente names graduation delta may be normalized');
 assert.equal(source.split(approvedSegmentoClienteGraduationTest).length,2,'Only the exact SegmentoCliente graduation test delta may be normalized');
 return source.replace(approvedSegmentoClienteGraduationTest,'\n').replace(approvedSegmentoClienteNames,previousSegmentoClienteNames);
}
/** #353 KitProduto: saiu do pin (JobAgendado line) após SegmentoCliente; reverse restaura KitProduto + omite teste. */
const previousKitProdutoNames = "  'JobAgendado', 'KitProduto', 'ParametroCaixaDiario', 'ParametroConciliacaoBancaria',\n  'ParametroPortalCliente', 'ParametroRecebimentoNFe', 'ParametroRoteirizacao', 'RotaPadrao',\n  'TabelaPreco', 'CadastroFiscal',\n  'GrupoEmpresarial', 'Usuario', 'ConfiguracaoBoletos', 'Webhook'];\n// ContatoB2B graduou para useCadastroReopenOnIdentity — cobertos no teste seguinte (não no pin RecordState).\n// Servico e TipoFrete graduaram para useCadastroReopenOnIdentity — cobertos nos testes seguintes.\n// SegmentoCliente graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.\n";
const approvedKitProdutoNames = "  'JobAgendado', 'ParametroCaixaDiario', 'ParametroConciliacaoBancaria',\n  'ParametroPortalCliente', 'ParametroRecebimentoNFe', 'ParametroRoteirizacao', 'RotaPadrao',\n  'TabelaPreco', 'CadastroFiscal',\n  'GrupoEmpresarial', 'Usuario', 'ConfiguracaoBoletos', 'Webhook'];\n// ContatoB2B graduou para useCadastroReopenOnIdentity — cobertos no teste seguinte (não no pin RecordState).\n// Servico e TipoFrete graduaram para useCadastroReopenOnIdentity — cobertos nos testes seguintes.\n// SegmentoCliente graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.\n// KitProduto graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.\n";
const approvedKitProdutoGraduationTest = "\ntest('KitProduto graduou do pin RecordState para useCadastroReopenOnIdentity com kitBoundId', () => {\n  const file = 'src/components/cadastros/KitProdutoForm.jsx';\n  const source = fs.readFileSync(file, 'utf8');\n  assert.equal(names.includes('KitProduto'), false);\n  assert.match(source, /useCadastroReopenOnIdentity/);\n  assert.match(source, /kitBoundId/);\n  assert.match(source, /itens_kit/);\n  assert.doesNotMatch(source, /useCadastroRecordState/);\n  assert.doesNotMatch(source, /prevUpdatedRef/);\n});\n\n";
function restoreApprovedKitProdutoCallbackDelta(source) {
 assert.equal(source.split(approvedKitProdutoNames).length,2,'Only the exact KitProduto names graduation delta may be normalized');
 assert.equal(source.split(approvedKitProdutoGraduationTest).length,2,'Only the exact KitProduto graduation test delta may be normalized');
 return source.replace(approvedKitProdutoGraduationTest,'\n').replace(approvedKitProdutoNames,previousKitProdutoNames);
}
/** #353 Filial: saiu do pin (EventoNotificacao line) após KitProduto; reverse restaura Filial + omite teste. */
const previousFilialNames = "  'ConfiguracaoIntegracao', 'ConfiguracaoWhatsApp', 'EventoNotificacao', 'Filial', 'GatewayPagamento',\n  'JobAgendado', 'ParametroCaixaDiario', 'ParametroConciliacaoBancaria',\n  'ParametroPortalCliente', 'ParametroRecebimentoNFe', 'ParametroRoteirizacao', 'RotaPadrao',\n  'TabelaPreco', 'CadastroFiscal',\n  'GrupoEmpresarial', 'Usuario', 'ConfiguracaoBoletos', 'Webhook'];\n// ContatoB2B graduou para useCadastroReopenOnIdentity — cobertos no teste seguinte (não no pin RecordState).\n// Servico e TipoFrete graduaram para useCadastroReopenOnIdentity — cobertos nos testes seguintes.\n// SegmentoCliente graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.\n// KitProduto graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.\n";
const approvedFilialNames = "  'ConfiguracaoIntegracao', 'ConfiguracaoWhatsApp', 'EventoNotificacao', 'GatewayPagamento',\n  'JobAgendado', 'ParametroCaixaDiario', 'ParametroConciliacaoBancaria',\n  'ParametroPortalCliente', 'ParametroRecebimentoNFe', 'ParametroRoteirizacao', 'RotaPadrao',\n  'TabelaPreco', 'CadastroFiscal',\n  'GrupoEmpresarial', 'Usuario', 'ConfiguracaoBoletos', 'Webhook'];\n// ContatoB2B graduou para useCadastroReopenOnIdentity — cobertos no teste seguinte (não no pin RecordState).\n// Servico e TipoFrete graduaram para useCadastroReopenOnIdentity — cobertos nos testes seguintes.\n// SegmentoCliente graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.\n// KitProduto graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.\n// Filial graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.\n";
const approvedFilialGraduationTest = "\ntest('Filial graduou do pin RecordState para useCadastroReopenOnIdentity com filialBoundId', () => {\n  const file = 'src/components/cadastros/FilialForm.jsx';\n  const source = fs.readFileSync(file, 'utf8');\n  assert.equal(names.includes('Filial'), false);\n  assert.match(source, /useCadastroReopenOnIdentity/);\n  assert.match(source, /filialBoundId/);\n  assert.match(source, /matriz_id/);\n  assert.doesNotMatch(source, /useCadastroRecordState/);\n  assert.doesNotMatch(source, /prevUpdatedRef/);\n});\n\n";
function restoreApprovedFilialCallbackDelta(source) {
 assert.equal(source.split(approvedFilialNames).length,2,'Only the exact Filial names graduation delta may be normalized');
 assert.equal(source.split(approvedFilialGraduationTest).length,2,'Only the exact Filial graduation test delta may be normalized');
 return source.replace(approvedFilialGraduationTest,'\n').replace(approvedFilialNames,previousFilialNames);
}
/** #353 CentroResultado: saiu do pin (ApiExterna line) após Filial; reverse restaura CentroResultado + omite teste. */
const previousCentroResultadoNames = "const names = ['ApiExterna', 'CatalogoWeb', 'CentroResultado', 'ChatbotCanal', 'ChatbotIntent',\n  'ConfiguracaoIntegracao', 'ConfiguracaoWhatsApp', 'EventoNotificacao', 'GatewayPagamento',\n  'JobAgendado', 'ParametroCaixaDiario', 'ParametroConciliacaoBancaria',\n  'ParametroPortalCliente', 'ParametroRecebimentoNFe', 'ParametroRoteirizacao', 'RotaPadrao',\n  'TabelaPreco', 'CadastroFiscal',\n  'GrupoEmpresarial', 'Usuario', 'ConfiguracaoBoletos', 'Webhook'];\n// ContatoB2B graduou para useCadastroReopenOnIdentity — cobertos no teste seguinte (não no pin RecordState).\n// Servico e TipoFrete graduaram para useCadastroReopenOnIdentity — cobertos nos testes seguintes.\n// SegmentoCliente graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.\n// KitProduto graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.\n// Filial graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.\n";
const approvedCentroResultadoNames = "const names = ['ApiExterna', 'CatalogoWeb', 'ChatbotCanal', 'ChatbotIntent',\n  'ConfiguracaoIntegracao', 'ConfiguracaoWhatsApp', 'EventoNotificacao', 'GatewayPagamento',\n  'JobAgendado', 'ParametroCaixaDiario', 'ParametroConciliacaoBancaria',\n  'ParametroPortalCliente', 'ParametroRecebimentoNFe', 'ParametroRoteirizacao', 'RotaPadrao',\n  'TabelaPreco', 'CadastroFiscal',\n  'GrupoEmpresarial', 'Usuario', 'ConfiguracaoBoletos', 'Webhook'];\n// ContatoB2B graduou para useCadastroReopenOnIdentity — cobertos no teste seguinte (não no pin RecordState).\n// Servico e TipoFrete graduaram para useCadastroReopenOnIdentity — cobertos nos testes seguintes.\n// SegmentoCliente graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.\n// KitProduto graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.\n// Filial graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.\n// CentroResultado graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.\n";
const approvedCentroResultadoGraduationTest = "\ntest('CentroResultado graduou do pin RecordState para useCadastroReopenOnIdentity com centroBoundId', () => {\n  const file = 'src/components/cadastros/CentroResultadoForm.jsx';\n  const source = fs.readFileSync(file, 'utf8');\n  assert.equal(names.includes('CentroResultado'), false);\n  assert.match(source, /useCadastroReopenOnIdentity/);\n  assert.match(source, /centroBoundId/);\n  assert.match(source, /CadastroCodigoRegistroField/);\n  assert.doesNotMatch(source, /useCadastroRecordState/);\n  assert.doesNotMatch(source, /prevUpdatedRef/);\n});\n\n";
function restoreApprovedCentroResultadoCallbackDelta(source) {
 assert.equal(source.split(approvedCentroResultadoNames).length,2,'Only the exact CentroResultado names graduation delta may be normalized');
 assert.equal(source.split(approvedCentroResultadoGraduationTest).length,2,'Only the exact CentroResultado graduation test delta may be normalized');
 return source.replace(approvedCentroResultadoGraduationTest,'\n').replace(approvedCentroResultadoNames,previousCentroResultadoNames);
}
/** #353 JobAgendado: saiu do pin após CentroResultado; reverse restaura JobAgendado + omite teste. */
const previousJobAgendadoNames = "  'ConfiguracaoIntegracao', 'ConfiguracaoWhatsApp', 'EventoNotificacao', 'GatewayPagamento',\n  'JobAgendado', 'ParametroCaixaDiario', 'ParametroConciliacaoBancaria',\n  'ParametroPortalCliente', 'ParametroRecebimentoNFe', 'ParametroRoteirizacao', 'RotaPadrao',\n  'TabelaPreco', 'CadastroFiscal',\n  'GrupoEmpresarial', 'Usuario', 'ConfiguracaoBoletos', 'Webhook'];\n// ContatoB2B graduou para useCadastroReopenOnIdentity — cobertos no teste seguinte (não no pin RecordState).\n// Servico e TipoFrete graduaram para useCadastroReopenOnIdentity — cobertos nos testes seguintes.\n// SegmentoCliente graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.\n// KitProduto graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.\n// Filial graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.\n// CentroResultado graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.\n";
const approvedJobAgendadoNames = "  'ConfiguracaoIntegracao', 'ConfiguracaoWhatsApp', 'EventoNotificacao', 'GatewayPagamento',\n  'ParametroCaixaDiario', 'ParametroConciliacaoBancaria',\n  'ParametroPortalCliente', 'ParametroRecebimentoNFe', 'ParametroRoteirizacao', 'RotaPadrao',\n  'TabelaPreco', 'CadastroFiscal',\n  'GrupoEmpresarial', 'Usuario', 'ConfiguracaoBoletos', 'Webhook'];\n// ContatoB2B graduou para useCadastroReopenOnIdentity — cobertos no teste seguinte (não no pin RecordState).\n// Servico e TipoFrete graduaram para useCadastroReopenOnIdentity — cobertos nos testes seguintes.\n// SegmentoCliente graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.\n// KitProduto graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.\n// Filial graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.\n// CentroResultado graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.\n// JobAgendado graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.\n";
const approvedJobAgendadoGraduationTest = "\ntest('JobAgendado graduou do pin RecordState para useCadastroReopenOnIdentity com jobBoundId', () => {\n  const file = 'src/components/cadastros/JobAgendadoForm.jsx';\n  const source = fs.readFileSync(file, 'utf8');\n  assert.equal(names.includes('JobAgendado'), false);\n  assert.match(source, /useCadastroReopenOnIdentity/);\n  assert.match(source, /jobBoundId/);\n  assert.match(source, /parametros_execucao/);\n  assert.doesNotMatch(source, /useCadastroRecordState/);\n  assert.doesNotMatch(source, /prevUpdatedRef/);\n});\n\n";
function restoreApprovedJobAgendadoCallbackDelta(source) {
 assert.equal(source.split(approvedJobAgendadoNames).length,2,'Only the exact JobAgendado names graduation delta may be normalized');
 assert.equal(source.split(approvedJobAgendadoGraduationTest).length,2,'Only the exact JobAgendado graduation test delta may be normalized');
 return source.replace(approvedJobAgendadoGraduationTest,'\n').replace(approvedJobAgendadoNames,previousJobAgendadoNames);
}
/** #353 RotaPadrao: saiu do pin após JobAgendado; reverse restaura RotaPadrao + omite teste. */
const previousRotaPadraoNames = "  'ParametroPortalCliente', 'ParametroRecebimentoNFe', 'ParametroRoteirizacao', 'RotaPadrao',\n  'TabelaPreco', 'CadastroFiscal',\n  'GrupoEmpresarial', 'Usuario', 'ConfiguracaoBoletos', 'Webhook'];\n// ContatoB2B graduou para useCadastroReopenOnIdentity — cobertos no teste seguinte (não no pin RecordState).\n// Servico e TipoFrete graduaram para useCadastroReopenOnIdentity — cobertos nos testes seguintes.\n// SegmentoCliente graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.\n// KitProduto graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.\n// Filial graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.\n// CentroResultado graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.\n// JobAgendado graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.\n";
const approvedRotaPadraoNames = "  'ParametroPortalCliente', 'ParametroRecebimentoNFe', 'ParametroRoteirizacao',\n  'TabelaPreco', 'CadastroFiscal',\n  'GrupoEmpresarial', 'Usuario', 'ConfiguracaoBoletos', 'Webhook'];\n// ContatoB2B graduou para useCadastroReopenOnIdentity — cobertos no teste seguinte (não no pin RecordState).\n// Servico e TipoFrete graduaram para useCadastroReopenOnIdentity — cobertos nos testes seguintes.\n// SegmentoCliente graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.\n// KitProduto graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.\n// Filial graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.\n// CentroResultado graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.\n// JobAgendado graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.\n// RotaPadrao graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.\n";
const approvedRotaPadraoGraduationTest = "\ntest('RotaPadrao graduou do pin RecordState para useCadastroReopenOnIdentity com rotaBoundId', () => {\n  const file = 'src/components/cadastros/RotaPadraoForm.jsx';\n  const source = fs.readFileSync(file, 'utf8');\n  assert.equal(names.includes('RotaPadrao'), false);\n  assert.match(source, /useCadastroReopenOnIdentity/);\n  assert.match(source, /rotaBoundId/);\n  assert.match(source, /CadastroCodigoRegistroField/);\n  assert.doesNotMatch(source, /useCadastroRecordState/);\n  assert.doesNotMatch(source, /prevUpdatedRef/);\n});\n\n";
function restoreApprovedRotaPadraoCallbackDelta(source) {
 assert.equal(source.split(approvedRotaPadraoNames).length,2,'Only the exact RotaPadrao names graduation delta may be normalized');
 assert.equal(source.split(approvedRotaPadraoGraduationTest).length,2,'Only the exact RotaPadrao graduation test delta may be normalized');
 return source.replace(approvedRotaPadraoGraduationTest,'\n').replace(approvedRotaPadraoNames,previousRotaPadraoNames);
}
/** #353 CatalogoWeb: saiu do pin (ApiExterna line) após RotaPadrao; reverse restaura CatalogoWeb + omite teste. */
const previousCatalogoWebNames = "const names = ['ApiExterna', 'CatalogoWeb', 'ChatbotCanal', 'ChatbotIntent',\n  'ConfiguracaoIntegracao', 'ConfiguracaoWhatsApp', 'EventoNotificacao', 'GatewayPagamento',\n  'ParametroCaixaDiario', 'ParametroConciliacaoBancaria',\n  'ParametroPortalCliente', 'ParametroRecebimentoNFe', 'ParametroRoteirizacao',\n  'TabelaPreco', 'CadastroFiscal',\n  'GrupoEmpresarial', 'Usuario', 'ConfiguracaoBoletos', 'Webhook'];\n// ContatoB2B graduou para useCadastroReopenOnIdentity — cobertos no teste seguinte (não no pin RecordState).\n// Servico e TipoFrete graduaram para useCadastroReopenOnIdentity — cobertos nos testes seguintes.\n// SegmentoCliente graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.\n// KitProduto graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.\n// Filial graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.\n// CentroResultado graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.\n// JobAgendado graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.\n// RotaPadrao graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.\n";
const approvedCatalogoWebNames = "const names = ['ApiExterna', 'ChatbotCanal', 'ChatbotIntent',\n  'ConfiguracaoIntegracao', 'ConfiguracaoWhatsApp', 'EventoNotificacao', 'GatewayPagamento',\n  'ParametroCaixaDiario', 'ParametroConciliacaoBancaria',\n  'ParametroPortalCliente', 'ParametroRecebimentoNFe', 'ParametroRoteirizacao',\n  'TabelaPreco', 'CadastroFiscal',\n  'GrupoEmpresarial', 'Usuario', 'ConfiguracaoBoletos', 'Webhook'];\n// ContatoB2B graduou para useCadastroReopenOnIdentity — cobertos no teste seguinte (não no pin RecordState).\n// Servico e TipoFrete graduaram para useCadastroReopenOnIdentity — cobertos nos testes seguintes.\n// SegmentoCliente graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.\n// KitProduto graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.\n// Filial graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.\n// CentroResultado graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.\n// JobAgendado graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.\n// RotaPadrao graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.\n// CatalogoWeb graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.\n";
const approvedCatalogoWebGraduationTest = "\ntest('CatalogoWeb graduou do pin RecordState para useCadastroReopenOnIdentity com catalogoBoundId', () => {\n  const file = 'src/components/cadastros/CatalogoWebForm.jsx';\n  const source = fs.readFileSync(file, 'utf8');\n  assert.equal(names.includes('CatalogoWeb'), false);\n  assert.match(source, /useCadastroReopenOnIdentity/);\n  assert.match(source, /catalogoBoundId/);\n  assert.match(source, /syncFlagsCatalogoProduto/);\n  assert.doesNotMatch(source, /useCadastroRecordState/);\n  assert.doesNotMatch(source, /prevUpdatedRef/);\n});\n\n";
function restoreApprovedCatalogoWebCallbackDelta(source) {
 assert.equal(source.split(approvedCatalogoWebNames).length,2,'Only the exact CatalogoWeb names graduation delta may be normalized');
 assert.equal(source.split(approvedCatalogoWebGraduationTest).length,2,'Only the exact CatalogoWeb graduation test delta may be normalized');
 return source.replace(approvedCatalogoWebGraduationTest,'\n').replace(approvedCatalogoWebNames,previousCatalogoWebNames);
}
/** #353 ApiExterna: saiu do pin após CatalogoWeb; reverse restaura ApiExterna + omite teste. */
const previousApiExternaNames = "const names = ['ApiExterna', 'ChatbotCanal', 'ChatbotIntent',\n  'ConfiguracaoIntegracao', 'ConfiguracaoWhatsApp', 'EventoNotificacao', 'GatewayPagamento',\n  'ParametroCaixaDiario', 'ParametroConciliacaoBancaria',\n  'ParametroPortalCliente', 'ParametroRecebimentoNFe', 'ParametroRoteirizacao',\n  'TabelaPreco', 'CadastroFiscal',\n  'GrupoEmpresarial', 'Usuario', 'ConfiguracaoBoletos', 'Webhook'];\n// ContatoB2B graduou para useCadastroReopenOnIdentity — cobertos no teste seguinte (não no pin RecordState).\n// Servico e TipoFrete graduaram para useCadastroReopenOnIdentity — cobertos nos testes seguintes.\n// SegmentoCliente graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.\n// KitProduto graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.\n// Filial graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.\n// CentroResultado graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.\n// JobAgendado graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.\n// RotaPadrao graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.\n// CatalogoWeb graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.\n";
const approvedApiExternaNames = "const names = ['ChatbotCanal', 'ChatbotIntent',\n  'ConfiguracaoIntegracao', 'ConfiguracaoWhatsApp', 'EventoNotificacao', 'GatewayPagamento',\n  'ParametroCaixaDiario', 'ParametroConciliacaoBancaria',\n  'ParametroPortalCliente', 'ParametroRecebimentoNFe', 'ParametroRoteirizacao',\n  'TabelaPreco', 'CadastroFiscal',\n  'GrupoEmpresarial', 'Usuario', 'ConfiguracaoBoletos', 'Webhook'];\n// ContatoB2B graduou para useCadastroReopenOnIdentity — cobertos no teste seguinte (não no pin RecordState).\n// Servico e TipoFrete graduaram para useCadastroReopenOnIdentity — cobertos nos testes seguintes.\n// SegmentoCliente graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.\n// KitProduto graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.\n// Filial graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.\n// CentroResultado graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.\n// JobAgendado graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.\n// RotaPadrao graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.\n// CatalogoWeb graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.\n// ApiExterna graduou para useCadastroReopenOnIdentity — coberto no teste seguinte.\n";
const approvedApiExternaGraduationTest = "\ntest('ApiExterna graduou do pin RecordState para useCadastroReopenOnIdentity com apiExternaBoundId', () => {\n  const file = 'src/components/cadastros/ApiExternaForm.jsx';\n  const source = fs.readFileSync(file, 'utf8');\n  assert.equal(names.includes('ApiExterna'), false);\n  assert.match(source, /useCadastroReopenOnIdentity/);\n  assert.match(source, /apiExternaBoundId/);\n  assert.match(source, /headers_autenticacao/);\n  assert.doesNotMatch(source, /useCadastroRecordState/);\n  assert.doesNotMatch(source, /prevUpdatedRef/);\n});\n\n";
function restoreApprovedApiExternaCallbackDelta(source) {
 assert.equal(source.split(approvedApiExternaNames).length,2,'Only the exact ApiExterna names graduation delta may be normalized');
 assert.equal(source.split(approvedApiExternaGraduationTest).length,2,'Only the exact ApiExterna graduation test delta may be normalized');
 return source.replace(approvedApiExternaGraduationTest,'\n').replace(approvedApiExternaNames,previousApiExternaNames);
}
test('bulk lifecycle evolution retains the original hash and rejects changed or repeated delegation assertions',()=>{
 const source=fs.readFileSync('server/tests/bulk-consolidacao.test.ts','utf8').replace(/\r\n/g,'\n');
 const restored=restoreApprovedBulkDelta(source);
 assert.equal(restored.includes(approvedBulkDelta),false);
 assert.throws(()=>restoreApprovedBulkDelta(source.replace('rbac: this.rbacGuard','rbac: this.otherGuard')));
 assert.throws(()=>restoreApprovedBulkDelta(source+approvedBulkDelta));
 assert.notEqual(crypto.createHash('sha256').update(restoreApprovedBulkDelta(source.replace('for (const [name, text] of oldMembers)','for (const [name, text] of newMembers)'))).digest('hex'),
   crypto.createHash('sha256').update(restored).digest('hex'));
});
test('ContatoB2B callback graduation retains beforeSha and rejects omission, repetition or out-of-scope edit',()=>{
 const source=fs.readFileSync('tests/cursor-callback-record-state.test.js','utf8').replace(/\r\n/g,'\n');
 const afterApi=restoreApprovedApiExternaCallbackDelta(source);
 const afterCat=restoreApprovedCatalogoWebCallbackDelta(afterApi);
 const afterRota=restoreApprovedRotaPadraoCallbackDelta(afterCat);
 const afterJob=restoreApprovedJobAgendadoCallbackDelta(afterRota);
 const afterCr=restoreApprovedCentroResultadoCallbackDelta(afterJob);
 const afterFil=restoreApprovedFilialCallbackDelta(afterCr);
 const afterKit=restoreApprovedKitProdutoCallbackDelta(afterFil);
 const afterSeg=restoreApprovedSegmentoClienteCallbackDelta(afterKit);
 const mid=restoreApprovedServicoTipoFreteCallbackDelta(afterSeg);
 const restored=restoreApprovedContatoB2BCallbackDelta(mid);
 assert.equal(restored.includes(approvedContatoB2BGraduationTest),false);
 assert.match(restored,/CadastroFiscal', 'ContatoB2B'/);
 assert.match(restored,/JobAgendado', 'KitProduto'/);
 assert.match(restored,/EventoNotificacao', 'Filial'/);
 assert.match(restored,/CatalogoWeb', 'CentroResultado'/);
 assert.match(restored,/GatewayPagamento',\n  'JobAgendado'/);
 assert.match(restored,/ParametroRoteirizacao', 'RotaPadrao'/);
 assert.match(restored,/ApiExterna', 'CatalogoWeb'/);
 assert.throws(()=>restoreApprovedApiExternaCallbackDelta(source.replace(approvedApiExternaGraduationTest,'\n')));
 assert.throws(()=>restoreApprovedApiExternaCallbackDelta(source+approvedApiExternaGraduationTest));
 assert.throws(()=>restoreApprovedCatalogoWebCallbackDelta(afterApi.replace(approvedCatalogoWebGraduationTest,'\n')));
 assert.throws(()=>restoreApprovedCatalogoWebCallbackDelta(afterApi+approvedCatalogoWebGraduationTest));
 assert.throws(()=>restoreApprovedRotaPadraoCallbackDelta(afterCat.replace(approvedRotaPadraoGraduationTest,'\n')));
 assert.throws(()=>restoreApprovedRotaPadraoCallbackDelta(afterCat+approvedRotaPadraoGraduationTest));
 assert.throws(()=>restoreApprovedJobAgendadoCallbackDelta(afterRota.replace(approvedJobAgendadoGraduationTest,'\n')));
 assert.throws(()=>restoreApprovedJobAgendadoCallbackDelta(afterRota+approvedJobAgendadoGraduationTest));
 assert.throws(()=>restoreApprovedCentroResultadoCallbackDelta(afterJob.replace(approvedCentroResultadoGraduationTest,'\n')));
 assert.throws(()=>restoreApprovedCentroResultadoCallbackDelta(afterJob+approvedCentroResultadoGraduationTest));
 assert.throws(()=>restoreApprovedFilialCallbackDelta(afterCr.replace(approvedFilialGraduationTest,'\n')));
 assert.throws(()=>restoreApprovedFilialCallbackDelta(afterCr+approvedFilialGraduationTest));
 assert.throws(()=>restoreApprovedKitProdutoCallbackDelta(afterFil.replace(approvedKitProdutoGraduationTest,'\n')));
 assert.throws(()=>restoreApprovedKitProdutoCallbackDelta(afterFil+approvedKitProdutoGraduationTest));
 assert.throws(()=>restoreApprovedSegmentoClienteCallbackDelta(afterKit.replace(approvedSegmentoClienteGraduationTest,'\n')));
 assert.throws(()=>restoreApprovedSegmentoClienteCallbackDelta(afterKit+approvedSegmentoClienteGraduationTest));
 assert.throws(()=>restoreApprovedServicoTipoFreteCallbackDelta(afterSeg.replace(approvedServicoTipoFreteGraduationTests,'\n')));
 assert.throws(()=>restoreApprovedServicoTipoFreteCallbackDelta(afterSeg+approvedServicoTipoFreteGraduationTests));
 assert.throws(()=>restoreApprovedContatoB2BCallbackDelta(mid.replace(approvedContatoB2BGraduationTest,'\n')));
 assert.throws(()=>restoreApprovedContatoB2BCallbackDelta(mid+approvedContatoB2BGraduationTest));
 assert.throws(()=>restoreApprovedContatoB2BCallbackDelta(mid.replace("CadastroFiscal',\n","CadastroFiscal', 'Webhook',\n")));
});
test('Servico/TipoFrete callback graduation rejects omission, repetition or out-of-scope edit',()=>{
 const source=fs.readFileSync('tests/cursor-callback-record-state.test.js','utf8').replace(/\r\n/g,'\n');
 const afterApi=restoreApprovedApiExternaCallbackDelta(source);
 const afterCat=restoreApprovedCatalogoWebCallbackDelta(afterApi);
 const afterRota=restoreApprovedRotaPadraoCallbackDelta(afterCat);
 const afterJob=restoreApprovedJobAgendadoCallbackDelta(afterRota);
 const afterCr=restoreApprovedCentroResultadoCallbackDelta(afterJob);
 const afterFil=restoreApprovedFilialCallbackDelta(afterCr);
 const afterKit=restoreApprovedKitProdutoCallbackDelta(afterFil);
 const afterSeg=restoreApprovedSegmentoClienteCallbackDelta(afterKit);
 const restored=restoreApprovedServicoTipoFreteCallbackDelta(afterSeg);
 assert.equal(restored.includes(approvedServicoTipoFreteGraduationTests),false);
 assert.match(restored,/SegmentoCliente', 'Servico', 'TabelaPreco', 'TipoFrete'/);
 assert.throws(()=>restoreApprovedServicoTipoFreteCallbackDelta(afterSeg.replace("TabelaPreco',","TabelaPreco', 'Webhook',")));
});
test('SegmentoCliente callback graduation rejects omission, repetition or out-of-scope edit',()=>{
 const source=fs.readFileSync('tests/cursor-callback-record-state.test.js','utf8').replace(/\r\n/g,'\n');
 const afterApi=restoreApprovedApiExternaCallbackDelta(source);
 const afterCat=restoreApprovedCatalogoWebCallbackDelta(afterApi);
 const afterRota=restoreApprovedRotaPadraoCallbackDelta(afterCat);
 const afterJob=restoreApprovedJobAgendadoCallbackDelta(afterRota);
 const afterCr=restoreApprovedCentroResultadoCallbackDelta(afterJob);
 const afterFil=restoreApprovedFilialCallbackDelta(afterCr);
 const afterKit=restoreApprovedKitProdutoCallbackDelta(afterFil);
 const restored=restoreApprovedSegmentoClienteCallbackDelta(afterKit);
 assert.equal(restored.includes(approvedSegmentoClienteGraduationTest),false);
 assert.match(restored,/SegmentoCliente', 'TabelaPreco'/);
 assert.throws(()=>restoreApprovedSegmentoClienteCallbackDelta(afterKit.replace("TabelaPreco',","TabelaPreco', 'Webhook',")));
});
test('KitProduto callback graduation rejects omission, repetition or out-of-scope edit',()=>{
 const source=fs.readFileSync('tests/cursor-callback-record-state.test.js','utf8').replace(/\r\n/g,'\n');
 const afterApi=restoreApprovedApiExternaCallbackDelta(source);
 const afterCat=restoreApprovedCatalogoWebCallbackDelta(afterApi);
 const afterRota=restoreApprovedRotaPadraoCallbackDelta(afterCat);
 const afterJob=restoreApprovedJobAgendadoCallbackDelta(afterRota);
 const afterCr=restoreApprovedCentroResultadoCallbackDelta(afterJob);
 const afterFil=restoreApprovedFilialCallbackDelta(afterCr);
 const restored=restoreApprovedKitProdutoCallbackDelta(afterFil);
 assert.equal(restored.includes(approvedKitProdutoGraduationTest),false);
 assert.match(restored,/JobAgendado', 'KitProduto'/);
 assert.throws(()=>restoreApprovedKitProdutoCallbackDelta(afterFil.replace("JobAgendado',","JobAgendado', 'Webhook',")));
});
test('Filial callback graduation rejects omission, repetition or out-of-scope edit',()=>{
 const source=fs.readFileSync('tests/cursor-callback-record-state.test.js','utf8').replace(/\r\n/g,'\n');
 const afterApi=restoreApprovedApiExternaCallbackDelta(source);
 const afterCat=restoreApprovedCatalogoWebCallbackDelta(afterApi);
 const afterRota=restoreApprovedRotaPadraoCallbackDelta(afterCat);
 const afterJob=restoreApprovedJobAgendadoCallbackDelta(afterRota);
 const afterCr=restoreApprovedCentroResultadoCallbackDelta(afterJob);
 const restored=restoreApprovedFilialCallbackDelta(afterCr);
 assert.equal(restored.includes(approvedFilialGraduationTest),false);
 assert.match(restored,/EventoNotificacao', 'Filial'/);
 assert.throws(()=>restoreApprovedFilialCallbackDelta(afterCr.replace("EventoNotificacao',","EventoNotificacao', 'Webhook',")));
});
test('CentroResultado callback graduation rejects omission, repetition or out-of-scope edit',()=>{
 const source=fs.readFileSync('tests/cursor-callback-record-state.test.js','utf8').replace(/\r\n/g,'\n');
 const afterApi=restoreApprovedApiExternaCallbackDelta(source);
 const afterCat=restoreApprovedCatalogoWebCallbackDelta(afterApi);
 const afterRota=restoreApprovedRotaPadraoCallbackDelta(afterCat);
 const afterJob=restoreApprovedJobAgendadoCallbackDelta(afterRota);
 const restored=restoreApprovedCentroResultadoCallbackDelta(afterJob);
 assert.equal(restored.includes(approvedCentroResultadoGraduationTest),false);
 assert.match(restored,/CatalogoWeb', 'CentroResultado'/);
 assert.throws(()=>restoreApprovedCentroResultadoCallbackDelta(afterJob.replace("CatalogoWeb',","CatalogoWeb', 'Webhook',")));
});
test('JobAgendado callback graduation rejects omission, repetition or out-of-scope edit',()=>{
 const source=fs.readFileSync('tests/cursor-callback-record-state.test.js','utf8').replace(/\r\n/g,'\n');
 const afterApi=restoreApprovedApiExternaCallbackDelta(source);
 const afterCat=restoreApprovedCatalogoWebCallbackDelta(afterApi);
 const afterRota=restoreApprovedRotaPadraoCallbackDelta(afterCat);
 const restored=restoreApprovedJobAgendadoCallbackDelta(afterRota);
 assert.equal(restored.includes(approvedJobAgendadoGraduationTest),false);
 assert.match(restored,/GatewayPagamento',\n  'JobAgendado'/);
 assert.throws(()=>restoreApprovedJobAgendadoCallbackDelta(afterRota.replace("GatewayPagamento',","GatewayPagamento', 'Webhook',")));
});
test('RotaPadrao callback graduation rejects omission, repetition or out-of-scope edit',()=>{
 const source=fs.readFileSync('tests/cursor-callback-record-state.test.js','utf8').replace(/\r\n/g,'\n');
 const afterApi=restoreApprovedApiExternaCallbackDelta(source);
 const afterCat=restoreApprovedCatalogoWebCallbackDelta(afterApi);
 const restored=restoreApprovedRotaPadraoCallbackDelta(afterCat);
 assert.equal(restored.includes(approvedRotaPadraoGraduationTest),false);
 assert.match(restored,/ParametroRoteirizacao', 'RotaPadrao'/);
 assert.throws(()=>restoreApprovedRotaPadraoCallbackDelta(afterCat.replace("ParametroRoteirizacao',","ParametroRoteirizacao', 'Webhook',")));
});
test('CatalogoWeb callback graduation rejects omission, repetition or out-of-scope edit',()=>{
 const source=fs.readFileSync('tests/cursor-callback-record-state.test.js','utf8').replace(/\r\n/g,'\n');
 const afterApi=restoreApprovedApiExternaCallbackDelta(source);
 const restored=restoreApprovedCatalogoWebCallbackDelta(afterApi);
 assert.equal(restored.includes(approvedCatalogoWebGraduationTest),false);
 assert.match(restored,/ApiExterna', 'CatalogoWeb'/);
 assert.throws(()=>restoreApprovedCatalogoWebCallbackDelta(afterApi.replace("ApiExterna',","ApiExterna', 'Webhook',")));
});
test('ApiExterna callback graduation rejects omission, repetition or out-of-scope edit',()=>{
 const source=fs.readFileSync('tests/cursor-callback-record-state.test.js','utf8').replace(/\r\n/g,'\n');
 const restored=restoreApprovedApiExternaCallbackDelta(source);
 assert.equal(restored.includes(approvedApiExternaGraduationTest),false);
 assert.match(restored,/ApiExterna', 'ChatbotCanal'/);
 assert.throws(()=>restoreApprovedApiExternaCallbackDelta(source.replace(approvedApiExternaGraduationTest,'\n')));
 assert.throws(()=>restoreApprovedApiExternaCallbackDelta(source+approvedApiExternaGraduationTest));
 assert.throws(()=>restoreApprovedApiExternaCallbackDelta(source.replace("ChatbotCanal',","ChatbotCanal', 'Webhook',")));
});
/** #353 LocalEstoque: saiu do pin residual RecordState → reopen canônico. */
const previousResidualNames = "const names = ['CentroOperacao', 'LocalEstoque', 'TabelaFiscal', 'ParametroOrigemPedido', 'ConfiguracaoNFe'];\n";
const approvedResidualNames = "const names = ['CentroOperacao', 'TabelaFiscal', 'ParametroOrigemPedido', 'ConfiguracaoNFe'];\n// LocalEstoque graduou para useCadastroReopenOnIdentity — cobertos no teste seguinte (não no pin RecordState).\n";
const approvedLocalEstoqueGraduationTest = "\ntest('LocalEstoque graduou do pin RecordState para useCadastroReopenOnIdentity com localBoundId', () => {\n  const file = 'src/components/cadastros/LocalEstoqueForm.jsx';\n  const source = fs.readFileSync(file, 'utf8');\n  assert.equal(names.includes('LocalEstoque'), false);\n  assert.match(source, /useCadastroReopenOnIdentity/);\n  assert.match(source, /localBoundId/);\n  assert.match(source, /estrutura_fisica/);\n  assert.doesNotMatch(source, /useCadastroRecordState/);\n  assert.doesNotMatch(source, /prevUpdatedRef/);\n});\n\n";
function restoreApprovedLocalEstoqueResidualDelta(source) {
 assert.equal(source.split(approvedResidualNames).length,2,'Only the exact LocalEstoque residual names graduation delta may be normalized');
 assert.equal(source.split(approvedLocalEstoqueGraduationTest).length,2,'Only the exact LocalEstoque graduation test delta may be normalized');
 return source.replace(approvedLocalEstoqueGraduationTest,'\n').replace(approvedResidualNames,previousResidualNames);
}
test('LocalEstoque residual graduation retains beforeSha and rejects omission, repetition or out-of-scope edit',()=>{
 const source=fs.readFileSync('tests/cursor-residual-independent.test.js','utf8').replace(/\r\n/g,'\n');
 const restored=restoreApprovedLocalEstoqueResidualDelta(source);
 assert.equal(restored.includes(approvedLocalEstoqueGraduationTest),false);
 assert.match(restored,/CentroOperacao', 'LocalEstoque'/);
 assert.throws(()=>restoreApprovedLocalEstoqueResidualDelta(source.replace(approvedLocalEstoqueGraduationTest,'\n')));
 assert.throws(()=>restoreApprovedLocalEstoqueResidualDelta(source+approvedLocalEstoqueGraduationTest));
 assert.throws(()=>restoreApprovedLocalEstoqueResidualDelta(source.replace("CentroOperacao',","CentroOperacao', 'Webhook',")));
});
for(const entry of manifest.cases)test(entry.path+': publication fixes only Git reference, preserving every prior assertion',()=>{
 const source=fs.readFileSync(entry.path,'utf8').replace(/\r\n/g,'\n');
 assert.equal(source.includes('HEAD:'),false);
 assert.equal(source.includes("'HEAD'"),false);
 assert.equal((source.match(new RegExp(base,'g'))||[]).length,entry.references);
 // The prior proof remains byte-identical after subtracting only the explicitly tested lifecycle addition.
 const reviewed=clienteConferenciaRemainder(entry.path,source);
 const prior=entry.path===REOPEN_CONSOLIDACAO_PATH
  ? restoreAuthorizedReopenConsolidacao(reviewed)
  : entry.path==='server/tests/bulk-consolidacao.test.ts'
    ? restoreApprovedBulkDelta(reviewed)
    : entry.path==='tests/cursor-callback-record-state.test.js'
      ? restoreApprovedCodigoFieldCallbackDelta(
          restoreApprovedContatoB2BCallbackDelta(
            restoreApprovedServicoTipoFreteCallbackDelta(
              restoreApprovedSegmentoClienteCallbackDelta(
                restoreApprovedKitProdutoCallbackDelta(
                  restoreApprovedFilialCallbackDelta(
                    restoreApprovedCentroResultadoCallbackDelta(
                      restoreApprovedJobAgendadoCallbackDelta(
                        restoreApprovedRotaPadraoCallbackDelta(
                          restoreApprovedCatalogoWebCallbackDelta(
                            restoreApprovedApiExternaCallbackDelta(reviewed)))))))))))
      : entry.path==='tests/cursor-residual-independent.test.js'
        ? restoreApprovedLocalEstoqueResidualDelta(reviewed)
        : reviewed;
 const restored=prior.replaceAll(base+':','HEAD:').replaceAll(JSON.stringify(base),"'HEAD'");
 assert.equal(crypto.createHash('sha256').update(restored).digest('hex'),entry.beforeSha256);
});
test('CI retains historical source for proofs and checks frontend types before build',()=>{
 const source=fs.readFileSync('.github/workflows/erp-runtime-ci.yml','utf8');
 const frontend=source.slice(source.indexOf('  frontend:'),source.indexOf('  backend:'));
 assert.match(frontend,/fetch-depth: 0/);
 assert.ok(frontend.indexOf('npm run typecheck')>frontend.indexOf('npm ci'));
 assert.ok(frontend.indexOf('npm run typecheck')<frontend.indexOf('npm run build'));
});
test('future private exports and certificate/key files are ignored without reading any private file',()=>{
 for(const file of ['local-imports/synthetic-future.json','backups/synthetic-future.dump','synthetic-future.pfx','synthetic-future.p12','synthetic-future.pem','synthetic-future.key','.env.synthetic-future']){
  execFileSync('git',['check-ignore','--no-index','-q','--',file]);
 }
});

test('CANAL publication tip does not rewrite manifest; P1 reopen delta is the exact authorized entry only',()=>{
  // Tip Codex 118e8438: normalização do canal NÃO altera o manifesto vs pai 79d002a3.
  const tipPub=execFileSync('git',['show','118e8438f6ba5c5ae97a31482e6a083fb98fb81d:tests/helpers/publicationBaselineManifest.json'],{encoding:'utf8'});
  const parentPub=execFileSync('git',['show','79d002a3a6b0d0e5a2e6ea4f2372930737ca4656:tests/helpers/publicationBaselineManifest.json'],{encoding:'utf8'});
  assert.equal(tipPub,parentPub);
  const historical=JSON.parse(execFileSync('git',['show','90f0a315eb3d2b59e0c2bfcab7077abc27bc3613:tests/helpers/publicationBaselineManifest.json'],{encoding:'utf8'}));
  const current=JSON.parse(fs.readFileSync('tests/helpers/publicationBaselineManifest.json','utf8'));
  assert.equal(current.cases.length,18);
  assert.equal(historical.cases.length,18);
  assert.equal(current.base,historical.base);
  for(const entry of historical.cases){
    const now=current.cases.find((c)=>c.path===entry.path);
    assert.ok(now,entry.path);
    if(entry.path===REOPEN_CONSOLIDACAO_PATH){
      // Delta autorizado fixo: beforeSha histórico + references=2. Sem notEqual+continue.
      assert.deepEqual(now, REOPEN_AUTHORIZED_MANIFEST_ENTRY);
      assert.notDeepEqual(now, entry);
      continue;
    }
    assert.deepEqual(now,entry);
  }
  // Contraprova: adulterar outro case deve divergir do histórico.
  const forged={...current,cases:current.cases.map((c)=>c.path===REOPEN_CONSOLIDACAO_PATH?c:{...c,references:(c.references||0)+99})};
  assert.notEqual(JSON.stringify(forged.cases.find((c)=>c.path!==REOPEN_CONSOLIDACAO_PATH)),JSON.stringify(historical.cases.find((c)=>c.path!==REOPEN_CONSOLIDACAO_PATH)));
});

test('P1 reopen guards reject assertion removal after beforeSha recalculation (Codex contraprova)',()=>{
  const authorized=normalizePublicationSource(fs.readFileSync(REOPEN_CONSOLIDACAO_PATH,'utf8'));
  assert.equal(publicationRestoredHash(authorized), REOPEN_AUTHORIZED_CURRENT_SHA);
  assert.equal(restoreAuthorizedReopenConsolidacao(authorized), loadHistoricalReopenConsolidacao());

  // Ataque Codex: remover assertion do caso reabertura e recalcular beforeSha.
  const attacked=authorized.replace(
    "assert.equal(decideCadastroReopen({\n    idChanged: false, updatedChanged: false, isDirty: true, matchesIncoming: false,\n  }), 'keep');\n\n  ",
    '',
  );
  assert.notEqual(attacked, authorized);
  const attackedHash=publicationRestoredHash(attacked);
  assert.notEqual(attackedHash, REOPEN_AUTHORIZED_CURRENT_SHA);
  assert.throws(()=>restoreAuthorizedReopenConsolidacao(attacked), /exact authorized reopen/);

  // Guard 1 (per-file): mesmo com beforeSha adulterado no manifesto, o restore real falha.
  const forgedManifestEntry={
    path: REOPEN_CONSOLIDACAO_PATH,
    beforeSha256: attackedHash,
    references: REOPEN_AUTHORIZED_REFERENCES,
  };
  assert.throws(()=>{
    const prior=restoreAuthorizedReopenConsolidacao(attacked);
    const restored=prior.replaceAll(`${base}:`,'HEAD:').replaceAll(JSON.stringify(base),"'HEAD'");
    assert.equal(crypto.createHash('sha256').update(restored).digest('hex'), forgedManifestEntry.beforeSha256);
  }, /exact authorized reopen/);

  // Guard 2 (CANAL/manifesto): entrada deve ser exatamente a autorizada — notEqual+continue rejeitado.
  assert.notDeepEqual(forgedManifestEntry, REOPEN_AUTHORIZED_MANIFEST_ENTRY);
  assert.throws(()=>assert.deepEqual(forgedManifestEntry, REOPEN_AUTHORIZED_MANIFEST_ENTRY));
});

test('P1 reopen guards reject internal mutation, omission, repetition and baseline tampering',()=>{
  const authorized=normalizePublicationSource(fs.readFileSync(REOPEN_CONSOLIDACAO_PATH,'utf8'));

  // Mutação interna (trocar outcome keep→apply).
  const internal=authorized.replace("}), 'keep');", "}), 'apply');");
  assert.throws(()=>restoreAuthorizedReopenConsolidacao(internal), /exact authorized reopen/);

  // Omissão do delta (source histórico como se fosse o atual).
  const historical=loadHistoricalReopenConsolidacao();
  assert.throws(()=>restoreAuthorizedReopenConsolidacao(historical), /exact authorized reopen|omission/i);

  // Repetição / adulteração externa: concatenar lixo fora do delta.
  assert.throws(()=>restoreAuthorizedReopenConsolidacao(`${authorized}\n`), /exact authorized reopen/);
  assert.throws(()=>restoreAuthorizedReopenConsolidacao(`// forged\n${authorized}`), /exact authorized reopen/);

  // Baseline histórico adulterado: hash histórico pinado deve bater com git show.
  assert.equal(publicationRestoredHash(historical), REOPEN_HISTORICAL_BEFORE_SHA);
  const tamperedBaseline=historical.replace('Dirty value', 'Tampered dirty');
  assert.notEqual(publicationRestoredHash(tamperedBaseline), REOPEN_HISTORICAL_BEFORE_SHA);

  // Manifesto: references adulterada ou beforeSha trocado rejeitados pelo deepEqual autorizado.
  assert.throws(()=>assert.deepEqual(
    { path: REOPEN_CONSOLIDACAO_PATH, beforeSha256: REOPEN_HISTORICAL_BEFORE_SHA, references: 1 },
    REOPEN_AUTHORIZED_MANIFEST_ENTRY,
  ));
  assert.throws(()=>assert.deepEqual(
    { path: REOPEN_CONSOLIDACAO_PATH, beforeSha256: REOPEN_AUTHORIZED_CURRENT_SHA, references: REOPEN_AUTHORIZED_REFERENCES },
    REOPEN_AUTHORIZED_MANIFEST_ENTRY,
  ));
});
