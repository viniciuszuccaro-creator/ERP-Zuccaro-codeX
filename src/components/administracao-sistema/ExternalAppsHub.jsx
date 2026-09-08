import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useWindow } from "@/components/lib/useWindow";
import { createPageUrl } from "@/utils";
import { Link } from "react-router-dom";
import { MessageCircle, Truck, Users, Zap, Factory, Smartphone, ShoppingCart, ExternalLink } from "lucide-react";
import { toast } from "sonner";

// Apps e ferramentas já existentes no projeto
import ChatbotDashboard from "@/components/chatbot/ChatbotDashboard";
import AppEntregasMotorista from "@/components/mobile/AppEntregasMotorista";
import DashboardCliente from "@/components/portal/DashboardCliente";
import ApontamentoProducao from "@/components/producao/ApontamentoProducao";
import ChatCliente from "@/components/portal/ChatCliente";
import ProducaoMobile from "@/pages/ProducaoMobile";
import OrcamentoSite from "@/pages/OrcamentoSite";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";

export default function ExternalAppsHub() {
  const { openWindow } = useWindow();
  const { grupoAtual, empresaAtual } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const contextoValido = Boolean((grupoAtual?.id || empresaAtual?.group_id) && empresaAtual?.id);
  const canAppMotorista =
    hasPermission('Expedicao', 'Entrega', 'entregar')
    || hasPermission('Expedicao', 'Entrega', 'editar')
    || hasPermission('Expedicao', 'Motorista', 'visualizar')
    || hasPermission('Cadastros', 'Motorista', 'visualizar');

  const launch = (Component, props, options) => () => openWindow(Component, { windowMode: true, ...(props || {}) }, { width: 1200, height: 720, ...(options || {}) });

  const launchAppMotorista = () => {
    if (!contextoValido) {
      toast.error('Selecione grupo e empresa antes de abrir o App Motorista');
      return;
    }
    if (!canAppMotorista) {
      toast.error('Sem permissao para o App Motorista');
      return;
    }
    openWindow(AppEntregasMotorista, { windowMode: true }, { title: "Apontamento de Entregas", width: 420, height: 800 });
  };

  const items = [
    { title: "Portal do Cliente", icon: Users, color: "text-sky-600", bg: "from-sky-50 to-sky-100", action: launch(DashboardCliente, {}, { title: "Portal do Cliente" }), desc: "Acesso do cliente aos pedidos e financeiro", route: createPageUrl("PortalCliente") },
    { title: "Chatbot Dashboard", icon: MessageCircle, color: "text-purple-600", bg: "from-purple-50 to-purple-100", action: launch(ChatbotDashboard, {}, { title: "Chatbot Dashboard" }), desc: "Central de atendimento automatizado", route: createPageUrl("HubAtendimento") },
    { title: "App Motorista", icon: Truck, color: "text-amber-600", bg: "from-amber-50 to-amber-100", action: launchAppMotorista, desc: "App de entrega para motoristas", route: createPageUrl("EntregasMobile") },
    { title: "Apontamento da Produção", icon: Factory, color: "text-emerald-600", bg: "from-emerald-50 to-emerald-100", action: launch(ApontamentoProducao, {}, { title: "Apontamento da Produção" }), desc: "Registro de produção no chão de fábrica", route: createPageUrl("Producao") },
    { title: "Apontamento Mobile", icon: Smartphone, color: "text-teal-600", bg: "from-teal-50 to-teal-100", action: launch(ProducaoMobile, {}, { title: "Apontamento Mobile" }), desc: "Versão mobile para produção", route: createPageUrl("ProducaoMobile") },
    { title: "Chat do Cliente", icon: MessageCircle, color: "text-indigo-600", bg: "from-indigo-50 to-indigo-100", action: launch(ChatCliente, {}, { title: "Chat do Cliente" }), desc: "Chat em tempo real com o cliente" },
    { title: "Orçamento (Site Público)", icon: ShoppingCart, color: "text-rose-600", bg: "from-rose-50 to-rose-100", action: launch(OrcamentoSite, {}, { title: "Orçamento Site Público" }), desc: "Formulário público de orçamento", route: createPageUrl("OrcamentoSite") },
  ];

  return (
    <Card className="w-full h-full border-2 border-slate-200">
      <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
        <CardTitle className="text-lg">📱 Apps, Portais & Ambientes Externos</CardTitle>
        <p className="text-sm text-slate-500 mt-1">
          Fonte única — Portal do Cliente, App Motorista, Chatbot, Produção Mobile e Orçamento Público.
        </p>
      </CardHeader>
      <CardContent className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((it) => (
            <div key={it.title} className={`rounded-xl border hover:shadow-lg transition-all p-4 bg-gradient-to-br ${it.bg} w-full flex flex-col gap-2`}>
              <div className="flex items-center justify-between">
                <div className={`p-2 rounded-lg bg-white/70`}>
                  <it.icon className={`w-5 h-5 ${it.color}`} />
                </div>
                <ExternalLink className="w-4 h-4 text-slate-400" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 text-sm">{it.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{it.desc}</p>
              </div>
              <div className="flex gap-2 mt-auto pt-1 flex-wrap">
                <Button type="button" variant="outline" size="sm" onClick={it.action} className="h-auto text-xs px-2 py-1 rounded-md bg-white/80 border-white/60 hover:bg-white transition-colors font-medium text-slate-700" data-action={`ExternalApps.${it.title}.janela`}>
                  🪟 Janela
                </Button>
                {it.route && (
                  <Link to={it.route} className="text-xs px-2 py-1 rounded-md bg-white/80 border border-white/60 hover:bg-white transition-colors font-medium text-slate-700">
                    📄 Página
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
