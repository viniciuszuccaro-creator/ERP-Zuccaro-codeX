import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { base44, isApiKeyMode, isHttpBackendMode, isLocalOnlyMode, localApiUser } from "@/api/base44Client";
import { HTTP_CONTEXT_CHANGED } from "@/api/erpHttpSession";

const UserContext = createContext(null);

const resolveBootUser = async () => {
  // HTTP/supabase_user: Bearer revalidado no BFF (não confiar em localStorage).
  if (isHttpBackendMode) {
    const { refreshErpHttpSessionFromServer, buildHttpSessionUser, ensureHttpTenantLocalMirror } = await import('@/api/erpHttpSession');
    const session = await refreshErpHttpSessionFromServer({});
    if (!session?.token) {
      const err = new Error('Authentication required');
      err.status = 401;
      err.authType = 'auth_required';
      throw err;
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
        base44Client: base44,
      });
    } catch (error) {
      console.warn('[UserContext] espelho local tenant falhou.', error?.message || error);
    }
    const sessionUser = buildHttpSessionUser(session);
    if (!sessionUser) {
      const err = new Error('Authentication required');
      err.status = 401;
      err.authType = 'auth_required';
      throw err;
    }
    return sessionUser;
  }

  if (isApiKeyMode && !isLocalOnlyMode) {
    return localApiUser;
  }
  try {
    return await base44.auth.me();
  } catch (error) {
    // Modo local: se a sessao falhar por carimbo/contexto no boot, nao perder o admin mestre.
    if (isLocalOnlyMode && localApiUser?.id) {
      console.warn('[UserContext] auth.me falhou no boot local; usando administrador local.', error?.message || error);
      return {
        ...localApiUser,
        full_name: localApiUser.full_name || 'Administrador Local',
        role: 'admin',
        perfil_acesso_id: localApiUser.perfil_acesso_id || 'local_perfil_admin',
      };
    }
    throw error;
  }
};

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const loadVersion = useRef(0);

  useEffect(() => {
    let mounted = true;

    const loadUser = async () => {
      const version = ++loadVersion.current;
      setIsLoading(true);
      try {
        const currentUser = await resolveBootUser();
        if (mounted && version === loadVersion.current) {
          setUser(currentUser);
          setError(null);
        }
      } catch (err) {
        if (mounted && version === loadVersion.current) {
          console.error("Erro ao carregar usuário:", err);
          setUser(null);
          setError(err);
        }
      } finally {
        if (mounted && version === loadVersion.current) {
          setIsLoading(false);
        }
      }
    };

    loadUser();
    if (isHttpBackendMode) window.addEventListener(HTTP_CONTEXT_CHANGED, loadUser);

    return () => {
      mounted = false;
      loadVersion.current += 1;
      if (isHttpBackendMode) window.removeEventListener(HTTP_CONTEXT_CHANGED, loadUser);
    };
  }, []);

  const refreshUser = async () => {
    const version = ++loadVersion.current;
    setIsLoading(true);
    try {
      const currentUser = await resolveBootUser();
      if (version === loadVersion.current) {
        setUser(currentUser);
        setError(null);
      }
      return currentUser;
    } catch (err) {
      if (version === loadVersion.current) {
        console.error("Erro ao atualizar usuário:", err);
        setError(err);
      }
      throw err;
    } finally {
      if (version === loadVersion.current) setIsLoading(false);
    }
  };

  return (
    <UserContext.Provider value={{ user, isLoading, error, refreshUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser deve ser usado dentro de um UserProvider");
  }
  return context;
}
