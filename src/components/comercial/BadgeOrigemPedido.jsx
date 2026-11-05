import React from "react";
import { Badge } from "@/components/ui/badge";
import { Lock, Bolt, User } from "lucide-react";
import { useOrigemPedido } from "@/components/lib/useOrigemPedido";

/**
 * Badge visual inteligente para origem de pedido
 * Mostra cor e ícone baseado no parâmetro configurado (escopo multiempresa via hook canônico)
 *
 * @param {{origemPedido: string, showLock?: boolean, className?: string}} props
 */
export default function BadgeOrigemPedido({
  origemPedido,
  showLock = true,
  className = "",
}) {
  const { parametros, isLoading, isError, contextoValido } = useOrigemPedido();

  // Mapear origem para canal
  const origemParaCanal = {
    Manual: 'ERP',
    Site: 'Site',
    'E-commerce': 'E-commerce',
    Chatbot: 'Chatbot',
    WhatsApp: 'WhatsApp',
    Portal: 'Portal Cliente',
    Marketplace: 'Marketplace',
    API: 'API',
    App: 'App Mobile',
    Importado: 'API',
  };

  const canal = origemParaCanal[origemPedido] || 'ERP';
  const parametro = Array.isArray(parametros) ? parametros.find((p) => p.canal === canal) : null;
  const configIndisponivel = !contextoValido || isLoading || isError;

  // Cores por badge
  const coresClasses = {
    blue: 'bg-blue-100 text-blue-800 border-blue-300',
    green: 'bg-green-100 text-green-800 border-green-300',
    purple: 'bg-purple-100 text-purple-800 border-purple-300',
    orange: 'bg-orange-100 text-orange-800 border-orange-300',
    red: 'bg-red-100 text-red-800 border-red-300',
    yellow: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    pink: 'bg-pink-100 text-pink-800 border-pink-300',
    cyan: 'bg-cyan-100 text-cyan-800 border-cyan-300',
  };

  const corClasse = parametro?.cor_badge
    ? coresClasses[parametro.cor_badge]
    : coresClasses.blue;

  const iconesTipo = {
    Manual: User,
    Automático: Bolt,
    Misto: Bolt,
  };

  const Icone = parametro?.tipo_criacao
    ? iconesTipo[parametro.tipo_criacao]
    : User;

  const ehBloqueado = parametro?.tipo_criacao === 'Automático' && parametro?.bloquear_edicao_automatico;
  const rotulo = configIndisponivel
    ? (origemPedido || '—')
    : (parametro?.nome || origemPedido || '—');

  return (
    <Badge className={`${corClasse} border ${className}`} title={configIndisponivel ? 'Configuração de canal indisponível no contexto' : undefined}>
      <Icone className="w-3 h-3 mr-1" />
      {rotulo}
      {ehBloqueado && showLock && !configIndisponivel && (
        <Lock className="w-3 h-3 ml-1" />
      )}
    </Badge>
  );
}
