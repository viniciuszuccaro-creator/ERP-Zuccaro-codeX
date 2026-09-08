const firstText = (...values) => values.map((value) => String(value || '').trim()).find(Boolean) || '';

/** Fail-closed: automacao exige grupo; empresa obrigatoria no escopo empresa. */
export const assertAutomacaoContext = ({ groupId, empresaId, scopeType = 'empresa' } = {}) => {
  if (!firstText(groupId)) {
    throw new Error('Grupo obrigatorio para automacao.');
  }
  if (scopeType !== 'grupo' && !firstText(empresaId)) {
    throw new Error('Empresa obrigatoria para automacao no escopo empresa.');
  }
  return {
    group_id: firstText(groupId),
    empresa_id: firstText(empresaId) || null,
    scopeType: scopeType === 'grupo' ? 'grupo' : 'empresa',
  };
};

/** Escopo de varredura de cobranca: exige group_id e/ou empresa_id; nunca varre tudo. */
export const resolveCobrancaScanScope = ({ groupId = null, empresaId = null } = {}) => {
  const group_id = firstText(groupId) || null;
  const empresa_id = firstText(empresaId) || null;
  if (!group_id && !empresa_id) {
    throw new Error('group_id ou empresa_id obrigatorio para lembretes de cobranca.');
  }
  return { group_id, empresa_id, modo: 'escopo_explicito' };
};

/** ConfiguracaoNFe: emitir_automatico so quando ativo e flag true. */
export const isEmitirAutomaticoEnabled = (configs = []) => {
  const list = Array.isArray(configs) ? configs : (configs ? [configs] : []);
  return list.some((cfg) => {
    if (!cfg || cfg.ativo === false) return false;
    return cfg.emitir_automatico === true || cfg.emitir_automaticamente === true;
  });
};

export const stampAutomacaoResult = (payload = {}) => ({
  ok: payload.ok !== false,
  modo: firstText(payload.modo) || 'sugestao',
  executado: payload.executado === true,
  ...payload,
});

/** Confirmacao humana para disparo massivo/critico na UI. */
export const requireAutomacaoHumanConfirm = (mensagem) => {
  if (typeof window === 'undefined' || typeof window.confirm !== 'function') {
    return false;
  }
  return Boolean(window.confirm(String(mensagem || 'Confirmar execucao da automacao?')));
};
