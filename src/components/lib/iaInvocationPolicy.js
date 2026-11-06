/** @typedef {{groupId?: unknown, empresaId?: unknown, scopeType?: string}} IaContext */
export const firstText = (...values) => values.map((value) => String(value || '').trim()).find(Boolean) || '';

const SENSITIVE_IA_HINTS = [
  'pagar',
  'receber',
  'baixar',
  'baixa',
  'emitir',
  'cancelar nf',
  'estoque',
  'preco',
  'preço',
  'desconto',
  'permissao',
  'permissão',
  'liquidar',
];

export const IA_MODO_SUGESTAO = 'sugestao';

const replaceControlCharacters = (value) => Array.from(value, (character) => {
  const code = character.charCodeAt(0);
  return code <= 31 || code === 127 ? ' ' : character;
}).join('');

export const sanitizeIaPrompt = (value, max = 4000) => String(value ?? '')
  .replace(/[<>]/g, '')
  .replace(/javascript:/gi, '')
  .split('\n')
  .map(replaceControlCharacters)
  .join(' ')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, max);

export const isSensitiveIaExecution = (payload = {}) => {
  if (payload.executar === true || payload.auto_executar === true || payload.aplicar_automaticamente === true) {
    return true;
  }
  const action = `${payload.acao || ''} ${payload.action || ''}`.toLowerCase();
  return SENSITIVE_IA_HINTS.some((hint) => action.includes(hint));
};

/** @param {{payload?: Record<string, unknown>, groupId?: unknown, empresaId?: unknown}} [options] */
export const assertIaInvocation = ({ payload = {}, groupId, empresaId } = {}) => {
  if (!firstText(groupId)) {
    throw new Error('Grupo obrigatorio para IA.');
  }
  if (isSensitiveIaExecution(payload)) {
    throw new Error('IA nao executa acao sensivel. Apenas sugere.');
  }
  return {
    ...payload,
    prompt: sanitizeIaPrompt(payload.prompt),
    group_id: firstText(groupId),
    empresa_id: firstText(empresaId) || null,
    modo: IA_MODO_SUGESTAO,
  };
};


/** Fail-closed UI guard for module IA surfaces (Gate 16 / P2). */
/** @param {IaContext} [options] */
export const assertIaUiContext = ({ groupId, empresaId, scopeType = 'empresa' } = {}) => {
  if (!firstText(groupId)) {
    throw new Error('Grupo obrigatorio para IA.');
  }
  if (scopeType !== 'grupo' && !firstText(empresaId)) {
    throw new Error('Empresa obrigatoria para IA no escopo empresa.');
  }
  return {
    group_id: firstText(groupId),
    empresa_id: firstText(empresaId) || null,
    scopeType: firstText(scopeType) || 'empresa',
    modo: IA_MODO_SUGESTAO,
  };
};


/** Fail-closed context for anomaly scans (financeiro/seguranca). */
/** @param {IaContext} [options] */
export const assertAnomalyScanContext = ({ groupId, empresaId, scopeType = 'empresa' } = {}) => (
  assertIaUiContext({ groupId, empresaId, scopeType })
);


/** Fail-closed context for forecast UIs (caixa, reposicao, recompra, atraso). */
/** @param {IaContext} [options] */
export const assertForecastUiContext = ({ groupId, empresaId, scopeType = 'empresa' } = {}) => (
  assertIaUiContext({ groupId, empresaId, scopeType })
);

/**
 * @template {object} T
 * @overload
 * @param {T} payload
 * @returns {Omit<T, 'modo' | 'fonte'> & {modo: typeof IA_MODO_SUGESTAO, fonte: string}}
 */
/**
 * @overload
 * @returns {{modo: typeof IA_MODO_SUGESTAO, fonte: string}}
 */
/** @param {{fonte?: unknown}} [payload] */
export const stampIaSuggestion = (payload = {}) => ({
  ...payload,
  modo: IA_MODO_SUGESTAO,
  fonte: firstText(payload.fonte) || 'ia_local',
});
