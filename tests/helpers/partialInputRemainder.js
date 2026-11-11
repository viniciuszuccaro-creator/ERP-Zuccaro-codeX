import assert from 'node:assert/strict';
export const partialInputHunks={
 'src/components/estoque/ImportadorProdutosPlanilha.jsx':[
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
