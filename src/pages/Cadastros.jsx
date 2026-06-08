import React, { useState, useEffect } from "react";
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

export default function Cadastros() {
  const [searchTerm, setSearchTerm] = useState("");
  const [acordeonAberto, setAcordeonAberto] = useState(["bloco1"]);
  const [abaGerenciamento, setAbaGerenciamento] = useState("cadastros");
  const { counts: allCounts, totals, isLoading: countsLoading } = useCadastrosAllCounts();
  const { isAdmin, hasPermission } = usePermissions();
  const { empresaAtual, grupoAtual, createInContext } = useContextoVisual();
  const { user } = useUser();
  const { toast } = useToast();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || null;
  const empresaId = empresaAtual?.id || null;
  const podeVerCadastros = isAdmin?.() || hasPermission("Cadastros", null, "visualizar") || hasPermission("Cadastros", null, "ver") || hasPermission("Cadastros", "Cadastros Gerais", "visualizar") || hasPermission("Cadastros", "Cadastros Gerais", "ver");
  const podeVerAppsExternos = isAdmin?.() || hasPermission("Sistema", "Integracoes", "visualizar") || hasPermission("Sistema", "Integracoes", "ver");
  const contextoAtivo = Boolean(empresaAtual?.id || grupoAtual?.id);

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
        dados_novos: extras.dados_novos,
        data_hora: new Date().toISOString(),
        sucesso: extras.sucesso ?? true,
      });
    } catch (_) {}
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let t = params.get('tab');
    if (!t) { try { t = localStorage.getItem('Cadastros_tab'); } catch {} }
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
        sucesso: false,
        dados_novos: { aba: value },
      });
      return;
    }

    setAbaGerenciamento(value);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', value);
    window.history.replaceState({}, '', url.toString());
    try { localStorage.setItem('Cadastros_tab', value); } catch {}
    registrarAuditoriaCadastros(`Troca de aba em Cadastros: ${value}`, { dados_novos: { aba: value } });
  };

  const handleCardClick = (blocoId) => {
    if (acordeonAberto.includes(blocoId)) {
      setAcordeonAberto(acordeonAberto.filter((id) => id !== blocoId));
    } else {
      setAcordeonAberto([...acordeonAberto, blocoId]);
    }
    registrarAuditoriaCadastros(`Alternar bloco de Cadastros: ${blocoId}`, {
      entidade: "Bloco Cadastros",
      dados_novos: { bloco: blocoId },
    });
  };

  useEffect(() => {
    const termo = searchTerm.trim();
    if (termo.length < 3) return;
    const timeout = setTimeout(() => {
      registrarAuditoriaCadastros("Busca universal em Cadastros Gerais", {
        entidade: "Busca Cadastros",
        dados_novos: { termo },
      });
    }, 900);
    return () => clearTimeout(timeout);
  }, [searchTerm]); // eslint-disable-line react-hooks/exhaustive-deps

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

          {/* DASHBOARD DE TOTAIS */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Card className="border-0 shadow-md hover:shadow-xl transition-all cursor-pointer bg-gradient-to-br from-blue-50 to-blue-100" onClick={() => handleCardClick('bloco1')} data-permission="Cadastros.Pessoas.visualizar" data-action="alternar-bloco-pessoas">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  <GroupCountBadge precomputedTotal={totals.bloco1} badgeClassName="bg-blue-600 text-white text-xs px-1.5 border-blue-600" />
                </div>
                <div className="text-lg font-bold text-blue-900">Pessoas</div>
                <p className="text-xs text-blue-700">& Parceiros</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-md hover:shadow-xl transition-all cursor-pointer bg-gradient-to-br from-purple-50 to-purple-100" onClick={() => handleCardClick('bloco2')} data-permission="Cadastros.Produtos.visualizar" data-action="alternar-bloco-produtos">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <Package className="w-5 h-5 text-purple-600" />
                  <GroupCountBadge precomputedTotal={totals.bloco2} badgeClassName="bg-purple-600 text-white text-xs px-1.5 border-purple-600" />
                </div>
                <div className="text-lg font-bold text-purple-900">Produtos</div>
                <p className="text-xs text-purple-700">& Serviços</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-md hover:shadow-xl transition-all cursor-pointer bg-gradient-to-br from-green-50 to-green-100" onClick={() => handleCardClick('bloco3')} data-permission="Cadastros.Financeiro.visualizar" data-action="alternar-bloco-financeiro-fiscal">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <DollarSign className="w-5 h-5 text-green-600" />
                  <GroupCountBadge precomputedTotal={totals.bloco3} badgeClassName="bg-green-600 text-white text-xs px-1.5 border-green-600" />
                </div>
                <div className="text-lg font-bold text-green-900">Financeiro</div>
                <p className="text-xs text-green-700">& Fiscal</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-md hover:shadow-xl transition-all cursor-pointer bg-gradient-to-br from-orange-50 to-orange-100" onClick={() => handleCardClick('bloco4')} data-permission="Cadastros.Logistica.visualizar" data-action="alternar-bloco-logistica">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <Truck className="w-5 h-5 text-orange-600" />
                  <GroupCountBadge precomputedTotal={totals.bloco4} badgeClassName="bg-orange-600 text-white text-xs px-1.5 border-orange-600" />
                </div>
                <div className="text-lg font-bold text-orange-900">Logística</div>
                <p className="text-xs text-orange-700">Frota & Almox.</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-md hover:shadow-xl transition-all cursor-pointer bg-gradient-to-br from-indigo-50 to-indigo-100" onClick={() => handleCardClick('bloco5')} data-permission="Cadastros.Organizacional.visualizar" data-action="alternar-bloco-organizacional">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <Building2 className="w-5 h-5 text-indigo-600" />
                  <GroupCountBadge precomputedTotal={totals.bloco5} badgeClassName="bg-indigo-600 text-white text-xs px-1.5 border-indigo-600" />
                </div>
                <div className="text-lg font-bold text-indigo-900">Organizacional</div>
                <p className="text-xs text-indigo-700">Estrutura</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-md hover:shadow-xl transition-all cursor-pointer bg-gradient-to-br from-cyan-50 to-cyan-100" onClick={() => handleCardClick('bloco6')} data-permission="Cadastros.Tecnologia.visualizar" data-action="alternar-bloco-tecnologia">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <Cpu className="w-5 h-5 text-cyan-600" />
                  <GroupCountBadge precomputedTotal={totals.bloco6} badgeClassName="bg-cyan-600 text-white text-xs px-1.5 border-cyan-600" />
                </div>
                <div className="text-lg font-bold text-cyan-900">Tecnologia</div>
                <p className="text-xs text-cyan-700">IA & Parâmetros</p>
              </CardContent>
            </Card>
          </div>

          {/* BUSCA UNIVERSAL */}
          <SearchInput
            placeholder="🔍 Busca Universal - Digite para filtrar em todos os 6 blocos simultaneamente..."
            value={searchTerm}
            onChange={(val) => setSearchTerm(val)}
            className="h-12 text-base shadow-md border-slate-300"
            data-permission="Cadastros.Busca.visualizar"
            data-action="buscar-cadastros-gerais"
          />

          {/* ACCORDIONS - 6 BLOCOS */}
          <Accordion type="multiple" value={acordeonAberto} onValueChange={setAcordeonAberto} className="space-y-4">
            <AccordionItem value="bloco1" className="border-2 border-blue-200 rounded-sm overflow-hidden shadow-md">
              <AccordionTrigger className="bg-gradient-to-r from-blue-50 to-blue-100 px-6 py-4 hover:from-blue-100 hover:to-blue-200">
                <div className="flex items-center gap-3 flex-1">
                  <Users className="w-6 h-6 text-blue-600" />
                  <div className="text-left">
                    <p className="font-bold text-lg text-blue-900">1️⃣ Pessoas & Parceiros</p>
                    <p className="text-xs text-blue-700">Clientes • Fornecedores • Transportadoras • Colaboradores • Representantes • Contatos B2B</p>
                  </div>
                  <GroupCountBadge precomputedTotal={totals.bloco1} badgeClassName="ml-auto bg-blue-600 text-white border-blue-600 text-xs" />
                </div>
              </AccordionTrigger>
              <AccordionContent className="p-6 bg-white">
                <Bloco1Pessoas allCounts={allCounts} isLoading={countsLoading} searchTerm={searchTerm} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="bloco2" className="border-2 border-purple-200 rounded-sm overflow-hidden shadow-md">
              <AccordionTrigger className="bg-gradient-to-r from-purple-50 to-purple-100 px-6 py-4 hover:from-purple-100 hover:to-purple-200">
                <div className="flex items-center gap-3 flex-1">
                  <Package className="w-6 h-6 text-purple-600" />
                  <div className="text-left">
                    <p className="font-bold text-lg text-purple-900">2️⃣ Produtos & Serviços</p>
                    <p className="text-xs text-purple-700">Produtos • Serviços • Setores • Grupos • Marcas • Tabelas de Preço</p>
                  </div>
                  <GroupCountBadge precomputedTotal={totals.bloco2} badgeClassName="ml-auto bg-purple-600 text-white border-purple-600 text-xs" />
                </div>
              </AccordionTrigger>
              <AccordionContent className="p-6 bg-white">
                <Bloco2Produtos allCounts={allCounts} isLoading={countsLoading} searchTerm={searchTerm} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="bloco3" className="border-2 border-green-200 rounded-sm overflow-hidden shadow-md">
              <AccordionTrigger className="bg-gradient-to-r from-green-50 to-green-100 px-6 py-4 hover:from-green-100 hover:to-green-200">
                <div className="flex items-center gap-3 flex-1">
                  <DollarSign className="w-6 h-6 text-green-600" />
                  <div className="text-left">
                    <p className="font-bold text-lg text-green-900">3️⃣ Financeiro & Fiscal</p>
                    <p className="text-xs text-green-700">Bancos • Contas • Formas Pagamento • Plano Contas • Centros Custo</p>
                  </div>
                  <GroupCountBadge precomputedTotal={totals.bloco3} badgeClassName="ml-auto bg-green-600 text-white border-green-600 text-xs" />
                </div>
              </AccordionTrigger>
              <AccordionContent className="p-6 bg-white">
                <Bloco3Financeiro allCounts={allCounts} isLoading={countsLoading} searchTerm={searchTerm} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="bloco4" className="border-2 border-orange-200 rounded-sm overflow-hidden shadow-md">
              <AccordionTrigger className="bg-gradient-to-r from-orange-50 to-orange-100 px-6 py-4 hover:from-orange-100 hover:to-orange-200">
                <div className="flex items-center gap-3 flex-1">
                  <Truck className="w-6 h-6 text-orange-600" />
                  <div className="text-left">
                    <p className="font-bold text-lg text-orange-900">4️⃣ Logística, Frota & Almoxarifado</p>
                    <p className="text-xs text-orange-700">Veículos • Motoristas • Tipos Frete • Locais Estoque • Rotas</p>
                  </div>
                  <GroupCountBadge precomputedTotal={totals.bloco4} badgeClassName="ml-auto bg-orange-600 text-white border-orange-600 text-xs" />
                </div>
              </AccordionTrigger>
              <AccordionContent className="p-6 bg-white">
                <Bloco4Logistica allCounts={allCounts} isLoading={countsLoading} searchTerm={searchTerm} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="bloco5" className="border-2 border-indigo-200 rounded-sm overflow-hidden shadow-md">
              <AccordionTrigger className="bg-gradient-to-r from-indigo-50 to-indigo-100 px-6 py-4 hover:from-indigo-100 hover:to-indigo-200">
                <div className="flex items-center gap-3 flex-1">
                  <Building2 className="w-6 h-6 text-indigo-600" />
                  <div className="text-left">
                    <p className="font-bold text-lg text-indigo-900">5️⃣ Estrutura Organizacional</p>
                    <p className="text-xs text-indigo-700">Grupos • Empresas • Departamentos • Cargos • Turnos</p>
                  </div>
                  <GroupCountBadge precomputedTotal={totals.bloco5} badgeClassName="ml-auto bg-indigo-600 text-white border-indigo-600 text-xs" />
                </div>
              </AccordionTrigger>
              <AccordionContent className="p-6 bg-white">
                <Bloco5Organizacional allCounts={allCounts} isLoading={countsLoading} searchTerm={searchTerm} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="bloco6" className="border-2 border-cyan-200 rounded-sm overflow-hidden shadow-md">
              <AccordionTrigger className="bg-gradient-to-r from-cyan-50 to-cyan-100 px-6 py-4 hover:from-cyan-100 hover:to-cyan-200">
                <div className="flex items-center gap-3 flex-1">
                  <Cpu className="w-6 h-6 text-cyan-600" />
                  <div className="text-left">
                    <p className="font-bold text-lg text-cyan-900">6️⃣ Tecnologia, IA & Parâmetros</p>
                    <p className="text-xs text-cyan-700">APIs • Webhooks • Chatbot • Jobs • Gateways • Parâmetros Operacionais</p>
                  </div>
                  <GroupCountBadge precomputedTotal={totals.bloco6} badgeClassName="ml-auto bg-cyan-600 text-white border-cyan-600 text-xs" />
                </div>
              </AccordionTrigger>
              <AccordionContent className="p-6 bg-white">
                <Bloco6Tecnologia allCounts={allCounts} isLoading={countsLoading} searchTerm={searchTerm} />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </TabsContent>
      </Tabs>
    </div>
  );
}
