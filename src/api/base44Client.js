import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';
import { localBase44, localApiUser as localOnlyUser } from './localBase44Client.js';
import {
  assertInteractiveAuthAllowed,
  createAuthDeniedError,
} from './localAuthSessionPolicy.js';
import { createHttpApiClient } from './httpApiClient.js';
import {
  HTTP_PILOT_ENTITIES,
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

export const isHttpProdutoEnabled = isHttpBackendMode && import.meta.env.VITE_ERP_HTTP_PRODUTO === 'true';
export const isHttpCliente360Enabled = isHttpBackendMode && import.meta.env.VITE_ERP_HTTP_CLIENTE_360 === 'true';
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
 * Auth/functions/integrations permanecem no fallback local neste lote.
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
        if (http.entities[prop]) return http.entities[prop];
      }
      return Reflect.get(target, prop, receiver);
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
