import assert from 'node:assert/strict';
export const partialInputHunks={
 'src/components/estoque/ImportadorProdutosPlanilha.jsx':[
  ["  // Escopo multiempresa: Grupo/Empresa via filterInContext (não list unscoped).\n  const { data: grupos = [], isError: isErrorGruposImportador } = useQuery({\n    queryKey: ['grupos-empresariais', contextoGrupoId],\n    queryFn: () => filterInContext('GrupoEmpresarial', {}, 'nome', 500),\n    enabled: Boolean(contextoGrupoId || empresaAtual?.id),\n    staleTime: 300000,\n  });\n  const { data: empresas = [], isError: isErrorEmpresasImportador } = useQuery({\n    queryKey: ['empresas-por-grupo', contextoGrupoId, grupoId],\n    queryFn: async () => {\n      // Fail-closed: filterInContext (nunca Empresa.list unscoped).\n      if (grupoId) {\n        return filterInContext('Empresa', { group_id: grupoId }, 'razao_social', 500);\n      }\n      return filterInContext('Empresa', {}, 'razao_social', 500);\n    },\n    enabled: Boolean(contextoGrupoId || empresaAtual?.id),\n    staleTime: 60000,\n    refetchOnWindowFocus: true,\n    refetchOnReconnect: true,\n  });\n\n","  const { data: grupos = [] } = useQuery({\n    queryKey: ['grupos-empresariais'],\n    queryFn: () => base44.entities.GrupoEmpresarial.list(),\n    staleTime: 300000,\n  });\n  const { data: empresas = [] } = useQuery({\n    queryKey: ['empresas-por-grupo', grupoId],\n    queryFn: async () => {\n      // Garantir que o grupo selecionado existe e recarregar quando trocar\n      if (!grupoId) return base44.entities.Empresa.list();\n      // Alguns clientes usam campos diferentes (group_id vs grupo_id)\n      const [byGroup, byGrupo, byGroupExact] = await Promise.all([\n        base44.entities.Empresa.filter({ group_id: grupoId }),\n        base44.entities.Empresa.filter({ grupo_id: grupoId }),\n        base44.entities.Empresa.filter({ groupId: grupoId }),\n      ]);\n      const merged = [...(byGroup || []), ...(byGrupo || []), ...(byGroupExact || [])];\n      // dedup por id\n      const map = new Map();\n      merged.forEach(e => { if (e?.id) map.set(e.id, e); });\n      const arr = Array.from(map.values());\n      return arr.length ? arr : [];\n    },\n    staleTime: 60000,\n    refetchOnWindowFocus: true,\n    refetchOnReconnect: true,\n  });\n\n",1],
  ["        {(isErrorGruposImportador || isErrorEmpresasImportador) && (\n          <p className=\"text-xs text-slate-500\">Masters de grupo/empresa indisponíveis (erro de carga ≠ zero).</p>\n        )}\n        <div className=\"grid gap-3 sm:grid-cols-2\">\n","        <div className=\"grid gap-3 sm:grid-cols-2\">\n",1],
  ['/** @param {string[]} [headers] */\nconst autoMapFromHeaders','const autoMapFromHeaders',1],
  ['  /** @type {Record<string, string>} */\n  const result = {};','  const result = {};',1],
  ['  /** @type {[Record<string, string>, React.Dispatch<React.SetStateAction<Record<string, string>>>]} */\n','',1],
  ["        const output = r !== null && typeof r === 'object' && 'output' in r ? r.output : null;\n        const arr = Array.isArray(output) ? output : [];",'        const arr = Array.isArray(r?.output) ? r.output : [];',1],
  ["        const out = r2 !== null && typeof r2 === 'object' && 'output' in r2 ? r2.output || {} : {};",'        const out = r2?.output || {};',1],
  ['      const dataRows = rows.filter(() => !isHeaderRow());','      const dataRows = rows.filter((r) => !isHeaderRow(r));',2],
 ],
 'src/components/rh/PontoTab.jsx':[
  ['        if (!data.entrada_manha || !data.saida_tarde) return { horas_trabalhadas: undefined, horas_extras: undefined };','        if (!data.entrada_manha || !data.saida_tarde) return 0;',1],
 ],
};
export function partialInputRemainder(file,text){
 if(!partialInputHunks[file])return text;
 let source=text.replace(/\r\n/g,'\n');
 for(const [after,before,count] of partialInputHunks[file]){
  assert.equal(source.split(after).length-1,count,file+': exact partial-input hunk count');source=source.split(after).join(before);
 }
 return text.includes('\r\n')?source.replace(/\n/g,'\r\n'):source;
}
