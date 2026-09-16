import React, { useCallback, useEffect, useRef, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Settings, Users, Shield, FileText, Wrench, Brain, Plug } from "lucide-react";
import usePermissions from "@/components/lib/usePermissions";
import ProtectedSection from "@/components/security/ProtectedSection";
import { useUser } from "@/components/lib/UserContext";
import { useContextoVisual } from "@/components/lib/useContextoVisual";

// Lazy sub-modules para não carregar tudo ao mesmo tempo
import AdminStatusBar from "@/components/administracao-sistema/AdminStatusBar";
import ConfiguracoesGeraisIndex from "@/components/administracao-sistema/configuracoes-gerais/ConfiguracoesGeraisIndex";
import IntegracoesIndex from "@/components/administracao-sistema/IntegracoesIndex";
import AuditoriaLogsIndex from "@/components/administracao-sistema/auditoria-logs/AuditoriaLogsIndex";
import SegurancaGovernancaIndex from "@/components/administracao-sistema/seguranca-governanca/SegurancaGovernancaIndex";
import IAOtimizacaoIndex from "@/components/administracao-sistema/IAOtimizacaoIndex";
import GestaoAcessosIndex from "@/components/administracao-sistema/gestao-acessos/GestaoAcessosIndex";
import AdminFerramentas from "@/components/administracao-sistema/AdminFerramentas";

const TAB_DEFS = [
  { value: "gerais",      label: "Parâmetros Gerais",     icon: Settings,  perm: "Configurações",    color: "blue" },
  { value: "integracoes", label: "Integrações",            icon: Plug,      perm: "Integrações",      color: "blue" },
  { value: "acessos",     label: "Gestão de Acessos",     icon: Users,     perm: "Controle de Acesso",color: "blue" },
  { value: "seguranca",   label: "Segurança & Gov.",      icon: Shield,    perm: "Segurança",        color: "blue" },
  { value: "ia",          label: "IA & Otimização",        icon: Brain,     perm: "IA",               color: "purple" },
  { value: "auditoria",   label: "Auditoria e Logs",      icon: FileText,  perm: "Auditoria",        color: "blue" },
];

const FERRAMENTAS_TAB = {
  value: "ferramentas",
  label: "Ferramentas",
  icon: Wrench,
  perm: "Ferramentas",
  color: "orange",
};

const getTabPermissionKey = (tab) => `Sistema.${tab.perm}.visualizar`;

const sanitizeFerramentaText = (value, max = 300) => String(value ?? "")
  .replace(/[<>]/g, "")
  .replace(/javascript:/gi, "")
  .trim()
  .slice(0, max);

export default function AdminTabs({
  initialTab,
  requestedTab = initialTab,
  isRequestedTabValid = true,
  isAdmin,
  empresaAtual,
  grupoAtual,
}) {
  const { hasPermission } = usePermissions();
  const { user } = useUser();
  const { createInContext } = useContextoVisual();
  const isAdminUser = typeof isAdmin === 'function' ? isAdmin() : !!isAdmin;
  const [activeTab, setActiveTab] = useState(initialTab || "gerais");
  const lastInitialResolutionRef = useRef(null);
  const grupoId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;

  const auditTabChange = useCallback(async ({ tab, permitido, motivo, abaAnterior }) => {
    try {
      await createInContext("AuditLog", {
        acao: permitido ? "admin_tab_acessada" : "admin_tab_bloqueada",
        entidade: "AdministracaoSistemaTabs",
        entidade_id: `admin-tab-${sanitizeFerramentaText(tab, 80)}`,
        tipo: permitido ? "acesso" : "seguranca",
        usuario_id: user?.id || user?.email || "sistema",
        usuario_nome: user?.full_name || user?.name || user?.email || "Sistema",
        group_id: grupoId,
        grupo_id: grupoId,
        empresa_id: empresaId,
        detalhes: {
          aba: sanitizeFerramentaText(tab, 80),
          aba_anterior: sanitizeFerramentaText(abaAnterior, 80),
          motivo,
          permissao: "Sistema.visualizar",
          groupId: grupoId,
          empresaId
        },
        sucesso: permitido,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.warn("[AdminTabs] Falha ao auditar troca de aba:", error);
    }
  }, [createInContext, empresaId, grupoId, user?.email, user?.full_name, user?.id, user?.name]);

  const syncTabUrl = useCallback((tab) => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tab);
      window.history.replaceState({}, "", url.toString());
    } catch (error) {
      console.warn("[AdminTabs] Falha ao sincronizar aba na URL:", error);
    }
  }, []);

  const canAccess = (perm) => isAdminUser || hasPermission('Sistema', perm, 'visualizar');

  const visibleTabs = TAB_DEFS.filter(t => canAccess(t.perm));
  const canAccessFerramentas = canAccess(FERRAMENTAS_TAB.perm);
  const allowedTabs = [
    ...visibleTabs,
    ...(canAccessFerramentas ? [FERRAMENTAS_TAB] : []),
  ];
  const allowedTabValues = new Set(allowedTabs.map((tab) => tab.value));
  const allowedTabSignature = allowedTabs.map((tab) => tab.value).join("|");
  const firstAllowedTab = allowedTabs[0]?.value || "";

  useEffect(() => {
    const requestedCanonicalTab = initialTab || "gerais";
    const requestedValue = requestedTab || requestedCanonicalTab;
    const requestedAllowed = isRequestedTabValid && allowedTabValues.has(requestedCanonicalTab);
    const nextTab = requestedAllowed ? requestedCanonicalTab : firstAllowedTab;
    const resolutionKey = [requestedValue, requestedCanonicalTab, nextTab, allowedTabSignature, grupoId, empresaId].join("|");

    if (lastInitialResolutionRef.current === resolutionKey) return;
    lastInitialResolutionRef.current = resolutionKey;

    auditTabChange({
      tab: requestedValue,
      permitido: requestedAllowed,
      motivo: requestedAllowed ? "aba_inicial_autorizada" : "aba_inicial_sem_permissao_ou_inexistente",
      abaAnterior: activeTab,
    });

    if (!nextTab) {
      setActiveTab("");
      return;
    }

    setActiveTab(nextTab);
    syncTabUrl(nextTab);
  }, [
    activeTab,
    allowedTabSignature,
    auditTabChange,
    empresaId,
    firstAllowedTab,
    grupoId,
    initialTab,
    isRequestedTabValid,
    requestedTab,
    syncTabUrl,
  ]);

  // Atualiza URL sem recarregar a página
  const handleTabChange = (val) => {
    const permitido = allowedTabValues.has(val);
    auditTabChange({
      tab: val,
      permitido,
      motivo: permitido ? "aba_disponivel_para_usuario" : "aba_sem_permissao_ou_inexistente",
      abaAnterior: activeTab,
    });
    if (!permitido) return;

    setActiveTab(val);
    syncTabUrl(val);
  };

  // Garante que o tab ativo seja válido
  const resolvedTab = allowedTabValues.has(activeTab)
    ? activeTab
    : firstAllowedTab;

  const triggerClass = (color) =>
    color === "purple"
      ? "data-[state=active]:bg-purple-600 data-[state=active]:text-white"
      : "data-[state=active]:bg-blue-600 data-[state=active]:text-white";

  return (
    <Tabs value={resolvedTab} onValueChange={handleTabChange} className="w-full h-full">
      <TabsList className="flex flex-wrap gap-1 h-auto bg-slate-100 p-1 rounded-xl">
        {visibleTabs.map((tab) => {
          const { value, label, icon: Icon, color } = tab;
          return (
          <TabsTrigger
            key={value}
            value={value}
            data-action={`AdminTabs.${value}`}
            data-permission={getTabPermissionKey(tab)}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${triggerClass(color)}`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">{label}</span>
          </TabsTrigger>
          );
        })}
        {canAccessFerramentas && (
          <TabsTrigger
            value="ferramentas"
            data-action="AdminTabs.ferramentas"
            data-permission={getTabPermissionKey(FERRAMENTAS_TAB)}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium data-[state=active]:bg-orange-600 data-[state=active]:text-white"
          >
            <Wrench className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Ferramentas</span>
          </TabsTrigger>
        )}
      </TabsList>

      {!firstAllowedTab && (
        <p className="mt-4 p-4 text-sm text-slate-500" data-rbac-empty-state>
          Nenhuma área administrativa foi liberada para este perfil.
        </p>
      )}

      {/* ── STATUS BAR GLOBAL ── */}
      <div className="mt-3">
        <AdminStatusBar />
      </div>

      {/* ── PARÂMETROS GERAIS ── */}
      <TabsContent value="gerais" className="mt-4">
        <ProtectedSection
          module="Sistema" section={["Configurações"]} action="visualizar"
          fallback={<p className="p-4 text-sm text-slate-500">Acesso restrito às Configurações.</p>}
        >
          <div className="w-full h-full overflow-auto">
            <ConfiguracoesGeraisIndex />
          </div>
        </ProtectedSection>
      </TabsContent>

      {/* ── INTEGRAÇÕES ── */}
      <TabsContent value="integracoes" className="mt-4">
        <ProtectedSection
          module="Sistema" section={["Integrações"]} action="visualizar"
          fallback={<p className="p-4 text-sm text-slate-500">Acesso restrito às Integrações.</p>}
        >
          <div className="w-full h-full">
            <IntegracoesIndex initialTab={null} />
          </div>
        </ProtectedSection>
      </TabsContent>

      {/* ── GESTÃO DE ACESSOS ── */}
      <TabsContent value="acessos" className="mt-4">
        <ProtectedSection
          module="Sistema" section={["Controle de Acesso"]} action="visualizar"
          fallback={<p className="p-4 text-sm text-slate-500">Acesso restrito à Gestão de Acessos.</p>}
        >
          <div className="w-full h-full overflow-hidden">
            <GestaoAcessosIndex />
          </div>
        </ProtectedSection>
      </TabsContent>

      {/* ── SEGURANÇA & GOVERNANÇA ── */}
      <TabsContent value="seguranca" className="mt-4">
        <ProtectedSection
          module="Sistema" section={["Segurança"]} action="visualizar"
          fallback={<p className="p-4 text-sm text-slate-500">Acesso restrito à Segurança.</p>}
        >
          <div className="w-full h-full">
            <SegurancaGovernancaIndex />
          </div>
        </ProtectedSection>
      </TabsContent>

      {/* ── IA & OTIMIZAÇÃO ── */}
      <TabsContent value="ia" className="mt-4">
        <ProtectedSection
          module="Sistema" section={["IA"]} action="visualizar"
          fallback={<p className="p-4 text-sm text-slate-500">Acesso restrito às configurações de IA.</p>}
        >
          <div className="w-full h-full">
            <IAOtimizacaoIndex initialTab={null} />
          </div>
        </ProtectedSection>
      </TabsContent>

      {/* ── AUDITORIA E LOGS ── */}
      <TabsContent value="auditoria" className="mt-4">
        <ProtectedSection
          module="Sistema" section={["Auditoria"]} action="visualizar"
          fallback={<p className="p-4 text-sm text-slate-500">Acesso restrito à Auditoria.</p>}
        >
          <div className="w-full h-full">
            <AuditoriaLogsIndex />
          </div>
        </ProtectedSection>
      </TabsContent>

      {/* ── FERRAMENTAS (admin only) ── */}
      {canAccessFerramentas && (
        <TabsContent value="ferramentas" className="mt-4">
          <AdminFerramentas empresaAtual={empresaAtual} grupoAtual={grupoAtual} />
        </TabsContent>
      )}
    </Tabs>
  );
}
