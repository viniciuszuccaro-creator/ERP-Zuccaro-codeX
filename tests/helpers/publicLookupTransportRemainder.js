import assert from 'node:assert/strict';
import {publicLookupSuggestionRemainder} from './publicLookupSuggestionRemainder.js';
export const publicLookupTransportFile = 'src/components/lib/BuscaDadosPublicos.jsx';
export const publicLookupTransportAfter = "    const response = await base44.functions.invoke('ConsultarCNPJ', { cnpj: cnpjLimpo });\n    const resultado = response?.data;";
export const publicLookupTransportBefore = '    const resultado = await base44.functions.ConsultarCNPJ({ cnpj: cnpjLimpo });';
export function publicLookupTransportRemainder(file, text) {
  if (file !== publicLookupTransportFile) return text;
  let source = publicLookupSuggestionRemainder(file, text).replace(/\r\n/g, '\n');
  assert.equal(source.split(publicLookupTransportAfter).length, 2, 'one exact public function invocation hunk');
  source = source.replace(publicLookupTransportAfter, publicLookupTransportBefore);
  return text.includes('\r\n') ? source.replace(/\n/g, '\r\n') : source;
}
