import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';
import { localBase44, localApiUser as localOnlyUser } from './localBase44Client.js';
import {
  assertInteractiveAuthAllowed,
  createAuthDeniedError,
} from './localAuthSessionPolicy.js';
import { createHttpApiClient } from './httpApiClient.js';
import { HTTP_CONTEXT_CHANGED } from './erpHttpSession.js';
import { runLocalEntityReadFunction, notifyEntityApiAccess } from './localEntityReadApi.js';
import {
  countEntitiesTouchesHttpPilot,
  runHttpPilotAwareCountEntities,
} from './httpPilotCountBridge.js';
import {
  HTTP_PILOT_ENTITIES,
  isHttpExpedicaoEnabled as expedicaoFlag,
  resolveErpApiBaseUrl,
  resolveErpBackendMode,
  resolveHttpPilotEntities,
} from './runtimeBackend.js';

const { appId, serverUrl, token, functionsVersion } = appParams;
const apiKey = import.meta.env.VITE_BASE44_API_KEY;
const hasRemoteBase44Config = Boolean(appId && serverUrl);

/** @type {'local' | 'http' | 'remote'} */
export const erpBackendMode = resolveErpBackendMode(import.meta.env);

export const isLocalOnlyMode = erpBackendMode === 'local'
  || import.meta.env.VITE_LOCAL_ONLY === 'true'
  || (erpBackendMode !== 'http' && erpBackendMode !== 'remote' && !hasRemoteBase44Config);

export const isHttpBackendMode = erpBackendMode === 'http';
export const isApiKeyMode = isLocalOnlyMode || isHttpBackendMode || !!apiKey;

export const isHttpExpedicaoEnabled = expedicaoFlag(import.meta.env);
export const isHttpExpedicaoMode = isHttpExpedicaoEnabled;
export const isHttpProdutoEnabled = isHttpBackendMode && import.meta.env.VITE_ERP_HTTP_PRODUTO === 'true';
export const isHttpCliente360Enabled = isHttpBackendMode && import.meta.env.VITE_ERP_HTTP_CLIENTE_360 === 'true';
/**
 * Contrato do produtor local/API key; nao representa uma sessao HTTP autenticada.
 * @typedef {Pick<import('@base44/sdk').User,
 * 'id' | 'created_date' | 'updated_date' | 'email' | 'full_name' | 'disabled' |
 * 'is_verified' | 'app_id' | 'is_service' | '_app_role' | 'role'> & {
 *   perfil_acesso_id?: string,
 *   contexto_atual?: 'grupo' | 'empresa',
 *   grupo_atual_id?: string,
 *   grupo_padrao_id?: string,
 *   empresa_atual_id?: string,
 *   empresa_padrao_id?: string,
 *   pode_operar_em_grupo?: boolean,
 *   pode_ver_todas_empresas?: boolean,
 *   empresas_vinculadas?: Array<{ empresa_id: string, ativo: boolean }>,
 *   grupos_vinculados?: Array<{ grupo_id: string, ativo: boolean }>,
 *   mestre_local?: boolean
 * }} LocalApiUser
 */
/** @type {LocalApiUser} */
export const localApiUser = (isLocalOnlyMode || isHttpBackendMode) ? localOnlyUser : {
  id: 'local-api-key-user',
  email: 'local-api@erp-integra.local',
  full_name: 'Usuario Local API',
  role: 'admin',
  app_id: appId || 'erp-zuccaro-local',
  is_service: false,
  _app_role: 'admin',
  disabled: false,
  is_verified: true,
  created_date: new Date(0).toISOString(),
  updated_date: new Date(0).toISOString(),
  pode_operar_em_grupo: true,
  pode_ver_todas_empresas: true,
  empresas_vinculadas: [],
  grupos_vinculados: []
};

const interactiveAuth = assertInteractiveAuthAllowed({
  isLocalOnlyMode: isLocalOnlyMode || isHttpBackendMode,
  hasApiKey: Boolean(apiKey),
  hasUserToken: Boolean(token),
});

const remoteBase44 = (isLocalOnlyMode || isHttpBackendMode || !hasRemoteBase44Config)
  ? null
  : createClient({
    appId,
    serverUrl,
    token,
    headers: apiKey ? { api_key: apiKey } : undefined,
    functionsVersion,
    requiresAuth: interactiveAuth.allowed ? Boolean(token) : true,
  });
/** @type {ReturnType<typeof createHttpApiClient> | null} */
let httpHybridClient = null;

/**
 * Modo http: entidades piloto no BFF; demais no localBase44 (migracao incremental).
 * Auth e entityGuard usam o BFF; demais functions/integrations preservam o fluxo existente.
 */
function createHttpHybridClient() {
  const http = createHttpApiClient({
    baseUrl: resolveErpApiBaseUrl(import.meta.env),
    getScope: () => {
      if (typeof window === 'undefined') return {};
      try {
        const raw = window.localStorage?.getItem('erp_runtime_scope');
        const scope = raw ? JSON.parse(raw) : {};
        const token = typeof scope.token === 'string' && scope.token.trim()
          ? scope.token.trim()
          : (typeof window.localStorage?.getItem === 'function'
            ? String(window.localStorage.getItem('base44_access_token') || '').trim()
            : '');
        return token ? { ...scope, token } : scope;
      } catch {
        return {};
      }
    },
  });

  httpHybridClient = http;
  const pilotSet = new Set(resolveHttpPilotEntities(import.meta.env));
  const entities = new Proxy(localBase44.entities || {}, {
    get(target, prop, receiver) {
      if (typeof prop === 'string' && pilotSet.has(prop)) {
        if (http.entities[prop]) return notifyEntityApiAccess(entities, prop, http.entities[prop], 'http');
      }
      const api = Reflect.get(target, prop, receiver);
      return typeof prop === 'string' ? notifyEntityApiAccess(entities, prop, api) : api;
    },
  });

  // Auth no modo HTTP: sessão Bearer do BFF — não o auth.me local (senão GuardRails
  // acusa "não autenticado" enquanto o header mostra o usuário HTTP).
  const httpAuth = {
    async me() {
      const {
        refreshErpHttpSessionFromServer,
        buildHttpSessionUser,
        ensureHttpTenantLocalMirror,
        clearErpHttpSession,
      } = await import('./erpHttpSession.js');
      // Sempre revalida no BFF — não monta usuário só com localStorage fabricável.
      const session = await refreshErpHttpSessionFromServer({});
      if (!session?.token) {
        clearErpHttpSession();
        throw createAuthDeniedError({ reason: 'http_session_missing' });
      }
      try {
        await ensureHttpTenantLocalMirror({
          token: session.token,
          actorId: session.actorId,
          groupId: session.groupId,
          empresaId: session.empresaId,
          groupName: session.groupName,
          empresas: session.empresas,
          perfilAcessoId: `http_perfil_${session.actorId}`,
          permissoes: session.permissoes || {},
          perfilNome: session.fullName || session.email,
        });
      } catch {
        /* espelho best-effort */
      }
      const user = buildHttpSessionUser(session);
      if (!user) {
        clearErpHttpSession();
        throw createAuthDeniedError({ reason: 'http_session_incomplete' });
      }
      return user;
    },
    async isAuthenticated() {
      try {
        await this.me();
        return true;
      } catch {
        return false;
      }
    },
    async updateMe() {
      return this.me();
    },
    async logout() {
      const { clearErpHttpSession } = await import('./erpHttpSession.js');
      clearErpHttpSession();
      if (typeof window !== 'undefined') {
        window.location.assign('/');
      }
      return true;
    },
    redirectToLogin() {
      return import('./erpHttpSession.js').then(({ clearErpHttpSession }) => {
        clearErpHttpSession();
        if (typeof window !== 'undefined') {
          window.location.assign('/');
        }
        return true;
      });
    },
  };

  return {
    ...localBase44,
    auth: httpAuth,
    entities,
    functions: {
      ...localBase44.functions,
      async invoke(name, payload = {}) {
        if (name === 'entityGuard') return http.entityGuard(payload);
        // Grids Cadastros (entityListSorted/getEntityRecord) devem usar o piloto HTTP
        // — senao a lista fica vazia no store local enquanto a API/Postgres tem dados.
        if (name === 'entityListSorted' || name === 'getEntityRecord') {
          const entityName = String(payload?.entityName || '').trim();
          if (entityName && pilotSet.has(entityName) && http.entities?.[entityName]) {
            const filter = {
              ...(payload.filter && typeof payload.filter === 'object' ? payload.filter : {}),
            };
            if (payload.search != null && String(payload.search).trim()) {
              filter.search = String(payload.search).trim();
            }
            return runLocalEntityReadFunction(name, { ...payload, filter }, {
              expandFilter: (_entity, nextFilter) => nextFilter || {},
              listEntity: async (entity, nextFilter, order, limit, skip) => {
                const rows = await http.entities[entity].filter(nextFilter, order, limit, skip);
                return Array.isArray(rows) ? rows : [];
              },
            });
          }
        }
        if (name === 'countEntities') {
          // Batch (useEntityCounts) e single: piloto HTTP; senao store local.
          // Sem isso o badge "Clientes: 0" diverge da lista HTTP (n>0).
          if (countEntitiesTouchesHttpPilot(payload, pilotSet, http.entities)) {
            return runHttpPilotAwareCountEntities(payload, {
              pilotSet,
              httpEntities: http.entities,
              countLocal: async (entityName, filter) => {
                const localRes = await localBase44.functions.invoke('countEntities', {
                  entityName,
                  filter: filter || {},
                });
                const d = localRes?.data;
                return typeof d?.count === 'number' ? d.count : 0;
              },
            });
          }
        }
        return localBase44.functions.invoke(name, payload);
      },
    },
    _http: http,
    _backend: 'http',
  };
}

function resolveBase44Client() {
  if (isHttpBackendMode) return createHttpHybridClient();
  if (isLocalOnlyMode || !remoteBase44) return localBase44;
  return remoteBase44;
}
const resolvedBase44 = resolveBase44Client();

/**
 * First migrated capability in the existing facade; never invokes local/remote demo IA.
 * @param {'atendimento_analise'|'atendimento_intencao'|'comercial_produtos'|'fiscal_validacao'|'entrega_previsao'|'financeiro_conciliacao'} purpose
 * @param {{prompt: string, group_id?: unknown, empresa_id?: unknown, response_json_schema?: Record<string, unknown>, tipo_ia?: string, signal?:AbortSignal}} input
 * @returns {Promise<string | object>}
 */
export async function invokeErpIa(purpose, input) {
  if (!isHttpBackendMode || !httpHybridClient) {
    throw Object.assign(new Error('IA requer a API propria autenticada do ERP.'), { code: 'IA_ERP_API_REQUIRED', status: 503 });
  }
  const groupId = input.group_id;
  if (typeof groupId !== 'string' || !groupId || (input.empresa_id != null && typeof input.empresa_id !== 'string')) {
    throw Object.assign(new Error('Contexto de IA invalido.'), { code: 'IA_SCOPE_INVALID', status: 403 });
  }
  const empresaId = typeof input.empresa_id === 'string' ? input.empresa_id : null;
  const controller = new AbortController();
  const onChange = () => controller.abort();
  if (typeof window !== 'undefined') window.addEventListener(HTTP_CONTEXT_CHANGED, onChange);
  const signal=input.signal?AbortSignal.any([controller.signal,input.signal]):controller.signal;
  try {
    if(signal.aborted)throw Object.assign(new Error('Contexto alterado durante a IA.'),{code:'IA_STALE_CONTEXT',status:409});
    const result = await httpHybridClient.invokeIaContextual({ purpose, prompt: input.prompt,
      group_id: groupId, empresa_id: empresaId, response_json_schema: input.response_json_schema, signal });
    if (signal.aborted) throw Object.assign(new Error('Contexto alterado durante a IA.'), { code: 'IA_STALE_CONTEXT', status: 409 });
    if (typeof result !== 'string' && (!result || typeof result !== 'object' || Array.isArray(result))) {
      throw Object.assign(new Error('Resposta IA invalida.'), { code: 'IA_RESPONSE_INVALID', status: 502 });
    }
    return result;
  } finally {
    if (typeof window !== 'undefined') window.removeEventListener(HTTP_CONTEXT_CHANGED, onChange);
  }
}

export function getHttpProdutoApi() {
  if (!isHttpProdutoEnabled || !httpHybridClient) {
    throw new Error('Produto HTTP indisponivel');
  }
  return httpHybridClient.preparedEntities.Produto;
}

/**
 * Contrato publico unico para os clientes remoto, local e http.
 * @type {import('@base44/sdk').Base44Client}
 */
export const base44 = /** @type {import('@base44/sdk').Base44Client} */ (resolvedBase44);

if (!isLocalOnlyMode && !isHttpBackendMode && isApiKeyMode && base44?.auth) {
  const originalMe = base44.auth.me?.bind(base44.auth);
  const originalUpdateMe = base44.auth.updateMe?.bind(base44.auth);
  const originalIsAuthenticated = base44.auth.isAuthenticated?.bind(base44.auth);

  base44.auth.me = async () => {
    if (!interactiveAuth.allowed) {
      throw createAuthDeniedError(interactiveAuth);
    }
    if (originalMe) return originalMe();
    throw createAuthDeniedError({ reason: 'auth_required', type: 'auth_required' });
  };

  base44.auth.isAuthenticated = async () => {
    if (!interactiveAuth.allowed) return false;
    if (originalIsAuthenticated) return originalIsAuthenticated();
    try {
      await base44.auth.me();
      return true;
    } catch {
      return false;
    }
  };

  base44.auth.updateMe = async (updates = {}) => {
    if (!interactiveAuth.allowed) {
      throw createAuthDeniedError(interactiveAuth);
    }
    if (originalUpdateMe) return originalUpdateMe(updates);
    return updates;
  };
}
