import React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import ContextoConfigBanner from "@/components/administracao-sistema/common/ContextoConfigBanner";
import HerancaConfigNotice from "@/components/administracao-sistema/common/HerancaConfigNotice";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import ProtectedSection from "@/components/security/ProtectedSection";
import ConfiguracaoBackup from "@/components/sistema/ConfiguracaoBackup";
import ConfiguracaoMonitoramento from "@/components/sistema/ConfiguracaoMonitoramento";
import MonitorAcessoRealtimeSection from "@/components/administracao-sistema/seguranca-governanca/MonitorAcessoRealtimeSection";
import PainelGovernancaSection from "@/components/administracao-sistema/seguranca-governanca/PainelGovernancaSection";
import { base44 } from "@/api/base44Client";
import { useUser } from "@/components/lib/UserContext";
import usePermissions from "@/components/lib/usePermissions";

export default function MonitoramentoManutencaoIndex({ initialTab = "monitoramento" }) {
  const { empresaAtual, grupoAtual } = useContextoVisual();
  const { user } = useUser();
  const { isAdmin, hasPermission } = usePermissions();
  const [tab, setTab] = React.useState(initialTab);
  const grupoAtivoId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const contextoValido = !!(empresaAtual?.id || grupoAtivoId);
  const canViewTab = (next) => {
    if (isAdmin()) return true;
    const mapa = {
      monitoramento: [['Seguranca', 'Monitoramento'], ['SeguranÁa', 'Monitoramento'], 'Monitoramento'],
      backup: [['Seguranca', 'Backup'], ['SeguranÁa', 'Backup'], 'Backup'],
      acesso: [['Seguranca', 'Monitoramento', 'AcessoRealtime'], ['SeguranÁa', 'Monitoramento', 'AcessoRealtime'], 'AcessoRealtime'],
      governanca: [['Seguranca', 'Governanca'], ['SeguranÁa', 'GovernanÁa'], 'Governanca'],
    };
    return (mapa[next] || []).some((section) => hasPermission('Sistema', section, 'visualizar'));
  };

  const registrarAuditoriaMonitoramento = (acao, next, sucesso = true, detalhe = null) => {
    try {
      base44.entities.AuditLog.create({
        usuario: user?.full_name || user?.email || "Usuario local",
        usuario_id: user?.id || null,
        empresa_id: empresaAtual?.id || null,
        group_id: grupoAtivoId || null,
        grupo_id: grupoAtivoId || null,
        acao,
        modulo: "Monitoramento",
        entidade: "AdministracaoSistema",
        tipo_auditoria: sucesso ? "acesso" : "seguranca",
        descricao: detalhe || `Aba de monitoramento visualizada: ${next}`,
        sucesso,
        data_hora: new Date().toISOString(),
      });
    } catch (error) {
      console.warn("Falha ao auditar aba de monitoramento:", error);
    }
  };

  const handleTabChange = (next) => {
    if (!contextoValido || !canViewTab(next)) {
      registrarAuditoriaMonitoramento(
        "Monitoramento.aba_bloqueada",
        next,
        false,
        !contextoValido
          ? `Aba de monitoramento bloqueada sem contexto grupo/empresa: ${next}`
          : `Aba de monitoramento bloqueada sem permissao: ${next}`
      );
      return;
    }
    setTab(next);
    registrarAuditoriaMonitoramento("Visualizacao", next, true);
  };

  return (
    <div className="w-full h-full flex flex-col">
      <Tabs value={tab} onValueChange={handleTabChange} className="w-full h-full" data-context-required="true" data-permission="Sistema.Monitoramento.visualizar">
        <TabsList className="flex flex-wrap gap-2">
          <TabsTrigger value="monitoramento" disabled={!contextoValido || !canViewTab("monitoramento")} data-action="Monitoramento.tab.monitoramento" data-permission="Sistema.Monitoramento.visualizar" data-context-required="true">Monitoramento</TabsTrigger>
          <TabsTrigger value="backup" disabled={!contextoValido || !canViewTab("backup")} data-action="Monitoramento.tab.backup" data-permission="Sistema.Backup.visualizar" data-context-required="true">Backup</TabsTrigger>
          <TabsTrigger value="acesso" disabled={!contextoValido || !canViewTab("acesso")} data-action="Monitoramento.tab.acesso" data-permission="Sistema.Seguranca.Monitoramento.AcessoRealtime.visualizar" data-context-required="true">Acesso em Tempo Real</TabsTrigger>
          <TabsTrigger value="governanca" disabled={!contextoValido || !canViewTab("governanca")} data-action="Monitoramento.tab.governanca" data-permission="Sistema.Seguranca.Governanca.visualizar" data-context-required="true">Governan√ßa</TabsTrigger>
        </TabsList>

        <TabsContent value="monitoramento" className="mt-4">
          <Card className="w-full">
            <CardContent className="p-4">
              <ContextoConfigBanner />
              <HerancaConfigNotice />
              <ProtectedSection module="Sistema" section={["Seguran√ßa","Monitoramento"]} action="visualizar">
                <ConfiguracaoMonitoramento empresaId={empresaAtual?.id} grupoId={grupoAtual?.id} />
              </ProtectedSection>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="backup" className="mt-4">
          <Card className="w-full">
            <CardContent className="p-4">
              <ContextoConfigBanner />
              <HerancaConfigNotice />
              <ProtectedSection module="Sistema" section={["Seguran√ßa","Backup"]} action="visualizar">
                <ConfiguracaoBackup empresaId={empresaAtual?.id} grupoId={grupoAtual?.id} />
              </ProtectedSection>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="acesso" className="mt-4">
          <Card className="w-full">
            <CardContent className="p-4">
              <ContextoConfigBanner />
              <HerancaConfigNotice />
              <ProtectedSection module="Sistema" section={["Seguran√ßa","Monitoramento","AcessoRealtime"]} action="visualizar">
                <MonitorAcessoRealtimeSection />
              </ProtectedSection>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="governanca" className="mt-4">
          <Card className="w-full">
            <CardContent className="p-4">
              <ContextoConfigBanner />
              <HerancaConfigNotice />
              <ProtectedSection module="Sistema" section={["Seguran√ßa","Governan√ßa"]} action="visualizar">
                <PainelGovernancaSection />
              </ProtectedSection>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
