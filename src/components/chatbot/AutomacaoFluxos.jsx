import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Workflow, Clock, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import usePermissions from '@/components/lib/usePermissions';

/**
 * V21.6 - AUTOMAÇÕES E FLUXOS
 * Configurar ações automáticas baseadas em triggers
 * ✅ Suporte multi-empresa
 * ✅ Layout responsivo w-full h-full
 */
export default function AutomacaoFluxos({ canalConfig }) {
  const { empresaAtual, grupoAtual, updateInContext } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const empresaId = empresaAtual?.id;
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id;
  const contextoValido = Boolean(empresaId || groupId);
  const canEditAutomacao = hasPermission('Sistema', 'Integracoes', 'editar') ||
    hasPermission('CRM', 'Atendimento', 'editar');
  const [automacoes, setAutomacoes] = useState([
    {
      nome: 'Boas-vindas Fora Horário',
      trigger: 'mensagem_fora_horario',
      acao: 'enviar_mensagem_automatica',
      ativo: true,
      condicoes: { horario_comercial: false }
    },
    {
      nome: 'Alerta Insatisfação',
      trigger: 'sentimento_negativo',
      acao: 'notificar_supervisor',
      ativo: true,
      condicoes: { sentimento: ['Negativo', 'Frustrado'] }
    },
    {
      nome: 'Timeout Inatividade',
      trigger: 'inatividade_30min',
      acao: 'fechar_conversa',
      ativo: true,
      condicoes: { minutos_inativo: 30 }
    },
    {
      nome: 'Follow-up Automático',
      trigger: 'conversa_resolvida',
      acao: 'enviar_pesquisa_satisfacao',
      ativo: true,
      condicoes: { status: 'Resolvida' }
    }
  ]);

  const salvarMutation = useMutation({
    mutationFn: async () => {
      if (!canalConfig?.id || !contextoValido || !canEditAutomacao) return;
      
      await updateInContext('ConfiguracaoCanal', canalConfig.id, {
        acoes_automaticas: automacoes.map(a => ({
          trigger: a.trigger,
          acao: a.acao,
          parametros: a.condicoes,
          ativo: a.ativo
        }))
      });
    },
    onSuccess: () => toast.success('Automações salvas!')
  });

  return (
    <Card className="w-full h-full" data-permission="Sistema.Integracoes.editar" data-context-required="group-or-company">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Workflow className="w-5 h-5 text-purple-600" />
          Automações e Fluxos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {automacoes.map((auto, idx) => (
          <div key={idx} className="p-4 border-2 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex-1">
                <p className="font-semibold text-sm">{auto.nome}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">
                    {auto.trigger}
                  </Badge>
                  <span className="text-xs text-slate-600">→ {auto.acao}</span>
                </div>
              </div>
              <Switch
                checked={auto.ativo}
                disabled={!contextoValido || !canEditAutomacao || !canalConfig?.id}
                data-action="AutomacaoFluxos.toggleAutomacao"
                data-permission="Sistema.Integracoes.editar"
                data-context-required="group-or-company"
                onCheckedChange={(checked) => {
                  const novas = [...automacoes];
                  novas[idx].ativo = checked;
                  setAutomacoes(novas);
                }}
              />
            </div>
          </div>
        ))}

        <Button onClick={() => salvarMutation.mutate()} disabled={!contextoValido || !canEditAutomacao || !canalConfig?.id || salvarMutation.isPending} className="w-full bg-purple-600 hover:bg-purple-700" data-action="AutomacaoFluxos.salvar" data-permission="Sistema.Integracoes.editar" data-context-required="group-or-company" data-sensitive="true">
          <Workflow className="w-4 h-4 mr-2" />
          Salvar Automações
        </Button>
      </CardContent>
    </Card>
  );
}
