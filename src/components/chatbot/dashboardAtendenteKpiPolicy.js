/** Sequência de dias com atividade comprovada (não fabricar streak). */
export function computeDiasConsecutivosAtendente(conversas, refDate = new Date()) {
  const days = new Set();
  for (const c of conversas || []) {
    const raw = c?.data_ultima_mensagem || c?.data_finalizacao || c?.created_date;
    if (!raw) continue;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) continue;
    days.add(d.toDateString());
  }
  let streak = 0;
  const cursor = new Date(refDate);
  cursor.setHours(12, 0, 0, 0);
  for (;;) {
    if (!days.has(cursor.toDateString())) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** Agrega KPIs do atendente — sem amostra → null (DESCONHECIDO), nunca inventa 0/5. */
export function buildMetricasAtendenteFromConversas(conversas, { agora = new Date() } = {}) {
  const hoje = new Date(agora);
  hoje.setHours(0, 0, 0, 0);

  const list = Array.isArray(conversas) ? conversas : [];
  const conversasHoje = list.filter((c) => {
    const raw = c?.data_ultima_mensagem;
    if (!raw) return false;
    return new Date(raw) >= hoje;
  });
  const resolvidasHoje = conversasHoje.filter((c) => c.status === "Resolvida");

  const temposResposta = list
    .filter((c) => c.tempo_primeira_resposta_minutos)
    .map((c) => c.tempo_primeira_resposta_minutos);
  const tempoMedio =
    temposResposta.length > 0
      ? temposResposta.reduce((a, b) => a + b, 0) / temposResposta.length
      : null;

  const avaliacoes = list.filter((c) => c.score_satisfacao);
  const csat =
    avaliacoes.length > 0
      ? avaliacoes.reduce((sum, c) => sum + c.score_satisfacao, 0) / avaliacoes.length
      : null;

  const taxaResolucao =
    conversasHoje.length > 0 ? (resolvidasHoje.length / conversasHoje.length) * 100 : null;

  return {
    conversasHoje: conversasHoje.length,
    resolvidasHoje: resolvidasHoje.length,
    emAndamento: conversasHoje.filter((c) => c.status === "Em Progresso").length,
    tempoMedioResposta: tempoMedio == null ? null : Number(tempoMedio.toFixed(1)),
    csat: csat == null ? null : Number(csat.toFixed(1)),
    taxaResolucao: taxaResolucao == null ? null : Number(taxaResolucao.toFixed(0)),
    totalAvaliacoes: avaliacoes.length,
    diasConsecutivos: computeDiasConsecutivosAtendente(list, agora),
    pontos: resolvidasHoje.length * 10 + Math.round((csat || 0) * 5),
    nivel: Math.floor(list.length / 50) + 1,
  };
}
