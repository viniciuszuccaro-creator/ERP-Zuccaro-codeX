import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Badge de status padronizado com cores automáticas
 * 
 * Componente inteligente que aplica cores baseadas no status fornecido,
 * seguindo padrões visuais do sistema.
 * 
 * @param {{status: string, customColors?: Record<string, string>, variant?: React.ComponentProps<typeof Badge>['variant'], className?: string}} props
 * 
 * @example
 * <StatusBadge status="Aprovado" />
 * <StatusBadge status="Pendente" customColors={{ Pendente: "bg-yellow-100 text-yellow-700" }} />
 */
export default function StatusBadge({ 
  status, 
  customColors = {},
  variant = "default",
  className = "" 
}) {
  
  // Cores padrão por categorias comuns
  const defaultColors = {
    // Positivos/Concluídos
    'Aprovado': 'bg-green-100 text-green-700 border-green-200',
    'Ativo': 'bg-green-100 text-green-700 border-green-200',
    'Concluído': 'bg-green-100 text-green-700 border-green-200',
    'Entregue': 'bg-green-100 text-green-700 border-green-200',
    'Pago': 'bg-green-100 text-green-700 border-green-200',
    'Recebido': 'bg-green-100 text-green-700 border-green-200',
    'Finalizado': 'bg-green-100 text-green-700 border-green-200',
    'Sucesso': 'bg-green-100 text-green-700 border-green-200',
    
    // Pendentes/Em Andamento
    'Pendente': 'bg-yellow-100 text-yellow-700 border-yellow-200',
    'Aguardando': 'bg-yellow-100 text-yellow-700 border-yellow-200',
    'Em Andamento': 'bg-blue-100 text-blue-700 border-blue-200',
    'Em Análise': 'bg-blue-100 text-blue-700 border-blue-200',
    'Em Produção': 'bg-blue-100 text-blue-700 border-blue-200',
    'Em Processo': 'bg-blue-100 text-blue-700 border-blue-200',
    'Em Trânsito': 'bg-cyan-100 text-cyan-700 border-cyan-200',
    'Processando': 'bg-blue-100 text-blue-700 border-blue-200',
    
    // Negativos/Problemas
    'Cancelado': 'bg-gray-100 text-gray-700 border-gray-200',
    'Inativo': 'bg-gray-100 text-gray-700 border-gray-200',
    'Rejeitado': 'bg-red-100 text-red-700 border-red-200',
    'Reprovado': 'bg-red-100 text-red-700 border-red-200',
    'Atrasado': 'bg-red-100 text-red-700 border-red-200',
    'Vencido': 'bg-red-100 text-red-700 border-red-200',
    'Erro': 'bg-red-100 text-red-700 border-red-200',
    'Bloqueado': 'bg-red-100 text-red-700 border-red-200',
    
    // Alertas
    'Urgente': 'bg-orange-100 text-orange-700 border-orange-200',
    'Alta': 'bg-orange-100 text-orange-700 border-orange-200',
    'Alerta': 'bg-orange-100 text-orange-700 border-orange-200',
    
    // Neutros
    'Rascunho': 'bg-slate-100 text-slate-700 border-slate-200',
    'Normal': 'bg-slate-100 text-slate-700 border-slate-200',
    'Média': 'bg-slate-100 text-slate-700 border-slate-200',
    'Baixa': 'bg-slate-100 text-slate-700 border-slate-200',
    
    // Específicos
    'Prospect': 'bg-purple-100 text-purple-700 border-purple-200',
    'Parcial': 'bg-amber-100 text-amber-700 border-amber-200',
  };

  const colors = { ...defaultColors, ...customColors };
  const colorClass = colors[status] || 'bg-slate-100 text-slate-700 border-slate-200';

  return (
    <Badge 
      variant={variant}
      className={cn(colorClass, className)}
    >
      {status}
    </Badge>
  );
}
