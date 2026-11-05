/** Cache key: Grupo + Empresa + ator + sessão (sem token). */
export function buildItensRevendaProdutosQueryKey(input) {
  return [
    'produtos-revenda',
    input?.groupId || null,
    input?.empresaId || null,
    input?.actorId || null,
    input?.sessionKey || null,
  ];
}

export function isItensRevendaScopeCurrent(expected, live) {
  return (expected?.actorId || null) === (live?.actorId || null)
    && (expected?.sessionKey || null) === (live?.sessionKey || null);
}

/** KPI: loading/erro/sem contexto nunca viram “zero produtos”. */
export function resolveItensRevendaProdutosKpiState(input) {
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

/** Filtra lista por busca (contrato legado descricao/codigo). */
export function filterProdutosRevendaBusca(produtos, search) {
  const rows = Array.isArray(produtos) ? produtos : [];
  const q = String(search || '').toLowerCase();
  if (!q) return rows;
  return rows.filter((p) =>
    p?.descricao?.toLowerCase().includes(q) ||
    p?.codigo?.toLowerCase().includes(q)
  );
}
