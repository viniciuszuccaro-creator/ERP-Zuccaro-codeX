import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { base44, isApiKeyMode, isHttpBackendMode, isLocalOnlyMode } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';
import { createAxiosClient } from '@base44/sdk/dist/utils/axios-client';
import { assertInteractiveAuthAllowed } from '@/api/localAuthSessionPolicy';
import {
  buildHttpSessionUser,
  clearErpHttpSession,
  ensureHttpTenantLocalMirror,
  loginErpHttpSession,
  readErpHttpSession,
} from '@/api/erpHttpSession';

const AuthContext = createContext();
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings, setAppPublicSettings] = useState(null);
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState(null);

  const applyHttpSession = useCallback(async (session) => {
    if (!session?.token || !session?.groupId || !session?.actorId) {
      clearErpHttpSession();
      setUser(null);
      setIsAuthenticated(false);
      setAuthError({ type: 'auth_required', message: 'Authentication required' });
      return false;
    }
    if (session.expiresAt) {
      const expiresMs = Date.parse(String(session.expiresAt));
      if (!Number.isFinite(expiresMs) || expiresMs <= Date.now()) {
        clearErpHttpSession();
        setUser(null);
        setIsAuthenticated(false);
        setAuthError({ type: 'auth_required', message: 'Authentication required' });
        return false;
      }
    }
    try {
      await ensureHttpTenantLocalMirror({
        groupId: session.groupId,
        empresaId: session.empresaId,
        base44Client: base44,
      });
    } catch (error) {
      console.warn('[Auth] espelho local Grupo/Empresa falhou; seguindo com sessão.', error);
    }
    const sessionUser = buildHttpSessionUser(session);
    if (!sessionUser) {
      clearErpHttpSession();
      setUser(null);
      setIsAuthenticated(false);
      setAuthError({ type: 'auth_required', message: 'Authentication required' });
      return false;
    }
    setUser(sessionUser);
    setIsAuthenticated(true);
    setAuthError(null);
    return true;
  }, []);

  const checkUserAuth = useCallback(async () => {
    try {
      setIsLoadingAuth(true);
      if (isHttpBackendMode) {
        const session = readErpHttpSession();
        const ok = await applyHttpSession(session);
        setIsLoadingAuth(false);
        setAuthChecked(true);
        return ok;
      }
      const currentUser = await base44.auth.me();
      const authenticated = await base44.auth.isAuthenticated();
      setUser(authenticated ? currentUser : null);
      setIsAuthenticated(Boolean(authenticated));
      setAuthError(authenticated ? null : { type: 'auth_required', message: 'Authentication required' });
      setIsLoadingAuth(false);
      setAuthChecked(true);
      return Boolean(authenticated);
    } catch (error) {
      console.error('User auth check failed:', error);
      setUser(null);
      setIsAuthenticated(false);
      setIsLoadingAuth(false);
      setAuthChecked(true);
      setAuthError({
        type: error?.authType || (error?.status === 401 || error?.status === 403 ? 'auth_required' : 'unknown'),
        message: error?.message || 'Authentication required',
      });
      return false;
    }
  }, [applyHttpSession]);

  const checkAppState = useCallback(async () => {
    setAuthChecked(false);
    setLoginError(null);

    if (isHttpBackendMode) {
      setAppPublicSettings({ id: appParams.appId || 'erp-http', public_settings: { auth: 'supabase_user' } });
      setIsLoadingPublicSettings(false);
      await checkUserAuth();
      return;
    }

    if (isLocalOnlyMode) {
      await checkUserAuth();
      setAppPublicSettings({ id: appParams.appId, public_settings: {} });
      setIsLoadingPublicSettings(false);
      return;
    }

    const interactive = assertInteractiveAuthAllowed({
      isLocalOnlyMode: false,
      hasApiKey: Boolean(import.meta.env.VITE_BASE44_API_KEY),
      hasUserToken: Boolean(appParams.token),
    });

    // API key sozinha nao autentica UI interativa (fail-closed Gate 1)
    if (isApiKeyMode && !interactive.allowed) {
      setUser(null);
      setIsAuthenticated(false);
      setAuthError({
        type: 'auth_required',
        message: 'API key nao autentica sessao interativa. Faca login com token de usuario.',
      });
      setAppPublicSettings({ id: appParams.appId, public_settings: {} });
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
      setAuthChecked(true);
      return;
    }

    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);

      const appClient = createAxiosClient({
        baseURL: `${appParams.serverUrl}/api/apps/public`,
        headers: {
          'X-App-Id': appParams.appId
        },
        token: appParams.token,
        interceptResponses: true
      });

      try {
        const publicSettings = await appClient.get(`/prod/public-settings/by-id/${appParams.appId}`);
        setAppPublicSettings(publicSettings);

        if (appParams.token) {
          await checkUserAuth();
        } else {
          setIsLoadingAuth(false);
          setIsAuthenticated(false);
          setAuthChecked(true);
        }
        setIsLoadingPublicSettings(false);
      } catch (appError) {
        console.error('App state check failed:', appError);

        if (appError.status === 403 && appError.data?.extra_data?.reason) {
          const reason = appError.data.extra_data.reason;
          if (reason === 'auth_required') {
            setAuthError({ type: 'auth_required', message: 'Authentication required' });
          } else if (reason === 'user_not_registered') {
            setAuthError({ type: 'user_not_registered', message: 'User not registered for this app' });
          } else {
            setAuthError({ type: reason, message: appError.message });
          }
        } else {
          setAuthError({
            type: 'unknown',
            message: appError.message || 'Failed to load app'
          });
        }
        setIsLoadingPublicSettings(false);
        setIsLoadingAuth(false);
        setAuthChecked(true);
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      setAuthError({
        type: 'unknown',
        message: error.message || 'An unexpected error occurred'
      });
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  }, [checkUserAuth]);

  useEffect(() => {
    checkAppState();
  }, [checkAppState]);

  const loginWithPassword = useCallback(async ({ email, password }) => {
    if (!isHttpBackendMode) {
      setLoginError('Login por senha disponível apenas no modo HTTP/supabase_user.');
      return false;
    }
    setLoginBusy(true);
    setLoginError(null);
    try {
      const session = await loginErpHttpSession({ email, password });
      await applyHttpSession({
        token: session.accessToken,
        groupId: session.groupId,
        empresaId: session.empresaId,
        actorId: session.actorId,
        email: session.email,
        role: session.role,
        fullName: session.fullName,
        expiresAt: session.expiresAt,
      });
      setAuthChecked(true);
      setIsLoadingAuth(false);
      return true;
    } catch (error) {
      clearErpHttpSession();
      setUser(null);
      setIsAuthenticated(false);
      setAuthError({ type: 'auth_required', message: 'Authentication required' });
      setLoginError(error?.message || 'Falha no login');
      return false;
    } finally {
      setLoginBusy(false);
    }
  }, [applyHttpSession]);

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    setAuthChecked(true);
    setAuthError({ type: 'auth_required', message: 'Authentication required' });
    setLoginError(null);

    if (isHttpBackendMode) {
      clearErpHttpSession();
      return;
    }

    if (shouldRedirect) {
      base44.auth.logout(window.location.href);
    } else {
      base44.auth.logout();
    }
  };

  const navigateToLogin = () => {
    if (isHttpBackendMode) {
      // Formulário de login é renderizado na própria tela de sessão inválida.
      setAuthError({ type: 'auth_required', message: 'Authentication required' });
      return true;
    }
    base44.auth.redirectToLogin(window.location.href);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authChecked,
      authError,
      appPublicSettings,
      loginBusy,
      loginError,
      loginWithPassword,
      supportsPasswordLogin: isHttpBackendMode,
      logout,
      navigateToLogin,
      checkAppState,
      checkUserAuth,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
