import assert from 'node:assert/strict';
import {portalBankSourceRemainder} from './portalBankSourceRemainder.js';

export const consumerWindowHunks = {
  'src/components/sistema/ConfigCenter.jsx': [
    ['/** @param {{empresaId?: string}} props */\nexport default function ConfigCenter', 'export default function ConfigCenter'],
  ],
  'src/components/administracao-sistema/configuracoes-gerais/IAPanel.jsx': [
    ['<ConfigCenter />', '<ConfigCenter scope="ia" />'],
  ],
  'src/components/governanca/PainelGovernanca.jsx': [
    ['/** @param {{empresaId?: string, grupoId?: string}} props */\nexport default function PainelGovernanca', 'export default function PainelGovernanca'],
  ],
  'src/components/integracoes/TesteGoogleMaps.jsx': [
    ['/** @param {{configuracao?: {integracao_maps?: {api_key?: string, ativa?: boolean}}, windowMode?: boolean}} props */\nexport default function TesteGoogleMaps', 'export default function TesteGoogleMaps'],
  ],
  'src/components/financeiro/contas-receber/TabelaReceber.jsx': [
    ['  sortField = undefined,\n  sortDirection = undefined,\n  onSortChange = undefined', '  sortField,\n  sortDirection,\n  onSortChange'],
  ],
  'src/components/cadastros/openCadastroWindow.js': [
    ["}) {\n  if (component == null) throw new TypeError('Componente de cadastro obrigatorio.');", '} = {}) {'],
  ],
  'src/components/lib/exportacaoPDF.jsx': [
    ['export function gerarPDFPedido(pedido, empresa = {}) {\n  if (!pedido) return false;', 'export function gerarPDFPedido(pedido, empresa = {}) {'],
    ["  // Abrir em nova janela e imprimir\n  const printWindow = window.open('', '_blank');\n  if (!printWindow) return false;\n  printWindow.opener = null;", "  // Abrir em nova janela e imprimir\n  const printWindow = window.open('', '_blank');"],
    ['  };\n  return true;\n}\n\n/**\n * Gera PDF de Romaneio', '  };\n}\n\n/**\n * Gera PDF de Romaneio'],
  ],
  'src/components/portal/DocumentosCliente.jsx': [
    ["                              onClick={() => {\n                                const url = conta.url_fatura;\n                                if (isSafeHttpUrl(url)) window.open(url, '_blank', 'noopener,noreferrer');\n                              }}", "                              onClick={() => window.open(conta.url_fatura, '_blank', 'noopener,noreferrer')}"],
  ],
};
export function consumerWindowRemainder(file, text) {
  const hunks = consumerWindowHunks[file];
  if (!hunks) return text;
  let source=portalBankSourceRemainder(file,text).replace(/\r\n/g,'\n');
  for (const [after,before] of hunks) {
    assert.equal(source.split(after).length,2,file+': exactly one approved consumer hunk');
    source=source.replace(after,before);
  }
  if(file==='src/components/administracao-sistema/configuracoes-gerais/IAPanel.jsx') {
    assert.ok(source.endsWith('\n')&&!source.endsWith('\n\n')); source=source.slice(0,-1);
  }
  return text.includes('\r\n') ? source.replace(/\n/g,'\r\n') : source;
}
