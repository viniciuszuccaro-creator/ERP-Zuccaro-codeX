import React, { useState, useEffect, useRef } from "react";
import useCadastrosAllCounts from "@/components/cadastros/hooks/useCadastrosAllCounts";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger
} from "@/components/ui/accordion";
import {
  Users, Building2, Truck, DollarSign, Package, Cpu
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SearchInput from "@/components/ui/SearchInput";
import usePermissions from "../components/lib/usePermissions";
import GerenciadorJanelas from "../components/sistema/GerenciadorJanelas";
import Bloco1Pessoas from "@/components/cadastros/blocks/Bloco1Pessoas";
import Bloco2Produtos from "@/components/cadastros/blocks/Bloco2Produtos";
import Bloco3Financeiro from "@/components/cadastros/blocks/Bloco3Financeiro";
import Bloco4Logistica from "@/components/cadastros/blocks/Bloco4Logistica";
import Bloco5Organizacional from "@/components/cadastros/blocks/Bloco5Organizacional";
import Bloco6Tecnologia from "@/components/cadastros/blocks/Bloco6Tecnologia";
import GroupCountBadge from "@/components/cadastros/GroupCountBadge";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import { useUser } from "@/components/lib/UserContext";
import { useToast } from "@/components/ui/use-toast";
import ExternalAppsHub from "@/components/administracao-sistema/ExternalAppsHub";

const BLOCO_IDS = ["bloco1", "bloco2", "bloco3", "bloco4", "bloco5", "bloco6"];

export default function Cadastros() {
  const [searchTerm, setSearchTerm] = useState("");
  const [acordeonAberto, setAcordeonAberto] = useState(["bloco1"]);
  const [abaGerenciamento, setAbaGerenciamento] = useState("cadastros");
  // Origem Base44 Cadastros (5a8c26fab): restaura acordeões ao limpar a busca universal.
  const openBeforeSearchRef = useRef(null);
  const {
    counts: allCounts,
    totals,
    isLoading: countsLoading,
    countsUnavailable,
    countsPartial,
    missing: countsMissing,
    refetch: refreshCounts,
  } = useCadastrosAllCounts();
  const { isAdmin, hasPermission } = usePermissions();
  const { empresaAtual, grupoAtual, createInContext } = useContextoVisual();
  const { user } = useUser();
  const { toast } = useToast();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || null;
  const empresaId = empresaAtual?.id || null;
  const podeVerCadastros = isAdmin?.() || hasPermission("Cadastros", null, "visualizar") || hasPermission("Cadastros", null, "ver") || hasPermission("Cadastros", "Cadastros Gerais", "visualizar") || hasPermission("Cadastros", "Cadastros Gerais", "ver");
  const podeVerAppsExternos = isAdmin?.() || hasPermission("Sistema", "Integracoes", "visualizar") || hasPermission("Sistema", "Integracoes", "ver");
  const contextoAtivo = Boolean(empresaAtual?.id || grupoAtual?.id);
  const blocosMeta = {
    bloco1: { nome: "Pessoas e Parceiros", permissao: "Cadastros.Pessoas.visualizar" },
    bloco2: { nome: "Produtos e Servicos", permissao: "Cadastros.Produtos.visualizar" },
    bloco3: { nome: "Financeiro e Fiscal", permissao: "Cadastros.Financeiro.visualizar" },
    bloco4: { nome: "Logistica", permissao: "Cadastros.Logistica.visualizar" },
    bloco5: { nome: "Organizacional", permissao: "Cadastros.Organizacional.visualizar" },
    bloco6: { nome: "Tecnologia", permissao: "Cadastros.Tecnologia.visualizar" },
  };

  const getTotalBloco = (blocoId) => {
    // null = indisponível (erro/parcial do bloco) ≠ zero confirmado
    const n = totals?.[blocoId];
    if (n == null) return null;
    return Number(n);
  };

  const getDadosContextoCadastros = () => ({
    contexto: grupoAtual?.id ? "grupo" : empresaAtual?.id ? "empresa" : "sem-contexto",
    contexto_valido: contextoAtivo,
    group_id: groupId,
    empresa_id: empresaId,
    empresa_nome: empresaAtual?.nome_fantasia || empresaAtual?.razao_social || null,
    grupo_nome: grupoAtual?.nome || grupoAtual?.nome_grupo || null,
    permissao: "Cadastros.visualizar",
    pode_visualizar_cadastros: podeVerCadastros,
    pode_visualizar_apps_externos: podeVerAppsExternos,
  });

  const registrarAuditoriaCadastros = async (descricao, extras = {}) => {
    try {
      await createInContext("AuditLog", {
        usuario_id: user?.id,
        usuario: user?.full_name || user?.email || "Usuario",
        acao: extras.acao || "Visualizacao",
        modulo: "Cadastros",
        tipo_auditoria: extras.tipo_auditoria || "acesso",
        entidade: extras.entidade || "Cadastros Gerais",
        descricao,
        empresa_id: empresaId,
        group_id: groupId,
        grupo_id: groupId,
        dados_novos: {
          ...getDadosContextoCadastros(),
          ...(extras.dados_novos || {}),
        },
        data_hora: new Date().toISOString(),
        sucesso: extras.sucesso ?? true,
      });
    } catch (error) {
      console.error('[Cadastros] Falha ao auditar acao', error);
    }
  };

  useEffect(() => {
    if (podeVerCadastros) return;
    void registrarAuditoriaCadastros("Bloqueio de acesso a Cadastros Gerais", {
      acao: "Bloqueio",
      tipo_auditoria: "seguranca",
      sucesso: false,
      dados_novos: { motivo: "permissao_negada" },
    });
  }, [podeVerCadastros, groupId, empresaId]);

  useEffect(() => {
    if (!podeVerCadastros || contextoAtivo) return;
    void registrarAuditoriaCadastros("Cadastros Gerais aberto sem contexto multiempresa selecionado", {
      acao: "Alerta contexto incompleto",
      tipo_auditoria: "seguranca",
      sucesso: false,
      dados_novos: { motivo: "contexto_obrigatorio" },
    });
  }, [podeVerCadastros, contextoAtivo, groupId, empresaId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let t = params.get('tab');
    if (!t) { try { t = localStorage.getItem('Cadastros_tab'); } catch (error) { console.warn('[Cadastros] Falha ao restaurar aba', error); } }
    if (t) setAbaGerenciamento(t);
  }, []);

  const handleAbaChange = (value) => {
    if (value === "apps-externos" && !podeVerAppsExternos) {
      toast({
        title: "Acesso negado",
        description: "Seu perfil nao possui permissao para acessar Apps, Portais & Ambientes Externos.",
        variant: "destructive",
      });
      registrarAuditoriaCadastros("Bloqueio de acesso a Apps, Portais & Ambientes Externos", {
        acao: "Bloqueio",
        tipo_auditoria: "seguranca",
        sucesso: false,
        dados_novos: { aba: value, motivo: "permissao_negada" },
      });
      return;
    }

    setAbaGerenciamento(value);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', value);
    window.history.replaceState({}, '', url.toString());
    try { localStorage.setItem('Cadastros_tab', value); } catch (error) { console.warn('[Cadastros] Falha ao persistir aba', error); }
    registrarAuditoriaCadastros(`Troca de aba em Cadastros: ${value}`, {
      dados_novos: { aba: value, contexto_obrigatorio_atendido: contextoAtivo },
      sucesso: contextoAtivo,
    });
  };

  const handleCardClick = (blocoId) => {
    // Com busca ativa os 6 blocos já estão abertos: chip = "Ir para" (scroll), não fechar.
    const buscaAtiva = Boolean(searchTerm.trim()) || openBeforeSearchRef.current !== null;
    if (buscaAtiva) {
      if (!acordeonAberto.includes(blocoId)) {
        setAcordeonAberto((prev) => (prev.includes(blocoId) ? prev : [...prev, blocoId]));
      }
      setTimeout(() => {
        document.querySelector(`[data-bloco="${blocoId}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
      registrarAuditoriaCadastros(`Ir para bloco de Cadastros: ${blocoId}`, {
        entidade: "Bloco Cadastros",
        dados_novos: {
          bloco: blocoId,
          bloco_nome: blocosMeta[blocoId]?.nome || blocoId,
          permissao_bloco: blocosMeta[blocoId]?.permissao || null,
          acao_visual: "ir_para",
          busca_ativa: true,
          blocos_abertos: acordeonAberto.includes(blocoId)
            ? acordeonAberto
            : [...acordeonAberto, blocoId],
          total_exibido_bloco: getTotalBloco(blocoId),
          contexto_obrigatorio_atendido: contextoAtivo,
        },
        sucesso: contextoAtivo,
      });
      return;
    }

    const estavaAberto = acordeonAberto.includes(blocoId);
    const proximosAbertos = estavaAberto
      ? acordeonAberto.filter((id) => id !== blocoId)
      : [...acordeonAberto, blocoId];

    setAcordeonAberto(proximosAbertos);
    // Origem Base44: atalho da barra de totais rola até o bloco recém-aberto.
    if (!estavaAberto) {
      setTimeout(() => {
        document.querySelector(`[data-bloco="${blocoId}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
    }
    registrarAuditoriaCadastros(`Alternar bloco de Cadastros: ${blocoId}`, {
      entidade: "Bloco Cadastros",
      dados_novos: {
        bloco: blocoId,
        bloco_nome: blocosMeta[blocoId]?.nome || blocoId,
        permissao_bloco: blocosMeta[blocoId]?.permissao || null,
        acao_visual: estavaAberto ? "fechar" : "abrir",
        blocos_abertos: proximosAbertos,
        total_exibido_bloco: getTotalBloco(blocoId),
        contexto_obrigatorio_atendido: contextoAtivo,
      },
      sucesso: contextoAtivo,
    });
  };

  // Origem Base44 Cadastros: busca universal abre os 6 blocos; limpar restaura o estado anterior.
  useEffect(() => {
    if (searchTerm.trim()) {
      if (openBeforeSearchRef.current === null) {
        openBeforeSearchRef.current = acordeonAberto;
        setAcordeonAberto(BLOCO_IDS);
      }
    } else if (openBeforeSearchRef.current !== null) {
      setAcordeonAberto(openBeforeSearchRef.current);
      openBeforeSearchRef.current = null;
    }
  }, [searchTerm]);

  useEffect(() => {
    const termo = searchTerm.trim().replace(/\s+/g, " ").slice(0, 120);
    if (termo.length < 3) return;
    const timeout = setTimeout(() => {
      registrarAuditoriaCadastros("Busca universal em Cadastros Gerais", {
        entidade: "Busca Cadastros",
        dados_novos: {
          termo,
          tamanho_termo: termo.length,
          blocos_abertos: acordeonAberto,
          totais_blocos: {
            bloco1: getTotalBloco("bloco1"),
            bloco2: getTotalBloco("bloco2"),
            bloco3: getTotalBloco("bloco3"),
            bloco4: getTotalBloco("bloco4"),
            bloco5: getTotalBloco("bloco5"),
            bloco6: getTotalBloco("bloco6"),
          },
          total_geral: Number(totals?.geral || Object.values(totals || {}).reduce((acc, value) => acc + Number(value || 0), 0)),
          contexto_obrigatorio_atendido: contextoAtivo,
        },
        sucesso: contextoAtivo,
      });
    }, 900);
    return () => clearTimeout(timeout);
  }, [searchTerm, contextoAtivo, acordeonAberto, totals]);

  if (!podeVerCadastros) {
    return (
      <div className="h-full w-full p-6 lg:p-8 flex items-center justify-center">
        <Card className="w-full max-w-xl rounded-sm border border-amber-200 bg-amber-50">
          <CardContent className="p-6 text-sm text-amber-900">
            Seu perfil ainda nao tem permissao para visualizar Cadastros Gerais.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full w-full min-h-0 overflow-auto p-6 lg:p-8 space-y-6" data-context-required="true" data-permission="Cadastros.visualizar">
      <GerenciadorJanelas />

      <Tabs value={abaGerenciamento} onValueChange={handleAbaChange} className="w-full h-full">
        <div className="overflow-x-auto pb-1">
          <TabsList className="inline-flex flex-nowrap min-w-max gap-2 mb-2">
            <TabsTrigger value="cadastros" data-permission="Cadastros.visualizar" data-action="abrir-aba-cadastros-gerais">📋 Cadastros Gerais</TabsTrigger>
            <TabsTrigger value="apps-externos" disabled={!podeVerAppsExternos} data-permission="Sistema.Integracoes.visualizar" data-action="abrir-aba-apps-externos">📱 Apps, Portais & Ambientes Externos</TabsTrigger>
          </TabsList>
        </div>

        {/* ABA: APPS EXTERNOS — Fonte única para Portal do Cliente, App Motorista, Chatbot, etc. */}
        <TabsContent value="apps-externos" className="mt-4">
          <ExternalAppsHub />
        </TabsContent>

        {/* ABA: CADASTROS */}
        <TabsContent value="cadastros" className="space-y-6 mt-6">
          {!contextoAtivo && (
            <Card className="rounded-sm border border-amber-200 bg-amber-50" data-context-required="true">
              <CardContent className="p-3 text-sm text-amber-900">
                Selecione um grupo ou empresa para aplicar o filtro multiempresa nos cadastros.
              </CardContent>
            </Card>
          )}

          {countsUnavailable && contextoAtivo && (
            <Card className="rounded-sm border border-amber-300 bg-amber-50" data-counts-unavailable="true" role="status">
              <CardContent className="p-3 text-sm text-amber-950">
                Contagens indisponíveis por erro de consulta — isso <strong>não</strong> significa
                que os cadastros estejam vazios. Confira permissão/contexto.
                Badges exibem &quot;—&quot; até a contagem responder.
                <button
                  type="button"
                  onClick={() => { void refreshCounts?.(); }}
                  className="ml-2 underline text-amber-950 font-medium"
                  data-action="cadastros-contagens-retry"
                  data-permission="Cadastros.visualizar"
                >
                  Tentar novamente
                </button>
              </CardContent>
            </Card>
          )}

          {countsPartial && !countsUnavailable && contextoAtivo && (
            <Card className="rounded-sm border border-amber-200 bg-amber-50/80" data-counts-partial="true" role="status">
              <CardContent className="p-3 text-sm text-amber-950">
                Contagem auxiliar parcial — algumas entidades não responderam
                {Array.isArray(countsMissing) && countsMissing.length > 0
                  ? ` (${countsMissing.slice(0, 4).join(", ")}${countsMissing.length > 4 ? "…" : ""})`
                  : ""}
                . Blocos afetados exibem &quot;—&quot;; demais totais permanecem válidos. Não é zero confirmado.
                <button
                  type="button"
                  onClick={() => { void refreshCounts?.(); }}
                  className="ml-2 underline text-amber-950 font-medium"
                  data-action="cadastros-contagens-retry"
                  data-permission="Cadastros.visualizar"
                >
                  Atualizar
                </button>
              </CardContent>
            </Card>
          )}

          {/* Identificação clara de escopo (empresa/grupo) antes dos atalhos. */}
          {contextoAtivo && (
            <p
              className="text-xs text-slate-600"
              data-block="cadastros-escopo-ativo"
              role="status"
            >
              Escopo ativo:{' '}
              <span className="font-medium text-slate-800">
                {grupoAtual?.nome || grupoAtual?.razao_social
                  ? `Grupo ${grupoAtual?.nome || grupoAtual?.razao_social}`
                  : null}
                {grupoAtual?.id && empresaAtual?.id ? ' · ' : null}
                {empresaAtual?.nome_fantasia || empresaAtual?.razao_social
                  ? `Empresa ${empresaAtual?.nome_fantasia || empresaAtual?.razao_social}`
                  : (!grupoAtual?.id ? '—' : null)}
              </span>
              {' '}— filtros e contagens respeitam este contexto.
            </p>
          )}

          {/* SUMÁRIO RÁPIDO — atalhos compactos (origem Base44 Cadastros P4; reusa handleCardClick + GroupCountBadge fail-closed) */}
          <div className="flex flex-wrap gap-2 items-center" data-block="cadastros-atalhos-totais" role="navigation" aria-label="Atalhos dos blocos de Cadastros">
            {[
              { id: "bloco1", label: "Pessoas", color: "bg-blue-100 text-blue-800 border-blue-200", icon: Users, permission: "Cadastros.Pessoas.visualizar", action: "alternar-bloco-pessoas" },
              { id: "bloco2", label: "Produtos", color: "bg-purple-100 text-purple-800 border-purple-200", icon: Package, permission: "Cadastros.Produtos.visualizar", action: "alternar-bloco-produtos" },
              { id: "bloco3", label: "Financeiro", color: "bg-green-100 text-green-800 border-green-200", icon: DollarSign, permission: "Cadastros.Financeiro.visualizar", action: "alternar-bloco-financeiro-fiscal" },
              { id: "bloco4", label: "Logística", color: "bg-orange-100 text-orange-800 border-orange-200", icon: Truck, permission: "Cadastros.Logistica.visualizar", action: "alternar-bloco-logistica" },
              { id: "bloco5", label: "Organizacional", color: "bg-indigo-100 text-indigo-800 border-indigo-200", icon: Building2, permission: "Cadastros.Organizacional.visualizar", action: "alternar-bloco-organizacional" },
              { id: "bloco6", label: "Tecnologia", color: "bg-cyan-100 text-cyan-800 border-cyan-200", icon: Cpu, permission: "Cadastros.Tecnologia.visualizar", action: "alternar-bloco-tecnologia" },
            ].map(({ id, label, color, icon: Icon, permission, action }) => {
              const total = getTotalBloco(id);
              const aberto = acordeonAberto.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleCardClick(id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1 ${color} ${aberto ? "ring-2 ring-slate-400 ring-offset-1" : ""}`}
                  title={`Ir para ${label}`}
                  data-permission={permission}
                  data-action={action}
                  data-context-required="group-or-company"
                  data-atalho-bloco={id}
                  aria-pressed={aberto}
                >
                  <Icon className="w-3.5 h-3.5" aria-hidden />
                  <span>{label}</span>
                  <span className="font-bold tabular-nums" data-total-bloco={id}>
                    {countsLoading
                      ? "…"
                      : Number.isFinite(total)
                        ? total.toLocaleString("pt-BR")
                        : "—"}
                  </span>
                </button>
              );
            })}
          </div>

          {/* BUSCA UNIVERSAL — placeholder curto (origem Base44; evita corte em tela estreita) */}
          <SearchInput
            placeholder="Busca universal nos 6 blocos…"
            value={searchTerm}
            onChange={(val) => setSearchTerm(val)}
            className="h-12 text-base shadow-md border-slate-300"
            aria-label="Busca universal em todos os blocos de Cadastros"
            data-permission="Cadastros.Busca.visualizar"
            data-action="buscar-cadastros-gerais"
            data-context-required="group-or-company"
          />

          {/* ACCORDIONS - 6 BLOCOS */}
          <Accordion type="multiple" value={acordeonAberto} onValueChange={setAcordeonAberto} className="space-y-4">
            <AccordionItem value="bloco1" data-bloco="bloco1" className="border-2 border-blue-200 rounded-sm overflow-hidden shadow-md">
              <AccordionTrigger className="bg-gradient-to-r from-blue-50 to-blue-100 px-6 py-4 hover:from-blue-100 hover:to-blue-200">
                <div className="flex items-center gap-3 flex-1">
                  <Users className="w-6 h-6 text-blue-600" />
                  <div className="text-left">
                    <p className="font-bold text-lg text-blue-900">1️⃣ Pessoas & Parceiros</p>
                    <p className="text-xs text-blue-700">Clientes • Fornecedores • Transportadoras • Colaboradores • Representantes • Contatos B2B</p>
                  </div>
                  <GroupCountBadge precomputedTotal={totals.bloco1} badgeClassName="ml-auto bg-blue-600 text-white border-blue-600 text-xs" countsUnavailable={countsUnavailable || totals.bloco1 == null} />
                </div>
              </AccordionTrigger>
              <AccordionContent className="p-6 bg-white">
                <Bloco1Pessoas allCounts={allCounts} missingCounts={countsMissing} isLoading={countsLoading} searchTerm={searchTerm} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="bloco2" data-bloco="bloco2" className="border-2 border-purple-200 rounded-sm overflow-hidden shadow-md">
              <AccordionTrigger className="bg-gradient-to-r from-purple-50 to-purple-100 px-6 py-4 hover:from-purple-100 hover:to-purple-200">
                <div className="flex items-center gap-3 flex-1">
                  <Package className="w-6 h-6 text-purple-600" />
                  <div className="text-left">
                    <p className="font-bold text-lg text-purple-900">2️⃣ Produtos & Serviços</p>
                    <p className="text-xs text-purple-700">Produtos • Serviços • Setores • Grupos • Marcas • Tabelas de Preço</p>
                  </div>
                  <GroupCountBadge precomputedTotal={totals.bloco2} badgeClassName="ml-auto bg-purple-600 text-white border-purple-600 text-xs" countsUnavailable={countsUnavailable || totals.bloco2 == null} />
                </div>
              </AccordionTrigger>
              <AccordionContent className="p-6 bg-white">
                <Bloco2Produtos allCounts={allCounts} missingCounts={countsMissing} isLoading={countsLoading} searchTerm={searchTerm} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="bloco3" data-bloco="bloco3" className="border-2 border-green-200 rounded-sm overflow-hidden shadow-md">
              <AccordionTrigger className="bg-gradient-to-r from-green-50 to-green-100 px-6 py-4 hover:from-green-100 hover:to-green-200">
                <div className="flex items-center gap-3 flex-1">
                  <DollarSign className="w-6 h-6 text-green-600" />
                  <div className="text-left">
                    <p className="font-bold text-lg text-green-900">3️⃣ Financeiro & Fiscal</p>
                    <p className="text-xs text-green-700">Bancos • Contas • Formas Pagamento • Plano Contas • Centros Custo</p>
                  </div>
                  <GroupCountBadge precomputedTotal={totals.bloco3} badgeClassName="ml-auto bg-green-600 text-white border-green-600 text-xs" countsUnavailable={countsUnavailable || totals.bloco3 == null} />
                </div>
              </AccordionTrigger>
              <AccordionContent className="p-6 bg-white">
                <Bloco3Financeiro allCounts={allCounts} missingCounts={countsMissing} isLoading={countsLoading} searchTerm={searchTerm} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="bloco4" data-bloco="bloco4" className="border-2 border-orange-200 rounded-sm overflow-hidden shadow-md">
              <AccordionTrigger className="bg-gradient-to-r from-orange-50 to-orange-100 px-6 py-4 hover:from-orange-100 hover:to-orange-200">
                <div className="flex items-center gap-3 flex-1">
                  <Truck className="w-6 h-6 text-orange-600" />
                  <div className="text-left">
                    <p className="font-bold text-lg text-orange-900">4️⃣ Logística, Frota & Almoxarifado</p>
                    <p className="text-xs text-orange-700">Veículos • Motoristas • Tipos Frete • Locais Estoque • Rotas</p>
                  </div>
                  <GroupCountBadge precomputedTotal={totals.bloco4} badgeClassName="ml-auto bg-orange-600 text-white border-orange-600 text-xs" countsUnavailable={countsUnavailable || totals.bloco4 == null} />
                </div>
              </AccordionTrigger>
              <AccordionContent className="p-6 bg-white">
                <Bloco4Logistica allCounts={allCounts} missingCounts={countsMissing} isLoading={countsLoading} searchTerm={searchTerm} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="bloco5" data-bloco="bloco5" className="border-2 border-indigo-200 rounded-sm overflow-hidden shadow-md">
              <AccordionTrigger className="bg-gradient-to-r from-indigo-50 to-indigo-100 px-6 py-4 hover:from-indigo-100 hover:to-indigo-200">
                <div className="flex items-center gap-3 flex-1">
                  <Building2 className="w-6 h-6 text-indigo-600" />
                  <div className="text-left">
                    <p className="font-bold text-lg text-indigo-900">5️⃣ Estrutura Organizacional</p>
                    <p className="text-xs text-indigo-700">Grupos • Empresas • Departamentos • Cargos • Turnos</p>
                  </div>
                  <GroupCountBadge precomputedTotal={totals.bloco5} badgeClassName="ml-auto bg-indigo-600 text-white border-indigo-600 text-xs" countsUnavailable={countsUnavailable || totals.bloco5 == null} />
                </div>
              </AccordionTrigger>
              <AccordionContent className="p-6 bg-white">
                <Bloco5Organizacional allCounts={allCounts} missingCounts={countsMissing} isLoading={countsLoading} searchTerm={searchTerm} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="bloco6" data-bloco="bloco6" className="border-2 border-cyan-200 rounded-sm overflow-hidden shadow-md">
              <AccordionTrigger className="bg-gradient-to-r from-cyan-50 to-cyan-100 px-6 py-4 hover:from-cyan-100 hover:to-cyan-200">
                <div className="flex items-center gap-3 flex-1">
                  <Cpu className="w-6 h-6 text-cyan-600" />
                  <div className="text-left">
                    <p className="font-bold text-lg text-cyan-900">6️⃣ Tecnologia, IA & Parâmetros</p>
                    <p className="text-xs text-cyan-700">APIs • Webhooks • Chatbot • Jobs • Gateways • Parâmetros Operacionais</p>
                  </div>
                  <GroupCountBadge precomputedTotal={totals.bloco6} badgeClassName="ml-auto bg-cyan-600 text-white border-cyan-600 text-xs" countsUnavailable={countsUnavailable || totals.bloco6 == null} />
                </div>
              </AccordionTrigger>
              <AccordionContent className="p-6 bg-white">
                <Bloco6Tecnologia allCounts={allCounts} missingCounts={countsMissing} isLoading={countsLoading} searchTerm={searchTerm} />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </TabsContent>
      </Tabs>
    </div>
  );
}
