/** @typedef {Record<string, unknown>} LocalRecord */

const MUTATING_AUDIT_ACTIONS = new Set(['criar', 'editar', 'excluir']);

/** @param {unknown} value */
const normalizeId = (value) => String(value || '').trim();

/** @param {unknown} value */
const normalizeAuditIdentifier = (value, fallback = null) => {
  const normalized = String(value || '')
    .trim()
    .replace(/[^A-Za-z0-9_. -]/g, '')
    .replace(/^\.+/, '')
    .slice(0, 100);
  return normalized || fallback;
};

/**
 * @param {unknown} links
 * @param {string} id
 * @param {'group' | 'company'} type
 */
const hasActiveLink = (links, id, type) => Array.isArray(links) && links.some((link) => {
  if (typeof link === 'string') return normalizeId(link) === id;
  if (!link || typeof link !== 'object' || link.ativo === false) return false;
  const linkedId = type === 'group'
    ? link.grupo_id || link.group_id || link.id
    : link.empresa_id || link.company_id || link.id;
  return normalizeId(linkedId) === id;
});

/**
 * Valida ownership do escopo contra os cadastros e vinculos locais existentes.
 * @param {{ groupId: unknown, empresaId: unknown, scopeType: unknown }} context
 * @param {{ user?: LocalRecord | null, groups?: LocalRecord[], companies?: LocalRecord[] }} scopeData
 */
export const evaluateLocalGuardScope = (context, scopeData = {}) => {
  const groupId = normalizeId(context.groupId);
  const empresaId = normalizeId(context.empresaId);
  const user = scopeData.user;
  if (!user) return { allowed: false, reason: 'usuario-local-ausente' };

  const groupExists = (scopeData.groups || []).some((group) => normalizeId(group.id) === groupId);
  if (!groupExists) return { allowed: false, reason: 'grupo-nao-encontrado' };

  const groupAllowed = hasActiveLink(user.grupos_vinculados, groupId, 'group')
    || normalizeId(user.grupo_atual_id) === groupId
    || normalizeId(user.grupo_padrao_id) === groupId;
  if (!groupAllowed) return { allowed: false, reason: 'grupo-nao-autorizado' };

  if (context.scopeType === 'grupo') {
    return user.pode_operar_em_grupo === false
      ? { allowed: false, reason: 'operacao-em-grupo-negada' }
      : { allowed: true, reason: 'escopo-grupo-autorizado' };
  }

  const company = (scopeData.companies || []).find((item) => normalizeId(item.id) === empresaId);
  if (!company) return { allowed: false, reason: 'empresa-nao-encontrada' };
  const companyGroupId = normalizeId(company.group_id || company.grupo_id || company.grupo_empresarial_id);
  if (companyGroupId !== groupId) return { allowed: false, reason: 'empresa-fora-do-grupo' };

  const companyAllowed = user.pode_ver_todas_empresas === true
    || hasActiveLink(user.empresas_vinculadas, empresaId, 'company')
    || normalizeId(user.empresa_atual_id) === empresaId
    || normalizeId(user.empresa_padrao_id) === empresaId;
  return companyAllowed
    ? { allowed: true, reason: 'escopo-empresa-autorizado' }
    : { allowed: false, reason: 'empresa-nao-autorizada' };
};

/**
 * Executa o guard local usando o mesmo contrato publico do dispatcher.
 * @param {LocalRecord} payload
 * @param {{
 *   normalizeAction: (action: unknown) => string,
 *   validateContext: (payload: LocalRecord) => { valid: boolean, error?: string | null, groupId: unknown, empresaId: unknown, scopeType: unknown },
 *   evaluatePermission: (payload: LocalRecord) => { allowed: boolean, reason?: string },
 *   loadScopeData: () => { user?: LocalRecord | null, groups?: LocalRecord[], companies?: LocalRecord[] },
 *   auditDenied: (entityName: string, action: string, recordId?: unknown) => void,
 * }} dependencies
 */
export const runLocalEntityGuard = (payload = {}, dependencies) => {
  const context = dependencies.validateContext(payload);
  const action = dependencies.normalizeAction(payload.action);
  const entityName = normalizeAuditIdentifier(
    payload.entity_name || payload.entityName || payload.function_name || payload.module,
    'EntityGuard',
  );
  const recordId = normalizeAuditIdentifier(payload.record_id || payload.recordId);

  const deny = (reason) => {
    dependencies.auditDenied(entityName, action, recordId);
    return {
      data: {
        allowed: false,
        can: false,
        permitido: false,
        local: true,
        reason,
      },
    };
  };

  if (!context.valid) return deny(context.error || 'contexto-invalido');
  const scopeAccess = evaluateLocalGuardScope(context, dependencies.loadScopeData());
  if (!scopeAccess.allowed) return deny(scopeAccess.reason);
  if (entityName === 'AuditLog' && MUTATING_AUDIT_ACTIONS.has(action)) {
    return deny('audit-log-immutable');
  }

  const result = dependencies.evaluatePermission({ ...payload, action });
  if (!result.allowed) return deny(result.reason || 'permission-denied');
  return {
    data: {
      allowed: true,
      can: true,
      permitido: true,
      local: true,
      reason: result.reason || null,
    },
  };
};
