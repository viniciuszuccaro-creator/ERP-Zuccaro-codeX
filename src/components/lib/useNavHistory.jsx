/**
 * useNavHistory — Fase 3
 * Rastreia histórico de navegação do usuário e deriva módulos mais visitados.
 * Usado pelo prefetch preditivo para antecipar próximas navegações.
 */
import { useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';

const STORAGE_KEY = 'nav_history_v1';
const MAX_ENTRIES = 50;
const DECAY_HOURS = 24; // entradas mais antigas que 24h têm peso reduzido

// Mapa de rota → módulo (mesma lógica do Layout)
const ROUTE_TO_MODULE = {
  '/CRM': 'CRM - Relacionamento',
  '/Comercial': 'Comercial e Vendas',
  '/Estoque': 'Estoque e Almoxarifado',
  '/Compras': 'Compras e Suprimentos',
  '/Financeiro': 'Financeiro e Contábil',
  '/Fiscal': 'Fiscal e Tributário',
  '/RH': 'Recursos Humanos',
  '/Expedicao': 'Expedição e Logística',
  '/Producao': 'Produção e Manufatura',
  '/Dashboard': 'Dashboard',
  '/DashboardCorporativo': 'Dashboard Corporativo',
  '/Cadastros': 'Cadastros Gerais',
  '/Contratos': 'Gestão de Contratos',
  '/HubAtendimento': 'Hub de Atendimento',
};

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch { return []; }
}

function saveHistory(entries) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
  } catch (error) {
    console.warn('[useNavHistory] Falha ao persistir historico de navegacao', error);
  }
}

/**
 * Retorna lista de módulos ordenados por frequência ponderada (recentes têm mais peso).
 * @returns {string[]} módulos mais prováveis de visitar
 */
export function getPredictedModules(currentPath, topN = 3) {
  const history = loadHistory();
  const now = Date.now();
  const counts = {};

  history.forEach(({ path, ts }) => {
    const module = ROUTE_TO_MODULE[path];
    if (!module || path === currentPath) return;
    const ageHours = (now - ts) / (1000 * 60 * 60);
    const weight = ageHours < DECAY_HOURS ? 1 + (1 - ageHours / DECAY_HOURS) : 0.5;
    counts[module] = (counts[module] || 0) + weight;
  });

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([module]) => module);
}

/**
 * Hook que registra a rota atual no histórico de navegação.
 */
export function useNavHistory() {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;
    if (!ROUTE_TO_MODULE[path]) return; // só rastreia rotas de módulos
    const history = loadHistory();
    history.push({ path, ts: Date.now() });
    saveHistory(history);
  }, [location.pathname]);

  const getPredicted = useCallback((topN = 3) => {
    return getPredictedModules(location.pathname, topN);
  }, [location.pathname]);

  return { getPredicted };
}

export default useNavHistory;
