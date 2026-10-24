import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, X, Check, AlertTriangle, Info, CheckCircle2, XCircle, Target } from "lucide-react";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { empresaAtual, estaNoGrupo } = useContextoVisual();

  const { data: notificacoes = [], refetch } = useQuery({
    queryKey: ['notificacoes', empresaAtual?.id],
    queryFn: async () => {
      const user = await base44.auth.me();
      // Preferir filtro no servidor para respeitar multiempresa
      const filtroSrv = (!estaNoGrupo && empresaAtual) ? { empresa_id: empresaAtual.id } : {};
      const todas = await base44.entities.Notificacao.filter(filtroSrv, '-created_date', 100);
      const visiveis = todas.filter(n => !n.arquivada && (!n.destinatario_email || n.destinatario_email === user.email));
      return visiveis;
    },
    refetchInterval: 30000, // Atualiza a cada 30 segundos
  });

  // Separar notificações
  const naoLidas = notificacoes.filter(n => !n.lida);
  const lidas = notificacoes.filter(n => n.lida);

  const marcarComoLidaMutation = useMutation({
    mutationFn: (/** @type {string} */ id) => base44.entities.Notificacao.update(id, {
      lida: true, 
      data_leitura: new Date().toISOString() 
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificacoes'] });
    },
  });

  const marcarTodasComoLidasMutation = useMutation({
    mutationFn: async () => {
      const promises = naoLidas.map(n => 
        base44.entities.Notificacao.update(n.id, { 
          lida: true, 
          data_leitura: new Date().toISOString() 
        })
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificacoes'] });
    },
  });

  const arquivarMutation = useMutation({
    mutationFn: (/** @type {string} */ id) => base44.entities.Notificacao.update(id, { arquivada: true }),
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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {naoLidas.length > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-600"
            >
              {naoLidas.length > 9 ? '9+' : naoLidas.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <Card className="border-0 shadow-lg">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Notificações</CardTitle>
              {naoLidas.length > 0 && (
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
          <Tabs defaultValue="nao-lidas" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="nao-lidas">
                Não lidas ({naoLidas.length})
              </TabsTrigger>
              <TabsTrigger value="todas">
                Todas ({notificacoes.length})
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
        </Card>
      </PopoverContent>
    </Popover>
  );
}
