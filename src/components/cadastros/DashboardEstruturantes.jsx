import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Factory, Package, Award, Warehouse, Scale, TrendingUp, CheckCircle2, AlertCircle, ChevronRight, Stars } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import {
  DASHBOARD_LIST_SOFT_LIMIT,
  formatCanaisOrigemKpiDisplay,
  isCappedListUnreliable,
  isDashboardCadastroAtivo,
} from "@/components/lib/dashboardKpiPolicy";

/**
 * 🎯 DASHBOARD ESTRUTURANTES V21.2 FASE 2
 * 
 * Painel visual consolidado dos 5 cadastros estruturantes
 * Mostra métricas, qualidade de dados e status de integração
 * KPIs: indisponível (contexto/RBAC/erro/cap) → "—" (≠ zero falso).
 */
export default function DashboardEstruturantes() {
  const { empresaAtual, grupoAtual, contexto, filterInContext } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = contexto === 'empresa' ? empresaAtual?.id : null;
  const contextoValido = Boolean(groupId || empresaId);
  const podeVisualizarCadastros = hasPermission('Cadastros', null, 'visualizar') || hasPermission('Cadastros', 'Produto', 'visualizar') || hasPermission('Estoque', 'Produto', 'visualizar');
  const consultasHabilitadas = contextoValido && podeVisualizarCadastros;
  const queryScope = [groupId, empresaId, contexto];

  // Sem default []: query disabled/erro ≠ zero confirmado nos KPIs.
  const { data: setores, isPending: loadingSetores, isError: errorSetores } = useQuery({
    queryKey: ['setores-atividade', ...queryScope],
    queryFn: () => filterInContext('SetorAtividade', {}, 'nome', DASHBOARD_LIST_SOFT_LIMIT),
    enabled: consultasHabilitadas,
    staleTime: 120000,
  });

  const { data: grupos, isPending: loadingGrupos, isError: errorGrupos } = useQuery({
    queryKey: ['grupos-produto', ...queryScope],
    queryFn: () => filterInContext('GrupoProduto', {}, 'nome', DASHBOARD_LIST_SOFT_LIMIT),
    enabled: consultasHabilitadas,
    staleTime: 120000,
  });

  const { data: marcas, isPending: loadingMarcas, isError: errorMarcas } = useQuery({
    queryKey: ['marcas', ...queryScope],
    queryFn: () => filterInContext('Marca', {}, 'nome', DASHBOARD_LIST_SOFT_LIMIT),
    enabled: consultasHabilitadas,
    staleTime: 120000,
  });

  const { data: locais, isPending: loadingLocais, isError: errorLocais } = useQuery({
    queryKey: ['locais-estoque', ...queryScope],
    queryFn: () => filterInContext('LocalEstoque', {}, 'nome', DASHBOARD_LIST_SOFT_LIMIT),
    enabled: consultasHabilitadas,
    staleTime: 120000,
  });

  const { data: tabelas, isPending: loadingTabelas, isError: errorTabelas } = useQuery({
    queryKey: ['tabelas-fiscais', ...queryScope],
    queryFn: () => filterInContext('TabelaFiscal', {}, 'nome', DASHBOARD_LIST_SOFT_LIMIT),
    enabled: consultasHabilitadas,
    staleTime: 120000,
  });

  const { data: produtos, isPending: loadingProdutos, isError: errorProdutos } = useQuery({
    queryKey: ['produtos-estruturantes', ...queryScope],
    queryFn: () => filterInContext('Produto', {}, 'descricao', DASHBOARD_LIST_SOFT_LIMIT),
    enabled: consultasHabilitadas,
    staleTime: 120000,
  });

  const setoresList = Array.isArray(setores) ? setores : [];
  const gruposList = Array.isArray(grupos) ? grupos : [];
  const marcasList = Array.isArray(marcas) ? marcas : [];
  const locaisList = Array.isArray(locais) ? locais : [];
  const tabelasList = Array.isArray(tabelas) ? tabelas : [];
  const produtosList = Array.isArray(produtos) ? produtos : [];

  const setoresBlocked = !consultasHabilitadas || errorSetores || isCappedListUnreliable(setoresList, DASHBOARD_LIST_SOFT_LIMIT);
  const gruposBlocked = !consultasHabilitadas || errorGrupos || isCappedListUnreliable(gruposList, DASHBOARD_LIST_SOFT_LIMIT);
  const marcasBlocked = !consultasHabilitadas || errorMarcas || isCappedListUnreliable(marcasList, DASHBOARD_LIST_SOFT_LIMIT);
  const locaisBlocked = !consultasHabilitadas || errorLocais || isCappedListUnreliable(locaisList, DASHBOARD_LIST_SOFT_LIMIT);
  const tabelasBlocked = !consultasHabilitadas || errorTabelas || isCappedListUnreliable(tabelasList, DASHBOARD_LIST_SOFT_LIMIT);
  const produtosBlocked = !consultasHabilitadas || errorProdutos || isCappedListUnreliable(produtosList, DASHBOARD_LIST_SOFT_LIMIT);
  const anyConsultaError = errorSetores || errorGrupos || errorMarcas || errorLocais || errorTabelas || errorProdutos;
  const anyCapped = [setoresList, gruposList, marcasList, locaisList, tabelasList, produtosList]
    .some((list) => isCappedListUnreliable(list, DASHBOARD_LIST_SOFT_LIMIT));
  const isLoading = consultasHabilitadas && (
    loadingSetores || loadingGrupos || loadingMarcas || loadingLocais || loadingTabelas || loadingProdutos
  );

  const setoresAtivos = setoresList.filter(isDashboardCadastroAtivo).length;
  const gruposAtivos = gruposList.filter(isDashboardCadastroAtivo).length;
  const marcasAtivas = marcasList.filter(isDashboardCadastroAtivo).length;
  const locaisAtivos = locaisList.filter(isDashboardCadastroAtivo).length;
  const tabelasAtivas = tabelasList.filter((t) => t.regra_ativa === true || isDashboardCadastroAtivo(t)).length;

  const setoresTotalDisplay = formatCanaisOrigemKpiDisplay({ blocked: setoresBlocked, value: setoresList.length });
  const gruposTotalDisplay = formatCanaisOrigemKpiDisplay({ blocked: gruposBlocked, value: gruposList.length });
  const marcasTotalDisplay = formatCanaisOrigemKpiDisplay({ blocked: marcasBlocked, value: marcasList.length });
  const locaisTotalDisplay = formatCanaisOrigemKpiDisplay({ blocked: locaisBlocked, value: locaisList.length });
  const tabelasTotalDisplay = formatCanaisOrigemKpiDisplay({ blocked: tabelasBlocked, value: tabelasList.length });

  const produtosClassificados = produtosList.filter(p => 
    p.setor_atividade_id && p.grupo_produto_id && p.marca_id
  ).length;
  const percentualClassificacao = !produtosBlocked && produtosList.length > 0 
    ? ((produtosClassificados / produtosList.length) * 100).toFixed(0) 
    : null;
  const classificacaoDisplay = formatCanaisOrigemKpiDisplay({
    blocked: produtosBlocked || percentualClassificacao == null,
    value: percentualClassificacao == null ? null : Number(percentualClassificacao),
    format: (n) => `${n}%`,
  });
  const classificacaoCountDisplay = produtosBlocked
    ? '—'
    : `${produtosClassificados}/${produtosList.length} produtos`;

  const ocupacaoTotal = locaisList.reduce((sum, l) => sum + (l.ocupacao_atual_m3 || 0), 0);
  const capacidadeTotal = locaisList.reduce((sum, l) => sum + (l.capacidade_m3 || 0), 0);
  const percentualOcupacao = !locaisBlocked && capacidadeTotal > 0 
    ? ((ocupacaoTotal / capacidadeTotal) * 100).toFixed(0) 
    : null;
  const ocupacaoDisplay = formatCanaisOrigemKpiDisplay({
    blocked: locaisBlocked || percentualOcupacao == null,
    value: percentualOcupacao == null ? null : Number(percentualOcupacao),
    format: (n) => `${n}%`,
  });
  const ocupacaoVolumeDisplay = locaisBlocked
    ? '—'
    : `${ocupacaoTotal.toFixed(0)}m³ / ${capacidadeTotal.toFixed(0)}m³`;

  const tabelasValidadasIA = tabelasList.filter(t => t.validado_ia).length;
  const percentualValidacaoIA = !tabelasBlocked && tabelasList.length > 0
    ? ((tabelasValidadasIA / tabelasList.length) * 100).toFixed(0)
    : null;
  const validacaoIaDisplay = formatCanaisOrigemKpiDisplay({
    blocked: tabelasBlocked || percentualValidacaoIA == null,
    value: percentualValidacaoIA == null ? null : Number(percentualValidacaoIA),
    format: (n) => `${n}%`,
  });
  const validacaoIaCountDisplay = tabelasBlocked
    ? '—'
    : `${tabelasValidadasIA}/${tabelasList.length} regras`;

  const fmtAtivosMetrica = (blocked, ativos, total, label = 'ativos') => (
    blocked
      ? '—'
      : `${formatCanaisOrigemKpiDisplay({ blocked: false, value: ativos })}/${formatCanaisOrigemKpiDisplay({ blocked: false, value: total })} ${label}`
  );

  const estruturantes = [
    {
      nome: "Setores de Atividade",
      icon: Factory,
      totalDisplay: setoresTotalDisplay,
      blocked: setoresBlocked,
      color: "indigo",
      bgGradient: "from-sky-50 to-sky-100",
      borderColor: "border-sky-300",
      textColor: "text-sky-700",
      metrica: fmtAtivosMetrica(setoresBlocked, setoresAtivos, setoresList.length),
      status: setoresBlocked ? "unknown" : (setoresAtivos > 0 ? "ok" : "alert")
    },
    {
      nome: "Grupos de Produto",
      icon: Package,
      totalDisplay: gruposTotalDisplay,
      blocked: gruposBlocked,
      color: "cyan",
      bgGradient: "from-cyan-50 to-cyan-100",
      borderColor: "border-cyan-300",
      textColor: "text-cyan-700",
      metrica: fmtAtivosMetrica(gruposBlocked, gruposAtivos, gruposList.length),
      status: gruposBlocked ? "unknown" : (gruposAtivos > 0 ? "ok" : "alert")
    },
    {
      nome: "Marcas",
      icon: Award,
      totalDisplay: marcasTotalDisplay,
      blocked: marcasBlocked,
      color: "amber",
      bgGradient: "from-amber-50 to-amber-100",
      borderColor: "border-amber-300",
      textColor: "text-amber-700",
      metrica: fmtAtivosMetrica(marcasBlocked, marcasAtivas, marcasList.length, 'ativas'),
      status: marcasBlocked ? "unknown" : (marcasAtivas > 0 ? "ok" : "alert")
    },
    {
      nome: "Locais de Estoque",
      icon: Warehouse,
      totalDisplay: locaisTotalDisplay,
      blocked: locaisBlocked,
      color: "purple",
      bgGradient: "from-sky-50 to-sky-100",
      borderColor: "border-sky-300",
      textColor: "text-sky-700",
      metrica: locaisBlocked ? '—' : `${ocupacaoDisplay} ocupação`,
      status: locaisBlocked || percentualOcupacao == null
        ? "unknown"
        : (parseInt(percentualOcupacao, 10) < 90 ? "ok" : "alert")
    },
    {
      nome: "Tabelas Fiscais",
      icon: Scale,
      totalDisplay: tabelasTotalDisplay,
      blocked: tabelasBlocked,
      color: "red",
      bgGradient: "from-red-50 to-red-100",
      borderColor: "border-red-300",
      textColor: "text-red-700",
      metrica: tabelasBlocked ? '—' : `${validacaoIaDisplay} validadas IA`,
      status: tabelasBlocked || percentualValidacaoIA == null
        ? "unknown"
        : (parseInt(percentualValidacaoIA, 10) > 50 ? "ok" : "alert")
    }
  ];

  return (
    <div className="w-full h-full space-y-6" data-permission="Cadastros.visualizar" data-context-required="true">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <Stars className="w-7 h-7 text-sky-600" />
            Dashboard de Cadastros Estruturantes
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Visão consolidada dos 5 pilares mestres do sistema • Fase 2 Completa
          </p>
        </div>
        {consultasHabilitadas && !anyConsultaError && !anyCapped && !isLoading ? (
          <Badge className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-4 py-2 text-sm" data-block="estruturantes-operacional-ok">
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Consultas OK
          </Badge>
        ) : (
          <Badge className="bg-amber-600 text-white px-4 py-2 text-sm" data-block="estruturantes-operacional-pendente">
            <AlertCircle className="w-4 h-4 mr-2" />
            Totais sob revisão
          </Badge>
        )}
      </div>

      {(!contextoValido || !podeVisualizarCadastros) && (
        <Alert variant="destructive">
          <AlertCircle className="w-5 h-5" />
          <AlertDescription>
            Dashboard de cadastros estruturantes exige contexto de grupo/empresa e permissão para visualizar cadastros.
          </AlertDescription>
        </Alert>
      )}
      {anyConsultaError && (
        <Alert className="border-amber-300 bg-amber-50" data-block="estruturantes-consulta-indisponivel">
          <AlertCircle className="w-5 h-5 text-amber-700" />
          <AlertDescription>
            Contagem/amostra indisponível (erro de consulta — não é zero confirmado).
          </AlertDescription>
        </Alert>
      )}
      {anyCapped && (
        <Alert className="border-amber-300 bg-amber-50" data-block="estruturantes-amostra-capada">
          <AlertCircle className="w-5 h-5 text-amber-700" />
          <AlertDescription>
            Amostra no soft limit ({DASHBOARD_LIST_SOFT_LIMIT}) — totais do card indisponíveis (≠ zero).
          </AlertDescription>
        </Alert>
      )}
      {isLoading && (
        <Alert className="border-slate-200 bg-slate-50" data-block="estruturantes-carregando">
          <AlertDescription>Carregando cadastros estruturantes…</AlertDescription>
        </Alert>
      )}

      {/* CARDS DOS ESTRUTURANTES */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {estruturantes.map((item, idx) => {
          const Icon = item.icon;
          return (
            <Card 
              key={idx}
              className={`bg-gradient-to-br ${item.bgGradient} border-2 ${item.borderColor} shadow-md hover:shadow-xl transition-all hover:scale-105`}
              data-block={item.blocked ? 'estruturante-kpi-indisponivel' : 'estruturante-kpi'}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <Icon className={`w-8 h-8 ${item.textColor}`} />
                  {item.status === "ok" ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  ) : (
                    <AlertCircle className={`w-5 h-5 ${item.status === "unknown" ? "text-slate-400" : "text-amber-600"}`} />
                  )}
                </div>
                <div className="text-3xl font-bold text-slate-900 mb-1" data-kpi="estruturante-total">
                  {item.totalDisplay}
                </div>
                <p className="text-xs font-semibold text-slate-700 mb-2">{item.nome}</p>
                <Badge variant="outline" className={`text-xs ${item.textColor}`}>
                  {item.metrica}
                </Badge>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* MÉTRICAS DE QUALIDADE */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-300">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2 text-blue-900">
              <TrendingUp className="w-4 h-4" />
              Classificação de Produtos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-3">
              <div className="text-4xl font-bold text-blue-900" data-kpi="classificacao-pct">{classificacaoDisplay}</div>
              <div className="text-sm text-blue-700 mb-1">
                {classificacaoCountDisplay}
              </div>
            </div>
            <p className="text-xs text-blue-600 mt-2">
              com Setor + Grupo + Marca definidos
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-sky-50 to-sky-100 border-2 border-sky-300">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2 text-sky-900">
              <Warehouse className="w-4 h-4" />
              Ocupação de Almoxarifados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-3">
              <div className="text-4xl font-bold text-sky-900" data-kpi="ocupacao-pct">{ocupacaoDisplay}</div>
              <div className="text-sm text-sky-700 mb-1">
                {ocupacaoVolumeDisplay}
              </div>
            </div>
            <p className="text-xs text-sky-600 mt-2">
              capacidade total utilizada
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-300">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2 text-red-900">
              <Scale className="w-4 h-4" />
              IA Compliance Fiscal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-3">
              <div className="text-4xl font-bold text-red-900" data-kpi="validacao-ia-pct">{validacaoIaDisplay}</div>
              <div className="text-sm text-red-700 mb-1">
                {validacaoIaCountDisplay}
              </div>
            </div>
            <p className="text-xs text-red-600 mt-2">
              validadas pela IA Fiscal
            </p>
          </CardContent>
        </Card>
      </div>

      {/* RELACIONAMENTOS */}
      <Card className="border-2 border-slate-300 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            Mapa de Relacionamentos - Fonte Única de Verdade
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-32 text-sm font-semibold text-slate-700">Produtos</div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
              <Badge className="bg-sky-100 text-sky-700">Setor Atividade</Badge>
              <span className="text-xs text-slate-500">+</span>
              <Badge className="bg-cyan-100 text-cyan-700">Grupo Produto</Badge>
              <span className="text-xs text-slate-500">+</span>
              <Badge className="bg-amber-100 text-amber-700">Marca</Badge>
              <span className="text-xs text-slate-500">=</span>
              <Badge className="bg-green-100 text-green-700">Tripla Classificação ✅</Badge>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-32 text-sm font-semibold text-slate-700">Movimentações</div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
              <Badge className="bg-sky-100 text-sky-700">Local Estoque</Badge>
              <span className="text-xs text-slate-500">→</span>
              <Badge className="bg-blue-100 text-blue-700">Picking Estruturado</Badge>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-32 text-sm font-semibold text-slate-700">NF-e</div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
              <Badge className="bg-red-100 text-red-700">Tabela Fiscal</Badge>
              <span className="text-xs text-slate-500">→</span>
              <Badge className="bg-sky-100 text-sky-700">IA Compliance</Badge>
              <span className="text-xs text-slate-500">→</span>
              <Badge className="bg-green-100 text-green-700">Emissão Validada ✅</Badge>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-32 text-sm font-semibold text-slate-700">Grupos Produto</div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
              <Badge className="bg-cyan-100 text-cyan-700">NCM Padrão</Badge>
              <span className="text-xs text-slate-500">+</span>
              <Badge className="bg-green-100 text-green-700">Margem Sugerida</Badge>
              <span className="text-xs text-slate-500">→</span>
              <Badge className="bg-blue-100 text-blue-700">Pricing Inteligente</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* PRÓXIMOS PASSOS */}
      <Card className="border-2 border-blue-300 bg-gradient-to-r from-blue-50 to-sky-50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Stars className="w-5 h-5 text-blue-600" />
            Próximos Passos - Fase 3
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="flex items-center gap-2">
            <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
            Controle de acesso granular por cadastro estruturante
          </p>
          <p className="flex items-center gap-2">
            <span className="w-2 h-2 bg-sky-600 rounded-full"></span>
            IA sugere classificação automática de produtos
          </p>
          <p className="flex items-center gap-2">
            <span className="w-2 h-2 bg-cyan-600 rounded-full"></span>
            Sincronização com marketplaces (produtos)
          </p>
          <p className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-600 rounded-full"></span>
            Dashboard analítico de qualidade de dados
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
