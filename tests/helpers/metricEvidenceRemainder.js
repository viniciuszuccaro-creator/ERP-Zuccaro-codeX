import assert from 'node:assert/strict';

export const resultAnnotation='/** @typedef {{ok: boolean, modo: string, executado: boolean, cancelado?: boolean, acoes?: unknown[]}} AutomacaoResultDefaults */\n/** @overload\n * @param {undefined} [payload]\n * @returns {{ok: boolean, modo: string, executado: boolean}} */\n/** @template {Record<string, unknown>} T\n * @overload\n * @param {T} payload\n * @returns {Omit<AutomacaoResultDefaults, keyof T> & T} */\n/** @param {Record<string, unknown>} [payload] */\n';
export const metricEvidenceHunks={
 'src/components/lib/automacaoAvancadaPolicy.js':[[resultAnnotation,'',1]],
 'src/components/producao/DashboardProducaoRealtime.jsx':[
  ["/** @param {unknown} disponibilidade @param {unknown} performance @param {unknown} qualidade */\nexport function calcularOEE(disponibilidade, performance, qualidade) {\n  if (typeof disponibilidade !== 'number' || typeof performance !== 'number'\n    || typeof qualidade !== 'number') return null;\n  if (![disponibilidade, performance, qualidade].every(value => Number.isFinite(value)\n    && value >= 0 && value <= 100)) return null;\n  return (disponibilidade * performance * qualidade) / 10000;\n}\n\n",'',1],
  ["  /** @type {[{eficienciaGeral: string, opsAtrasadas: number, pesoProducaoHoje: string, tempoMedioProducao: string, taxaRefugo: string, oee: number | null}, React.Dispatch<React.SetStateAction<{eficienciaGeral: string, opsAtrasadas: number, pesoProducaoHoje: string, tempoMedioProducao: string, taxaRefugo: string, oee: number | null}>>]} */\n  const [metricas, setMetricas] = useState({\n    eficienciaGeral: '0',\n    opsAtrasadas: 0,\n    pesoProducaoHoje: '0',\n    tempoMedioProducao: '0',\n    taxaRefugo: '0',\n    oee: null\n  });","  const [metricas, setMetricas] = useState({\n    eficienciaGeral: 0,\n    opsAtrasadas: 0,\n    pesoProducaoHoje: 0,\n    tempoMedioProducao: 0,\n    taxaRefugo: 0,\n    oee: 0\n  });",1],
  ["      // Sem fonte real de disponibilidade, OEE nao e uma medicao disponivel.\n      const oee = calcularOEE(null, eficiencia, 100 - taxaRefugo);","      // OEE simplificado (Overall Equipment Effectiveness)\n      const disponibilidade = 85; // Mock - seria calculado com dados reais de máquinas\n      const performance = eficiencia;\n      const qualidade = 100 - taxaRefugo;\n      const oee = (disponibilidade * performance * qualidade) / 10000;",1],
  ['        oee\n','        oee: oee.toFixed(1)\n',1],
  ['Number(metricas.eficienciaGeral) >= 80','metricas.eficienciaGeral >= 80',1],
  ['Number(metricas.taxaRefugo) <= 3','metricas.taxaRefugo <= 3',2],
  ['Number(metricas.taxaRefugo) > 3','metricas.taxaRefugo > 3',1],
  ["metricas.oee === null ? 'text-slate-400' : metricas.oee >= 75",'metricas.oee >= 75',1],
  ["{metricas.oee === null ? 'Sem dados' : `${metricas.oee.toFixed(1)}%`}",'{metricas.oee}%',1],
  ['metricas.oee !== null && metricas.oee < 75','metricas.oee < 75',1],
  ['metricas.oee !== null && metricas.oee >= 75','metricas.oee >= 75',1],
 ],
};
export function metricEvidenceRemainder(file,text){
 if(!metricEvidenceHunks[file])return text;
 let source=text.replace(/\r\n/g,'\n');
 for(const [after,before,count] of metricEvidenceHunks[file]){
  assert.equal(source.split(after).length,count+1,file+': exact metric/result hunk');source=source.split(after).join(before);
 }
 return text.includes('\r\n')?source.replace(/\n/g,'\r\n'):source;
}
