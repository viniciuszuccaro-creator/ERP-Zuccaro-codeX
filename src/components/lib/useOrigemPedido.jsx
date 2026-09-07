import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

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
 * @returns {Object} { origemPedido, bloquearEdicao: true, parametro, parametros, isLoading }
 */
export function useOrigemPedido() {
  
  // Buscar parâmetros configurados (cache otimizado)
  const { data: parametros = [], isLoading } = useQuery({
    queryKey: ['parametros-origem-pedido'],
    queryFn: () => base44.entities.ParametroOrigemPedido.list(),
    initialData: [],
    staleTime: 5 * 60 * 1000, // 5 minutos
    cacheTime: 10 * 60 * 1000, // 10 minutos
  });

  // Detectar origem AUTOMATICAMENTE (performance < 50ms)
  const origemPedido = useMemo(() => {
    const inicio = performance.now();

    // 1️⃣ URL params (maior prioridade - integração externa)
    const urlParams = new URLSearchParams(window.location.search);
    const origemURL = urlParams.get('origem');
    if (origemURL) {
      console.log(`Origem AUTO via URL: ${origemURL} (${(performance.now() - inicio).toFixed(1)}ms)`);
      return origemURL;
    }

    // 2️⃣ Sessão (origem persistida temporariamente)
    const origemSessao = localStorage.getItem('origem_pedido_sessao');
    if (origemSessao && origemSessao !== 'Manual') {
      console.log(`Origem AUTO via sessão: ${origemSessao} (${(performance.now() - inicio).toFixed(1)}ms)`);
      return origemSessao;
    }

    // 3️⃣ Pathname (contexto da página)
    const pathname = window.location.pathname.toLowerCase();
    if (pathname.includes('portal')) {
      console.log(`Origem AUTO via pathname: Portal (${(performance.now() - inicio).toFixed(1)}ms)`);
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
    console.log(`Origem padrão: Manual (ERP) (${(performance.now() - inicio).toFixed(1)}ms)`);
    return 'Manual';
  }, []);

  // Buscar parâmetro do canal detectado
  const parametroAtivo = useMemo(() => {
    if (!parametros || parametros.length === 0) return null;

    // Mapear origem para canal
    const origemParaCanal = {
      'Manual': 'ERP',
      'E-commerce': 'E-commerce',
      'API': 'API',
      'Importado': 'API',
      'Site': 'Site',
      'site': 'Site',
      'App': 'App Mobile',
      'WhatsApp': 'WhatsApp',
      'Portal': 'Portal Cliente',
      'Marketplace': 'Marketplace',
      'Chatbot': 'Chatbot'
    };

    const canal = origemParaCanal[origemPedido] || 'ERP';
    
    return parametros.find(p => p.canal === canal && p.ativo) || null;
  }, [parametros, origemPedido]);

  return {
    origemPedido,
    bloquearEdicao: true, // V21.6 FINAL: SEMPRE BLOQUEADO (detecção 100% automática)
    parametro: parametroAtivo,
    parametros,
    isLoading
  };
}

/**
 * Hook para buscar configurações de origem por canal específico
 * @param {string} canal - Nome do canal: 'ERP', 'Site', 'Chatbot', etc.
 */
export function useParametroOrigem(canal) {
  const { data: parametros, isLoading } = useQuery({
    queryKey: ['parametros-origem-pedido', canal],
    queryFn: () => base44.entities.ParametroOrigemPedido.filter({ canal, ativo: true }),
    initialData: [],
  });

  return {
    parametro: parametros?.[0] || null,
    isLoading
  };
}

export default useOrigemPedido;