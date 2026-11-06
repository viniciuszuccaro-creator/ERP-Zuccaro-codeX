import assert from 'node:assert/strict';
import {financialBatchPermissionRemainder} from './financialBatchPermissionRemainder.js';
import {portalBankSourceRemainder} from './portalBankSourceRemainder.js';
import { consumerWindowHunks } from './consumerWindowRemainder.js';

export const portalReadHunks = {
  "src/lib/utils.js": [
    [
      "  return typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value)) ? value : null;\n}\n\n/** @param {unknown} value\n * @returns {value is string} */\nexport function isSafeHttpUrl(value) {\n  if (typeof value !== 'string') return false;\n  try {\n    const url = new URL(value);\n    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;\n  } catch {\n    return false;\n  }\n}\n\nexport const isIframe = window.self !== window.top;\n",
      "  return typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value)) ? value : null;\n}\n\nexport const isIframe = window.self !== window.top;\n",
      1
    ]
  ],
  "src/components/financeiro/ContasReceberTab.jsx": [
    [
      "import useEntityListSorted from \"@/components/lib/useEntityListSorted\";\nimport useBackendPagination from \"@/components/lib/useBackendPagination\";\nimport usePersistedSort from \"@/components/lib/usePersistedSort\";\nimport { isSafeHttpUrl } from \"@/lib/utils\";\nimport {\n  buildFinanceiroQueryScopeKey,\n  buildFinanceiroTitulosScopeSwitchReset,\n",
      "import useEntityListSorted from \"@/components/lib/useEntityListSorted\";\nimport useBackendPagination from \"@/components/lib/useBackendPagination\";\nimport usePersistedSort from \"@/components/lib/usePersistedSort\";\nimport {\n  buildFinanceiroQueryScopeKey,\n  buildFinanceiroTitulosScopeSwitchReset,\n",
      1
    ],
    [
      "    .replace(/<\\s*script[^>]*>[\\s\\S]*?<\\s*\\/\\s*script\\s*>/gi, \"\")\n    .replace(/javascript:\\s*/gi, \"\")\n    .trim();\n  const isSafeUrl = isSafeHttpUrl;\n  const [searchTerm, setSearchTerm] = useState(\"\");\n  const [statusFilter, setStatusFilter] = useState(\"todas\");\n  const [gerarCobrancaDialogOpen, setGerarCobrancaDialogOpen] = useState(false);\n",
      "    .replace(/<\\s*script[^>]*>[\\s\\S]*?<\\s*\\/\\s*script\\s*>/gi, \"\")\n    .replace(/javascript:\\s*/gi, \"\")\n    .trim();\n  const isSafeUrl = (value) => {\n    try {\n      const url = new URL(String(value || \"\"));\n      return ['http:', 'https:'].includes(url.protocol);\n    } catch (_) {\n      return false;\n    }\n  };\n  const [searchTerm, setSearchTerm] = useState(\"\");\n  const [statusFilter, setStatusFilter] = useState(\"todas\");\n  const [gerarCobrancaDialogOpen, setGerarCobrancaDialogOpen] = useState(false);\n",
      1
    ]
  ],
  "src/components/portal/BoletosList.jsx": [
    ["import { displayScalar, isSafeHttpUrl } from '@/lib/utils';\n", "", 1],
    ["displayScalar(b.descricao) || displayScalar(b.numero_documento) || 'Título a receber'", "b.descricao || b.numero_documento || 'Título a receber'", 1],
    ["{displayScalar(b.status)}", "{b.status}", 1],
    ["isSafeHttpUrl(b.url_boleto_pdf) && (", "b.url_boleto_pdf && !String(b.url_boleto_pdf).startsWith('portal://') && (", 1],
    ["{typeof b.linha_digitavel === 'string' ? b.linha_digitavel.slice(0, 12) : ''}", "{(b.linha_digitavel || '').slice(0, 12)}", 1]
  ],
  "src/components/portal/DocumentosCliente.jsx": [
    [
      "import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';\nimport { FileText, Download, Search, CreditCard, Eye, Calendar } from 'lucide-react';\nimport { toast } from 'sonner';\nimport { displayScalar, isSafeHttpUrl } from '@/lib/utils';\nimport {\n  applyPortalReadScope,\n  buildPortalDocumentoLinks,\n",
      "import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';\nimport { FileText, Download, Search, CreditCard, Eye, Calendar } from 'lucide-react';\nimport { toast } from 'sonner';\nimport {\n  applyPortalReadScope,\n  buildPortalDocumentoLinks,\n",
      1
    ],
    [
      "  const [searchTerm, setSearchTerm] = useState('');\n  const qc = useQueryClient();\n\n  const { data: contexto, isLoading: loadingCtx } = useQuery({\n    queryKey: ['portal-docs-contexto'],\n    queryFn: async () => {\n      const user = await base44.auth.me();\n",
      "  const [searchTerm, setSearchTerm] = useState('');\n  const qc = useQueryClient();\n\n  const { data: contexto = {}, isLoading: loadingCtx } = useQuery({\n    queryKey: ['portal-docs-contexto'],\n    queryFn: async () => {\n      const user = await base44.auth.me();\n",
      1
    ],
    [
      "    },\n  });\n\n  const cliente = contexto?.cliente;\n  const clienteId = contexto?.clienteId;\n\n  const { data: notasFiscais = [], isLoading: loadingNFe } = useQuery({\n    queryKey: ['minhas-nfes', clienteId],\n",
      "    },\n  });\n\n  const cliente = contexto.cliente;\n  const clienteId = contexto.clienteId;\n\n  const { data: notasFiscais = [], isLoading: loadingNFe } = useQuery({\n    queryKey: ['minhas-nfes', clienteId],\n",
      1
    ],
    [
      "  const handleDownloadNFe = async (nfe) => {\n    try {\n      const links = buildPortalDocumentoLinks({ nfe, clienteId });\n      if (isSafeHttpUrl(links.xml)) window.open(links.xml, '_blank', 'noopener,noreferrer');\n      else toast.error('XML nao disponivel');\n    } catch (error) {\n      toast.error(error?.message || 'Download bloqueado');\n",
      "  const handleDownloadNFe = async (nfe) => {\n    try {\n      const links = buildPortalDocumentoLinks({ nfe, clienteId });\n      if (links.xml) window.open(links.xml, '_blank');\n      else toast.error('XML nao disponivel');\n    } catch (error) {\n      toast.error(error?.message || 'Download bloqueado');\n",
      1
    ],
    [
      "\n  const handleVisualizarBoleto = (conta) => {\n    if (conta.url_boleto_pdf && !String(conta.url_boleto_pdf).startsWith('portal://')) {\n      if (!isSafeHttpUrl(conta.url_boleto_pdf)) { toast.error('URL do boleto invalida ou insegura'); return; }\n      window.open(conta.url_boleto_pdf, '_blank', 'noopener,noreferrer');\n    } else if (conta.linha_digitavel) {\n      toast.message(`Linha digitavel: ${conta.linha_digitavel}`);\n    } else {\n",
      "\n  const handleVisualizarBoleto = (conta) => {\n    if (conta.url_boleto_pdf && !String(conta.url_boleto_pdf).startsWith('portal://')) {\n      window.open(conta.url_boleto_pdf, '_blank');\n    } else if (conta.linha_digitavel) {\n      toast.message(`Linha digitavel: ${conta.linha_digitavel}`);\n    } else {\n",
      1
    ],
    [
      "  };\n\n  const filteredNFes = notasFiscais.filter(nfe =>\n    ((typeof nfe.numero === 'string' || typeof nfe.numero === 'number') && String(nfe.numero).includes(searchTerm)) ||\n    (typeof nfe.chave_acesso === 'string' && nfe.chave_acesso.includes(searchTerm))\n  );\n\n  const filteredBoletos = contasReceber.filter(conta =>\n    (typeof conta.numero_documento === 'string' && conta.numero_documento.includes(searchTerm)) ||\n    (typeof conta.descricao === 'string' && conta.descricao.toLowerCase().includes(searchTerm.toLowerCase()))\n  );\n\n  if (loadingCtx) {\n",
      "  };\n\n  const filteredNFes = notasFiscais.filter(nfe =>\n    nfe.numero?.toString().includes(searchTerm) ||\n    nfe.chave_acesso?.includes(searchTerm)\n  );\n\n  const filteredBoletos = contasReceber.filter(conta =>\n    conta.numero_documento?.includes(searchTerm) ||\n    conta.descricao?.toLowerCase().includes(searchTerm.toLowerCase())\n  );\n\n  if (loadingCtx) {\n",
      1
    ],
    [
      "                          <FileText className=\"w-6 h-6 text-white\" />\n                        </div>\n                        <div>\n                          <h3 className=\"font-semibold text-lg\">NF-e Nº {displayScalar(nfe.numero)}</h3>\n                          <p className=\"text-sm text-slate-600\">\n                            Série: {displayScalar(nfe.serie)} | Chave: {typeof nfe.chave_acesso === 'string' ? nfe.chave_acesso.substring(0, 20) : ''}...\n                          </p>\n                          <p className=\"text-sm text-slate-600\">\n                            Emissão: {typeof nfe.data_emissao === 'string' || typeof nfe.data_emissao === 'number' ? new Date(nfe.data_emissao).toLocaleDateString('pt-BR') : '—'}\n                          </p>\n                          <p className=\"text-sm font-medium text-green-600 mt-1\">\n                            Valor: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(nfe.valor_total))}\n                          </p>\n                        </div>\n                      </div>\n                      <Badge className=\"bg-green-100 text-green-800\">\n                        {displayScalar(nfe.status) || 'Autorizada'}\n                      </Badge>\n                    </div>\n\n",
      "                          <FileText className=\"w-6 h-6 text-white\" />\n                        </div>\n                        <div>\n                          <h3 className=\"font-semibold text-lg\">NF-e Nº {nfe.numero}</h3>\n                          <p className=\"text-sm text-slate-600\">\n                            Série: {nfe.serie} | Chave: {nfe.chave_acesso?.substring(0, 20)}...\n                          </p>\n                          <p className=\"text-sm text-slate-600\">\n                            Emissão: {new Date(nfe.data_emissao).toLocaleDateString('pt-BR')}\n                          </p>\n                          <p className=\"text-sm font-medium text-green-600 mt-1\">\n                            Valor: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(nfe.valor_total)}\n                          </p>\n                        </div>\n                      </div>\n                      <Badge className=\"bg-green-100 text-green-800\">\n                        {nfe.status || 'Autorizada'}\n                      </Badge>\n                    </div>\n\n",
      1
    ],
    [
      "                      {(() => {\n                        try {\n                          const links = buildPortalDocumentoLinks({ nfe, clienteId });\n                          return isSafeHttpUrl(links.danfe) ? (\n                            <Button\n                              size=\"sm\"\n                              variant=\"outline\"\n                              onClick={() => window.open(links.danfe, '_blank', 'noopener,noreferrer')}\n                              className=\"flex items-center gap-2\"\n                            >\n                              <Eye className=\"w-4 h-4\" />\n",
      "                      {(() => {\n                        try {\n                          const links = buildPortalDocumentoLinks({ nfe, clienteId });\n                          return links.danfe ? (\n                            <Button\n                              size=\"sm\"\n                              variant=\"outline\"\n                              onClick={() => window.open(links.danfe, '_blank')}\n                              className=\"flex items-center gap-2\"\n                            >\n                              <Eye className=\"w-4 h-4\" />\n",
      1
    ],
    [
      "                            <CreditCard className=\"w-6 h-6 text-white\" />\n                          </div>\n                          <div>\n                            <h3 className=\"font-semibold text-lg\">{displayScalar(conta.descricao)}</h3>\n                            <p className=\"text-sm text-slate-600\">\n                              Doc: {displayScalar(conta.numero_documento) || 'N/A'}\n                            </p>\n                            <p className=\"text-sm text-slate-600\">\n                              Vencimento: {new Date(conta.data_vencimento).toLocaleDateString('pt-BR')}\n",
      "                            <CreditCard className=\"w-6 h-6 text-white\" />\n                          </div>\n                          <div>\n                            <h3 className=\"font-semibold text-lg\">{conta.descricao}</h3>\n                            <p className=\"text-sm text-slate-600\">\n                              Doc: {conta.numero_documento || 'N/A'}\n                            </p>\n                            <p className=\"text-sm text-slate-600\">\n                              Vencimento: {new Date(conta.data_vencimento).toLocaleDateString('pt-BR')}\n",
      1
    ],
    [
      "                              </p>\n                            )}\n                            <p className=\"text-lg font-bold text-blue-600 mt-2\">\n                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(conta.valor))}\n                            </p>\n                          </div>\n                        </div>\n                        <Badge className={statusColorBoleto[conta.status] || 'bg-gray-100'}>\n                          {displayScalar(conta.status)}\n                        </Badge>\n                      </div>\n\n",
      "                              </p>\n                            )}\n                            <p className=\"text-lg font-bold text-blue-600 mt-2\">\n                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(conta.valor)}\n                            </p>\n                          </div>\n                        </div>\n                        <Badge className={statusColorBoleto[conta.status] || 'bg-gray-100'}>\n                          {conta.status}\n                        </Badge>\n                      </div>\n\n",
      1
    ],
    [
      "                            <Download className=\"w-4 h-4\" />\n                            {conta.pix_copia_cola ? 'Copiar PIX' : 'Gerar PIX'}\n                          </Button>\n                          {isSafeHttpUrl(conta.url_fatura) && (\n                            <Button\n                              size=\"sm\"\n                              variant=\"outline\"\n                              onClick={() => window.open(conta.url_fatura, '_blank', 'noopener,noreferrer')}\n                              className=\"flex items-center gap-2\"\n                            >\n                              <Calendar className=\"w-4 h-4\" />\n",
      "                            <Download className=\"w-4 h-4\" />\n                            {conta.pix_copia_cola ? 'Copiar PIX' : 'Gerar PIX'}\n                          </Button>\n                          {conta.url_fatura && (\n                            <Button\n                              size=\"sm\"\n                              variant=\"outline\"\n                              onClick={() => window.open(conta.url_fatura, '_blank')}\n                              className=\"flex items-center gap-2\"\n                            >\n                              <Calendar className=\"w-4 h-4\" />\n",
      1
    ]
  ]
};
const documentFile='src/components/portal/DocumentosCliente.jsx';
const [clickAfter,clickBefore]=consumerWindowHunks[documentFile][0];
const documentHunks=portalReadHunks[documentFile].filter(([current])=>current.includes(clickBefore));
assert.equal(documentHunks.length,1,'one historical link hunk to compose');
assert.equal(documentHunks[0][0].split(clickBefore).length,2);
documentHunks[0][0]=documentHunks[0][0].replace(clickBefore,clickAfter);

export function portalReadRemainder(file, text) {
  text = financialBatchPermissionRemainder(file, text);
  text = portalBankSourceRemainder(file, text);
  if (!portalReadHunks[file]) return text;
  let source = text.replace(/\r\n/g, '\n');
  for (const [current, previous, count] of portalReadHunks[file] || []) {
    assert.equal(source.split(current).length - 1, count, file + ': exact portal read hunk');
    source = source.split(current).join(previous);
  }
  return source;
}
