import React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import usePermissions from "@/components/lib/usePermissions";
import { useUser } from "@/components/lib/UserContext";
import SegurancaDashboard from "@/components/administracao-sistema/seguranca-governanca/SegurancaDashboard";

import IAGovernancaComplianceSection from "@/components/administracao-sistema/seguranca-governanca/IAGovernancaComplianceSection";
import MonitoramentoManutencaoIndex from "@/components/administracao-sistema/MonitoramentoManutencaoIndex";
import ConfiguracaoSeguranca from "@/components/sistema/ConfiguracaoSeguranca";


import { useContextoVisual } from "@/components/lib/useContextoVisual";
import ContextoConfigBanner from "@/components/administracao-sistema/common/ContextoConfigBanner";
import HerancaConfigNotice from "@/components/administracao-sistema/common/HerancaConfigNotice";

export default function SegurancaGovernancaIndex() {
  const { isAdmin, hasPermission } = usePermissions();
  const { empresaAtual, grupoAtual, createInContext } = useContextoVisual();
  const { user } = useUser();
  const params = new URLSearchParams(window.location.search);
  const segTab = params.get('segTab') || 'politicas';
  const [activeTab, setActiveTab] = React.useState(segTab);
  const canViewSecurity =
    isAdmin() ||
    hasPermission('Sistema', 'Seguranca', 'visualizar') ||
    hasPermission('Sistema', 'Segurança', 'visualizar');

  const handleTabChange = (value) => {
    setActiveTab(value);
    const nextParams = new URLSearchParams(window.location.search);
    nextParams.set('tab', 'seguranca');
    nextParams.set('segTab', value);
    window.history.replaceState(null, '', `${window.location.pathname}?${nextParams.toString()}`);
    try {
      void createInContext('AuditLog', {
        usuario: user?.full_name || user?.email || "Usuario local",
        usuario_id: user?.id || null,
        empresa_id: empresaAtual?.id || null,
        group_id: grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null,
        acao: "Visualizacao",
        modulo: "Sistema",
        entidade: "Seguranca",
        descricao: `Aba de seguranca visualizada: ${value}`,
        data_hora: new Date().toISOString()
      }).catch((error) => console.warn("Falha ao auditar aba de seguranca:", error));
    } catch {}
  };

  if (!canViewSecurity) return <div className="p-4 text-sm text-slate-500">Acesso restrito.</div>;

  return (
    <div className="w-full h-full min-h-0 flex flex-col overflow-auto">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full h-full min-h-0">
        <TabsList className="flex flex-wrap gap-2">
          <TabsTrigger value="politicas" data-action="Seguranca.tab.politicas" data-permission="Sistema.Seguranca.visualizar" data-context-required="group-or-company">Políticas</TabsTrigger>
          <TabsTrigger value="manutencao" data-action="Seguranca.tab.manutencao" data-permission="Sistema.Seguranca.visualizar" data-context-required="group-or-company">Monitoramento & Manutenção</TabsTrigger>
          <TabsTrigger value="compliance" data-action="Seguranca.tab.compliance" data-permission="Sistema.Seguranca.visualizar" data-context-required="group-or-company">Compliance IA</TabsTrigger>
        </TabsList>

        <TabsContent value="politicas" className="mt-4 w-full h-full min-h-0">
          <Card className="w-full h-full">
            <CardContent className="p-4">
              <ContextoConfigBanner />
              <HerancaConfigNotice />
              <ConfiguracaoSeguranca empresaId={empresaAtual?.id || null} grupoId={grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null} />
              <SegurancaDashboard />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manutencao" className="mt-4 w-full h-full min-h-0">
          <Card className="w-full h-full">
            <CardContent className="p-4">
              <MonitoramentoManutencaoIndex />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compliance" className="mt-4 w-full h-full min-h-0">
          <Card className="w-full h-full">
            <CardContent className="p-4">
              <IAGovernancaComplianceSection />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
