import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { sanitizeAuditPayload } from "@/components/lib/sanitizeOnWrite";

let _cachedUser = null;
const reportUIAuditFailure = (operation, error, context = {}) => {
  console.error('[uiAudit] ' + operation, {
    error: error?.message || String(error),
    ...context,
  });
};

async function getUserSafe() {
  try {
    if (_cachedUser) return _cachedUser;
    _cachedUser = await base44.auth.me();
    return _cachedUser;
  } catch (error) {
    reportUIAuditFailure('Falha ao carregar usuario', error);
    return null;
  }
}

function getContextSafe() {
  try {
    const empresa_id = typeof localStorage !== 'undefined' ? localStorage.getItem('empresa_atual_id') : null;
    const group_id = typeof localStorage !== 'undefined' ? localStorage.getItem('group_atual_id') : null;
    return { empresa_id, group_id };
  } catch (error) {
    reportUIAuditFailure('Falha ao carregar contexto', error);
    return {};
  }
}

// Minimal, resilient audit logger (non-blocking) + visual feedback
export function logUIAction({ component, action, status, meta }) {
  // Visual feedback minimal por status
  try {
    if (status === 'start') {
      // noop (evitar ruído)
    } else if (status === 'success' && meta?.toastSuccess) {
      try { toast.success(`${action} concluído`); } catch (error) { reportUIAuditFailure('Falha ao exibir confirmacao', error, { action }); }
    } else if (status === 'error') {
      try { toast.error(`Falha em ${action}`, { description: meta?.error || '' }); } catch (error) { reportUIAuditFailure('Falha ao exibir erro', error, { action }); }
    }
  } catch (error) { reportUIAuditFailure('Falha no feedback visual', error, { action }); }

  try {
    const descricao = `[${component}] ${action} • ${status}`;
    getUserSafe().then((u) => {
      const ctx = getContextSafe();
      base44.entities?.AuditLog?.create?.({
        usuario: u?.full_name || u?.email || 'Usuário',
        usuario_id: u?.id,
        empresa_id: ctx?.empresa_id || null,
        group_id: ctx?.group_id || null,
        acao: "Interação",
        modulo: "Sistema",
        entidade: "UI",
        descricao,
        dados_novos: {
          status,
          action,
          component,
          meta: sanitizeMeta(meta),
          url: typeof window !== 'undefined' ? window.location.pathname : undefined,
        },
      });
    }).catch((error) => reportUIAuditFailure('Falha ao persistir acao de UI', error, { component, action }));
  } catch (error) { reportUIAuditFailure('Falha ao preparar auditoria de UI', error, { component, action }); }
}

export function logUIIssue({ component, issue, severity = "warn", meta }) {
  try {
    const descricao = `[${component}] ISSUE: ${issue}`;
    getUserSafe().then((u) => {
      const ctx = getContextSafe();
      base44.entities?.AuditLog?.create?.({
        usuario: u?.full_name || u?.email || 'Usuário',
        usuario_id: u?.id,
        empresa_id: ctx?.empresa_id || null,
        group_id: ctx?.group_id || null,
        acao: "Auditoria",
        modulo: "Sistema",
        entidade: "UI",
        descricao,
        dados_novos: {
          severity,
          issue,
          component,
          meta: sanitizeMeta(meta),
          url: typeof window !== 'undefined' ? window.location.pathname : undefined,
        },
      });
    }).catch((error) => reportUIAuditFailure('Falha ao persistir problema de UI', error, { component, issue }));
  } catch (error) { reportUIAuditFailure('Falha ao preparar problema de UI', error, { component, issue }); }
}

function sanitizeMeta(meta) {
  return sanitizeAuditPayload(meta) || null;
}

export async function persistOperationalAudit({
  acao,
  modulo = 'Sistema',
  entidade = 'AuditLog',
  registro_id = null,
  sucesso = true,
  descricao,
  detalhes = null,
  dados_anteriores = null,
  dados_novos = null,
  empresa_id = null,
  group_id = null,
} = {}) {
  const user = await getUserSafe();
  const ctx = getContextSafe();
  const payload = {
    usuario: user?.full_name || user?.email || 'Usuario',
    usuario_id: user?.id || null,
    acao,
    modulo,
    entidade,
    registro_id,
    tipo_auditoria: sucesso ? 'entidade' : 'seguranca',
    descricao: String(descricao || acao || 'Auditoria').slice(0, 500),
    sucesso,
    empresa_id: empresa_id || ctx.empresa_id || null,
    group_id: group_id || ctx.group_id || null,
    correlacao_id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `audit-${Date.now()}`,
    dados_anteriores: sanitizeAuditPayload(dados_anteriores) || null,
    dados_novos: sanitizeAuditPayload(detalhes ?? dados_novos) || null,
    data_hora: new Date().toISOString(),
  };

  try {
    await base44.entities.AuditLog.create(payload);
  } catch (error) {
    reportUIAuditFailure('Falha ao persistir auditoria operacional', error, {
      modulo,
      acao,
      entidade,
      registro_id,
      group_id: payload.group_id,
      empresa_id: payload.empresa_id,
      correlacao_id: payload.correlacao_id,
    });
  }
}

// Fase 4: auditoria completa (verbose) por padrão
const AUDIT_VERBOSE = false;

function shouldPersistUIAudit(actionName, baseMeta = {}) {
  const kind = baseMeta?.kind;
  if (kind === 'input' || kind === 'textarea') return false;
  if (!actionName) return false;
  if (String(actionName).includes('.onChange')) return false;
  return true;
}

// CORREÇÃO CRÍTICA: Wrap não-bloqueante para handlers de UI
// Não usa async/await para evitar delays imperceptíveis que interferem na digitação
function uiAuditWrapLegacy(actionName, handler, baseMeta = {}) {
  return function wrapped(...args) {
    // Log assíncrono não-bloqueante (fire-and-forget)
    Promise.resolve().then(() => {
      if (AUDIT_VERBOSE) logUIAction({ component: inferComponent(actionName), action: actionName, status: "start", meta: baseMeta });
    });
    
    try {
      const res = handler ? handler(...args) : undefined;
      
      // Log de sucesso não-bloqueante
      Promise.resolve().then(() => {
        if (AUDIT_VERBOSE) logUIAction({ component: inferComponent(actionName), action: actionName, status: "success", meta: baseMeta });
        if (baseMeta && baseMeta.toastSuccess) {
          try { toast.success(`${actionName} concluído`); } catch (error) { reportUIAuditFailure('Falha ao exibir confirmacao legada', error, { actionName }); }
        }
      });
      
      return res;
    } catch (error) {
      const msg = String(error?.message || error) || 'Erro';
      
      // Log de erro não-bloqueante
      Promise.resolve().then(() => {
        try { toast.error(`Falha: ${actionName}`, { description: msg }); } catch (toastError) { reportUIAuditFailure('Falha ao exibir erro legado', toastError, { actionName }); }
        if (AUDIT_VERBOSE) logUIAction({ component: inferComponent(actionName), action: actionName, status: "error", meta: { ...baseMeta, error: msg } });
      });
      
      throw error;
    }
  };
}

export function uiAuditWrap(actionName, handler, baseMeta = {}) {
  return function wrapped(...args) {
    Promise.resolve().then(() => {
      if (AUDIT_VERBOSE) logUIAction({ component: inferComponent(actionName), action: actionName, status: "start", meta: baseMeta });
    });

    const logSuccess = () => {
      if (AUDIT_VERBOSE || shouldPersistUIAudit(actionName, baseMeta)) {
        logUIAction({ component: inferComponent(actionName), action: actionName, status: "success", meta: baseMeta });
      }
      if (baseMeta?.toastSuccess) {
        try { toast.success(baseMeta.successMessage || `${actionName} concluido`); } catch (error) { reportUIAuditFailure('Falha ao exibir confirmacao', error, { actionName }); }
      }
    };

    const logError = (error) => {
      const msg = String(error?.message || error) || 'Erro';
      try { toast.error(`Falha: ${actionName}`, { description: msg }); } catch (toastError) { reportUIAuditFailure('Falha ao exibir erro', toastError, { actionName }); }
      if (AUDIT_VERBOSE || shouldPersistUIAudit(actionName, baseMeta)) {
        logUIAction({ component: inferComponent(actionName), action: actionName, status: "error", meta: { ...baseMeta, error: msg } });
      }
    };

    try {
      const res = handler ? handler(...args) : undefined;

      if (res && typeof res.then === 'function') {
        return res.then((value) => {
          Promise.resolve().then(logSuccess);
          return value;
        }).catch((error) => {
          Promise.resolve().then(() => logError(error));
          throw error;
        });
      }

      Promise.resolve().then(logSuccess);
      return res;
    } catch (error) {
      Promise.resolve().then(() => logError(error));
      throw error;
    }
  };
}

function inferComponent(actionName) {
  if (!actionName) return "UI";
  if (actionName.startsWith("Button")) return "Button";
  if (actionName.startsWith("Input")) return "Input";
  if (actionName.startsWith("Checkbox")) return "Checkbox";
  if (actionName.startsWith("Select")) return "Select";
  if (actionName.startsWith("Switch")) return "Switch";
  if (actionName.startsWith("RadioGroup")) return "RadioGroup";
  return "UI";
}
