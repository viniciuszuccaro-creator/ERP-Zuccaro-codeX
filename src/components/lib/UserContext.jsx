import React, { createContext, useContext, useState, useEffect } from "react";
import { base44, isApiKeyMode, isLocalOnlyMode, localApiUser } from "@/api/base44Client";

const UserContext = createContext(null);

const resolveBootUser = async () => {
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
