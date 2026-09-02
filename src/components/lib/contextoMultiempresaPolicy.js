const normalizeIdentifier = (value) => {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized || null;
};

const firstValue = (...values) => values.map(normalizeIdentifier).find(Boolean) || null;

export const normalizeScopeType = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (['grupo', 'group'].includes(normalized)) return 'grupo';
  if (['empresa', 'company'].includes(normalized)) return 'empresa';
  return null;
};

export const normalizeMultiempresaContext = (input = {}) => {
  const groupId = firstValue(input.groupId, input.group_id, input.grupoId, input.grupo_id) || null;
  const rawEmpresaId = firstValue(input.empresaId, input.empresa_id, input.companyId, input.company_id) || null;
  const inferredScope = rawEmpresaId ? 'empresa' : (groupId ? 'grupo' : null);
  const scopeType = normalizeScopeType(firstValue(input.scopeType, input.scope_type, input.contexto)) || inferredScope;

  return {
    groupId,
    empresaId: scopeType === 'grupo' ? null : rawEmpresaId,
    scopeType,
  };
};

export const validateMultiempresaContext = (input = {}) => {
  const context = normalizeMultiempresaContext(input);
  let error = null;

  if (!context.scopeType) error = 'Tipo de contexto multiempresa obrigatório';
  else if (!context.groupId) error = 'Grupo obrigatório no contexto multiempresa';
  else if (context.scopeType === 'empresa' && !context.empresaId) error = 'Empresa obrigatória no contexto de empresa';

  return { ...context, valid: !error, error };
};

export const toEntityScope = (input = {}) => {
  const context = validateMultiempresaContext(input);
  if (!context.valid) return {};
  return {
    group_id: context.groupId,
    ...(context.scopeType === 'empresa' ? { empresa_id: context.empresaId } : {}),
  };
};

export const toGuardScope = (input = {}) => {
  const context = validateMultiempresaContext(input);
  return {
    group_id: context.groupId,
    empresa_id: context.empresaId,
    scope_type: context.scopeType,
    __blocked: !context.valid,
    __error: context.error,
  };
};
