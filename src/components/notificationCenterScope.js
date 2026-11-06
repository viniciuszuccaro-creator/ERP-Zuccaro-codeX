/** Cache key: Grupo + Empresa + ator + sessão. */
export function buildNotificationCenterQueryKey(input) {
  return [
    'notificacoes',
    input?.groupId || null,
    input?.empresaId || null,
    input?.actorId || null,
    input?.sessionKey || null,
  ];
}

export function isNotificationCenterScopeCurrent(expected, live) {
  return (expected?.actorId || null) === (live?.actorId || null)
    && (expected?.sessionKey || null) === (live?.sessionKey || null);
}

/** KPI: loading/erro/sem contexto nunca viram badge “0”. */
export function resolveNotificationCenterKpiState(input) {
  const contextoValido = Boolean(input?.contextoValido);
  const isLoading = Boolean(input?.isLoading);
  const isError = Boolean(input?.isError);
  const isFetching = Boolean(input?.isFetching);
  const dataDefined = Boolean(input?.dataDefined);
  if (!contextoValido) return 'unavailable';
  if (isError) return 'error';
  if (isLoading || (isFetching && !dataDefined)) return 'loading';
  return 'ready';
}

/** Preserva filtro legado: não arquivada e destinatário vazio ou igual ao e-mail do ator. */
export function filterNotificacoesVisiveis(rows, actorEmail) {
  const list = Array.isArray(rows) ? rows : [];
  const email = typeof actorEmail === 'string' ? actorEmail.trim().toLowerCase() : '';
  return list.filter((n) => {
    if (n?.arquivada) return false;
    const dest = typeof n?.destinatario_email === 'string' ? n.destinatario_email.trim().toLowerCase() : '';
    if (!dest) return true;
    if (!email) return false;
    return dest === email;
  });
}

export function countNotificacoesNaoLidas(rows) {
  const list = Array.isArray(rows) ? rows : [];
  return list.filter((n) => !n?.lida).length;
}
