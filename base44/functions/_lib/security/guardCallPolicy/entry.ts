const firstValue = (...values) => values.find((value) => value !== undefined && value !== null && value !== '');

export const normalizeGuardCallScope = (input = {}) => {
  const groupId = firstValue(input.groupId, input.group_id, input.grupoId, input.grupo_id) || null;
  const empresaId = firstValue(input.empresaId, input.empresa_id, input.companyId, input.company_id) || null;
  const scopeType = empresaId ? 'empresa' : (groupId ? 'grupo' : null);
  return { groupId, empresaId, scopeType };
};

export const completeGuardCallScope = async (base44, input = {}) => {
  const scope = normalizeGuardCallScope(input);
  if (scope.empresaId && !scope.groupId) {
    try {
      const empresas = await base44.asServiceRole.entities.Empresa.filter({ id: scope.empresaId }, undefined, 1);
      const empresa = Array.isArray(empresas) ? empresas[0] : null;
      scope.groupId = empresa?.group_id || empresa?.grupo_id || null;
    } catch (error) {
      return {
        groupId: null,
        empresaId: scope.empresaId,
        scopeType: 'empresa',
        error: error?.message || 'empresa_lookup_failed',
      };
    }
  }
  return scope;
};

export const recordMatchesGuardScope = (record = {}, input = {}) => {
  const scope = normalizeGuardCallScope(input);
  const recordGroupId = firstValue(record.group_id, record.grupo_id) || null;
  const recordEmpresaId = firstValue(
    record.empresa_id,
    record.empresa_dona_id,
    record.empresa_faturamento_id,
    record.empresa_origem_id,
  ) || null;

  if (!scope.groupId || !recordGroupId || scope.groupId !== recordGroupId) return false;
  if (scope.scopeType === 'empresa') return Boolean(recordEmpresaId && recordEmpresaId === scope.empresaId);
  return true;
};

export const requireEntityGuard = async (base44, payload = {}, functionsApi = null) => {
  const scope = await completeGuardCallScope(base44, payload);
  if (!scope.groupId || (scope.scopeType === 'empresa' && !scope.empresaId)) {
    return Response.json({ error: 'Contexto multiempresa incompleto' }, { status: 400 });
  }

  try {
    const api = functionsApi || base44.functions;
    const guard = await api.invoke('entityGuard', {
      ...payload,
      group_id: scope.groupId,
      empresa_id: scope.empresaId,
      scope_type: scope.scopeType,
    });
    if (guard?.data?.allowed !== true) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    return null;
  } catch {
    return Response.json({ error: 'Guard de acesso indisponivel' }, { status: 503 });
  }
};
