import assert from 'node:assert/strict';
import {backupCapabilityRemainder} from './backupCapabilityRemainder.js';
import {financialFileCommandRemainder} from './financialFileCommandRemainder.js';

export const commandAuditHunks={
 'src/components/estoque/RequisicoesAlmoxarifadoTab.jsx':[
  ["  const { empresaAtual, grupoAtual, createInContext, updateInContext } = useContextoVisual();\n  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;","  const { empresaAtual, grupoAtual, contexto, createInContext, updateInContext } = useContextoVisual();"],
  ["  const contextoValido = Boolean(empresaAtual?.id || grupoAtual?.id)\n    && typeof groupId === 'string' && groupId.trim().length > 0\n    && [grupoAtual?.id, empresaAtual?.group_id, empresaAtual?.grupo_id]\n      .filter(value => value != null).every(value => value === groupId);","  const contextoValido = Boolean(empresaAtual?.id || grupoAtual?.id);"],
  ['          group_id: groupId,','          group_id: contexto?.group_id,'],
  ['        group_id: groupId,\n        grupo_id: groupId,','        group_id: grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || contexto?.group_id || null,\n        grupo_id: grupoAtual?.id || empresaAtual?.grupo_id || empresaAtual?.group_id || contexto?.group_id || null,'],
 ],
 'src/components/fiscal/ImportarXMLNFe.jsx':[
  ['  /** @param {{acao: string, sucesso?: boolean, motivo?: string | null, dados?: Record<string, unknown>}} options */\n',''],
  ['        group_id: groupId || null,\n        grupo_id: groupId || null,\n        empresa_id: empresaSelecionadaId || null,','        group_id: groupId || dados.group_id || null,\n        grupo_id: groupId || dados.group_id || null,\n        empresa_id: empresaSelecionadaId || dados.empresa_id || null,'],
  ["console.error('Falha ao auditar importacao XML NF-e.');","console.error('Falha ao auditar importacao XML NF-e:', error);"],
 ],
 'src/components/financeiro/GestaoRemessaRetorno.jsx':[
  ['  /** @param {{acao: string, entidade?: string, registroId?: string | null, descricao: string,\n   * dadosAnteriores?: unknown, dadosNovos?: unknown, sucesso?: boolean}} options */\n',''],
  ["console.warn('Falha ao auditar CNAB.');","console.warn('Falha ao auditar CNAB:', error);"],
 ],
 'src/components/crm/OportunidadesLista.jsx':[
  ["    mutationFn: async (/** @type {unknown} */ data) => {\n      assertWrite(\"criar\");\n      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Dados da oportunidade invalidos.');","    mutationFn: async (data) => {\n      assertWrite(\"criar\");"],
 ],
 'src/components/comercial/PedidosEntregaTab.jsx':[
  ['                contextoValido={contextoValido}\n                canView={canView}\n                onAudit={auditEntrega}\n',''],
 ],
 // #543: PedidosRetiradaTab — Pedido via filterInContext (sem list unscoped).
 'src/components/comercial/PedidosRetiradaTab.jsx':[
  [
    'import { Textarea } from "@/components/ui/textarea";\nimport useContextoVisual from "@/components/lib/useContextoVisual";\n',
    'import { Textarea } from "@/components/ui/textarea";\n',
  ],
  [
    '  const queryClient = useQueryClient();\n  const { empresaAtual, grupoAtual, filterInContext } = useContextoVisual();\n  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;\n  const empresaId = empresaAtual?.id || null;\n  const contextoValido = Boolean(groupId || empresaId);\n\n  // Escopo multiempresa: Pedido via filterInContext (sem list unscoped).\n  const { data: pedidos = [], isError: isErrorPedidosRetirada } = useQuery({\n    queryKey: [\'pedidos-retirada\', groupId, empresaId],\n    queryFn: () => filterInContext(\'Pedido\', {}, \'-created_date\', 500),\n    enabled: contextoValido,\n  });\n',
    '  const queryClient = useQueryClient();\n\n  const { data: pedidos = [] } = useQuery({\n    queryKey: [\'pedidos\'],\n    queryFn: () => base44.entities.Pedido.list(\'-created_date\'),\n  });\n',
  ],
  [
    '  if (!contextoValido) {\n    return (\n      <div className={containerClass}>\n        <Card className="border-amber-300 bg-amber-50">\n          <CardContent className="p-4 text-sm text-amber-900">\n            Selecione grupo ou empresa para listar pedidos de retirada.\n          </CardContent>\n        </Card>\n      </div>\n    );\n  }\n\n  return (\n    <div className={containerClass}>\n      {/* Header */}\n      <div className="flex justify-between items-center mb-6">\n        <div>\n          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">\n            <Package className="w-7 h-7 text-green-600" />\n            Pedidos para Retirada\n          </h2>\n          <p className="text-slate-600 text-sm">Pedidos que o cliente irá buscar no local</p>\n        </div>\n      </div>\n      {isErrorPedidosRetirada && (\n        <p className="text-xs text-slate-500 mb-2">Pedidos indisponíveis (erro de carga ≠ zero).</p>\n      )}\n',
    '  return (\n    <div className={containerClass}>\n      {/* Header */}\n      <div className="flex justify-between items-center mb-6">\n        <div>\n          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">\n            <Package className="w-7 h-7 text-green-600" />\n            Pedidos para Retirada\n          </h2>\n          <p className="text-slate-600 text-sm">Pedidos que o cliente irá buscar no local</p>\n        </div>\n      </div>\n',
  ],
 ],
};
export function commandAuditRemainder(file,text){
 text=backupCapabilityRemainder(file,text);
 if(!commandAuditHunks[file])return text;
 let source=financialFileCommandRemainder(file,text).replace(/\r\n/g,'\n');
 for(const [after,before] of commandAuditHunks[file]){
  assert.equal(source.split(after).length,2,file+': exactly one command/audit hunk');source=source.replace(after,before);
 }
 if(file==='src/components/fiscal/ImportarXMLNFe.jsx'){
  assert.ok(source.endsWith('\n')&&!source.endsWith('\n\n'));source=source.slice(0,-1);
 }
 return text.includes('\r\n')?source.replace(/\n/g,'\r\n'):source;
}
