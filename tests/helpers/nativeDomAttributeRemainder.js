import assert from 'node:assert/strict';

export const nativeDomEdits = {
  'src/components/comercial/FechamentoFinanceiroTab.jsx': [['rows',2,1],['rows',3,3]],
  'src/components/comercial/LogisticaEntregaTab.jsx': [['rows',4,1]],
  'src/components/financeiro/CartoesACompensar.jsx': [['colSpan',11,1]],
  'src/components/integracoes/TesteTransportadoras.jsx': [['maxLength',9,2]],
  'src/components/producao/DocumentosProducao.jsx': [['colSpan',3,1],['colSpan',2,1]],
  'src/components/expedicao/RoteirizacaoInteligente.jsx': [['colSpan',9,1]],
};

export function nativeDomAttributeRemainder(file, source) {
  for (const [name,value,count] of nativeDomEdits[file] || []) {
    const current = `${name}={${value}}`;
    assert.equal(source.split(current).length - 1, count, `${file}: exact ${current} count`);
    source = source.replaceAll(current, `${name}="${value}"`);
  }
  return source;
}
