import assert from 'node:assert/strict';

const component = name => `src/components/${name}.jsx`;
export const primitiveUiEdits = {
  [component('auditoria/LogsAuditoria')]: [
    ['onCheckedChange={(checked) => setFiltroCritico(checked === true)}', 'onCheckedChange={setFiltroCritico}', 1],
    ['onCheckedChange={(checked) => setShowDescricao(checked === true)}', 'onCheckedChange={setShowDescricao}', 1],
    ['onCheckedChange={(checked) => setShowIP(checked === true)}', 'onCheckedChange={setShowIP}', 1],
  ],
  [component('expedicao/SeparacaoConferencia')]: ['quantidade','qualidade','embalagem','etiquetas','documentos'].map(field => [`conferiu_${field}: v === true`, `conferiu_${field}: v`, 1]),
  [component('expedicao/painel-logistico/ControlsBar')]: [["React.useState(/** @returns {boolean|'sim'} */ () => false)", 'React.useState(false)', 1]],
  'src/pages/Agenda.jsx': [
    ['!Number.isNaN(parsed.getTime())', '!isNaN(parsed)', 1],
    ...['dia_inteiro','lembrete','notificar_email','notificar_whatsapp'].map(field => [`${field}: checked === true`, `${field}: checked`, 1]),
  ],
  'src/pages/Relatorios.jsx': [['ativo: checked === true', 'ativo: checked', 1]],
  [component('chatbot/MonitorSLA')]: ['tfrMedio','trMedio'].map(field => [`Number(metricas.${field}) /`, `metricas.${field} /`, 1]),
  [component('comercial/MonitoramentoCanaisRealtime')]: [['agora.getTime() - ultimaAtualizacao.getTime()', 'agora.getTime() - ultimaAtualizacao', 1]],
  [component('estoque/ControleLotesValidade')]: [['dataValidade.getTime() - hoje.getTime()', 'dataValidade - hoje.getTime()', 1]],
  [component('expedicao/painel-logistico/AlertsPanel')]: ['prev','tsPronto','saida'].map(name => [`now.getTime() - ${name}.getTime()`, `now.getTime() - ${name}`, 1]),
  [component('expedicao/painel-logistico/BottlenecksPanel')]: [['now.getTime() - tsPronto.getTime()', 'now.getTime() - tsPronto', 1]],
  [component('producao/RelatoriosProducao')]: [
    ['Number(variacaoCusto) > 0', 'variacaoCusto > 0', 1],
    ['parseFloat(String(taxaRefugo))', 'parseFloat(taxaRefugo)', 1],
    ['parseFloat(String(variacaoCusto))', 'parseFloat(variacaoCusto)', 4],
  ],
  [component('portal/ChamadosCliente')]: [['!isNaN(Number(nota)) && Number(nota) >= 1 && Number(nota) <= 5', '!isNaN(nota) && nota >= 1 && nota <= 5', 1]],
  [component('chatbot/DashboardAtendente')]: [['parseFloat(String(metricas.tempoMedioResposta || 1))', 'parseFloat(metricas.tempoMedioResposta || 1)', 1]],
  [component('crm/FunilVendasAvancado')]: [['Number(metricas.taxaConversao) >= 20', 'metricas.taxaConversao >= 20', 2]],
  'src/pages/DashboardCorporativo.jsx': [['parseFloat(String(otd))', 'parseFloat(otd)', 1]],
  ...Object.fromEntries(['cadastros/DashboardCanaisOrigem','cadastros/HistoricoProduto'].map(name => [component(name), [["typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : '-'", 'value.toFixed(2)', 1]]])),
  [component('producao/DashboardRefugoIA')]: [["typeof value === 'number' && Number.isFinite(value) ? value.toFixed(1) : '-'", 'value.toFixed(1)', 2]],
};

export function primitiveUiBoundaryRemainder(file, source) {
  const edits = primitiveUiEdits[file]; if (!edits) return source;
  for (const [after, before, count] of edits) {
    assert.equal(source.split(after).length - 1, count, `Exact stage45 boundary count: ${file}: ${after}`);
    source = source.split(after).join(before);
  }
  return source;
}
