import { useState, useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import usePermissions from '@/components/lib/usePermissions';

const CONFIG_PERMISSION_RULES = [
  { match: (chave, categoria) => String(categoria || '').toLowerCase().includes('seguranca') || String(chave || '').startsWith('seg_'), permissions: [['Sistema', 'Seguranca', 'editar'], ['Sistema', 'Segurança', 'editar']] },
  { match: (chave, categoria) => String(categoria || '').toLowerCase().includes('notific'), permissions: [['Sistema', 'Notificacoes', 'editar'], ['Sistema', 'Configurações', 'editar'], ['Sistema', 'Configuracoes', 'editar']] },
  { match: (chave, categoria) => String(categoria || '').toLowerCase().includes('fiscal') || String(chave || '').startsWith('fiscal_'), permissions: [['Sistema', 'Fiscal', 'editar'], ['Sistema', 'Configurações', 'editar'], ['Sistema', 'Configuracoes', 'editar']] },
  { match: (chave) => String(chave || '').startsWith('ia_') || String(chave || '').startsWith('cc_ia_'), permissions: [['Sistema', 'IA e Otimização', 'editar'], ['Sistema', 'IA e Otimizacao', 'editar'], ['Sistema', 'Configurações', 'editar']] },
  { match: () => true, permissions: [['Sistema', 'Configurações', 'editar'], ['Sistema', 'Configuracoes', 'editar'], ['Sistema', 'Sistema', 'editar']] },
];

export function getConfigPermissionKey(chave, categoria) {
  const key = String(chave || '');
  const cat = String(categoria || '').toLowerCase();
  if (cat.includes('seguranca') || key.startsWith('seg_')) return 'Sistema.Seguranca.editar';
  if (cat.includes('notific')) return 'Sistema.Notificacoes.editar';
  if (cat.includes('fiscal') || key.startsWith('fiscal_')) return 'Sistema.Fiscal.editar';
  if (key.startsWith('ia_') || key.startsWith('cc_ia_')) return 'Sistema.IA e Otimizacao.editar';
  return 'Sistema.Configuracoes.editar';
}

export function canEditConfigByPermission(hasPermission, chave, categoria) {
  const rule = CONFIG_PERMISSION_RULES.find(item => item.match(chave, categoria));
  try {
    if (hasPermission(getConfigPermissionKey(chave, categoria))) return true;
  } catch (error) {
    console.warn('[useToggleConfig] Permissao granular indisponivel', error);
  }
  return (rule?.permissions || []).some(([modulo, secao, acao]) => {
    try { return hasPermission(modulo, secao, acao); } catch { return false; }
  });
}

export async function loadScopedConfiguracaoSistema({ empresaId, grupoId, limit = 500, includeGlobal = false }) {
  const queries = [];

  if (grupoId && empresaId) {
    queries.push(base44.entities.ConfiguracaoSistema.filter({ group_id: grupoId, empresa_id: empresaId }, '-updated_date', limit));
  }
  if (empresaId) {
    queries.push(base44.entities.ConfiguracaoSistema.filter({ empresa_id: empresaId }, '-updated_date', limit));
  }
  if (grupoId) {
    queries.push(base44.entities.ConfiguracaoSistema.filter({ group_id: grupoId }, '-updated_date', limit));
  }
  if (includeGlobal) {
    queries.push(base44.entities.ConfiguracaoSistema.filter({ empresa_id: null, group_id: null }, '-updated_date', limit));
  }

  const results = await Promise.allSettled(queries);
  const merged = [];
  const seen = new Set();

  for (const result of results) {
    if (result.status !== 'fulfilled' || !Array.isArray(result.value)) continue;
    for (const item of result.value) {
      const key = item?.id || `${item?.chave}:${item?.empresa_id || ''}:${item?.group_id || ''}:${item?.updated_date || ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
    }
  }

  return merged.sort((a, b) => {
    const dateA = new Date(a?.updated_date || a?.created_date || 0).getTime();
    const dateB = new Date(b?.updated_date || b?.created_date || 0).getTime();
    return dateB - dateA;
  });
}

/**
 * useToggleConfig v9 — Salva via upsertConfig e mantém confirmedMap
 * para não perder o valor confirmado pelo banco após invalidate/refetch.
 */
export function useToggleConfig(empresaId, grupoId, queryKey) {
  const [saving, setSaving] = useState({});
  // optimisticMap: valor durante o request (antes de confirmar)
  const [optimisticMap, setOptimisticMap] = useState({});
  // confirmedMap: valor confirmado pelo backend (sobrescreve dados da query enquanto não há novo fetch limpo)
  const [confirmedMap, setConfirmedMap] = useState({});
  const queryClient = useQueryClient();
  const pendingRef = useRef({});
  const { hasPermission } = usePermissions();

  // Reset ao trocar empresa/grupo
  useEffect(() => {
    setOptimisticMap({});
    setConfirmedMap({});
    pendingRef.current = {};
  }, [empresaId, grupoId]);

  const getScope = useCallback(() => {
    const scope = {};
    if (grupoId) scope.group_id = grupoId;
    if (empresaId) scope.empresa_id = empresaId;
    return scope;
  }, [grupoId, empresaId]);

  const sameId = (a, b) => String(a || '') === String(b || '');

  const sortByNewest = (items) => {
    return [...items].sort((a, b) => {
      const dateA = new Date(a?.updated_date || a?.created_date || 0).getTime();
      const dateB = new Date(b?.updated_date || b?.created_date || 0).getTime();
      return dateB - dateA;
    });
  };

  const findMatchingRecord = useCallback((list, chave) => {
    if (!Array.isArray(list)) return null;
    const candidates = sortByNewest(list.filter(c => c.chave === chave));
    if (!candidates.length) return null;
    if (empresaId && grupoId) {
      const exact = candidates.find(c => sameId(c.empresa_id, empresaId) && sameId(c.group_id, grupoId));
      if (exact) return exact;
    }
    if (empresaId) {
      const byE = candidates.find(c => sameId(c.empresa_id, empresaId));
      if (byE) return byE;
    }
    if (grupoId) {
      const byG = candidates.find(c => sameId(c.group_id, grupoId));
      if (byG) return byG;
    }
    return candidates[0] || null;
  }, [empresaId, grupoId]);

  const saveDirectConfig = useCallback(async (chave, categoria, ativa, scope) => {
    const filter = { chave, ...scope };
    const existentes = await base44.entities.ConfiguracaoSistema.filter(filter, '-updated_date', 20);
    const latest = findMatchingRecord(existentes, chave);
    const payload = {
      chave,
      categoria: categoria || 'Sistema',
      ativa,
      ...scope,
      updated_date: new Date().toISOString(),
    };

    if (latest?.id) {
      return await base44.entities.ConfiguracaoSistema.update(latest.id, payload);
    }

    return await base44.entities.ConfiguracaoSistema.create(payload);
  }, [findMatchingRecord]);

  const persistToggle = useCallback(async (chave, categoria, newValue, scope) => {
    try {
      const res = await base44.functions.invoke('upsertConfig', {
        chave,
        data: { chave, categoria: categoria || 'Sistema', ativa: newValue },
        scope,
      });
      const record = res?.data?.record;
      if (record && typeof record.ativa === 'boolean' && record.ativa === newValue) {
        return record;
      }
    } catch (_) {
      // Fallback direto abaixo mantém o toggle funcional quando a função estiver indisponível.
    }

    return await saveDirectConfig(chave, categoria, newValue, scope);
  }, [saveDirectConfig]);

  const handleToggle = useCallback(async (chave, categoria, newValue) => {
    if (saving[chave] || pendingRef.current[chave]) return;

    if (!canEditConfigByPermission(hasPermission, chave, categoria)) {
      toast.error('Sem permissao para alterar esta configuracao.');
      return false;
    }

    const scope = getScope();
    if (!scope.empresa_id && !scope.group_id) {
      toast.error('Selecione um grupo ou empresa antes de alterar esta configuracao.');
      return false;
    }

    pendingRef.current[chave] = true;
    setSaving(prev => ({ ...prev, [chave]: true }));
    setOptimisticMap(prev => ({ ...prev, [chave]: newValue }));

    try {
      const record = await persistToggle(chave, categoria, newValue, scope);
      const backendValue = typeof record?.ativa === 'boolean'
        ? record.ativa
        : newValue;
      const savedRecord = {
        ...(record || {}),
        chave,
        categoria: categoria || 'Sistema',
        ativa: backendValue,
        ...scope,
        updated_date: record?.updated_date || new Date().toISOString(),
      };

      setConfirmedMap(prev => ({ ...prev, [chave]: backendValue }));

      if (queryKey) {
        queryClient.setQueryData(queryKey, (old = []) => {
          const list = Array.isArray(old) ? old : [];
          const isSameScope = (item) => {
            if (item?.chave !== chave) return false;
            if (scope.empresa_id && !sameId(item?.empresa_id, scope.empresa_id)) return false;
            if (scope.group_id && !sameId(item?.group_id, scope.group_id)) return false;
            if (!scope.empresa_id && item?.empresa_id) return false;
            if (!scope.group_id && item?.group_id) return false;
            return true;
          };
          const withoutOldScope = list.filter(item => !isSameScope(item));
          return [savedRecord, ...withoutOldScope];
        });
        await queryClient.invalidateQueries({ queryKey, exact: true });
      }

      try {
        const me = await base44.auth.me();
        await base44.entities.AuditLog.create({
          usuario: me?.full_name || me?.email || 'Usuario',
          usuario_id: me?.id || null,
          acao: 'Toggle',
          modulo: categoria || 'Sistema',
          entidade: 'ConfiguracaoSistema',
          registro_id: record?.id || null,
          empresa_id: scope.empresa_id || null,
          group_id: scope.group_id || null,
          descricao: `Toggle ${chave} ${backendValue ? 'ativado' : 'desativado'}`,
          dados_novos: savedRecord,
          sucesso: true,
          data_hora: new Date().toISOString()
        });
      } catch (auditError) {
        console.error('[useToggleConfig] Falha ao auditar alteracao', auditError);
      }

      return true;
    } catch (err) {
      setOptimisticMap(prev => {
        const next = { ...prev };
        delete next[chave];
        return next;
      });
      toast.error('Erro ao salvar toggle: ' + String(err?.message || err));
      return false;
    } finally {
      setOptimisticMap(prev => {
        const next = { ...prev };
        delete next[chave];
        return next;
      });
      setSaving(prev => { const n = { ...prev }; delete n[chave]; return n; });
      delete pendingRef.current[chave];
    }
  }, [saving, getScope, queryClient, queryKey, persistToggle, hasPermission]);

  const getToggleValue = useCallback((configs, chave) => {
    // Prioridade 1: valor otimístico local (clique imediato)
    if (chave in optimisticMap) return optimisticMap[chave];
    // Prioridade 2: valor confirmado pelo backend (após salvar, antes do refetch)
    if (chave in confirmedMap) return confirmedMap[chave];
    // Prioridade 3: valor da query (banco)
    const match = findMatchingRecord(configs, chave);
    if (match && typeof match.ativa === 'boolean') return match.ativa;
    // Prioridade 4: fallback global
    if (Array.isArray(configs)) {
      const global = configs.find(c => c.chave === chave && !c.empresa_id && !c.group_id);
      if (global && typeof global.ativa === 'boolean') return global.ativa;
    }
    return false;
  }, [optimisticMap, confirmedMap, findMatchingRecord]);

  return {
    saving,
    optimistic: optimisticMap,
    handleToggle,
    getToggleValue,
    seedIdCache: () => {},
    syncWithQueryData: () => {},
  };
}
