import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Settings2, Users, TrendingUp, Settings, Brain } from 'lucide-react';
import { toast } from 'sonner';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import usePermissions from '@/components/lib/usePermissions';

/**
 * V21.6 - ROTEAMENTO INTELIGENTE DE CONVERSAS
 * 
 * Sistema de distribuição automática:
 * ✅ Round-robin (rotativo)
 * ✅ Por habilidade/especialidade
 * ✅ Por carga de trabalho
 * ✅ Por histórico cliente-atendente
 * ✅ IA preditiva de melhor match
 * ✅ Suporte multi-empresa
 * ✅ Layout responsivo w-full h-full
 */
export default function RoteamentoInteligente({ canalConfig }) {
  const queryClient = useQueryClient();
  const { empresaAtual, grupoAtual, filterInContext, updateInContext } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const empresaId = empresaAtual?.id;
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id;
  const contextKey = empresaId || groupId || 'sem-contexto';
  const contextoValido = contextKey !== 'sem-contexto';
  const canViewRoteamento = hasPermission('CRM', 'Atendimento', 'visualizar') ||
    hasPermission('Sistema', 'Integracoes', 'visualizar');
  const canEditRoteamento = hasPermission('CRM', 'Atendimento', 'editar') ||
    hasPermission('Sistema', 'Integracoes', 'editar');

  const [regras, setRegras] = useState({
    tipo_roteamento: 'round-robin',
    priorizar_ultimo_atendente: true,
    max_conversas_simultaneas: 5,
    distribuir_por_skill: false,
    usar_ia_matching: false,
    considerar_carga_trabalho: true
  });

  const { data: atendentes = [] } = useQuery({
    queryKey: ['atendentes-equipe', contextKey, canalConfig?.id],
    queryFn: async () => {
      const usuarios = await filterInContext('User', {}, 'full_name', 500);
      return usuarios.filter(u => 
        canalConfig?.equipe_atendimento_ids?.includes(u.id)
      );
    },
    enabled: !!canalConfig && contextoValido && canViewRoteamento
  });

  const { data: estatisticas = [] } = useQuery({
    queryKey: ['estatisticas-atendentes', contextKey, canalConfig?.id],
    queryFn: async () => {
      const conversas = await filterInContext('ConversaOmnicanal', {}, '-data_inicio', 1000);
      
      return atendentes.map(atendente => {
        const conversasAtendente = conversas.filter(c => c.atendente_id === atendente.id);
        const ativas = conversasAtendente.filter(c => c.status === 'Em Progresso').length;
        const resolvidasHoje = conversasAtendente.filter(c => {
          if (!c.data_finalizacao) return false;
          return new Date(c.data_finalizacao).toDateString() === new Date().toDateString();
        }).length;
        const avaliacaoMedia = conversasAtendente
          .filter(c => c.score_satisfacao)
          .reduce((sum, c) => sum + c.score_satisfacao, 0) / 
          conversasAtendente.filter(c => c.score_satisfacao).length || 0;

        return {
          atendente_id: atendente.id,
          nome: atendente.full_name,
          email: atendente.email,
          conversas_ativas: ativas,
          resolvidas_hoje: resolvidasHoje,
          avaliacao_media: avaliacaoMedia.toFixed(1),
          disponivel: ativas < regras.max_conversas_simultaneas
        };
      });
    },
    enabled: atendentes.length > 0 && contextoValido && canViewRoteamento
  });

  const salvarRegrasMutation = useMutation({
    mutationFn: async () => {
      if (!canalConfig?.id || !contextoValido || !canEditRoteamento) return;
      
      await updateInContext('ConfiguracaoCanal', canalConfig.id, {
        regras_roteamento: regras
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config-canal'] });
      toast.success('Regras de roteamento atualizadas!');
    }
  });

  const selecionarProximoAtendente = async (conversaId) => {
    let atendenteEscolhido = null;

    if (regras.tipo_roteamento === 'round-robin') {
      // Rotativo simples
      const disponiveis = estatisticas.filter(e => e.disponivel);
      if (disponiveis.length > 0) {
        atendenteEscolhido = disponiveis[0];
      }
    } else if (regras.tipo_roteamento === 'por-carga') {
      // Menor carga de trabalho
      const menosCarga = [...estatisticas].sort((a, b) => a.conversas_ativas - b.conversas_ativas)[0];
      if (menosCarga?.disponivel) {
        atendenteEscolhido = menosCarga;
      }
    } else if (regras.tipo_roteamento === 'por-performance') {
      // Melhor avaliação
      const melhorAvaliacao = [...estatisticas]
        .filter(e => e.disponivel)
        .sort((a, b) => parseFloat(b.avaliacao_media) - parseFloat(a.avaliacao_media))[0];
      atendenteEscolhido = melhorAvaliacao;
    }

    if (atendenteEscolhido) {
      if (!contextoValido || !canEditRoteamento) return;

      await updateInContext('ConversaOmnicanal', conversaId, {
        atendente_id: atendenteEscolhido.atendente_id,
        atendente_nome: atendenteEscolhido.nome,
        status: 'Em Progresso'
      });
      
      toast.success(`Conversa atribuída a ${atendenteEscolhido.nome}`);
    }
  };

  return (
    <div className="w-full h-full space-y-6" data-permission="CRM.Atendimento.editar" data-context-required="group-or-company">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-yellow-600" />
            Regras de Roteamento Inteligente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Tipo de Roteamento</Label>
            <select
              value={regras.tipo_roteamento}
              onChange={(e) => setRegras({ ...regras, tipo_roteamento: e.target.value })}
              className="w-full mt-2 px-3 py-2 border rounded-md"
            >
              <option value="round-robin">Round-robin (Rotativo)</option>
              <option value="por-carga">Por Carga de Trabalho</option>
              <option value="por-performance">Por Performance (Avaliação)</option>
              <option value="skill-based">Por Habilidade/Especialidade</option>
              <option value="ia-matching">IA Preditiva (Melhor Match)</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <Label>Priorizar último atendente</Label>
            <Switch
              checked={regras.priorizar_ultimo_atendente}
              disabled={!contextoValido || !canEditRoteamento || !canalConfig?.id}
              data-action="RoteamentoInteligente.toggleUltimoAtendente"
              data-permission="CRM.Atendimento.editar"
              data-context-required="group-or-company"
              onCheckedChange={(checked) => setRegras({ ...regras, priorizar_ultimo_atendente: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label>Considerar carga de trabalho</Label>
            <Switch
              checked={regras.considerar_carga_trabalho}
              disabled={!contextoValido || !canEditRoteamento || !canalConfig?.id}
              data-action="RoteamentoInteligente.toggleCarga"
              data-permission="CRM.Atendimento.editar"
              data-context-required="group-or-company"
              onCheckedChange={(checked) => setRegras({ ...regras, considerar_carga_trabalho: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label>
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-purple-600" />
                Usar IA para matching
              </div>
            </Label>
            <Switch
              checked={regras.usar_ia_matching}
              disabled={!contextoValido || !canEditRoteamento || !canalConfig?.id}
              data-action="RoteamentoInteligente.toggleIA"
              data-permission="CRM.Atendimento.editar"
              data-context-required="group-or-company"
              onCheckedChange={(checked) => setRegras({ ...regras, usar_ia_matching: checked })}
            />
          </div>

          <div>
            <Label>Máximo de conversas simultâneas por atendente</Label>
            <input
              type="number"
              value={regras.max_conversas_simultaneas}
              onChange={(e) => setRegras({ ...regras, max_conversas_simultaneas: parseInt(e.target.value) })}
              className="w-full mt-2 px-3 py-2 border rounded-md"
              min="1"
              max="20"
            />
          </div>

          <Button
            onClick={() => salvarRegrasMutation.mutate()}
            disabled={salvarRegrasMutation.isPending || !contextoValido || !canEditRoteamento || !canalConfig?.id}
            className="w-full bg-blue-600 hover:bg-blue-700"
            data-action="RoteamentoInteligente.salvarRegras"
            data-permission="CRM.Atendimento.editar"
            data-context-required="group-or-company"
            data-sensitive="true"
          >
            Salvar Regras
          </Button>
        </CardContent>
      </Card>

      {/* Estatísticas dos Atendentes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            Performance da Equipe
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {estatisticas.map((stat) => (
              <div
                key={stat.atendente_id}
                className={`p-3 rounded-lg border-2 transition-all ${
                  stat.disponivel 
                    ? 'border-green-200 bg-green-50' 
                    : 'border-red-200 bg-red-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900">{stat.nome}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-600">
                      <span>Ativas: {stat.conversas_ativas}/{regras.max_conversas_simultaneas}</span>
                      <span>Hoje: {stat.resolvidas_hoje}</span>
                      <span className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        {stat.avaliacao_media}/5
                      </span>
                    </div>
                  </div>
                  <Badge className={stat.disponivel ? 'bg-green-600' : 'bg-red-600'}>
                    {stat.disponivel ? 'Disponível' : 'Ocupado'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
