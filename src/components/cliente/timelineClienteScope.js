/** Cache key: cliente + limite + Grupo + Empresa + ator + sessão. */
export function buildTimelineClienteQueryKey(namespace, input) {
  return [
    namespace,
    input?.clienteId || null,
    input?.limite ?? null,
    input?.limitarModulo || null,
    input?.limitarReferencia || null,
    input?.groupId || null,
    input?.empresaId || null,
    input?.actorId || null,
    input?.sessionKey || null,
  ];
}

export function isTimelineClienteScopeCurrent(expected, live) {
  return (expected?.actorId || null) === (live?.actorId || null)
    && (expected?.sessionKey || null) === (live?.sessionKey || null);
}

/** KPI: loading/erro/sem contexto nunca viram “0 eventos”. */
export function resolveTimelineClienteKpiState(input) {
  const contextoValido = Boolean(input?.contextoValido);
  const hasClienteId = Boolean(input?.clienteId);
  const isLoading = Boolean(input?.isLoading);
  const isError = Boolean(input?.isError);
  const isFetching = Boolean(input?.isFetching);
  const dataDefined = Boolean(input?.dataDefined);
  if (!contextoValido || !hasClienteId) return 'unavailable';
  if (isError) return 'error';
  if (isLoading || (isFetching && !dataDefined)) return 'loading';
  return 'ready';
}

export function countTimelineEventosPorModuloTipo(eventos, modulo, tipo) {
  const rows = Array.isArray(eventos) ? eventos : [];
  return rows.filter((e) => e?.modulo_origem === modulo && e?.tipo_evento === tipo).length;
}

export function countTimelineComunicacoes(eventos) {
  const rows = Array.isArray(eventos) ? eventos : [];
  return rows.filter((e) => e?.whatsapp_envio || e?.email_envio).length;
}

export function diasDesdeUltimoEvento(eventos, now = new Date()) {
  const rows = Array.isArray(eventos) ? eventos : [];
  const ultimo = rows[0];
  if (!ultimo?.data_evento) return null;
  const ref = now instanceof Date ? now : new Date(now);
  return Math.floor((ref.getTime() - new Date(ultimo.data_evento).getTime()) / (1000 * 60 * 60 * 24));
}
