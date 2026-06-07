import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import { useUser } from "@/components/lib/UserContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import usePermissions from "@/components/lib/usePermissions";

export default function VersionamentoConfigPanel() {
  const { contexto, empresaAtual, grupoAtual, filterInContext, updateInContext, createInContext } = useContextoVisual();
  const { user } = useUser();
  const { isAdmin, hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const scopeId = empresaAtual?.id || grupoAtual?.id || 'sem-contexto';
  const contextoValido = scopeId !== 'sem-contexto';
  const podeRestaurarConfig = isAdmin() || hasPermission("Sistema", "Configurações", "editar") || hasPermission("Sistema", "Configuracoes", "editar");

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit-config', scopeId, contexto],
    queryFn: async () => {
      const recent = await filterInContext('AuditLog', { entidade: 'ConfiguracaoSistema' }, '-data_hora', 100);
      return recent.filter((log) => log.entidade === 'ConfiguracaoSistema' || log.entity_name === 'ConfiguracaoSistema');
    },
    enabled: contextoValido,
    staleTime: 30000
  });

  const restoreMutation = useMutation({
    mutationFn: async (log) => {
      const registroId = log?.registro_id;
      if (!contextoValido) {
        throw new Error('Selecione um grupo ou empresa antes de restaurar configuracoes.');
      }
      if (!podeRestaurarConfig) {
        throw new Error('Sem permissao para restaurar configuracoes.');
      }
      if (!registroId) {
        throw new Error('Historico sem registro vinculado para restaurar.');
      }
      const snapshot = log?.dados_anteriores || log?.dados_antigos || log?.dados_novos;
      if (!snapshot) {
        throw new Error('Historico sem snapshot restauravel.');
      }
      const payload = { ...snapshot };
      delete payload.id; delete payload.created_date; delete payload.updated_date; delete payload.created_by;
      // preserva contexto atual se existir
      if (grupoAtual?.id) payload.group_id = grupoAtual.id;
      if (empresaAtual?.id) payload.empresa_id = empresaAtual.id;
      const result = await updateInContext('ConfiguracaoSistema', registroId, payload);
      await createInContext('AuditLog', {
        usuario: user?.full_name || user?.email || 'Usuario local',
        usuario_id: user?.id || null,
        empresa_id: empresaAtual?.id || null,
        group_id: grupoAtual?.id || null,
        acao: 'Restauracao Configuracao',
        modulo: 'Configuracoes',
        entidade: 'ConfiguracaoSistema',
        registro_id: registroId,
        descricao: `Restauracao de configuracao pelo historico: ${payload.chave || registroId}`,
        dados_antigos: log,
        dados_novos: result || payload,
        data_hora: new Date().toISOString()
      });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit-config'] });
      queryClient.invalidateQueries({ queryKey: ['cfg-sistema-grupo'] });
      queryClient.invalidateQueries({ queryKey: ['cfg-sistema-empresa'] });
      toast.success('Configuracao restaurada e auditada.');
    },
    onError: (error) => {
      toast.error(error?.message || 'Nao foi possivel restaurar a configuracao.');
    }
  });

  return (
    <div className="space-y-3">
      <div className="text-sm text-slate-600">
        Histórico recente de alterações (AuditLog) • Restaure para um snapshot anterior de forma auditada.
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="max-h-[520px] overflow-auto divide-y">
            {(logs || []).map((l) => (
              <div key={l.id} className="p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{l.descricao || 'Alteração em ConfiguracaoSistema'}</div>
                  <div className="text-xs text-slate-500 truncate">{new Date(l.data_hora || l.created_date).toLocaleString('pt-BR')} • Usuário: {l.usuario}</div>
                </div>
                <Badge variant="outline" className="text-xs">{l.acao}</Badge>
                <Button size="sm" variant="outline" onClick={() => restoreMutation.mutate(l)} disabled={restoreMutation.isPending || !contextoValido || !podeRestaurarConfig} data-action="ConfigVersionamento.restaurar" data-permission="Sistema.Configuracoes.editar" data-sensitive="true" data-context-required="group-or-company">
                  Restaurar
                </Button>
              </div>
            ))}
            {(!logs || logs.length === 0) && (
              <div className="p-3 text-sm text-slate-500">Sem histórico de alterações recentes.</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
