/**
 * useInvalidationBus — Fase 2
 * Barramento de invalidação seletiva por subscription.
 * Conecta os eventos de real-time das entidades ao React Query,
 * invalidando apenas as queries relevantes sem broadcast global.
 */
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

// Mapa: entidade → query keys a invalidar no React Query
const ENTITY_QUERY_KEYS = {
  Cliente:             [['entityListSorted', 'Cliente'], ['Cliente', 'count']],
  Fornecedor:          [['entityListSorted', 'Fornecedor'], ['Fornecedor', 'count']],
  Transportadora:      [['entityListSorted', 'Transportadora'], ['Transportadora', 'count']],
  Colaborador:         [['entityListSorted', 'Colaborador'], ['Colaborador', 'count']],
  Produto:             [['entityListSorted', 'Produto'], ['Produto', 'count']],
  Pedido:              [['entityListSorted', 'Pedido'], ['Pedido', 'count'], ['pedidos']],
  ContaReceber:        [['entityListSorted', 'ContaReceber'], ['ContaReceber', 'count'], ['contasReceber']],
  ContaPagar:          [['entityListSorted', 'ContaPagar'], ['ContaPagar', 'count'], ['contasPagar']],
  Entrega:             [['entityListSorted', 'Entrega'], ['Entrega', 'count'], ['entregas']],
  NotaFiscal:          [['entityListSorted', 'NotaFiscal'], ['NotaFiscal', 'count']],
  OrdemCompra:         [['entityListSorted', 'OrdemCompra'], ['OrdemCompra', 'count']],
  MovimentacaoEstoque: [['entityListSorted', 'MovimentacaoEstoque'], ['MovimentacaoEstoque', 'count']],
  Oportunidade:        [['entityListSorted', 'Oportunidade'], ['Oportunidade', 'count']],
  Representante:       [['entityListSorted', 'Representante'], ['Representante', 'count']],
  ContatoB2B:          [['entityListSorted', 'ContatoB2B'], ['ContatoB2B', 'count']],
  SegmentoCliente:     [['entityListSorted', 'SegmentoCliente'], ['SegmentoCliente', 'count']],
  RegiaoAtendimento:   [['entityListSorted', 'RegiaoAtendimento'], ['RegiaoAtendimento', 'count']],
};

// Throttle de invalidação por entidade (evita flood de invalidações em eventos rápidos)
const INVALIDATE_THROTTLE_MS = 800;

/**
 * Hook que assina eventos real-time de uma lista de entidades e
 * invalida apenas as queries React Query afetadas.
 * 
 * @param {string[]} entities - lista de nomes de entidades para monitorar
 * @param {object}   options  - { enabled: bool }
 */
export function useInvalidationBus(entities = [], options = {}) {
  const { enabled = true } = options;
  const queryClient = useQueryClient();
  const lastInvalidateRef = useRef({});

  useEffect(() => {
    if (!enabled || !entities.length) return;

    const unsubs = entities.map((entityName) => {
      const api = base44.entities?.[entityName];
      if (!api?.subscribe) return null;

      return api.subscribe((evt) => {
        const now = Date.now();
        const last = lastInvalidateRef.current[entityName] || 0;
        if (now - last < INVALIDATE_THROTTLE_MS) return;
        lastInvalidateRef.current[entityName] = now;

        const keys = ENTITY_QUERY_KEYS[entityName] || [['entityListSorted', entityName]];
        // Invalidação assíncrona para não bloquear o handler
        setTimeout(() => {
          keys.forEach((qk) => {
            try {
              queryClient.invalidateQueries({ queryKey: qk, exact: false });
            } catch (error) {
              console.warn('[useInvalidationBus] Falha ao invalidar consulta', error);
            }
          });
        }, 50);
      });
    }).filter(Boolean);

    return () => { unsubs.forEach(u => { if (typeof u === 'function') u(); }); };
  }, [enabled, entities.join(','), queryClient]);
}

export default useInvalidationBus;
