import React, { createContext, useContext, useState, useCallback } from 'react';

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

  // Fechar janela
  const closeWindow = useCallback((windowId) => {
    setWindows(prev => prev.filter(w => w.id !== windowId));
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
    const windowId = `window-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    setWindows(prevWindows => {
      // 1. Verificar uniqueKey para evitar duplicação
      if (options.uniqueKey) {
        const janelaExistente = prevWindows.find(w => w.uniqueKey === options.uniqueKey);
        if (janelaExistente) {
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

      // 3. Cascata inteligente — limita ao viewport disponível (evita janela inacessível)
      const offsetBase = prevWindows.length * 40;
      const maxOffset = 400;
      const cascade = offsetBase % maxOffset;
      const viewportW = typeof globalThis !== 'undefined' && globalThis.window
        ? globalThis.window.innerWidth
        : 1280;
      const viewportH = typeof globalThis !== 'undefined' && globalThis.window
        ? globalThis.window.innerHeight
        : 800;
      const requestedW = options.width || 900;
      const requestedH = options.height || 600;
      const width = Math.min(requestedW, Math.max(480, viewportW - 24));
      const height = Math.min(requestedH, Math.max(320, viewportH - 24));
      const rawX = options.x !== undefined ? options.x : 100 + cascade;
      const rawY = options.y !== undefined ? options.y : 80 + cascade;
      const x = Math.max(0, Math.min(rawX, Math.max(0, viewportW - width)));
      const y = Math.max(0, Math.min(rawY, Math.max(0, viewportH - height)));
      
      const newWindow = {
        id: windowId,
        component,
        props,
        title: options.title || 'Nova Janela',
        isMinimized: false,
        isMaximized: false,
        width,
        height,
        x,
        y,
        zIndex: finalZ,
        uniqueKey: options.uniqueKey
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