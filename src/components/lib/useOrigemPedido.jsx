import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import useContextoVisual from '@/components/lib/useContextoVisual';

/**
 * V21.6 FINAL - Hook de Detecção AUTOMÁTICA e OBRIGATÓRIA de Origem
 *
 * ⚡ Detecção 100% Automática - Campo SEMPRE bloqueado
 * 🔒 Bloqueio Total - Sem edição manual permitida
 * Rastreabilidade 100% - Todos pedidos rastreados
 *
 * Detecta origem de onde o pedido está sendo criado:
 * - URL params (?origem=Site)
 * - Sessão (localStorage)
 * - Pathname (/portal, /site, /chatbot)
 * - Referrer (de onde veio)
 * - Padrão: Manual (ERP interno)
 *
 * @returns {Object} { origemPedido, bloquearEdicao: true, parametro, parametros, isLoading, isError, contextoValido }
 */
export function useOrigemPedido() {
  const { empresaAtual, grupoAtual, filterInContext } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const contextKey = empresaId || groupId || 'sem-contexto';
  const contextoValido = contextKey !== 'sem-contexto';

  // Buscar parâmetros configurados no escopo multiempresa (sem initialData sintético)
  const { data: parametros, isLoading, isError, error } = useQuery({
    queryKey: ['parametros-origem-pedido', contextKey],
    queryFn: () => filterInContext('ParametroOrigemPedido', {}, 'canal', 500),
    enabled: contextoValido,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const lista = Array.isArray(parametros) ? parametros : [];

  // Detectar origem AUTOMATICAMENTE (performance < 50ms)
  const origemPedido = useMemo(() => {
    // 1️⃣ URL params (maior prioridade - integração externa)
    const urlParams = new URLSearchParams(window.location.search);
    const origemURL = urlParams.get('origem');
    if (origemURL) {
      return origemURL;
    }

    // 2️⃣ Sessão (origem persistida temporariamente)
    const origemSessao = localStorage.getItem('origem_pedido_sessao');
    if (origemSessao && origemSessao !== 'Manual') {
      return origemSessao;
    }

    // 3️⃣ Pathname (contexto da página)
    const pathname = window.location.pathname.toLowerCase();
    if (pathname.includes('portal')) {
      return 'Portal';
    }
    if (pathname.includes('site')) return 'Site';
    if (pathname.includes('api')) return 'API';
    if (pathname.includes('marketplace')) return 'Marketplace';
    if (pathname.includes('chatbot')) return 'Chatbot';
    if (pathname.includes('whatsapp')) return 'WhatsApp';
    if (pathname.includes('app')) return 'App';

    // 4️⃣ Referrer (de onde o usuário veio)
    const referrer = document.referrer.toLowerCase();
    if (referrer.includes('ecommerce') || referrer.includes('loja')) return 'E-commerce';
    if (referrer.includes('marketplace')) return 'Marketplace';
    if (referrer.includes('site')) return 'Site';

    // 5️⃣ Padrão: Manual (criado dentro do ERP)
    return 'Manual';
  }, []);

  // Buscar parâmetro do canal detectado
  const parametroAtivo = useMemo(() => {
    if (!lista.length) return null;

    const origemParaCanal = {
      Manual: 'ERP',
      'E-commerce': 'E-commerce',
      API: 'API',
      Importado: 'API',
      Site: 'Site',
      site: 'Site',
      App: 'App Mobile',
      WhatsApp: 'WhatsApp',
      Portal: 'Portal Cliente',
      Marketplace: 'Marketplace',
      Chatbot: 'Chatbot',
    };

    const canal = origemParaCanal[origemPedido] || 'ERP';

    return lista.find((p) => p.canal === canal && p.ativo) || null;
  }, [lista, origemPedido]);

  return {
    origemPedido,
    bloquearEdicao: true, // V21.6 FINAL: SEMPRE BLOQUEADO (detecção 100% automática)
    parametro: parametroAtivo,
    parametros: lista,
    isLoading: !contextoValido || isLoading,
    isError: !contextoValido ? false : isError,
    error,
    contextoValido,
    contextKey,
  };
}

/**
 * Hook para buscar configurações de origem por canal específico
 * @param {string} canal - Nome do canal: 'ERP', 'Site', 'Chatbot', etc.
 */
export function useParametroOrigem(canal) {
  const { empresaAtual, grupoAtual, filterInContext } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const contextKey = empresaId || groupId || 'sem-contexto';
  const contextoValido = contextKey !== 'sem-contexto';

  const { data: parametros, isLoading, isError } = useQuery({
    queryKey: ['parametros-origem-pedido', contextKey, canal],
    queryFn: () => filterInContext('ParametroOrigemPedido', { canal, ativo: true }, 'canal', 50),
    enabled: contextoValido && Boolean(canal),
  });

  const lista = Array.isArray(parametros) ? parametros : [];

  return {
    parametro: lista[0] || null,
    isLoading: !contextoValido || isLoading,
    isError: !contextoValido ? false : isError,
    contextoValido,
  };
}

export default useOrigemPedido;
