import assert from 'node:assert/strict';
export const financialFileCommandAnnotations={
 'src/components/financeiro/GestaoRemessaRetorno.jsx':[
  '/** @type {{bancoId: string, titulosIds: string[]}} */ ',
  '/** @type {File} */ ',
 ],
 'src/components/fiscal/ExportacaoSPED.jsx':[
  '/** @type {{tipoSped: string, periodoInicial: string, periodoFinal: string}} */ ',
 ],
};
export function financialFileCommandRemainder(file,text){
 let source=text;
 for(const annotation of financialFileCommandAnnotations[file]||[]){
  assert.equal(source.split(annotation).length,2,file+': exactly one approved command annotation');
  source=source.replace(annotation,'');
 }
 return source;
}
