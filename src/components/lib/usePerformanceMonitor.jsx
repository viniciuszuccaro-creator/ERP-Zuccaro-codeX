/**
 * Hook de Monitoramento de Performance
 * Rastreia e reporta performance de operações
 */

import { useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * Hook para medir performance de uma operação
 */
export function usePerformanceTracker(modulo, funcionalidade, options = {}) {
  const startTimeRef = useRef(null);
  const {
    enabled = true,
    threshold_ms = 1000,
    auto_report = true
  } = options;

  const startTracking = () => {
    if (!enabled) return;
    startTimeRef.current = performance.now();
  };

  const endTracking = async (metadata = {}) => {
    if (!enabled || !startTimeRef.current) return null;

    const endTime = performance.now();
    const duracao_ms = Math.round(endTime - startTimeRef.current);
    const duracao_segundos = duracao_ms / 1000;

    const perfData = {
      timestamp: new Date().toISOString(),
      tipo_operacao: metadata.tipo_operacao || 'query',
      modulo,
      funcionalidade,
      duracao_ms,
      duracao_segundos,
      threshold_ms,
      lento: duracao_ms > threshold_ms,
      percentual_acima_threshold: duracao_ms > threshold_ms 
        ? ((duracao_ms - threshold_ms) / threshold_ms) * 100 
        : 0,
      ...metadata
    };

    // Report automático
    if (auto_report) {
      try {
        await reportPerformance(perfData);
      } catch (error) {
        console.warn('Erro ao reportar performance:', error);
      }
    }

    startTimeRef.current = null;
    return perfData;
  };

  return { startTracking, endTracking };
}

/**
 * Reporta dados de performance para o sistema
 */
export async function reportPerformance(perfData) {
  try {
    // Só reporta se for operação lenta ou tiver erro
    if (!perfData.lento && !perfData.erro) {
      return;
    }

    await base44.entities.LogPerformance.create(perfData);

    // Gerar alerta se muito lento ou erro crítico
    if (perfData.duracao_ms > perfData.threshold_ms * 3 || perfData.erro) {
      await gerarAlertaPerformance(perfData);
    }
  } catch (error) {
    console.error('Erro ao reportar performance:', error);
  }
}

/**
 * Gera alerta de performance
 */
async function gerarAlertaPerformance(perfData) {
  const severidade = 
    perfData.erro && perfData.erro_tipo === 'timeout' ? 'Critical' :
    perfData.erro ? 'Error' :
    perfData.duracao_ms > perfData.threshold_ms * 5 ? 'Critical' :
    perfData.duracao_ms > perfData.threshold_ms * 3 ? 'Error' :
    'Warning';

  const tipo_alerta = 
    perfData.erro ? 'Erro Crítico' :
    perfData.tipo_operacao === 'query' ? 'Query Lenta' :
    perfData.tipo_operacao === 'api_call' ? 'API Lenta' :
    'Threshold Excedido';

  try {
    await base44.entities.AlertaPerformance.create({
      numero_alerta: `APM-${Date.now()}`,
      data_hora: perfData.timestamp,
      tipo_alerta,
      severidade,
      modulo: perfData.modulo,
      funcionalidade: perfData.funcionalidade,
      metrica_tipo: 'duracao',
      valor_medido: perfData.duracao_ms,
      threshold_configurado: perfData.threshold_ms,
      percentual_excedido: perfData.percentual_acima_threshold,
      descricao: `${perfData.funcionalidade} levou ${perfData.duracao_ms}ms (threshold: ${perfData.threshold_ms}ms)`,
      impacto_estimado: severidade === 'Critical' ? 'Alto' : severidade === 'Error' ? 'Médio' : 'Baixo',
      primeira_ocorrencia: perfData.timestamp,
      ultima_ocorrencia: perfData.timestamp,
      quantidade_ocorrencias: 1,
      status: 'Novo',
      automaticamente_criado: true
    });
  } catch (error) {
    console.error('Erro ao gerar alerta:', error);
  }
}

/**
 * Decorator para medir performance de funções
 */
export function withPerformanceTracking(fn, modulo, funcionalidade, threshold_ms = 1000) {
  return async function(...args) {
    const startTime = performance.now();
    let erro = null;
    let resultado = null;

    try {
      resultado = await fn(...args);
    } catch (error) {
      erro = error;
      throw error;
    } finally {
      const endTime = performance.now();
      const duracao_ms = Math.round(endTime - startTime);

      const perfData = {
        timestamp: new Date().toISOString(),
        tipo_operacao: 'api_call',
        modulo,
        funcionalidade,
        duracao_ms,
        duracao_segundos: duracao_ms / 1000,
        threshold_ms,
        lento: duracao_ms > threshold_ms,
        percentual_acima_threshold: duracao_ms > threshold_ms 
          ? ((duracao_ms - threshold_ms) / threshold_ms) * 100 
          : 0,
        erro: !!erro,
        erro_mensagem: erro?.message,
        erro_tipo: erro?.name || 'unknown'
      };

      // Report assíncrono (não bloqueia)
      reportPerformance(perfData).catch(console.error);
    }

    return resultado;
  };
}

/**
 * Hook para monitorar performance de queries
 */
export function useQueryPerformance(queryKey, threshold_ms = 1000) {
  useEffect(() => {
    const startTime = performance.now();

    return () => {
      const endTime = performance.now();
      const duracao_ms = Math.round(endTime - startTime);

      if (duracao_ms > threshold_ms) {
        const perfData = {
          timestamp: new Date().toISOString(),
          tipo_operacao: 'query',
          modulo: 'Sistema',
          funcionalidade: Array.isArray(queryKey) ? queryKey.join('_') : queryKey,
          duracao_ms,
          duracao_segundos: duracao_ms / 1000,
          threshold_ms,
          lento: true,
          percentual_acima_threshold: ((duracao_ms - threshold_ms) / threshold_ms) * 100,
          query_tipo: 'SELECT'
        };

        reportPerformance(perfData).catch(console.error);
      }
    };
  }, [queryKey, threshold_ms]);
}

/**
 * Medir performance de uma função assíncrona
 * @template T
 * @param {() => T | Promise<T>} fn
 * @param {Record<string, unknown> & {threshold_ms?: number}} metadata
 * @returns {Promise<T>}
 */
export async function measurePerformance(fn, metadata = {}) {
  const startTime = performance.now();
  let erro = null;
  let resultado = null;

  try {
    resultado = await fn();
  } catch (error) {
    erro = error;
    throw error;
  } finally {
    const endTime = performance.now();
    const duracao_ms = Math.round(endTime - startTime);

    /** @type {{timestamp: string, duracao_ms: number, duracao_segundos: number, erro: boolean, erro_mensagem?: unknown, threshold_ms?: number, lento?: boolean, percentual_acima_threshold?: number} & Record<string, unknown>} */
    const perfData = {
      timestamp: new Date().toISOString(),
      duracao_ms,
      duracao_segundos: duracao_ms / 1000,
      erro: !!erro,
      erro_mensagem: erro?.message,
      ...metadata
    };

    if (perfData.threshold_ms) {
      perfData.lento = duracao_ms > perfData.threshold_ms;
      perfData.percentual_acima_threshold = duracao_ms > perfData.threshold_ms
        ? ((duracao_ms - perfData.threshold_ms) / perfData.threshold_ms) * 100
        : 0;
    }

    // Report assíncrono
    reportPerformance(perfData).catch(console.error);
  }

  return resultado;
}

/**
 * Calcular métricas agregadas
 */
export function calcularMetricas(logs) {
  if (!logs || logs.length === 0) return null;

  const duracoes = logs.map(l => l.duracao_ms);
  const soma = duracoes.reduce((a, b) => a + b, 0);
  const media = soma / duracoes.length;
  
  const sorted = [...duracoes].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];
  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  const lentas = logs.filter(l => l.lento).length;
  const taxa_lento_percent = (lentas / logs.length) * 100;

  const comErro = logs.filter(l => l.erro).length;
  const taxa_erro_percent = (comErro / logs.length) * 100;

  return {
    total_operacoes: logs.length,
    duracao_media_ms: Math.round(media),
    duracao_min_ms: min,
    duracao_max_ms: max,
    p50_ms: p50,
    p95_ms: p95,
    p99_ms: p99,
    operacoes_lentas: lentas,
    taxa_lento_percent: Math.round(taxa_lento_percent),
    operacoes_erro: comErro,
    taxa_erro_percent: Math.round(taxa_erro_percent * 100) / 100
  };
}

export default {
  usePerformanceTracker,
  reportPerformance,
  withPerformanceTracking,
  useQueryPerformance,
  measurePerformance,
  calcularMetricas
};
