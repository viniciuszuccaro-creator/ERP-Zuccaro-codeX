/**
 * Feature flag do runtime ERP.
 *
 * Valores:
 * - local  → localBase44 (default GitHub/DEV sem API)
 * - http   → HttpApiClient → BFF Hostinger/Supabase
 * - remote → SDK Base44 legado (sandbox/compatibilidade; nao e runtime oficial)
 *
 * Nunca seleciona producao automaticamente.
 */

export const ERP_BACKEND_MODES = Object.freeze(['local', 'http', 'remote']);

/**
 * @param {ImportMetaEnv | Record<string, string | undefined>} [env]
 * @returns {'local' | 'http' | 'remote'}
 */
export function resolveErpBackendMode(env = import.meta.env) {
  const raw = String(env?.VITE_ERP_BACKEND || '').trim().toLowerCase();
  if (raw === 'http' || raw === 'remote' || raw === 'local') {
    return raw;
  }

  // Compatibilidade com flag antiga: local-only continua local.
  if (env?.VITE_LOCAL_ONLY === 'true') {
    return 'local';
  }

  const appId = env?.VITE_BASE44_APP_ID;
  const serverUrl = env?.VITE_BASE44_BACKEND_URL;
  if (appId && serverUrl) {
    return 'remote';
  }

  return 'local';
}

/**
 * @param {ImportMetaEnv | Record<string, string | undefined>} [env]
 */
export function resolveErpApiBaseUrl(env = import.meta.env) {
  // Deploy local/DEV com nginx proxy same-origin (sem depender de DNS).
  if (String(env?.VITE_ERP_API_SAME_ORIGIN || '').trim().toLowerCase() === 'true') {
    return '';
  }
  const configured = String(env?.VITE_ERP_API_BASE_URL || '').trim().replace(/\/$/, '');
  if (configured) return configured;
  return 'http://localhost:3080';
}

/**
 * Entidades piloto roteadas ao BFF quando mode=http.
 * Demais entidades permanecem no fallback local durante a migracao incremental.
 *
 * Produto: API/schema MASTER DATA prontos no BFF (RUNTIME-03), mas NAO entram
 * no piloto HTTP ainda — ativacao so apos E2E + tenant FK + auditoria aprovados.
 */
export const HTTP_PILOT_ENTITIES = Object.freeze([
  'Marca',
  'UnidadeMedida',
  'GrupoProduto',
  'SetorAtividade',
]);

/** Produto HTTP e explicito no formulario; consumidores legados mantem sua fonte. */
export function resolveHttpPilotEntities(env = import.meta.env) {
  void env;
  return [...HTTP_PILOT_ENTITIES];
}
