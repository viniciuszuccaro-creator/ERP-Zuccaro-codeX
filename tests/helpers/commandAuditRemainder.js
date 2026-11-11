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
