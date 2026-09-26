import React, { createContext, useContext, useState, useEffect } from "react";
import { base44, isApiKeyMode, isHttpBackendMode, isLocalOnlyMode, localApiUser } from "@/api/base44Client";
import {
  buildHttpSessionUser,
  ensureHttpTenantLocalMirror,
  readErpHttpSession,
} from "@/api/erpHttpSession";

const UserContext = createContext(null);

const resolveBootUser = async () => {
  // HTTP/supabase_user: usar sessão Bearer + tenant real (não o admin local paralelo).
  if (isHttpBackendMode) {
    const session = readErpHttpSession();
    if (!session) {
      const err = new Error('Authentication required');
      err.status = 401;
      err.authType = 'auth_required';
      throw err;
    }
    try {
      await ensureHttpTenantLocalMirror({
        groupId: session.groupId,
        empresaId: session.empresaId,
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

  useEffect(() => {
    let mounted = true;

    const loadUser = async () => {
      try {
        const currentUser = await resolveBootUser();
        if (mounted) {
          setUser(currentUser);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          console.error("Erro ao carregar usuário:", err);
          setUser(null);
          setError(err);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    loadUser();

    return () => {
      mounted = false;
    };
  }, []);

  const refreshUser = async () => {
    try {
      const currentUser = await resolveBootUser();
      setUser(currentUser);
      setError(null);
      return currentUser;
    } catch (err) {
      console.error("Erro ao atualizar usuário:", err);
      setError(err);
      throw err;
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
