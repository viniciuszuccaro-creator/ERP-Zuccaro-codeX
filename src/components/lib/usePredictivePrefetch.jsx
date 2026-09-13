/**
 * usePredictivePrefetch — Fase 3
 * Prefetch preditivo baseado no histórico de navegação do usuário.
 * Analisa as N rotas mais visitadas e pré-carrega os dados desses módulos
 * de forma silenciosa durante períodos de ociosidade.
 */
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getPredictedModules } from './useNavHistory';
import { usePrefetchModuleData } from './usePrefetchModuleData';
import { useLocation } from 'react-router-dom';
import { useContextoVisual } from './useContextoVisual';

// Só executa 1 vez a cada 5 minutos por sessão
const PREDICTIVE_INTERVAL_MS = 5 * 60 * 1000;
// Aguarda inatividade antes de executar (não atrapalha a navegação atual)
const IDLE_DELAY_MS = 3000;

export function usePredictivePrefetch() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const { prefetch } = usePrefetchModuleData();
  const { empresaAtual, grupoAtual } = useContextoVisual();
  const lastRunRef = useRef(0);
  const timerRef = useRef(null);

  useEffect(() => {
    const run = () => {
      const now = Date.now();
      if (now - lastRunRef.current < PREDICTIVE_INTERVAL_MS) return;
      if (!empresaAtual?.id && !grupoAtual?.id) return;

      const predicted = getPredictedModules(location.pathname, 3);
      if (!predicted.length) return;

      lastRunRef.current = now;

      // Prefetch em sequência com delay para não sobrecarregar
      predicted.forEach((module, idx) => {
        setTimeout(() => {
          try {
            prefetch(module);
          } catch (error) {
            console.warn('[usePredictivePrefetch] Prefetch opcional indisponivel', error);
          }
        }, idx * 800); // 800ms entre cada módulo
      });
    };

    // Agenda para rodar durante inatividade
    if (timerRef.current) clearTimeout(timerRef.current);

    if ('requestIdleCallback' in window) {
      timerRef.current = setTimeout(() => {
        window.requestIdleCallback(run, { timeout: 5000 });
      }, IDLE_DELAY_MS);
    } else {
      timerRef.current = setTimeout(run, IDLE_DELAY_MS + 2000);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [location.pathname, empresaAtual?.id, grupoAtual?.id]);
}

export default usePredictivePrefetch;
