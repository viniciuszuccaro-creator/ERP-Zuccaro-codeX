import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWindow } from "@/components/lib/useWindow";
import ParametroOrigemPedidoForm from "./ParametroOrigemPedidoForm";
import DashboardCanaisOrigem from "./DashboardCanaisOrigem";
import GerenciadorCanaisOrigem from "./GerenciadorCanaisOrigem";
import StatusOrigemPedido100 from "@/components/sistema/StatusOrigemPedido100";
import useContextoVisual from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { readErpHttpSession } from "@/api/erpHttpSession";
import { central360SessionKey } from "@/api/httpApiClient";
import {
  buildParametrosOrigemQueryKey,
  isParametrosOrigemScopeCurrent,
  resolveParametrosOrigemKpiState,
} from "./parametrosOrigemScope";
import {
  Plus,
  Search,
  Settings,
  CheckCircle,
  XCircle,
  Edit,
  Zap,
  User,
  BarChart3,
  List
} from "lucide-react";

function readOrigemActorAndSession() {
  const session = readErpHttpSession();
  const actorId = typeof session?.actorId === 'string' ? session.actorId.trim() : '';
  return {
    actorId: actorId || null,
    sessionKey: central360SessionKey(session?.token),
  };
}

/**
 * V21.6 - Tab COMPLETA para gerenciar origens de pedidos
 * Lista canais + Dashboard de performance
 */
export default function ParametrosOrigemPedidoTab() {
  const { openWindow } = useWindow();
  const [busca, setBusca] = useState('');
  const [abaAtiva, setAbaAtiva] = useState('canais');
  const { empresaAtual, grupoAtual, filterInContext } = useContextoVisual();
  const { canCreate, canEdit, hasPermission } = usePermissions();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const { actorId, sessionKey } = readOrigemActorAndSession();
  const contextoValido = Boolean(groupId || empresaId);
  const podeVer = hasPermission('Cadastros', 'ParametroOrigemPedido', 'visualizar')
    || hasPermission('Cadastros', 'Canais de Origem', 'visualizar')
    || hasPermission('Cadastros', null, 'visualizar');
  const podeCriar = canCreate('Cadastros', 'ParametroOrigemPedido') || canCreate('Cadastros', 'Canais de Origem') || canCreate('Cadastros', null);
  const podeEditar = canEdit('Cadastros', 'ParametroOrigemPedido') || canEdit('Cadastros', 'Canais de Origem') || canEdit('Cadastros', null);
  const origemQueryKey = buildParametrosOrigemQueryKey({ groupId, empresaId, actorId, sessionKey });
  const scopeExpected = { actorId, sessionKey };

  const {
    data: parametros,
    isLoading,
    isError,
    error,
    isFetching,
  } = useQuery({
    queryKey: origemQueryKey,
    queryFn: async ({ signal }) => {
      const rows = await filterInContext('ParametroOrigemPedido', {}, 'canal', 500);
      if (signal?.aborted) {
        const err = new Error('PARAM_ORIGEM_ABORTED');
        err.name = 'AbortError';
        throw err;
      }
      if (!isParametrosOrigemScopeCurrent(scopeExpected, readOrigemActorAndSession())) {
        throw new Error('PARAM_ORIGEM_STALE_SCOPE');
      }
      return rows;
    },
    enabled: contextoValido && podeVer,
  });

  const lista = Array.isArray(parametros) ? parametros : [];
  const kpiState = resolveParametrosOrigemKpiState({
    contextoValido,
    podeVer,
    isLoading,
    isError,
    isFetching,
    dataDefined: parametros !== undefined,
  });
  const contagemIndisponivel = kpiState !== 'ready';
  const parametrosFiltrados = lista.filter(p =>
    p.nome?.toLowerCase().includes(busca.toLowerCase()) ||
    p.canal?.toLowerCase().includes(busca.toLowerCase())
  );

  const handleNovo = () => {
    if (!contextoValido || !podeCriar) return;
    openWindow(
      ParametroOrigemPedidoForm,
      { windowMode: true },
      {
        title: 'Novo Parâmetro de Origem',
        width: 900,
        height: 700,
        uniqueKey: `cadastros-param-origem-create-${JSON.stringify([groupId || null, empresaId || null])}`,
      },
    );
  };

  const handleEditar = (parametro) => {
    if (!contextoValido || !podeEditar) return;
    openWindow(
      ParametroOrigemPedidoForm,
      { parametro, windowMode: true },
      {
        title: `Editar: ${parametro.nome}`,
        width: 900,
        height: 700,
        uniqueKey: `cadastros-param-origem-edit-${String(parametro?.id || '')}`,
      },
    );
  };

  const iconesTipo = {
    'Manual': User,
    'Automático': Zap,
    'Misto': Settings
  };

  const canaisAtivos = contagemIndisponivel ? null : lista.filter(p => p.ativo).length;
  const canaisInativos = contagemIndisponivel ? null : lista.filter(p => !p.ativo).length;
  const canaisAutomaticos = contagemIndisponivel
    ? null
    : lista.filter(p => p.tipo_criacao === 'Automático' || p.tipo_criacao === 'Misto').length;
  const totalCanais = contagemIndisponivel ? null : lista.length;
  const kpiLabel = (value) => {
    if (kpiState === 'unavailable') return '—';
    if (kpiState === 'error') return 'Erro';
    if (kpiState === 'loading') return '…';
    return value;
  };

  return (
    <div className="space-y-4 w-full h-full">
      {!contextoValido && (
        <Card>
          <CardContent className="p-4 text-sm text-slate-600">
            Selecione grupo ou empresa para listar canais de origem. Contagens indisponíveis não são zero.
          </CardContent>
        </Card>
      )}
      {contextoValido && !podeVer && (
        <Card>
          <CardContent className="p-4 text-sm text-slate-600">
            Sem permissão para visualizar parâmetros de origem.
          </CardContent>
        </Card>
      )}
      {isError && (
        <Card>
          <CardContent className="p-4 text-sm text-red-700">
            Falha ao carregar canais: {error?.message || 'erro desconhecido'}. Contagens não são zero.
          </CardContent>
        </Card>
      )}

      {/* Estatísticas Rápidas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-slate-600">Total Canais</p>
            <p className="text-2xl font-bold text-blue-600" data-testid="param-origem-kpi-total">{kpiLabel(totalCanais)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-slate-600">Ativos</p>
            <p className="text-2xl font-bold text-green-600" data-testid="param-origem-kpi-ativos">{kpiLabel(canaisAtivos)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-slate-600">Inativos</p>
            <p className="text-2xl font-bold text-orange-600" data-testid="param-origem-kpi-inativos">{kpiLabel(canaisInativos)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-slate-600">Automáticos</p>
            <p className="text-2xl font-bold text-sky-600" data-testid="param-origem-kpi-auto">
              {kpiLabel(canaisAutomaticos)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs: Canais vs Dashboard */}
      <Tabs value={abaAtiva} onValueChange={setAbaAtiva}>
        <div className="flex gap-3 items-center mb-4 flex-wrap">
          <TabsList className="bg-slate-100">
            <TabsTrigger value="canais">
              <List className="w-4 h-4 mr-2" />
              Canais Configurados
            </TabsTrigger>
            <TabsTrigger value="gerenciador">
              <Settings className="w-4 h-4 mr-2" />
              Gerenciador Rápido
            </TabsTrigger>
            <TabsTrigger value="dashboard">
              <BarChart3 className="w-4 h-4 mr-2" />
              Dashboard & Performance
            </TabsTrigger>
            <TabsTrigger value="status">
              <CheckCircle className="w-4 h-4 mr-2" />
              Status 100%
            </TabsTrigger>
          </TabsList>

          {abaAtiva === 'canais' && (
            <>
              <div className="flex-1 relative min-w-[12rem]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Buscar por nome ou canal..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-10"
                  disabled={!contextoValido || !podeVer}
                />
              </div>
              <Button
                onClick={handleNovo}
                disabled={!contextoValido || !podeCriar}
                data-permission="Cadastros.ParametroOrigemPedido.criar"
              >
                <Plus className="w-4 h-4 mr-2" />
                Novo Canal
              </Button>
            </>
          )}
        </div>

        <TabsContent value="canais" className="mt-0">
          {isLoading ? (
            <div className="text-center py-12 text-slate-500">
              Carregando parâmetros...
            </div>
          ) : isError ? (
            <div className="text-center py-12 text-red-600">
              Não foi possível carregar os canais. Tente novamente.
            </div>
          ) : !contextoValido || !podeVer ? (
            <div className="text-center py-12 text-slate-500">
              Contexto e permissão são obrigatórios para listar canais.
            </div>
          ) : parametrosFiltrados.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Settings className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                <p className="text-slate-600 font-medium">
                  Nenhum parâmetro configurado
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  Crie seu primeiro canal de origem de pedidos
                </p>
                <Button onClick={handleNovo} className="mt-4" disabled={!podeCriar}>
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Primeiro Canal
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {parametrosFiltrados.map((param) => {
                const IconeTipo = iconesTipo[param.tipo_criacao] || Settings;

                return (
                  <Card
                    key={param.id}
                    className="hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => handleEditar(param)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className={`p-2 rounded-lg bg-${param.cor_badge}-100`}>
                            <IconeTipo className={`w-5 h-5 text-${param.cor_badge}-600`} />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800">{param.nome}</p>
                            <p className="text-xs text-slate-500">{param.canal}</p>
                          </div>
                        </div>
                        <Badge variant={param.ativo ? 'default' : 'secondary'}>
                          {param.ativo ? (
                            <><CheckCircle className="w-3 h-3 mr-1" />Ativo</>
                          ) : (
                            <><XCircle className="w-3 h-3 mr-1" />Inativo</>
                          )}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-600 line-clamp-2 mb-3">{param.descricao || 'Sem descrição'}</p>
                      <div className="flex justify-between items-center">
                        <Badge variant="outline">{param.tipo_criacao}</Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => { e.stopPropagation(); handleEditar(param); }}
                          disabled={!podeEditar}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="gerenciador" className="mt-0">
          <GerenciadorCanaisOrigem />
        </TabsContent>

        <TabsContent value="dashboard" className="mt-0">
          <DashboardCanaisOrigem empresaId={empresaId} />
        </TabsContent>

        <TabsContent value="status" className="mt-0">
          <StatusOrigemPedido100 />
        </TabsContent>
      </Tabs>
    </div>
  );
}
