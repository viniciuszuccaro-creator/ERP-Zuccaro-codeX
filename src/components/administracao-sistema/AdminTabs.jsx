import React, { useState, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Settings, Users, Shield, FileText, Sparkles, Wrench, Brain, Plug } from "lucide-react";
import usePermissions from "@/components/lib/usePermissions";
import ProtectedSection from "@/components/security/ProtectedSection";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
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

const TAB_DEFS = [
  { value: "gerais",      label: "Parâmetros Gerais",     icon: Settings,  perm: "Configurações",    color: "blue" },
  { value: "integracoes", label: "Integrações",            icon: Plug,      perm: "Integrações",      color: "blue" },
  { value: "acessos",     label: "Gestão de Acessos",     icon: Users,     perm: "Controle de Acesso",color: "blue" },
  { value: "seguranca",   label: "Segurança & Gov.",      icon: Shield,    perm: "Segurança",        color: "blue" },
  { value: "ia",          label: "IA & Otimização",        icon: Brain,     perm: "IA",               color: "purple" },
  { value: "auditoria",   label: "Auditoria e Logs",      icon: FileText,  perm: "Auditoria",        color: "blue" },
];

const sanitizeFerramentaText = (value, max = 300) => String(value ?? "")
  .replace(/[<>]/g, "")
  .replace(/javascript:/gi, "")
  .trim()
  .slice(0, max);

const sanitizeFerramentaPayload = (value) => {
  if (Array.isArray(value)) return value.map(sanitizeFerramentaPayload);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        sanitizeFerramentaText(key, 80),
        sanitizeFerramentaPayload(item)
      ])
    );
  }
  return typeof value === "string" ? sanitizeFerramentaText(value, 500) : value;
};

export default function AdminTabs({ initialTab, isAdmin, empresaAtual, grupoAtual }) {
  const { hasPermission } = usePermissions();
  const { user } = useUser();
  const { createInContext } = useContextoVisual();
  const isAdminUser = typeof isAdmin === 'function' ? isAdmin() : !!isAdmin;
  const [activeTab, setActiveTab] = useState(initialTab || "gerais");
  const grupoId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;

  // Sync com URL param ao navegar externamente
  useEffect(() => {
    if (initialTab && initialTab !== activeTab) setActiveTab(initialTab);
  }, [initialTab]);

  const auditTabChange = async ({ tab, permitido, motivo }) => {
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
          aba_anterior: activeTab,
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
  };

  // Atualiza URL sem recarregar a página
  const handleTabChange = (val) => {
    const permitido = allowedTabValues.has(val);
    auditTabChange({
      tab: val,
      permitido,
      motivo: permitido ? "aba_disponivel_para_usuario" : "aba_sem_permissao_ou_inexistente"
    });
    if (!permitido) return;

    setActiveTab(val);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", val);
      window.history.replaceState({}, "", url.toString());
    } catch (_) {}
  };

  const canAccess = (perm) => isAdminUser || hasPermission('Sistema', perm, 'visualizar');

  const visibleTabs = TAB_DEFS.filter(t => canAccess(t.perm));
  const allowedTabValues = new Set([
    ...visibleTabs.map((tab) => tab.value),
    ...(isAdminUser ? ["ferramentas"] : []),
  ]);

  // Garante que o tab ativo seja válido
  const resolvedTab = allowedTabValues.has(activeTab)
    ? activeTab
    : (visibleTabs[0]?.value || "gerais");

  const triggerClass = (color) =>
    color === "purple"
      ? "data-[state=active]:bg-purple-600 data-[state=active]:text-white"
      : "data-[state=active]:bg-blue-600 data-[state=active]:text-white";

  return (
    <Tabs value={resolvedTab} onValueChange={handleTabChange} className="w-full h-full">
      <TabsList className="flex flex-wrap gap-1 h-auto bg-slate-100 p-1 rounded-xl">
        {visibleTabs.map(({ value, label, icon: Icon, color }) => (
          <TabsTrigger
            key={value}
            value={value}
            data-action={`AdminTabs.${value}`}
            data-permission={`Sistema.${value}.visualizar`}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${triggerClass(color)}`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">{label}</span>
          </TabsTrigger>
        ))}
        {isAdminUser && (
          <TabsTrigger
            value="ferramentas"
            data-action="AdminTabs.ferramentas"
            data-permission="Sistema.ferramentas.visualizar"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium data-[state=active]:bg-orange-600 data-[state=active]:text-white"
          >
            <Wrench className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Ferramentas</span>
          </TabsTrigger>
        )}
      </TabsList>

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
            <IntegracoesIndex />
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
            <IAOtimizacaoIndex />
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
      {isAdminUser && (
        <TabsContent value="ferramentas" className="mt-4">
          <AdminFerramentas empresaAtual={empresaAtual} grupoAtual={grupoAtual} />
        </TabsContent>
      )}
    </Tabs>
  );
}

function AdminFerramentas({ empresaAtual, grupoAtual }) {
  const { user } = useUser();
  const { createInContext } = useContextoVisual();
  const { isAdmin, hasPermission } = usePermissions();
  const [loadingSeed, setLoadingSeed] = useState(false);
  const [loadingBackfillDry, setLoadingBackfillDry] = useState(false);
  const [loadingBackfillApply, setLoadingBackfillApply] = useState(false);
  const grupoId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const contextoValido = !!(grupoId || empresaId);
  const isAdminUser = typeof isAdmin === "function" ? isAdmin() : false;
  const podeCriarFerramenta = isAdminUser ||
    hasPermission("Sistema", "Ferramentas", "criar") ||
    hasPermission("Sistema", "Configuracoes", "criar") ||
    hasPermission("Sistema", "Configurações", "criar");
  const podeExecutarFerramenta = isAdminUser ||
    hasPermission("Sistema", "Ferramentas", "executar") ||
    hasPermission("Sistema", "Configuracoes", "executar") ||
    hasPermission("Sistema", "Configurações", "executar");
  const podeEditarFerramenta = isAdminUser ||
    hasPermission("Sistema", "Ferramentas", "editar") ||
    hasPermission("Sistema", "Configuracoes", "editar") ||
    hasPermission("Sistema", "Configurações", "editar");

  const dadosContextoFerramenta = () => ({
    contexto: grupoAtual?.id ? "grupo" : empresaAtual?.id ? "empresa" : "sem-contexto",
    contexto_valido: contextoValido,
    groupId: grupoId,
    empresaId,
    grupo_nome: grupoAtual?.nome || grupoAtual?.nome_grupo || null,
    empresa_nome: empresaAtual?.nome_fantasia || empresaAtual?.razao_social || null,
  });

  const auditFerramenta = async ({ acao, descricao, dadosNovos, sucesso = true, erro = null }) => {
    try {
      await createInContext("AuditLog", {
        usuario: user?.full_name || user?.email || "Usuario local",
        usuario_id: user?.id || null,
        empresa_id: empresaId,
        group_id: grupoId,
        grupo_id: grupoId,
        acao: sanitizeFerramentaText(acao, 120),
        modulo: "Administracao",
        entidade: "FerramentasAdministrativas",
        descricao: sanitizeFerramentaText(descricao, 500),
        tipo_auditoria: sucesso ? "execucao" : "seguranca",
        dados_novos: sanitizeFerramentaPayload({
          ...dadosContextoFerramenta(),
          ...(dadosNovos || {}),
          erro: erro ? sanitizeFerramentaText(erro, 500) : null,
        }),
        sucesso,
        data_hora: new Date().toISOString(),
      });
    } catch (error) {
      console.warn("Falha ao auditar ferramenta administrativa:", error);
    }
  };

  const runSeed = async () => {
    if (!contextoValido) {
      toast.error("Selecione um grupo ou empresa antes de executar seed.");
      await auditFerramenta({
        acao: "Bloqueio sem contexto",
        descricao: "Tentativa de executar seed leve sem grupo ou empresa.",
        dadosNovos: { ferramenta: "seedData" },
        sucesso: false
      });
      return;
    }
    if (!podeCriarFerramenta) {
      toast.error("Seu perfil nao permite executar seed administrativo.");
      await auditFerramenta({
        acao: "Bloqueio por permissao",
        descricao: "Tentativa de executar seed leve sem permissao.",
        dadosNovos: { ferramenta: "seedData", permissao: "Sistema.Ferramentas.criar" },
        sucesso: false
      });
      return;
    }
    setLoadingSeed(true);
    try {
      const payload = {
        counts: { clientes: 5, produtos: 10, colaboradores: 5 },
        group_id: grupoId,
        empresa_id: empresaId,
      };
      const res = await base44.functions.invoke('seedData', payload);
      await auditFerramenta({
        acao: "Seed",
        descricao: "Seed leve executado em ferramentas administrativas",
        dadosNovos: { ferramenta: "seedData", payload, summary: res?.data?.summary || null }
      });
      toast.success('Seed concluído: ' + JSON.stringify(res?.data?.summary || {}, null, 2));
    } catch (err) {
      await auditFerramenta({
        acao: "Erro no seed",
        descricao: "Seed leve falhou em ferramentas administrativas.",
        dadosNovos: { ferramenta: "seedData" },
        sucesso: false,
        erro: err?.message
      });
      toast.error('Erro no seed: ' + err?.message);
    } finally {
      setLoadingSeed(false);
    }
  };

  const runBackfillDry = async () => {
    if (!contextoValido) {
      toast.error("Selecione um grupo ou empresa antes de executar dry-run.");
      await auditFerramenta({
        acao: "Bloqueio sem contexto",
        descricao: "Tentativa de executar dry-run de backfill sem grupo ou empresa.",
        dadosNovos: { ferramenta: "backfillGroupEmpresa", dryRun: true },
        sucesso: false
      });
      return;
    }
    if (!podeExecutarFerramenta) {
      toast.error("Seu perfil nao permite executar dry-run administrativo.");
      await auditFerramenta({
        acao: "Bloqueio por permissao",
        descricao: "Tentativa de executar dry-run de backfill sem permissao.",
        dadosNovos: { ferramenta: "backfillGroupEmpresa", dryRun: true, permissao: "Sistema.Ferramentas.executar" },
        sucesso: false
      });
      return;
    }
    setLoadingBackfillDry(true);
    try {
      const payload = { dryRun: true, apply: false, limitPerEntity: 1000, group_id: grupoId, empresa_id: empresaId };
      const res = await base44.functions.invoke('backfillGroupEmpresa', payload);
      await auditFerramenta({
        acao: "Backfill Dry-run",
        descricao: "Dry-run de backfill multiempresa executado",
        dadosNovos: { payload, summary: res?.data?.summary || null }
      });
      toast.success('Dry-run: ' + JSON.stringify(res?.data?.summary || {}, null, 2));
    } catch (err) {
      await auditFerramenta({
        acao: "Erro no backfill dry-run",
        descricao: "Dry-run de backfill multiempresa falhou.",
        dadosNovos: { ferramenta: "backfillGroupEmpresa", dryRun: true },
        sucesso: false,
        erro: err?.message
      });
      toast.error('Erro: ' + err?.message);
    } finally {
      setLoadingBackfillDry(false);
    }
  };

  const runBackfillApply = async () => {
    if (!contextoValido) {
      toast.error("Selecione um grupo ou empresa antes de aplicar backfill.");
      await auditFerramenta({
        acao: "Bloqueio sem contexto",
        descricao: "Tentativa de aplicar backfill multiempresa sem grupo ou empresa.",
        dadosNovos: { ferramenta: "backfillGroupEmpresa", apply: true },
        sucesso: false
      });
      return;
    }
    if (!podeEditarFerramenta) {
      toast.error("Seu perfil nao permite aplicar correcoes administrativas.");
      await auditFerramenta({
        acao: "Bloqueio por permissao",
        descricao: "Tentativa de aplicar backfill multiempresa sem permissao.",
        dadosNovos: { ferramenta: "backfillGroupEmpresa", apply: true, permissao: "Sistema.Ferramentas.editar" },
        sucesso: false
      });
      return;
    }
    if (!confirm('Aplicar correcoes de multiempresa? Esta acao sera auditada e deve ser usada somente apos dry-run.')) {
      await auditFerramenta({
        acao: "Backfill cancelado",
        descricao: "Usuario cancelou aplicacao de backfill multiempresa.",
        dadosNovos: { ferramenta: "backfillGroupEmpresa", apply: true },
        sucesso: false
      });
      return;
    }
    setLoadingBackfillApply(true);
    try {
      const payload = { dryRun: false, apply: true, limitPerEntity: 1000, group_id: grupoId, empresa_id: empresaId };
      const res = await base44.functions.invoke('backfillGroupEmpresa', payload);
      await auditFerramenta({
        acao: "Backfill Aplicado",
        descricao: "Backfill multiempresa aplicado",
        dadosNovos: { payload, summary: res?.data?.summary || null }
      });
      toast.success('Aplicado: ' + JSON.stringify(res?.data?.summary || {}, null, 2));
    } catch (err) {
      await auditFerramenta({
        acao: "Erro no backfill aplicado",
        descricao: "Aplicacao de backfill multiempresa falhou.",
        dadosNovos: { ferramenta: "backfillGroupEmpresa", apply: true },
        sucesso: false,
        erro: err?.message
      });
      toast.error('Erro: ' + err?.message);
    } finally {
      setLoadingBackfillApply(false);
    }
  };

  return (
    <div
      className="w-full h-full space-y-4"
      data-permission="Sistema.Configuracoes.executar"
      data-context-required="group_id|empresa_id"
    >
      <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-800">
        ⚠️ <strong>Ferramentas administrativas</strong> — Use com cautela. Estas operações afetam dados reais do banco.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="font-semibold text-slate-900">Seed de Dados (Teste)</h3>
            <p className="text-xs text-slate-500">Cria clientes, produtos e colaboradores de teste com contexto multiempresa atual.</p>
            <Button variant="outline" onClick={runSeed} disabled={loadingSeed || !contextoValido || !podeCriarFerramenta} data-action="AdminFerramentas.seedLeve" data-permission="Sistema.Ferramentas.criar" data-context-required="group-or-company" data-sensitive="true">
              {loadingSeed ? 'Executando…' : 'Executar Seed Leve'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="font-semibold text-slate-900">Backfill Multiempresa</h3>
            <p className="text-xs text-slate-500">Dry-run valida e lista correções de group_id/empresa_id; Aplicar executa somente casos inequívocos.</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={runBackfillDry} disabled={loadingBackfillDry || !contextoValido || !podeExecutarFerramenta} data-action="AdminFerramentas.backfillDryRun" data-permission="Sistema.Ferramentas.executar" data-context-required="group-or-company">
                {loadingBackfillDry ? 'Analisando…' : 'Dry-run (visualizar)'}
              </Button>
              <Button
                className="bg-orange-600 hover:bg-orange-700 text-white"
                onClick={runBackfillApply}
                disabled={loadingBackfillApply || !contextoValido || !podeEditarFerramenta}
                data-action="AdminFerramentas.backfillAplicar"
                data-permission="Sistema.Ferramentas.editar"
                data-context-required="group-or-company"
                data-sensitive="true"
              >
                {loadingBackfillApply ? 'Aplicando…' : 'Aplicar Correções'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
