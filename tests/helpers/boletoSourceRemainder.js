import assert from 'node:assert/strict';
export const boletoSourceFile='src/components/chatbot/GerarBoletoChat.jsx';
export const boletoSourceHunks=[
 ['    mutationFn: async (/** @type {Record<string, unknown>} */ titulo) => {\n      if (!titulo || typeof titulo !== \'object\' || Array.isArray(titulo)\n        || typeof titulo.id !== \'string\' || !titulo.id.trim()) throw new Error("Selecione um titulo financeiro.");','    mutationFn: async (titulo) => {\n      if (!titulo?.id) throw new Error("Selecione um titulo financeiro.");'],
 ['Disponibilizar boleto existente e registrar na conversa? Esta acao sera auditada.','Gerar 2a via de boleto e registrar o envio na conversa? Esta acao sera auditada.'],
 ['      const linhaDigitavel = sanitizeLinhaDigitavel(titulo.linha_digitavel);\n      const urlBoleto = sanitizeText(titulo.url_boleto_pdf || titulo.boleto_url);\n      if (!/\\d/.test(linhaDigitavel) || !urlBoleto) {\n        await auditBoletoChat("bloqueado_boleto_indisponivel", false, { titulo_id: titulo.id });\n        throw new Error("Boleto indisponivel: aguarde os dados da emissao bancaria.");\n      }','      const linhaDigitavel = sanitizeLinhaDigitavel(titulo.linha_digitavel)\n        || `23793.38128 60000.000003 00000.000409 1 ${Math.random().toString().slice(2, 16)}`;\n      const urlBoleto = sanitizeText(titulo.url_boleto_pdf || titulo.boleto_url)\n        || `https://boleto.exemplo.com/${encodeURIComponent(titulo.id)}`;'],
 ['Boleto existente disponibilizado.','Boleto gerado com sucesso!'],
 ['                        Disponibilizar 2a Via','                        Gerar 2a Via'],
];
export function boletoSourceRemainder(file,text){
 if(file!==boletoSourceFile)return text;
 let source=text.replace(/\r\n/g,'\n');
 for(const [after,before] of boletoSourceHunks){
  assert.equal(source.split(after).length,2,'exactly one approved boleto source hunk');source=source.replace(after,before);
 }
 return text.includes('\r\n')?source.replace(/\n/g,'\r\n'):source;
}
