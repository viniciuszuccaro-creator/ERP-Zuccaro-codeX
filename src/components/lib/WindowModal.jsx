import React, { useRef, useState, useEffect } from 'react';
import { X, Minus, Maximize2, Minimize2 } from 'lucide-react';
import { useWindowManager } from './WindowManager';
import { motion } from 'framer-motion';

/**
 * WINDOW MODAL V21.0
 * Janela Responsiva Individual com Controles
 * w-full e h-full responsivo, redimensionável, com barra de rolagem automática
 */

export default function WindowModal({ window, children }) {
  const { closeWindow, minimizeWindow, toggleMaximize, bringToFront, updateWindow } = useWindowManager();
  const windowRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });

  // Estilo da janela - V21.6.4: z-index GARANTIDO sempre aplicado
  const windowStyle = window.isMaximized
    ? {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        zIndex: window.zIndex,
      }
    : {
        position: 'fixed',
        top: window.y,
        left: window.x,
        width: window.width,
        height: window.height,
        zIndex: window.zIndex,
      };

  // Iniciar drag - MELHORADO
  const handleMouseDown = (e) => {
    if (window.isMaximized || e.target.closest('.window-controls')) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    setIsDragging(true);
    setDragStart({
      x: e.clientX - (window.x || 0),
      y: e.clientY - (window.y || 0),
    });
    bringToFront(window.id);
  };

  // Iniciar resize - MELHORADO
  const handleResizeMouseDown = (e) => {
    if (window.isMaximized) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    setIsResizing(true);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: window.width || 800,
      height: window.height || 600,
    });
    bringToFront(window.id);
  };

  // Movimento do mouse - CORRIGIDO PARA USAR WINDOW GLOBAL
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging) {
        e.preventDefault();
        const newX = Math.max(0, Math.min(e.clientX - dragStart.x, globalThis.window.innerWidth - 300));
        const newY = Math.max(0, Math.min(e.clientY - dragStart.y, globalThis.window.innerHeight - 100));
        updateWindow(window.id, { x: newX, y: newY });
      } else if (isResizing) {
        e.preventDefault();
        const deltaX = e.clientX - resizeStart.x;
        const deltaY = e.clientY - resizeStart.y;
        const newWidth = Math.max(400, Math.min(resizeStart.width + deltaX, globalThis.window.innerWidth - window.x));
        const newHeight = Math.max(300, Math.min(resizeStart.height + deltaY, globalThis.window.innerHeight - window.y));
        updateWindow(window.id, { width: newWidth, height: newHeight });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      globalThis.window.addEventListener('mousemove', handleMouseMove);
      globalThis.window.addEventListener('mouseup', handleMouseUp);
      return () => {
        globalThis.window.removeEventListener('mousemove', handleMouseMove);
        globalThis.window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, dragStart, resizeStart, window.id, window.x, window.y, updateWindow]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 20 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      ref={windowRef}
      style={{
        ...windowStyle,
        pointerEvents: 'auto'
      }}
      className={`bg-white rounded-lg shadow-2xl border-2 flex flex-col overflow-hidden select-none ${
        isDragging ? 'cursor-grabbing shadow-blue-500/50 transition-none' : ''
      } ${
        isResizing ? 'cursor-se-resize transition-none' : ''
      } ${
        !isDragging && !isResizing ? 'transition-all duration-200' : ''
      }`}
      onMouseDown={(e) => {
        // Só ativar janela se não clicar em input/textarea/select/button
        const isInteractiveElement = ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(e.target.tagName);
        if (!isInteractiveElement) {
          e.stopPropagation();
          bringToFront(window.id);
        }
      }}
    >
      {/* Header - CURSOR MOVE VISÍVEL */}
      <div
        className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-3 flex items-center justify-between cursor-move select-none active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        style={{ touchAction: 'none', userSelect: 'none' }}
      >
        <h3 className="font-semibold text-sm truncate flex-1 pointer-events-none">{window.title}</h3>
        <div className="window-controls flex items-center gap-1 relative z-20">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              minimizeWindow(window.id);
            }}
            className="p-1.5 hover:bg-blue-800 rounded transition-colors"
            title="Minimizar"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleMaximize(window.id);
            }}
            className="p-1.5 hover:bg-blue-800 rounded transition-colors"
            title={window.isMaximized ? 'Restaurar' : 'Maximizar'}
          >
            {window.isMaximized ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              closeWindow(window.id);
            }}
            className="p-1.5 hover:bg-red-600 rounded transition-colors relative z-30"
            title="Fechar"
            aria-label="Fechar janela"
            data-action="window-close"
          >
            <X className="w-4 h-4 pointer-events-none" />
          </button>
        </div>
      </div>

      {/* Conteúdo com barra de rolagem - padrão universal */}
      <div className="flex-1 min-h-0 min-w-0 overflow-y-auto bg-white w-full">
        {children}
      </div>

      {/* Resize handle - MELHORADO */}
      {!window.isMaximized && (
        <div
          className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize hover:bg-blue-200 transition-colors z-50 group"
          onMouseDown={handleResizeMouseDown}
          title="Arrastar para redimensionar"
          style={{ pointerEvents: 'auto' }}
        >
          <div className="w-full h-full flex items-end justify-end p-0.5">
            <div className="w-4 h-4 border-r-3 border-b-3 border-blue-500 group-hover:border-blue-700 transition-colors rounded-tl-sm" 
                 style={{ borderRightWidth: '3px', borderBottomWidth: '3px' }} 
            />
          </div>
        </div>
      )}
    </motion.div>
  );
}