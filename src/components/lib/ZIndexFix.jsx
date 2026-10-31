/**
 * 🔧 GARANTIA GLOBAL DE Z-INDEX V21.5
 * 
 * Sistema automático que garante z-index correto em TODOS os componentes
 * Sobrescreve qualquer z-index incorreto automaticamente
 */

import { useEffect } from 'react';

/**
 * Hook para garantir z-index correto em tempo real
 * Uso: Adicionar no Layout.js para monitoramento global
 */
export function useZIndexGuard() {
  useEffect(() => {
    // Monitorar e corrigir z-index em tempo real - V21.6.2
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node instanceof HTMLElement || node instanceof SVGElement) {
              // Corrigir Radix components - ABAIXO de janelas (999999)
              if (node.hasAttribute('data-radix-select-content')) {
                node.style.zIndex = '999999';
              }
              
              if (node.hasAttribute('data-radix-dropdown-menu-content')) {
                node.style.zIndex = '999999';
              }
              
              if (node.hasAttribute('data-radix-popover-content')) {
                node.style.zIndex = '999999';
              }

              if (node.hasAttribute('data-radix-dialog-content') && 
                  node.closest('[cmdk-root]')) {
                node.style.zIndex = '999999';
              }

              // Buscar recursivamente em filhos
              const selects = node.querySelectorAll('[data-radix-select-content]');
              const dropdowns = node.querySelectorAll('[data-radix-dropdown-menu-content]');
              const popovers = node.querySelectorAll('[data-radix-popover-content]');
              
              [...Array.from(selects), ...Array.from(dropdowns), ...Array.from(popovers)].forEach(el => {
                if (el instanceof HTMLElement || el instanceof SVGElement) el.style.zIndex = '999999';
              });
            }
          });
        }
      });
    });

    // Observar todo o body
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Correção inicial
    const fixExisting = () => {
      const selects = document.querySelectorAll('[data-radix-select-content]');
      const dropdowns = document.querySelectorAll('[data-radix-dropdown-menu-content]');
      const popovers = document.querySelectorAll('[data-radix-popover-content]');
      
      [...Array.from(selects), ...Array.from(dropdowns), ...Array.from(popovers)].forEach(el => {
        if (el instanceof HTMLElement || el instanceof SVGElement) el.style.zIndex = '999999';
      });
    };

    fixExisting();
    
    // Re-executar a cada segundo (garantia)
    const interval = setInterval(fixExisting, 1000);

    return () => {
      observer.disconnect();
      clearInterval(interval);
    };
  }, []);
}

/**
 * CSS Global Injection - Garantia definitiva
 */
export function injectGlobalZIndexStyles() {
  if (typeof document === 'undefined') return;

  const styleId = 'zindex-global-fix-v21-5';
  
  // Remover estilo anterior se existir
  const existingStyle = document.getElementById(styleId);
  if (existingStyle) {
    existingStyle.remove();
  }

  const style = document.createElement('style');
  style.id = styleId;
  style.innerHTML = `
    /* 🔧 GARANTIA GLOBAL DE Z-INDEX V21.6.2 - HIERARQUIA CORRETA */
    
    /* Janelas multitarefa - PRIORIDADE MÁXIMA */
    [class*="motion-div"] {
      position: relative;
    }
    
    /* Select Content - abaixo de janelas */
    [data-radix-select-content] {
      z-index: 999999 !important;
    }
    
    /* Dropdown Menu Content - abaixo de janelas */
    [data-radix-dropdown-menu-content] {
      z-index: 999999 !important;
    }
    
    /* Popover Content - abaixo de janelas */
    [data-radix-popover-content] {
      z-index: 999999 !important;
    }
    
    /* Command Dialog - abaixo de janelas */
    [data-radix-dialog-content][cmdk-dialog-content] {
      z-index: 999999 !important;
    }
    
    /* Tooltip Content - abaixo de janelas */
    [data-radix-tooltip-content] {
      z-index: 999999 !important;
    }
    
    /* Context Menu - abaixo de janelas */
    [data-radix-context-menu-content] {
      z-index: 999999 !important;
    }
    
    /* Garantia adicional para portals - mas abaixo de janelas */
    [data-radix-portal] > [role="dialog"],
    [data-radix-portal] > [role="menu"],
    [data-radix-portal] > [role="listbox"] {
      z-index: 999999 !important;
    }
  `;
  
  document.head.appendChild(style);
}

/**
 * Componente para usar no Layout
 */
export default function ZIndexGuard({ children }) {
  useZIndexGuard();
  
  useEffect(() => {
    injectGlobalZIndexStyles();
  }, []);

  return children;
}
