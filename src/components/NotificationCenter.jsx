import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, X, Check, AlertTriangle, Info, CheckCircle2, XCircle } from "lucide-react";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import { readErpHttpSession } from "@/api/erpHttpSession";
import { central360SessionKey } from "@/api/httpApiClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  buildNotificationCenterQueryKey,
  isNotificationCenterScopeCurrent,
  resolveNotificationCenterKpiState,
  filterNotificacoesVisiveis,
  countNotificacoesNaoLidas,
} from "./notificationCenterScope";

function readNotificationActorAndSession() {
  const session = readErpHttpSession();
  const actorId = typeof session?.actorId === "string" && session.actorId.trim()
    ? session.actorId.trim()
    : null;
  const email = typeof session?.email === "string" && session.email.trim()
    ? session.email.trim()
    : null;
  return { actorId, sessionKey: central360SessionKey(session?.token), email };
}

/**
 * Notificacao via filter/update InContext; badge KPI ≠ 0 em loading/erro.
 */
export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const {
    filterInContext,
    updateInContext,
    empresaAtual,
    grupoAtual,
    contexto,
  } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = contexto === "empresa" ? empresaAtual?.id : null;
  const contextoValido = Boolean(groupId || empresaId);
  const { actorId, sessionKey, email: actorEmail } = readNotificationActorAndSession();
  const scopeExpected = { actorId, sessionKey };

  const notificacoesQuery = useQuery({
    queryKey: buildNotificationCenterQueryKey({ groupId, empresaId, actorId, sessionKey }),
    queryFn: async ({ signal }) => {
      const rows = await filterInContext('Notificacao', {}, '-created_date', 100);
      if (signal?.aborted) {
        const err = new Error('NOTIFICATION_CENTER_ABORTED');
        err.name = 'AbortError';
        throw err;
      }
      if (!isNotificationCenterScopeCurrent(scopeExpected, readNotificationActorAndSession())) {
        throw new Error('NOTIFICATION_CENTER_STALE_SCOPE');
      }
      return filterNotificacoesVisiveis(rows, actorEmail);
    },
    enabled: contextoValido,
    refetchInterval: 30000,
  });

  const kpiState = resolveNotificationCenterKpiState({
    contextoValido,
    isLoading: notificacoesQuery.isLoading,
    isError: notificacoesQuery.isError,
    isFetching: notificacoesQuery.isFetching,
    dataDefined: notificacoesQuery.data !== undefined,
  });
  const notificacoes = kpiState === 'ready' && Array.isArray(notificacoesQuery.data)
    ? notificacoesQuery.data
    : [];
  const contagemIndisponivel = kpiState !== 'ready';
  const naoLidas = notificacoes.filter((n) => !n.lida);
  const badgeCount = contagemIndisponivel ? null : countNotificacoesNaoLidas(notificacoes);

  const marcarComoLidaMutation = useMutation({
    mutationFn: (/** @type {string} */ id) => updateInContext('Notificacao', id, {
      lida: true,
      data_leitura: new Date().toISOString(),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificacoes'] });
    },
  });

  const marcarTodasComoLidasMutation = useMutation({
    mutationFn: async () => {
      const promises = naoLidas.map((n) =>
        updateInContext('Notificacao', n.id, {
          lida: true,
          data_leitura: new Date().toISOString(),
        }),
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificacoes'] });
    },
  });

  const arquivarMutation = useMutation({
    mutationFn: (/** @type {string} */ id) => updateInContext('Notificacao', id, { arquivada: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificacoes'] });
    },
  });

  const getIconByType = (tipo) => {
    switch (tipo) {
      case 'sucesso':
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case 'erro':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'aviso':
        return <AlertTriangle className="w-5 h-5 text-amber-600" />;
      case 'urgente':
        return <AlertTriangle className="w-5 h-5 text-red-600 animate-pulse" />;
      default:
        return <Info className="w-5 h-5 text-blue-600" />;
    }
  };

  const handleNotificationClick = (notificacao) => {
    if (!notificacao.lida) {
      marcarComoLidaMutation.mutate(notificacao.id);
    }
    if (notificacao.link_acao) {
      window.location.href = notificacao.link_acao;
    }
  };

  const tabNaoLidasLabel = contagemIndisponivel ? 'Não lidas (…)' : `Não lidas (${naoLidas.length})`;
  const tabTodasLabel = contagemIndisponivel ? 'Todas (…)' : `Todas (${notificacoes.length})`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {badgeCount !== null && badgeCount > 0 && (
            <Badge
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-600"
            >
              {badgeCount > 9 ? '9+' : badgeCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <Card className="border-0 shadow-lg">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Notificações</CardTitle>
              {!contagemIndisponivel && naoLidas.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => marcarTodasComoLidasMutation.mutate()}
                  disabled={marcarTodasComoLidasMutation.isPending}
                >
                  <Check className="w-4 h-4 mr-2" />
                  Marcar todas como lidas
                </Button>
              )}
            </div>
          </CardHeader>
          {kpiState === 'unavailable' && (
            <div className="p-4 text-sm text-amber-800 bg-amber-50 border-b border-amber-200">
              Selecione grupo ou empresa para listar notificações.
            </div>
          )}
          {kpiState === 'error' && (
            <div className="p-4 text-sm text-red-800 bg-red-50 border-b border-red-200">
              Erro ao carregar (erro ≠ badge 0).
            </div>
          )}
          {kpiState === 'loading' && (
            <div className="p-8 text-center text-slate-500 text-sm">Carregando…</div>
          )}
          {kpiState === 'ready' && (
          <Tabs defaultValue="nao-lidas" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="nao-lidas">
                {tabNaoLidasLabel}
              </TabsTrigger>
              <TabsTrigger value="todas">
                {tabTodasLabel}
              </TabsTrigger>
            </TabsList>
            <ScrollArea className="h-96">
              <TabsContent value="nao-lidas" className="m-0">
                {naoLidas.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    <Bell className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p>Nenhuma notificação não lida</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {naoLidas.map((notif) => (
                      <div
                        key={notif.id}
                        className="p-4 hover:bg-slate-50 cursor-pointer transition-colors"
                        onClick={() => handleNotificationClick(notif)}
                      >
                        <div className="flex gap-3">
                          <div className="flex-shrink-0 mt-1">
                            {getIconByType(notif.tipo)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <h4 className="font-semibold text-sm text-slate-900">
                                {notif.titulo}
                              </h4>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 flex-shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  arquivarMutation.mutate(notif.id);
                                }}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                            <p className="text-sm text-slate-600 line-clamp-2">
                              {notif.mensagem}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline" className="text-xs">
                                {notif.categoria}
                              </Badge>
                              <span className="text-xs text-slate-400">
                                {new Date(notif.created_date).toLocaleString('pt-BR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
              <TabsContent value="todas" className="m-0">
                {notificacoes.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    <Bell className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p>Nenhuma notificação</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {notificacoes.map((notif) => (
                      <div
                        key={notif.id}
                        className={`p-4 hover:bg-slate-50 cursor-pointer transition-colors ${
                          !notif.lida ? 'bg-blue-50/50' : ''
                        }`}
                        onClick={() => handleNotificationClick(notif)}
                      >
                        <div className="flex gap-3">
                          <div className="flex-shrink-0 mt-1">
                            {getIconByType(notif.tipo)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <h4 className={`font-semibold text-sm ${notif.lida ? 'text-slate-600' : 'text-slate-900'}`}>
                                {notif.titulo}
                              </h4>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 flex-shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  arquivarMutation.mutate(notif.id);
                                }}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                            <p className="text-sm text-slate-600 line-clamp-2">
                              {notif.mensagem}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline" className="text-xs">
                                {notif.categoria}
                              </Badge>
                              <span className="text-xs text-slate-400">
                                {new Date(notif.created_date).toLocaleString('pt-BR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>
          )}
        </Card>
      </PopoverContent>
    </Popover>
  );
}
