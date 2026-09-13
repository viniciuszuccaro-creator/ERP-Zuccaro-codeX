import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useUser } from '@/components/lib/UserContext';
import { Bell, Package, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';

/**
 * V21.5 - Notificações Portal COMPLETO
 * ✅ Dropdown com badge contador
 * ✅ Auto-refresh 60s
 * ✅ Ícones por tipo
 * ✅ Marcar como lida
 * ✅ Timestamp formatado
 */
export default function NotificacoesPortal() {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const { data: notificacoes = [] } = useQuery({
    queryKey: ['notificacoes-portal', user?.id],
    queryFn: async () => {
      const me = await base44.auth.me();
      let empresaId = null, groupId = null;
      try {
        const c = await base44.entities.Cliente.filter({ portal_usuario_id: me.id }, undefined, 1);
        if (Array.isArray(c) && c[0]) { empresaId = c[0].empresa_id || null; groupId = c[0].group_id || null; }
      } catch (error) {
        console.error('[NotificacoesPortal] Falha ao resolver contexto do cliente', error);
        throw new Error('Contexto do cliente indisponivel para notificacoes.');
      }
      return await base44.entities.Notificacao.filter(
        { usuario_id: me.id, lida: false, empresa_id: empresaId || undefined, group_id: groupId || undefined },
        '-created_date',
        10
      );
    },
    refetchInterval: 60000, // Atualiza a cada minuto
    enabled: !!user?.id,
  });

  const getIconByTipo = (tipo) => {
    switch (tipo) {
      case 'pedido':
        return <Package className="w-5 h-5 text-blue-600" />;
      case 'nfe':
        return <FileText className="w-5 h-5 text-green-600" />;
      case 'alerta':
        return <AlertCircle className="w-5 h-5 text-orange-600" />;
      case 'sucesso':
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      default:
        return <Bell className="w-5 h-5 text-slate-600" />;
    }
  };

  const marcarComoLida = async (notifId) => {
    try {
      const me = await base44.auth.me();
      let empresaId = null, groupId = null;
      try {
        const c = await base44.entities.Cliente.filter({ portal_usuario_id: me.id }, undefined, 1);
        if (Array.isArray(c) && c[0]) { empresaId = c[0].empresa_id || null; groupId = c[0].group_id || null; }
      } catch (error) {
        console.error('[NotificacoesPortal] Falha ao resolver contexto para leitura', error);
        throw new Error('Contexto do cliente indisponivel para atualizar notificacao.');
      }
      await base44.entities.Notificacao.update(notifId, { lida: true, empresa_id: empresaId || undefined, group_id: groupId || undefined });
      await queryClient.invalidateQueries({ queryKey: ['notificacoes-portal', user?.id] });
    } catch (error) {
      console.error('[NotificacoesPortal] Falha ao marcar notificacao como lida', error);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {notificacoes.length > 0 && (
            <Badge className="absolute -top-1 -right-1 w-5 h-5 p-0 flex items-center justify-center bg-red-600 text-white text-xs">
              {notificacoes.length}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-full max-w-sm sm:max-w-md p-0">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4">
          <h3 className="font-bold text-lg">Notificações</h3>
          <p className="text-xs text-blue-100">{notificacoes.length} não lida(s)</p>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {notificacoes.length > 0 ? (
            notificacoes.map((notif) => (
              <div
                key={notif.id}
                className="p-4 border-b hover:bg-slate-50 cursor-pointer transition-colors"
                onClick={() => marcarComoLida(notif.id)}
              >
                <div className="flex items-start gap-3">
                  {getIconByTipo(notif.tipo)}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm line-clamp-2">{notif.titulo}</p>
                    <p className="text-xs text-slate-600 mt-1 line-clamp-2">{notif.mensagem}</p>
                    <p className="text-xs text-slate-500 mt-2">
                      {format(new Date(notif.created_date), 'dd/MM/yyyy HH:mm')}
                    </p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-12 text-center text-slate-500">
              <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhuma notificação</p>
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
