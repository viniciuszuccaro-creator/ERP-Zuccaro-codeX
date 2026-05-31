import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Factory, Package, Award, Warehouse, Scale, TrendingUp, CheckCircle2, AlertCircle, ChevronRight, Stars } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";

/**
 * 🎯 DASHBOARD ESTRUTURANTES V21.2 FASE 2
 * 
 * Painel visual consolidado dos 5 cadastros estruturantes
 * Mostra métricas, qualidade de dados e status de integração
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

  const { data: setores = [] } = useQuery({
    queryKey: ['setores-atividade', ...queryScope],
    queryFn: () => filterInContext('SetorAtividade', {}, 'nome', 9999),
    enabled: consultasHabilitadas,
    staleTime: 120000,
  });

  const { data: grupos = [] } = useQuery({
    queryKey: ['grupos-produto', ...queryScope],
    queryFn: () => filterInContext('GrupoProduto', {}, 'nome', 9999),
    enabled: consultasHabilitadas,
    staleTime: 120000,
  });

  const { data: marcas = [] } = useQuery({
    queryKey: ['marcas', ...queryScope],
    queryFn: () => filterInContext('Marca', {}, 'nome', 9999),
    enabled: consultasHabilitadas,
    staleTime: 120000,
  });

  const { data: locais = [] } = useQuery({
    queryKey: ['locais-estoque', ...queryScope],
    queryFn: () => filterInContext('LocalEstoque', {}, 'nome', 9999),
    enabled: consultasHabilitadas,
    staleTime: 120000,
  });

  const { data: tabelas = [] } = useQuery({
    queryKey: ['tabelas-fiscais', ...queryScope],
    queryFn: () => filterInContext('TabelaFiscal', {}, 'nome', 9999),
    enabled: consultasHabilitadas,
    staleTime: 120000,
  });

  const { data: produtos = [] } = useQuery({
    queryKey: ['produtos-estruturantes', ...queryScope],
    queryFn: () => filterInContext('Produto', {}, 'descricao', 9999),
    enabled: consultasHabilitadas,
    staleTime: 120000,
  });

  // Métricas calculadas
  const setoresAtivos = setores.filter(s => s.ativo !== false).length;
  const gruposAtivos = grupos.filter(g => g.ativo !== false).length;
  const marcasAtivas = marcas.filter(m => m.ativo !== false).length;
  const locaisAtivos = locais.filter(l => l.ativo !== false).length;
  const tabelasAtivas = tabelas.filter(t => t.regra_ativa !== false).length;

  const produtosClassificados = produtos.filter(p => 
    p.setor_atividade_id && p.grupo_produto_id && p.marca_id
  ).length;
  const percentualClassificacao = produtos.length > 0 
    ? ((produtosClassificados / produtos.length) * 100).toFixed(0) 
    : 0;

  const ocupacaoTotal = locais.reduce((sum, l) => sum + (l.ocupacao_atual_m3 || 0), 0);
  const capacidadeTotal = locais.reduce((sum, l) => sum + (l.capacidade_m3 || 0), 0);
  const percentualOcupacao = capacidadeTotal > 0 
    ? ((ocupacaoTotal / capacidadeTotal) * 100).toFixed(0) 
    : 0;

  const tabelasValidadasIA = tabelas.filter(t => t.validado_ia).length;
  const percentualValidacaoIA = tabelas.length > 0
    ? ((tabelasValidadasIA / tabelas.length) * 100).toFixed(0)
    : 0;

  const estruturantes = [
    {
      nome: "Setores de Atividade",
      icon: Factory,
      total: setores.length,
      ativos: setoresAtivos,
      color: "indigo",
      bgGradient: "from-indigo-50 to-indigo-100",
      borderColor: "border-indigo-300",
      textColor: "text-indigo-700",
      metrica: `${setoresAtivos}/${setores.length} ativos`,
      status: setoresAtivos > 0 ? "ok" : "alert"
    },
    {
      nome: "Grupos de Produto",
      icon: Package,
      total: grupos.length,
      ativos: gruposAtivos,
      color: "cyan",
      bgGradient: "from-cyan-50 to-cyan-100",
      borderColor: "border-cyan-300",
      textColor: "text-cyan-700",
      metrica: `${gruposAtivos}/${grupos.length} ativos`,
      status: gruposAtivos > 0 ? "ok" : "alert"
    },
    {
      nome: "Marcas",
      icon: Award,
      total: marcas.length,
      ativos: marcasAtivas,
      color: "amber",
      bgGradient: "from-amber-50 to-amber-100",
      borderColor: "border-amber-300",
      textColor: "text-amber-700",
      metrica: `${marcasAtivas}/${marcas.length} ativas`,
      status: marcasAtivas > 0 ? "ok" : "alert"
    },
    {
      nome: "Locais de Estoque",
      icon: Warehouse,
      total: locais.length,
      ativos: locaisAtivos,
      color: "purple",
      bgGradient: "from-purple-50 to-purple-100",
      borderColor: "border-purple-300",
      textColor: "text-purple-700",
      metrica: `${percentualOcupacao}% ocupação`,
      status: parseInt(percentualOcupacao) < 90 ? "ok" : "alert"
    },
    {
      nome: "Tabelas Fiscais",
      icon: Scale,
      total: tabelas.length,
      ativos: tabelasAtivas,
      color: "red",
      bgGradient: "from-red-50 to-red-100",
      borderColor: "border-red-300",
      textColor: "text-red-700",
      metrica: `${percentualValidacaoIA}% validadas IA`,
      status: parseInt(percentualValidacaoIA) > 50 ? "ok" : "alert"
    }
  ];

  return (
    <div className="w-full h-full space-y-6" data-permission="Cadastros.visualizar" data-context-required="true">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <Stars className="w-7 h-7 text-purple-600" />
            Dashboard de Cadastros Estruturantes
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Visão consolidada dos 5 pilares mestres do sistema • Fase 2 Completa
          </p>
        </div>
        <Badge className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-4 py-2 text-sm">
          <CheckCircle2 className="w-4 h-4 mr-2" />
          100% Operacional
        </Badge>
      </div>

      {(!contextoValido || !podeVisualizarCadastros) && (
        <Alert variant="destructive">
          <AlertCircle className="w-5 h-5" />
          <AlertDescription>
            Dashboard de cadastros estruturantes exige contexto de grupo/empresa e permissão para visualizar cadastros.
          </AlertDescription>
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
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <Icon className={`w-8 h-8 ${item.textColor}`} />
                  {item.status === "ok" ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-amber-600" />
                  )}
                </div>
                <div className="text-3xl font-bold text-slate-900 mb-1">
                  {item.total}
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
              <div className="text-4xl font-bold text-blue-900">{percentualClassificacao}%</div>
              <div className="text-sm text-blue-700 mb-1">
                {produtosClassificados}/{produtos.length} produtos
              </div>
            </div>
            <p className="text-xs text-blue-600 mt-2">
              com Setor + Grupo + Marca definidos
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-300">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2 text-purple-900">
              <Warehouse className="w-4 h-4" />
              Ocupação de Almoxarifados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-3">
              <div className="text-4xl font-bold text-purple-900">{percentualOcupacao}%</div>
              <div className="text-sm text-purple-700 mb-1">
                {ocupacaoTotal.toFixed(0)}m³ / {capacidadeTotal.toFixed(0)}m³
              </div>
            </div>
            <p className="text-xs text-purple-600 mt-2">
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
              <div className="text-4xl font-bold text-red-900">{percentualValidacaoIA}%</div>
              <div className="text-sm text-red-700 mb-1">
                {tabelasValidadasIA}/{tabelas.length} regras
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
              <Badge className="bg-indigo-100 text-indigo-700">Setor Atividade</Badge>
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
              <Badge className="bg-purple-100 text-purple-700">Local Estoque</Badge>
              <span className="text-xs text-slate-500">→</span>
              <Badge className="bg-blue-100 text-blue-700">Picking Estruturado</Badge>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-32 text-sm font-semibold text-slate-700">NF-e</div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
              <Badge className="bg-red-100 text-red-700">Tabela Fiscal</Badge>
              <span className="text-xs text-slate-500">→</span>
              <Badge className="bg-purple-100 text-purple-700">IA Compliance</Badge>
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
      <Card className="border-2 border-blue-300 bg-gradient-to-r from-blue-50 to-purple-50">
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
            <span className="w-2 h-2 bg-purple-600 rounded-full"></span>
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