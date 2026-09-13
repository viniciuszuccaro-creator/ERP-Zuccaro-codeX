import { useState, useCallback } from 'react';
import { toast } from 'sonner';

/**
 * V22.0 ETAPA 1 - Hook de Padronização de Estados de Ação
 * 
 * Garante que TODA ação interativa tenha 3 estados bem definidos:
 * 1. Iniciada (isLoading)
 * 2. Concluída com Sucesso
 * 3. Concluída com Erro
 * 
 * Uso:
 * const { execute, isLoading, error } = useActionState();
 * 
 * const handleSave = async () => {
 *   await execute(
 *     async () => { await api.save(data); },
 *     { successMessage: "Salvo!", errorMessage: "Erro ao salvar" }
 *   );
 * };
 */
export function useActionState(options = {}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastResult, setLastResult] = useState(null);

  const execute = useCallback(async (action, config = {}) => {
    const {
      successMessage = 'Ação executada com sucesso',
      errorMessage = 'Erro ao executar ação',
      showSuccessToast = true,
      showErrorToast = true,
      onSuccess,
      onError,
      logAction = true,
      actionName = 'Ação desconhecida'
    } = { ...options, ...config };

    // Estado 1: Iniciada
    setIsLoading(true);
    setError(null);

    const startTime = performance.now();

    try {
      // Executar a ação
      const result = await action();

      // Estado 2: Concluída com Sucesso
      setLastResult(result);
      
      if (showSuccessToast) {
        toast.success(successMessage);
      }

      if (onSuccess) {
        onSuccess(result);
      }

      // Log de auditoria
      if (logAction && typeof window !== 'undefined') {
        try {
          const duration = performance.now() - startTime;
          window.__actionLogs = window.__actionLogs || [];
          window.__actionLogs.push({
            action: actionName,
            status: 'success',
            duration,
            timestamp: new Date().toISOString(),
            result: result
          });
        } catch (auditError) {
          console.error('[useActionState] Falha ao auditar conclusao da acao', auditError);
        }
      }

      return result;
    } catch (err) {
      // Estado 3: Concluída com Erro
      setError(err);
      
      if (showErrorToast) {
        toast.error(errorMessage + (err?.message ? `: ${err.message}` : ''));
      }

      if (onError) {
        onError(err);
      }

      // Log de erro
      if (logAction && typeof window !== 'undefined') {
        try {
          const duration = performance.now() - startTime;
          window.__actionLogs = window.__actionLogs || [];
          window.__actionLogs.push({
            action: actionName,
            status: 'error',
            duration,
            timestamp: new Date().toISOString(),
            error: err?.message || String(err)
          });
        } catch (auditError) {
          console.error('[useActionState] Falha ao auditar erro da acao', auditError);
        }
      }

      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [options]);

  const reset = useCallback(() => {
    setIsLoading(false);
    setError(null);
    setLastResult(null);
  }, []);

  return {
    execute,
    isLoading,
    error,
    lastResult,
    reset
  };
}

/**
 * Hook para ações em lote
 */
export function useBatchActionState() {
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState([]);
  const [results, setResults] = useState([]);

  const executeBatch = useCallback(async (items, actionFn, config = {}) => {
    const {
      successMessage = 'Todas as ações foram concluídas',
      errorMessage = 'Algumas ações falharam',
      showProgressToast = true
    } = config;

    setIsLoading(true);
    setProgress({ current: 0, total: items.length });
    setErrors([]);
    setResults([]);

    const localResults = [];
    const localErrors = [];

    for (let i = 0; i < items.length; i++) {
      try {
        const result = await actionFn(items[i], i);
        localResults.push({ index: i, result, success: true });
        setProgress({ current: i + 1, total: items.length });
      } catch (err) {
        localErrors.push({ index: i, error: err, item: items[i] });
        setProgress({ current: i + 1, total: items.length });
      }
    }

    setResults(localResults);
    setErrors(localErrors);
    setIsLoading(false);

    if (localErrors.length === 0) {
      if (showProgressToast) toast.success(successMessage);
    } else {
      if (showProgressToast) {
        toast.error(`${errorMessage}: ${localErrors.length} de ${items.length} falharam`);
      }
    }

    return { results: localResults, errors: localErrors };
  }, []);

  return {
    executeBatch,
    isLoading,
    progress,
    errors,
    results
  };
}
