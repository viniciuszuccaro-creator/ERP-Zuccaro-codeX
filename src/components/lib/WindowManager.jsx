import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

/**
 * WINDOW MANAGER V21.0
 * Sistema de Multitarefas com Janelas Responsivas
 * Regra-Mãe: Acrescentar • Reorganizar • Conectar • Melhorar
 */

const WindowContext = createContext();

export const useWindowManager = () => {
  const context = useContext(WindowContext);
  if (!context) {
    throw new Error('useWindowManager deve ser usado dentro de WindowProvider');
  }
  return context;
};

export function WindowProvider({ children }) {
  const [windows, setWindows] = useState([]);
  const [activeWindowId, setActiveWindowId] = useState(null);
  /** Registro síncrono uniqueKey→windowId (evita race Card+Abrir antes do setState). */
  const uniqueKeyRegistryRef = useRef(new Map());

  // Fechar janela
  const closeWindow = useCallback((windowId) => {
    setWindows(prev => {
      const closing = prev.find(w => w.id === windowId);
      if (closing?.uniqueKey) uniqueKeyRegistryRef.current.delete(closing.uniqueKey);
      return prev.filter(w => w.id !== windowId);
    });
    if (activeWindowId === windowId) {
      setActiveWindowId(windows[windows.length - 2]?.id || null);
    }
  }, [activeWindowId, windows]);

  // Minimizar janela
  const minimizeWindow = useCallback((windowId) => {
    setWindows(prev => prev.map(w => 
      w.id === windowId ? { ...w, isMinimized: true } : w
    ));
  }, []);

  // Restaurar janela minimizada
  const restoreWindow = useCallback((windowId) => {
    setWindows(prev => prev.map(w => 
      w.id === windowId ? { ...w, isMinimized: false } : w
    ));
    setActiveWindowId(windowId);
  }, []);

  // Maximizar/Restaurar janela
  const toggleMaximize = useCallback((windowId) => {
    setWindows(prev => prev.map(w => 
      w.id === windowId ? { ...w, isMaximized: !w.isMaximized } : w
    ));
  }, []);

  // Trazer janela para frente - V21.6.4 CORREÇÃO TOTAL
  const bringToFront = useCallback((windowId) => {
    setActiveWindowId(windowId);
    setWindows(prev => {
      const maxZ = Math.max(...prev.map(w => w.zIndex), 99999000);
      return prev.map(w => 
        w.id === windowId ? { ...w, zIndex: maxZ + 100000, isMinimized: false } : w
      );
    });
  }, []);

  // Abrir nova janela - V21.7 CORREÇÃO ESTADO UNIFICADO
  const openWindow = useCallback((component, props = {}, options = {}) => {
    const uniqueKey = options.uniqueKey ? String(options.uniqueKey) : '';

    // Guard síncrono: segundo clique (Card+Abrir / duplo) reutiliza a mesma janela
    if (uniqueKey && uniqueKeyRegistryRef.current.has(uniqueKey)) {
      const existingId = uniqueKeyRegistryRef.current.get(uniqueKey);
      setActiveWindowId(existingId);
      setWindows(prevWindows => {
        const janelaExistente = prevWindows.find(w => w.id === existingId || w.uniqueKey === uniqueKey);
        if (!janelaExistente) return prevWindows;
        const maxZ = Math.max(...prevWindows.map(w => w.zIndex), 99999000);
        return prevWindows.map(w =>
          w.id === janelaExistente.id
            ? { ...w, zIndex: maxZ + 100000, isMinimized: false }
            : w
        );
      });
      return existingId;
    }

    const windowId = `window-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    if (uniqueKey) uniqueKeyRegistryRef.current.set(uniqueKey, windowId);

    setWindows(prevWindows => {
      // 1. Verificar uniqueKey no estado (rede de segurança)
      if (uniqueKey) {
        const janelaExistente = prevWindows.find(w => w.uniqueKey === uniqueKey);
        if (janelaExistente) {
          uniqueKeyRegistryRef.current.set(uniqueKey, janelaExistente.id);
          setActiveWindowId(janelaExistente.id);
          const maxZ = Math.max(...prevWindows.map(w => w.zIndex), 99999000);
          return prevWindows.map(w =>
            w.id === janelaExistente.id
              ? { ...w, zIndex: maxZ + 100000, isMinimized: false }
              : w
          );
        }
      }

      // 2. Calcular z-index sempre no topo
      const baseZ = 99999000;
      const currentMaxZ = prevWindows.length > 0 ? Math.max(...prevWindows.map(w => w.zIndex), baseZ) : baseZ;
      const finalZ = currentMaxZ + 100000;

      // 3. Cascata inteligente
      const offsetBase = prevWindows.length * 40;
      const maxOffset = 400;
      const cascade = offsetBase % maxOffset;

      const newWindow = {
        id: windowId,
        component,
        props,
        title: options.title || 'Nova Janela',
        isMinimized: false,
        isMaximized: false,
        width: options.width || 900,
        height: options.height || 600,
        x: options.x !== undefined ? options.x : 100 + cascade,
        y: options.y !== undefined ? options.y : 80 + cascade,
        zIndex: finalZ,
        uniqueKey: uniqueKey || undefined,
      };

      setActiveWindowId(windowId);
      return [...prevWindows, newWindow];
    });

    return windowId;
  }, []);

  // Atualizar posição e tamanho
  const updateWindow = useCallback((windowId, updates) => {
    setWindows(prev => prev.map(w => 
      w.id === windowId ? { ...w, ...updates } : w
    ));
  }, []);

  const value = {
    windows,
    activeWindowId,
    openWindow,
    closeWindow,
    minimizeWindow,
    restoreWindow,
    toggleMaximize,
    bringToFront,
    updateWindow,
  };

  return (
    <WindowContext.Provider value={value}>
      {children}
    </WindowContext.Provider>
  );
}