import assert from 'node:assert/strict';
import {consolidation82Remainder} from './consolidation82Remainder.js';
import crypto from 'node:crypto';
export const portalIdentityHunks={
  "src/components/lib/portalClientePolicy.js": {
    "hash": "82329a112a967950e7eec3c486c96ac39ae9daf7d1cd3554ac70656b8df8e883",
    "hunks": [
      [
        "  return firstText(requestedClienteId) || null;\n};\n\n/** @param {unknown} value @returns {value is string} */\nexport function isPortalClienteIdentificado(value) {\n  return typeof value === 'string' && value.trim().length > 0;\n}\n\n/** @param {PortalRecord} orcamento @param {unknown} clienteId\n * @returns {asserts orcamento is PortalRecord & {id: string}} */\nexport function assertPortalOrcamentoIdentificado(orcamento, clienteId) {\n  if (!isPortalClienteIdentificado(clienteId) || !isPortalClienteIdentificado(orcamento?.id)) {\n    throw new Error('Identidade do cliente e do orcamento obrigatoria.');\n  }\n  assertPortalTituloDoCliente({titulo: orcamento, clienteId});\n  if (orcamento.cliente_id !== clienteId || orcamento.status !== 'Pendente') {\n    throw new Error('Orcamento sem vinculo literal ou fora do estado pendente.');\n  }\n}\n\n/** Checksum dos bytes PNG; nao autentica pessoa, certificado ou aceite.\n * @param {Blob} blob */\nexport async function calcularChecksumAssinaturaPortal(blob) {\n  if (!(blob instanceof Blob) || blob.type !== 'image/png' || blob.size > 2 * 1024 * 1024 || blob.size < 8) {\n    throw new Error('Arquivo de assinatura PNG invalido.');\n  }\n  const bytes = new Uint8Array(await blob.arrayBuffer());\n  const header = [137, 80, 78, 71, 13, 10, 26, 10];\n  if (!header.every((value, index) => bytes[index] === value)) throw new Error('Arquivo de assinatura PNG invalido.');\n  if (!globalThis.crypto?.subtle) throw new Error('Checksum de assinatura indisponivel.');\n  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);\n  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');\n}\n\n/** @param {PortalScopeOptions} options */\nexport const assertPortalClienteScope = ({ user, cliente, requestedClienteId, adminMode = false } = {}) => {\n  const requested = firstText(requestedClienteId);",
        "  return firstText(requestedClienteId) || null;\n};\n\n/** @param {PortalScopeOptions} options */\nexport const assertPortalClienteScope = ({ user, cliente, requestedClienteId, adminMode = false } = {}) => {\n  const requested = firstText(requestedClienteId);"
      ]
    ]
  },
  "src/components/portal/AprovacaoComAssinatura.jsx": {
    "hash": "8792f0933b8f8a1658983918e23d654b6cf6f49d462f9ee83e6437c98e9b4d56",
    "hunks": [
      [
        "} from \"lucide-react\";\nimport { toast } from \"sonner\";\nimport { format } from \"date-fns\";\nimport { isPortalClienteIdentificado, assertPortalOrcamentoIdentificado, calcularChecksumAssinaturaPortal } from '@/components/lib/portalClientePolicy';\n\nconst reportApprovalSignatureFailure = (operation, error, context = {}) => {\n  console.error('[AprovacaoComAssinatura] ' + operation, {",
        "} from \"lucide-react\";\nimport { toast } from \"sonner\";\nimport { format } from \"date-fns\";\n\nconst reportApprovalSignatureFailure = (operation, error, context = {}) => {\n  console.error('[AprovacaoComAssinatura] ' + operation, {"
      ],
      [
        " * ✅ Histórico de aprovações\n * ✅ 100% Responsivo w-full h-full\n */\n/** @param {{clienteId?: string}} props */\nexport default function AprovacaoComAssinatura({ clienteId }) {\n  const queryClient = useQueryClient();\n  const canvasRef = useRef(null);",
        " * ✅ Histórico de aprovações\n * ✅ 100% Responsivo w-full h-full\n */\nexport default function AprovacaoComAssinatura({ clienteId }) {\n  const queryClient = useQueryClient();\n  const canvasRef = useRef(null);"
      ],
      [
        "  const { data: orcamentos = [] } = useQuery({\n    queryKey: ['orcamentos-aprovacao', clienteId],\n    queryFn: async () => {\n      if (!isPortalClienteIdentificado(clienteId)) return [];\n      return base44.entities.OrcamentoCliente.filter({\n        cliente_id: clienteId,\n        status: 'Pendente'\n      }, '-created_date');\n    },\n    enabled: isPortalClienteIdentificado(clienteId)\n  });\n\n  // Canvas de Assinatura",
        "  const { data: orcamentos = [] } = useQuery({\n    queryKey: ['orcamentos-aprovacao', clienteId],\n    queryFn: async () => {\n      if (!clienteId) return [];\n      return base44.entities.OrcamentoCliente.filter({\n        cliente_id: clienteId,\n        status: 'Pendente'\n      }, '-created_date');\n    },\n    enabled: !!clienteId\n  });\n\n  // Canvas de Assinatura"
      ],
      [
        "  };\n\n  const aprovarMutation = useMutation({\n    mutationFn: async (/** @type {{orcamento: import('../lib/portalClientePolicy').PortalRecord, assinaturaDataUrl: string}} */ { orcamento, assinaturaDataUrl }) => {\n      assertPortalOrcamentoIdentificado(orcamento, clienteId);\n      if (typeof assinaturaDataUrl !== 'string' || !assinaturaDataUrl.startsWith('data:image/png;base64,')\n        || assinaturaDataUrl.length > Math.ceil(2 * 1024 * 1024 * 4 / 3) + 32) {\n        throw new Error('Origem da assinatura PNG invalida.');\n      }\n      // 1. Upload da assinatura\n      const blob = await (await fetch(assinaturaDataUrl)).blob();\n      const assinaturaHash = await calcularChecksumAssinaturaPortal(blob);\n      const file = new File([blob], 'assinatura.png', { type: 'image/png' });\n      const { file_url } = await base44.integrations.Core.UploadFile({ file });\n",
        "  };\n\n  const aprovarMutation = useMutation({\n    mutationFn: async ({ orcamento, assinaturaDataUrl }) => {\n      // 1. Upload da assinatura\n      const blob = await (await fetch(assinaturaDataUrl)).blob();\n      const file = new File([blob], 'assinatura.png', { type: 'image/png' });\n      const { file_url } = await base44.integrations.Core.UploadFile({ file });\n"
      ],
      [
        "        data_aprovacao: new Date().toISOString(),\n        assinatura_url: file_url,\n        assinatura_ip: 'Portal',\n        assinatura_hash: assinaturaHash\n      });\n\n      // 3. Criar pedido automaticamente",
        "        data_aprovacao: new Date().toISOString(),\n        assinatura_url: file_url,\n        assinatura_ip: 'Portal',\n        assinatura_hash: btoa(assinaturaDataUrl.substring(0, 100))\n      });\n\n      // 3. Criar pedido automaticamente"
      ],
      [
        "  });\n\n  const rejeitarMutation = useMutation({\n    mutationFn: async (/** @type {{orcamento: import('../lib/portalClientePolicy').PortalRecord, motivo: string}} */ { orcamento, motivo }) => {\n      assertPortalOrcamentoIdentificado(orcamento, clienteId);\n      await base44.entities.OrcamentoCliente.update(orcamento.id, {\n        status: 'Revisao Solicitada',\n        comentario_revisao: motivo,",
        "  });\n\n  const rejeitarMutation = useMutation({\n    mutationFn: async ({ orcamento, motivo }) => {\n      await base44.entities.OrcamentoCliente.update(orcamento.id, {\n        status: 'Revisao Solicitada',\n        comentario_revisao: motivo,"
      ],
      [
        "    });\n  };\n\n  if (!isPortalClienteIdentificado(clienteId)) return <p role=\"status\">Cliente do portal nao identificado. Operacoes indisponiveis.</p>;\n  return (\n    <div className=\"space-y-4 w-full h-full\">\n      <Card className=\"border-2 border-blue-300 bg-blue-50 shadow-lg w-full\">",
        "    });\n  };\n\n  return (\n    <div className=\"space-y-4 w-full h-full\">\n      <Card className=\"border-2 border-blue-300 bg-blue-50 shadow-lg w-full\">"
      ]
    ]
  },
  "src/components/portal/UploadProjetos.jsx": {
    "hash": "9186ff2df9f5cebaea0777fe0d99be6459f83007a46256bae3c6bc15b586e55d",
    "hunks": [
      [
        "import { useToast } from \"@/components/ui/use-toast\";\nimport { Upload, FileText, CheckCircle2, Clock, AlertCircle, Download } from \"lucide-react\";\nimport { format } from \"date-fns\";\nimport { isPortalClienteIdentificado } from '@/components/lib/portalClientePolicy';\n\n/**\n * V21.5 - Upload de Projetos COMPLETO",
        "import { useToast } from \"@/components/ui/use-toast\";\nimport { Upload, FileText, CheckCircle2, Clock, AlertCircle, Download } from \"lucide-react\";\nimport { format } from \"date-fns\";\n\n/**\n * V21.5 - Upload de Projetos COMPLETO"
      ],
      [
        " * ✅ Geração automática de orçamento\n * ✅ 100% Responsivo w-full h-full\n */\n/** @param {{clienteId?: string, clienteNome?: string}} props */\nexport default function UploadProjetos({ clienteId, clienteNome }) {\n  const [arquivoSelecionado, setArquivoSelecionado] = useState(null);\n  const [descricaoProjeto, setDescricaoProjeto] = useState(\"\");",
        " * ✅ Geração automática de orçamento\n * ✅ 100% Responsivo w-full h-full\n */\nexport default function UploadProjetos({ clienteId, clienteNome }) {\n  const [arquivoSelecionado, setArquivoSelecionado] = useState(null);\n  const [descricaoProjeto, setDescricaoProjeto] = useState(\"\");"
      ],
      [
        "    queryKey: ['projetosCliente', clienteId],\n    queryFn: async () => {\n      // Buscar pedidos do cliente que têm projetos anexados\n      if (!isPortalClienteIdentificado(clienteId)) return [];\n      const pedidos = await base44.entities.Pedido.filter({ cliente_id: clienteId }, '-created_date');\n      \n      const projetosCliente = [];",
        "    queryKey: ['projetosCliente', clienteId],\n    queryFn: async () => {\n      // Buscar pedidos do cliente que têm projetos anexados\n      const pedidos = await base44.entities.Pedido.filter({ cliente_id: clienteId }, '-created_date');\n      \n      const projetosCliente = [];"
      ],
      [
        "      \n      return projetosCliente;\n    },\n    enabled: isPortalClienteIdentificado(clienteId)\n  });\n\n  const uploadProjetoMutation = useMutation({\n    mutationFn: async (/** @type {File} */ file) => {\n      if (!isPortalClienteIdentificado(clienteId)) throw new Error('Cliente do portal nao identificado.');\n      setUploading(true);\n      \n      // Upload do arquivo",
        "      \n      return projetosCliente;\n    },\n    enabled: !!clienteId\n  });\n\n  const uploadProjetoMutation = useMutation({\n    mutationFn: async (/** @type {File} */ file) => {\n      setUploading(true);\n      \n      // Upload do arquivo"
      ],
      [
        "    }\n  };\n\n  if (!isPortalClienteIdentificado(clienteId)) return <p role=\"status\">Cliente do portal nao identificado. Operacoes indisponiveis.</p>;\n  return (\n    <div className=\"space-y-6 w-full h-full\">\n      <div>",
        "    }\n  };\n\n  return (\n    <div className=\"space-y-6 w-full h-full\">\n      <div>"
      ]
    ]
  },
  "src/components/portal/ChatVendedor.jsx": {
    "hash": "d16c698e5f58a9ce06bce31a0709d5d503a5811cad9041e9a0830a7f574458a6",
    "hunks": [
      [
        "import { format } from \"date-fns\";\nimport { useUser } from \"@/components/lib/UserContext\";\nimport { toast } from \"sonner\";\nimport { isPortalClienteIdentificado } from '@/components/lib/portalClientePolicy';\n\n/**\n * V21.5 - Chat Direto Cliente → Vendedor COMPLETO",
        "import { format } from \"date-fns\";\nimport { useUser } from \"@/components/lib/UserContext\";\nimport { toast } from \"sonner\";\n\n/**\n * V21.5 - Chat Direto Cliente → Vendedor COMPLETO"
      ],
      [
        " * ✅ Status online/offline do vendedor\n * ✅ 100% Responsivo w-full h-full\n */\n/** @param {{clienteId?: string}} props */\nexport default function ChatVendedor({ clienteId }) {\n  const { user } = useUser();\n  const queryClient = useQueryClient();",
        " * ✅ Status online/offline do vendedor\n * ✅ 100% Responsivo w-full h-full\n */\nexport default function ChatVendedor({ clienteId }) {\n  const { user } = useUser();\n  const queryClient = useQueryClient();"
      ],
      [
        "\n  const { data: cliente } = useQuery({\n    queryKey: ['cliente', clienteId],\n    queryFn: () => isPortalClienteIdentificado(clienteId) ? base44.entities.Cliente.filter({ id: clienteId }).then(r => r[0]) : Promise.resolve(null),\n    enabled: isPortalClienteIdentificado(clienteId)\n  });\n\n  const { data: conversas = [], isLoading } = useQuery({\n    queryKey: ['chat-cliente', clienteId],\n    queryFn: async () => {\n      if (!isPortalClienteIdentificado(clienteId)) return [];\n      const interacoes = await base44.entities.ChatbotInteracao.filter({\n        cliente_id: clienteId,\n        canal: 'Portal'\n      }, '-created_date');\n      return interacoes;\n    },\n    enabled: isPortalClienteIdentificado(clienteId),\n    refetchInterval: 5000 // Atualiza a cada 5s\n  });\n\n  const enviarMensagemMutation = useMutation({\n    mutationFn: async (/** @type {string} */ mensagemTexto) => {\n      if (!isPortalClienteIdentificado(clienteId)) throw new Error('Cliente do portal nao identificado.');\n      // 1. Criar interação de chat\n      const interacao = await base44.entities.ChatbotInteracao.create({\n        cliente_id: clienteId,",
        "\n  const { data: cliente } = useQuery({\n    queryKey: ['cliente', clienteId],\n    queryFn: () => base44.entities.Cliente.filter({ id: clienteId }).then(r => r[0]),\n    enabled: !!clienteId\n  });\n\n  const { data: conversas = [], isLoading } = useQuery({\n    queryKey: ['chat-cliente', clienteId],\n    queryFn: async () => {\n      const interacoes = await base44.entities.ChatbotInteracao.filter({\n        cliente_id: clienteId,\n        canal: 'Portal'\n      }, '-created_date');\n      return interacoes;\n    },\n    enabled: !!clienteId,\n    refetchInterval: 5000 // Atualiza a cada 5s\n  });\n\n  const enviarMensagemMutation = useMutation({\n    mutationFn: async (/** @type {string} */ mensagemTexto) => {\n      // 1. Criar interação de chat\n      const interacao = await base44.entities.ChatbotInteracao.create({\n        cliente_id: clienteId,"
      ],
      [
        "\n  const responderMutation = useMutation({\n    mutationFn: async (/** @type {{interacaoId: string, resposta: string}} */ { interacaoId, resposta }) => {\n      if (!isPortalClienteIdentificado(clienteId)) throw new Error('Cliente do portal nao identificado.');\n      await base44.entities.ChatbotInteracao.update(interacaoId, {\n        resposta_agente: resposta,\n        status: 'respondido',",
        "\n  const responderMutation = useMutation({\n    mutationFn: async (/** @type {{interacaoId: string, resposta: string}} */ { interacaoId, resposta }) => {\n      await base44.entities.ChatbotInteracao.update(interacaoId, {\n        resposta_agente: resposta,\n        status: 'respondido',"
      ],
      [
        "    enviarMensagemMutation.mutate(mensagem);\n  };\n\n  if (!isPortalClienteIdentificado(clienteId)) return <p role=\"status\">Cliente do portal nao identificado. Operacoes indisponiveis.</p>;\n  if (isLoading) {\n    return (\n      <div className=\"flex items-center justify-center min-h-[400px]\">",
        "    enviarMensagemMutation.mutate(mensagem);\n  };\n\n  if (isLoading) {\n    return (\n      <div className=\"flex items-center justify-center min-h-[400px]\">"
      ]
    ]
  },
  "src/components/portal/AnalyticsPortalCliente.jsx": {
    "hash": "f51f6b7bd0851bcbabd74f25c21d5a613a1c0adba33c50d2af16826be6e9ae74",
    "hunks": [
      [
        "import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';\nimport { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';\nimport { TrendingUp, Package, DollarSign, Calendar } from 'lucide-react';\nimport { isPortalClienteIdentificado } from '@/components/lib/portalClientePolicy';\n\n/**\n * V21.5 - Analytics Portal Cliente",
        "import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';\nimport { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';\nimport { TrendingUp, Package, DollarSign, Calendar } from 'lucide-react';\n\n/**\n * V21.5 - Analytics Portal Cliente"
      ],
      [
        " * ✅ Métricas de relacionamento\n * ✅ 100% Responsivo\n */\n/** @param {{clienteId?: string}} props */\nexport default function AnalyticsPortalCliente({ clienteId }) {\n  const { data: pedidos = [] } = useQuery({\n    queryKey: ['analytics-pedidos', clienteId],\n    queryFn: () => isPortalClienteIdentificado(clienteId) ? base44.entities.Pedido.filter({ cliente_id: clienteId }, '-data_pedido', 100) : Promise.resolve([]),\n    enabled: isPortalClienteIdentificado(clienteId),\n  });\n\n  // Agregar pedidos por mês",
        " * ✅ Métricas de relacionamento\n * ✅ 100% Responsivo\n */\nexport default function AnalyticsPortalCliente({ clienteId }) {\n  const { data: pedidos = [] } = useQuery({\n    queryKey: ['analytics-pedidos', clienteId],\n    queryFn: () => base44.entities.Pedido.filter({ cliente_id: clienteId }, '-data_pedido', 100),\n    enabled: !!clienteId,\n  });\n\n  // Agregar pedidos por mês"
      ],
      [
        "\n  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];\n\n  if (!isPortalClienteIdentificado(clienteId)) return <p role=\"status\">Cliente do portal nao identificado. Operacoes indisponiveis.</p>;\n  return (\n    <div className=\"space-y-6 w-full h-full\">\n      <div className=\"grid grid-cols-1 lg:grid-cols-2 gap-6 w-full\">",
        "\n  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];\n\n  return (\n    <div className=\"space-y-6 w-full h-full\">\n      <div className=\"grid grid-cols-1 lg:grid-cols-2 gap-6 w-full\">"
      ],
      [
        "    </div>\n  );\n}\n",
        "    </div>\n  );\n}"
      ]
    ]
  },
  "src/components/portal/HistoricoComprasCliente.jsx": {
    "hash": "59af470227712788e3287494dd1f4e28a3de94e1f62cee27bca97d7cfb464873",
    "hunks": [
      [
        "import { Badge } from '@/components/ui/badge';\nimport { Calendar, Package, TrendingUp, Award } from 'lucide-react';\nimport { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';\nimport { isPortalClienteIdentificado } from '@/components/lib/portalClientePolicy';\n\n/**\n * V21.5 - Histórico de Compras Inteligente",
        "import { Badge } from '@/components/ui/badge';\nimport { Calendar, Package, TrendingUp, Award } from 'lucide-react';\nimport { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';\n\n/**\n * V21.5 - Histórico de Compras Inteligente"
      ],
      [
        " * ✅ Sugestões personalizadas IA\n * ✅ Fidelidade e cashback\n */\n/** @param {{clienteId?: string}} props */\nexport default function HistoricoComprasCliente({ clienteId }) {\n  const { data: cliente } = useQuery({\n    queryKey: ['cliente-historico', clienteId],\n    queryFn: () => isPortalClienteIdentificado(clienteId) ? base44.entities.Cliente.filter({ id: clienteId }).then(r => r[0]) : Promise.resolve(null),\n    enabled: isPortalClienteIdentificado(clienteId),\n  });\n\n  const { data: pedidos = [] } = useQuery({\n    queryKey: ['historico-pedidos', clienteId, cliente?.empresa_id, cliente?.group_id],\n    queryFn: () => isPortalClienteIdentificado(clienteId) ? base44.entities.Pedido.filter({ cliente_id: clienteId, empresa_id: cliente?.empresa_id || undefined, group_id: cliente?.group_id || undefined }, '-data_pedido', 100) : Promise.resolve([]),\n    enabled: isPortalClienteIdentificado(clienteId),\n  });\n\n  // Produtos mais comprados",
        " * ✅ Sugestões personalizadas IA\n * ✅ Fidelidade e cashback\n */\nexport default function HistoricoComprasCliente({ clienteId }) {\n  const { data: cliente } = useQuery({\n    queryKey: ['cliente-historico', clienteId],\n    queryFn: () => base44.entities.Cliente.filter({ id: clienteId }).then(r => r[0]),\n    enabled: !!clienteId,\n  });\n\n  const { data: pedidos = [] } = useQuery({\n    queryKey: ['historico-pedidos', clienteId, cliente?.empresa_id, cliente?.group_id],\n    queryFn: () => base44.entities.Pedido.filter({ cliente_id: clienteId, empresa_id: cliente?.empresa_id || undefined, group_id: cliente?.group_id || undefined }, '-data_pedido', 100),\n    enabled: !!clienteId,\n  });\n\n  // Produtos mais comprados"
      ],
      [
        "    quantidade: p.quantidade,\n  }));\n\n  if (!isPortalClienteIdentificado(clienteId)) return <p role=\"status\">Cliente do portal nao identificado. Operacoes indisponiveis.</p>;\n  return (\n    <div className=\"space-y-6 w-full h-full\">\n      {/* KPIs de Fidelidade */}",
        "    quantidade: p.quantidade,\n  }));\n\n  return (\n    <div className=\"space-y-6 w-full h-full\">\n      {/* KPIs de Fidelidade */}"
      ],
      [
        "    </div>\n  );\n}\n",
        "    </div>\n  );\n}"
      ]
    ]
  }
};
export function portalIdentityRemainder(file,text){
 text=consolidation82Remainder(file,text,false);
 const entry=portalIdentityHunks[file];if(!entry)return text;
 let source=text.replace(/\r\n/g,'\n');
 for(const [after,before] of entry.hunks){assert.equal(source.split(after).length,2,file+': exact identity/checksum hunk');source=source.replace(after,before);}
 assert.equal(crypto.createHash('sha256').update(source).digest('hex'),entry.hash,file+': entire previous source');
 return text.includes('\r\n')?source.replace(/\n/g,'\r\n'):source;
}
