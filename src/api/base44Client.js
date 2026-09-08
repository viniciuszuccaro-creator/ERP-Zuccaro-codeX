import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';
import { localBase44, localApiUser as localOnlyUser } from './localBase44Client';
import {
  assertInteractiveAuthAllowed,
  createAuthDeniedError,
} from './localAuthSessionPolicy';

const { appId, serverUrl, token, functionsVersion } = appParams;
const apiKey = import.meta.env.VITE_BASE44_API_KEY;
const hasRemoteBase44Config = Boolean(appId && serverUrl);
export const isLocalOnlyMode = import.meta.env.VITE_LOCAL_ONLY === 'true' || !hasRemoteBase44Config;

export const isApiKeyMode = isLocalOnlyMode || !!apiKey;
export const localApiUser = isLocalOnlyMode ? localOnlyUser : {
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
  isLocalOnlyMode,
  hasApiKey: Boolean(apiKey),
  hasUserToken: Boolean(token),
});

// Sessao interativa exige auth de usuario; API key sozinha nao libera browser.
const remoteBase44 = isLocalOnlyMode ? null : createClient({
  appId,
  serverUrl,
  token,
  headers: apiKey ? { api_key: apiKey } : undefined,
  functionsVersion,
  requiresAuth: interactiveAuth.allowed ? Boolean(token) : true,
});

/**
 * Contrato publico unico para os clientes remoto e local. O SDK mantem o
 * registro dinamico de entidades sem apagar os contratos de auth, funcoes e integracoes.
 * @type {import('@base44/sdk').Base44Client}
 */
export const base44 = /** @type {import('@base44/sdk').Base44Client} */ (
  isLocalOnlyMode ? localBase44 : remoteBase44
);

if (!isLocalOnlyMode && isApiKeyMode && base44?.auth) {
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
