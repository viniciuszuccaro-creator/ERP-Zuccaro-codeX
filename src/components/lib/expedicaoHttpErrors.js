/**
 * Mensagens de erro do BFF Expedição para UI (fail-closed, sem vazar stack/segredos).
 * @param {unknown} error
 * @returns {string}
 */
export function formatExpedicaoHttpError(error) {
  if (!error) return 'Falha na operacao de Expedicao.';
  const code = String(error.code || error?.body?.error?.code || '').trim();
  const status = Number(error.status || 0);
  const message = String(error.message || error?.body?.error?.message || '').trim();

  const byCode = {
    ESTOQUE_SIDE_EFFECT_FAILED: 'Falha no side-effect de estoque. Nenhuma expedicao foi confirmada (rollback).',
    ENTREGA_NOT_FOUND: 'Entrega nao encontrada neste grupo/empresa.',
    ROMANEIO_NOT_FOUND: 'Romaneio nao encontrado neste grupo/empresa.',
    ENTREGA_STATE_CONFLICT: 'Estado da entrega nao permite esta acao.',
    SEPARACAO_QTY_INVALID: 'Quantidade separada invalida.',
    VALIDATION_ERROR: 'Dados invalidos. Revise o formulario.',
    FORBIDDEN: 'Permissao insuficiente para esta acao.',
    TENANT_SCOPE_REQUIRED: 'Selecione grupo e empresa antes de continuar.',
    AUTH_REQUIRED: 'Sessao nao autenticada. Faca login novamente.',
  };

  if (code && byCode[code]) return byCode[code];
  if (status === 403) return 'Permissao insuficiente para esta acao.';
  if (status === 404) return 'Registro nao encontrado neste grupo/empresa.';
  if (status === 409) return 'Conflito de estado. Recarregue e tente novamente.';
  if (status === 422) return message || 'Dados invalidos. Revise o formulario.';
  if (status === 502) return message || 'Falha intermediaria no backend. Estado preservado sem falso sucesso.';
  if (message && !/postgresql|stack|token|bearer|password/i.test(message)) return message;
  return 'Falha na operacao de Expedicao. Tente novamente ou contate o suporte.';
}

/**
 * @param {unknown} value
 * @returns {string|null}
 */
export function asUuidOrNull(value) {
  const raw = String(value || '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw)) {
    return null;
  }
  return raw;
}

/**
 * Payload create Entrega canônico a partir do formulário SPA.
 * @param {Record<string, any>} form
 * @returns {Record<string, unknown>}
 */
export function mapEntregaFormToHttpCreate(form) {
  const itensSource = Array.isArray(form?.itens) && form.itens.length
    ? form.itens
    : [{ descricao: form?.cliente_nome ? `Entrega ${form.cliente_nome}` : 'Item', unidade: 'UN', quantidade: 1 }];
  const itens = itensSource.map((item) => ({
    produto_id: asUuidOrNull(item.produto_id),
    descricao: String(item.descricao || item.produto_descricao || 'Item').trim() || 'Item',
    unidade_sigla: String(item.unidade_sigla || item.unidade || item.unidade_medida || 'UN').trim() || 'UN',
    quantidade_pedida: item.quantidade_pedida ?? item.quantidade ?? 1,
  }));
  const toDatetime = (value) => {
    if (!value) return null;
    const raw = String(value).trim();
    if (!raw) return null;
    if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) return raw;
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return `${raw}T12:00:00.000Z`;
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  };
  const tipo = String(form?.tipo_frete || 'ENTREGA').toUpperCase();
  return {
    pedido_id: asUuidOrNull(form?.pedido_id),
    pedido_numero: form?.numero_pedido || form?.pedido_numero || null,
    cliente_id: asUuidOrNull(form?.cliente_id),
    cliente_nome: form?.cliente_nome || null,
    cliente_empresa_id: asUuidOrNull(form?.cliente_empresa_id),
    cliente_local_id: asUuidOrNull(form?.cliente_local_id),
    tipo_frete: tipo === 'RETIRADA' ? 'RETIRADA' : 'ENTREGA',
    data_entrega_solicitada: toDatetime(form?.data_entrega_solicitada),
    data_previsao: toDatetime(form?.data_previsao),
    cidade: form?.cidade || form?.endereco_entrega_completo?.cidade || null,
    endereco: form?.endereco_entrega_completo && typeof form.endereco_entrega_completo === 'object'
      ? form.endereco_entrega_completo
      : {},
    observacoes: form?.observacoes || undefined,
    volumes: form?.volumes,
    itens,
    idempotency_key: form?.idempotency_key || `ent-form:${form?.pedido_id || form?.numero_pedido || 'new'}:${form?.empresa_id || 'e'}`,
  };
}
