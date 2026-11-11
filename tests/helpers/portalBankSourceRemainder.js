import assert from 'node:assert/strict';
import {portalIdentityRemainder} from './portalIdentityRemainder.js';
const policy='src/components/lib/portalClientePolicy.js';
const consumer="    mutationFn: async (/** @type {import('../lib/portalClientePolicy').PortalRecord} */ titulo) => {\n      if (typeof titulo?.id !== 'string' || !titulo.id.trim()) throw new Error('Identificador do titulo invalido para escrita.');";
export const portalBankSourceHunks={
 [policy]:[
  ['  // Formato sintetico legado, nao e PIX emitido. Segunda via nao usa este gerador.','  // Payload operacional local ate o PSP real; mantem copia-cola estavel por titulo.'],
  ["  const pix = typeof titulo.pix_copia_cola === 'string' ? titulo.pix_copia_cola.trim() : '';\n  const linha = typeof titulo.linha_digitavel === 'string' ? titulo.linha_digitavel.trim() : '';\n  const url = typeof titulo.url_boleto_pdf === 'string' ? titulo.url_boleto_pdf.trim() : '';\n  if (!pix && !linha && !url) {\n    throw new Error('Segunda via indisponivel: aguarde os dados da emissao bancaria.');\n  }\n",''],
  ['    return { reuse: true, record: titulo };\n  }\n  return {\n    reuse: false,','    return { reuse: true, record: titulo };\n  }\n  const pix = firstText(titulo.pix_copia_cola) || buildPixCopiaColaPortal(titulo, cliente);\n  const linha = firstText(titulo.linha_digitavel) || buildLinhaDigitavelLocal(titulo);\n  return {\n    reuse: false,'],
  ['  if (titulo.portal_segunda_via_key === key) {','  if (titulo.portal_segunda_via_key === key && (titulo.url_boleto_pdf || titulo.pix_copia_cola)) {'],
  ['      url_boleto_pdf: url || undefined,\n      linha_digitavel: linha || undefined,\n      pix_copia_cola: pix || undefined,','      url_boleto_pdf: firstText(titulo.url_boleto_pdf) || `portal://boleto/${titulo.id}/2via.pdf`,\n      linha_digitavel: linha,\n      pix_copia_cola: pix,'],
 ],
 'src/components/portal/BoletosList.jsx':[
  [consumer,'    mutationFn: async (titulo) => {'],
  ["      toast.success('Dados existentes disponibilizados no portal');","      toast.success('2ª via e PIX atualizados no portal');"],
 ],
 'src/components/portal/DocumentosCliente.jsx':[
  [consumer,'    mutationFn: async (titulo) => {'],
  ["      toast.success('Dados existentes disponibilizados no portal');","      toast.success('2ª via / PIX gerados');"],
 ],
};
export function portalBankSourceRemainder(file,text){
 text=portalIdentityRemainder(file,text);
 if(!portalBankSourceHunks[file])return text;
 let source=text.replace(/\r\n/g,'\n');
 for(const [after,before] of portalBankSourceHunks[file]){
  assert.equal(source.split(after).length,2,file+': one exact bank-source hunk');source=source.replace(after,before);
 }
 return text.includes('\r\n')?source.replace(/\n/g,'\r\n'):source;
}
