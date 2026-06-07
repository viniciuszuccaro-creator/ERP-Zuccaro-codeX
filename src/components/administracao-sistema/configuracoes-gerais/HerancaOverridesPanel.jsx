import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import { useUser } from "@/components/lib/UserContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import usePermissions from "@/components/lib/usePermissions";

export default function HerancaOverridesPanel() {
  const { empresaAtual, grupoAtual, contexto, filterInContext, createInContext, updateInContext, deleteInContext } = useContextoVisual();
  const { user } = useUser();
  const { isAdmin, hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const scope = React.useMemo(() => ({
    group_id: grupoAtual?.id || null,
    empresa_id: contexto === 'grupo' ? null : (empresaAtual?.id || null)
  }), [empresaAtual?.id, grupoAtual?.id, contexto]);
  const contextoValidoParaOverride = !!scope.group_id && !!scope.empresa_id;
  const podeEditarOverrides = isAdmin() || hasPermission("Sistema", "Configurações", "editar") || hasPermission("Sistema", "Configuracoes", "editar");

  const registrarAuditoria = React.useCallback(async ({ acao, chave, registroId, dadosNovos, dadosAntigos }) => {
    try {
      await createInContext('AuditLog', {
        usuario: user?.full_name || user?.email || 'Usuario local',
        usuario_id: user?.id || null,
        empresa_id: scope.empresa_id || null,
        group_id: scope.group_id || null,
        acao,
        modulo: 'Configuracoes',
        entidade: 'ConfiguracaoSistema',
        registro_id: registroId || chave,
        descricao: `${acao} de override de configuracao: ${chave}`,
        dados_antigos: dadosAntigos || null,
        dados_novos: dadosNovos || null,
        data_hora: new Date().toISOString()
      });
    } catch (error) {
      console.warn('Falha ao registrar auditoria de override:', error);
    }
  }, [createInContext, scope.empresa_id, scope.group_id, user?.email, user?.full_name, user?.id]);

  const { data: cfgGrupo = [] } = useQuery({
    queryKey: ['cfg-sistema-grupo', scope.group_id],
    enabled: !!scope.group_id,
    queryFn: async () => filterInContext('ConfiguracaoSistema', { group_id: scope.group_id, empresa_id: null }, '-updated_date', 200)
  });

  const { data: cfgEmpresa = [] } = useQuery({
    queryKey: ['cfg-sistema-empresa', scope.empresa_id],
    enabled: contextoValidoParaOverride,
    queryFn: async () => filterInContext('ConfiguracaoSistema', { empresa_id: scope.empresa_id }, '-updated_date', 200)
  });

  const upsertMutation = useMutation({
    mutationFn: async ({ registroGrupo }) => {
      if (!contextoValidoParaOverride) {
        throw new Error('Selecione um grupo e uma empresa antes de criar override.');
      }
      if (!podeEditarOverrides) {
        throw new Error('Sem permissao para criar override.');
      }
      // Procura override existente por mesma chave
      const existente = (cfgEmpresa || []).find(c => c.chave === registroGrupo.chave);
      const payload = {
        ...registroGrupo,
        id: undefined,
        created_date: undefined,
        updated_date: undefined,
        empresa_id: scope.empresa_id,
        group_id: scope.group_id,
        origem_configuracao: 'override_empresa',
        chave_origem_grupo: registroGrupo.id || null
      };
      if (existente) {
        const atualizado = await updateInContext('ConfiguracaoSistema', existente.id, payload);
        await registrarAuditoria({
          acao: 'Atualizacao Override',
          chave: registroGrupo.chave,
          registroId: existente.id,
          dadosAntigos: existente,
          dadosNovos: atualizado || payload
        });
        return existente.id;
      }
      const created = await createInContext('ConfiguracaoSistema', payload);
      await registrarAuditoria({
        acao: 'Criacao Override',
        chave: registroGrupo.chave,
        registroId: created?.id,
        dadosNovos: created || payload
      });
      return created.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cfg-sistema-empresa', scope.empresa_id] });
      queryClient.invalidateQueries({ queryKey: ['audit-config'] });
      toast.success('Override salvo para a empresa selecionada.');
    },
    onError: (error) => {
      toast.error(error?.message || 'Nao foi possivel salvar o override.');
    }
  });

  const removerOverrideMutation = useMutation({
    mutationFn: async ({ chave }) => {
      if (!contextoValidoParaOverride) {
        throw new Error('Selecione um grupo e uma empresa antes de remover override.');
      }
      if (!podeEditarOverrides) {
        throw new Error('Sem permissao para remover override.');
      }
      const existente = (cfgEmpresa || []).find(c => c.chave === chave);
      if (!existente) {
        throw new Error('Override nao encontrado para esta empresa.');
      }
      await deleteInContext('ConfiguracaoSistema', existente.id);
      await registrarAuditoria({
        acao: 'Remocao Override',
        chave,
        registroId: existente.id,
        dadosAntigos: existente
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cfg-sistema-empresa', scope.empresa_id] });
      queryClient.invalidateQueries({ queryKey: ['audit-config'] });
      toast.success('Override removido da empresa selecionada.');
    },
    onError: (error) => {
      toast.error(error?.message || 'Nao foi possivel remover o override.');
    }
  });

  const renderLinha = (g) => {
    const override = (cfgEmpresa || []).find(e => e.chave === g.chave);
    return (
      <div key={g.id} className="flex items-center gap-3 p-2 border-b">
        <Badge variant={override ? 'default' : 'outline'}>{override ? 'Override' : 'Herdado'}</Badge>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{g.chave || '(sem chave)'}</div>
          <div className="text-xs text-slate-500 truncate">{JSON.stringify(g.valor || g, null, 0)}</div>
        </div>
        {contextoValidoParaOverride && (
          override ? (
            <Button variant="outline" size="sm" onClick={() => removerOverrideMutation.mutate({ chave: g.chave })} disabled={removerOverrideMutation.isPending || !podeEditarOverrides} data-action="ConfigHeranca.override.remover" data-permission="Sistema.Configuracoes.editar" data-context-required="group-or-company" data-sensitive="true">Remover Override</Button>
          ) : (
            <Button size="sm" onClick={() => upsertMutation.mutate({ registroGrupo: g })} disabled={upsertMutation.isPending || !podeEditarOverrides} data-action="ConfigHeranca.override.criar" data-permission="Sistema.Configuracoes.criar" data-context-required="group-or-company" data-sensitive="true">Criar Override</Button>
          )
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-600">
          Contexto: {scope.group_id ? 'Grupo' : '—'} {scope.empresa_id ? `• Empresa ${scope.empresa_id}` : '• Sem empresa selecionada'}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="grid grid-cols-1 lg:grid-cols-2">
            <div className="border-r">
              <div className="p-3 text-sm font-semibold bg-slate-50">Configurações do Grupo</div>
              <div className="max-h-[420px] overflow-auto">
                {(cfgGrupo || []).map(renderLinha)}
                {(!cfgGrupo || cfgGrupo.length === 0) && (
                  <div className="p-3 text-sm text-slate-500">Nenhuma configuração no grupo.</div>
                )}
              </div>
            </div>
            <div>
              <div className="p-3 text-sm font-semibold bg-slate-50">Overrides da Empresa</div>
              <div className="max-h-[420px] overflow-auto">
                {(cfgEmpresa || []).map((e) => (
                  <div key={e.id} className="flex items-center gap-3 p-2 border-b">
                    <Badge>Override</Badge>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{e.chave || '(sem chave)'}</div>
                      <div className="text-xs text-slate-500 truncate">{JSON.stringify(e.valor || e, null, 0)}</div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => removerOverrideMutation.mutate({ chave: e.chave })} disabled={removerOverrideMutation.isPending || !podeEditarOverrides} data-action="ConfigHeranca.override.removerEmpresa" data-permission="Sistema.Configuracoes.editar" data-context-required="group-or-company" data-sensitive="true">Remover</Button>
                  </div>
                ))}
                {(!cfgEmpresa || cfgEmpresa.length === 0) && (
                  <div className="p-3 text-sm text-slate-500">Nenhum override na empresa.</div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
