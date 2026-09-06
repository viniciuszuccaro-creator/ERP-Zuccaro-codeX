export const normalizeIdentifier = (value) => {
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

export const recordMatchesGroupScope = (record = {}, groupId) => {
  const scopedGroupId = normalizeIdentifier(groupId);
  if (!scopedGroupId || !record) return false;
  const recordGroupId = firstValue(record.group_id, record.grupo_id, record.grupo_empresarial_id);
  return recordGroupId === scopedGroupId;
};

export const empresaPertenceAoGrupo = (empresa, groupId) => recordMatchesGroupScope(empresa, groupId);

export const userTemAcessoGrupo = (user, grupoId) => {
  const id = normalizeIdentifier(grupoId);
  if (!user || !id) return false;
  if (firstValue(user.grupo_atual_id, user.grupo_padrao_id, user.group_id) === id) return true;
  const vinculos = Array.isArray(user.grupos_vinculados) ? user.grupos_vinculados : [];
  return vinculos.some((vinculo) => (
    normalizeIdentifier(vinculo?.grupo_id) === id && vinculo?.ativo !== false
  ));
};

export const userTemAcessoEmpresa = (user, empresa) => {
  const groupId = firstValue(user?.grupo_atual_id, user?.grupo_padrao_id, user?.group_id);
  if (!user || !empresaPertenceAoGrupo(empresa, groupId)) return false;
  const empresaId = normalizeIdentifier(empresa?.id);
  if (!empresaId) return false;
  if (firstValue(user.empresa_atual_id, user.empresa_padrao_id) === empresaId) return true;
  const vinculos = Array.isArray(user.empresas_vinculadas) ? user.empresas_vinculadas : [];
  if (!vinculos.length) return false;
  return vinculos.some((vinculo) => (
    normalizeIdentifier(vinculo?.empresa_id) === empresaId && vinculo?.ativo !== false
  ));
};

export const OPERACAO_EXIGE_EMPRESA_ENTITIES = new Set([
  'Pedido',
  'PedidoExterno',
  'NotaFiscal',
  'NFe',
  'CTe',
  'ContaReceber',
  'ContaPagar',
  'OrdemCompra',
  'SolicitacaoCompra',
  'OrdemProducao',
  'Entrega',
  'MovimentacaoEstoque',
  'CaixaMovimento',
  'ConciliacaoBancaria',
  'Comissao',
]);

export const entityRequiresEmpresaOnWrite = (entityName) => OPERACAO_EXIGE_EMPRESA_ENTITIES.has(entityName);

export const resolveEmpresaIdOnWrite = (record = {}, contextEmpresaId = null) => firstValue(
  record.empresa_id,
  record.empresa_faturamento_id,
  record.empresa_dona_id,
  record.empresa_alocada_id,
  record.empresa_origem_id,
  contextEmpresaId,
);

export const buildMultiempresaReadFilter = ({
  groupId,
  empresaId,
  ctxField = 'empresa_id',
  shared = false,
  rest = {},
  empresaIdsDoGrupo = [],
  extraGroupOr = [],
} = {}) => {
  const scopedGroupId = normalizeIdentifier(groupId);
  const scopedEmpresaId = normalizeIdentifier(empresaId);
  const field = ctxField || 'empresa_id';
  const groupConds = [];
  const empresaConds = [];

  if (scopedGroupId) {
    groupConds.push(
      { group_id: scopedGroupId },
      { grupo_id: scopedGroupId },
      { grupo_empresarial_id: scopedGroupId },
    );
  }

  if (scopedEmpresaId) {
    empresaConds.push({ [field]: scopedEmpresaId });
    if (field !== 'empresa_id') empresaConds.push({ empresa_id: scopedEmpresaId });
    if (shared) {
      empresaConds.push(
        { empresa_dona_id: scopedEmpresaId },
        { empresas_compartilhadas_ids: { $in: [scopedEmpresaId] } },
      );
    }
  } else if (scopedGroupId) {
    const ids = (Array.isArray(empresaIdsDoGrupo) ? empresaIdsDoGrupo : [])
      .map(normalizeIdentifier)
      .filter(Boolean);
    if (ids.length) {
      groupConds.push({ [field]: { $in: ids } });
      if (shared) {
        groupConds.push(
          { empresa_id: { $in: ids } },
          { empresa_dona_id: { $in: ids } },
          { empresas_compartilhadas_ids: { $in: ids } },
        );
      }
    }
    if (Array.isArray(extraGroupOr) && extraGroupOr.length) {
      groupConds.push(...extraGroupOr);
    }
  }

  if (scopedEmpresaId && scopedGroupId) {
    return { ...rest, $and: [{ $or: groupConds }, { $or: empresaConds }] };
  }
  if (scopedEmpresaId) return { ...rest, $or: empresaConds };
  if (scopedGroupId) return { ...rest, $or: groupConds };
  return { ...rest };
};

export const recordMatchesEmpresaScope = (record = {}, empresaId) => {
  const scopedEmpresaId = normalizeIdentifier(empresaId);
  if (!scopedEmpresaId || !record) return false;

  const recordEmpresaId = firstValue(
    record.empresa_id,
    record.empresa_dona_id,
    record.empresa_faturamento_id,
    record.empresa_origem_id,
  );

  if (recordEmpresaId) return recordEmpresaId === scopedEmpresaId;

  const empresasCompartilhadas = Array.isArray(record.empresas_compartilhadas_ids)
    ? record.empresas_compartilhadas_ids.map(normalizeIdentifier).filter(Boolean)
    : [];

  return empresasCompartilhadas.includes(scopedEmpresaId);
};
