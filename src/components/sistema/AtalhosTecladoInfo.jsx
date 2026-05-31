import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Keyboard, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

/**
 * V21.0 FASE 1: INFORMAÇÕES DE ATALHOS DE TECLADO
 * Painel informativo com todos os atalhos disponíveis
 */
export default function AtalhosTecladoInfo() {
  const atalhos = [
    {
      categoria: 'Navegação',
      items: [
        { tecla: 'Ctrl+K', acao: 'Pesquisa Universal' },
        { tecla: 'Ctrl+Shift+D', acao: 'Ir para Dashboard' },
        { tecla: 'Ctrl+Shift+C', acao: 'Ir para Comercial' }
      ]
    },
    {
      categoria: 'Multitarefa (Fase 1)',
      items: [
        { tecla: 'Ctrl+Shift+N', acao: 'Novo Cliente (Janela)' },
        { tecla: 'Ctrl+Shift+P', acao: 'Novo Produto (Janela)' }
      ]
    },
    {
      categoria: 'Janelas',
      items: [
        { tecla: 'Drag Título', acao: 'Mover janela' },
        { tecla: 'Drag Canto', acao: 'Redimensionar janela' },
        { tecla: 'Clique', acao: 'Trazer para frente' }
      ]
    }
  ];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          className="gap-2"
        >
          <Keyboard className="w-4 h-4" />
          <span className="hidden md:inline">Atalhos</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-blue-600" />
            Atalhos de Teclado - V21.0
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {atalhos.map((grupo, idx) => (
            <div key={idx}>
              <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                {grupo.categoria}
                {grupo.categoria.includes('Fase 1') && (
                  <Badge className="bg-purple-600 text-white">NOVO</Badge>
                )}
              </h3>
              <div className="space-y-2">
                {grupo.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <span className="text-sm text-slate-700">{item.acao}</span>
                    <kbd className="px-3 py-1 bg-slate-200 border border-slate-300 rounded text-xs font-mono text-slate-900">
                      {item.tecla}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <div className="flex gap-2 mb-2">
              <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-blue-900">
                <strong>Dica:</strong> Use os atalhos Ctrl+Shift para abrir formulários em janelas 
                multitarefa. Trabalhe com múltiplos cadastros simultaneamente!
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}