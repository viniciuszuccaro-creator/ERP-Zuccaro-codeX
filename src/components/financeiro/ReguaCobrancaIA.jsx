import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Sparkles, Send, TrendingUp } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import usePermissions from '@/components/lib/usePermissions';
import { useUser } from '@/components/lib/UserContext';
import {
  assertAutomacaoContext,
  requireAutomacaoHumanConfirm,
  stampAutomacaoResult,
} from '@/components/lib/automacaoAvancadaPolicy';

/**
 * Régua de Cobrança Inteligente
 * Sugere faixas de atraso; envio/CRM só após confirmação humana.
 */
export default function ReguaCobrancaIA({ empresaId: empresaIdProp, windowMode = false }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useUser();
  const { filterInContext, createInContext, empresaAtual, grupoAtual, estaNoGrupo } = useContextoVisual();
  const { hasPermission, isAdmin } = usePermissions();
  const [executando, setExecutando] = useState(false);

  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaIdProp || empresaAtual?.id || null;
  const scopeType = estaNoGrupo && !empresaIdProp ? 'grupo' : 'empresa';
  const contextoValido = Boolean(groupId && (scopeType === 'grupo' || empresaId));
  const canView = isAdmin?.() || hasPermission('Financeiro', null, 'ver') || hasPermission('Financeiro', null, 'visualizar')
    || hasPermission('Financeiro', 'Contas a Receber', 'ver') || hasPermission('Financeiro', 'Contas a Receber', 'visualizar');
  const canExecutar = isAdmin?.() || hasPermission('Financeiro', 'Contas a Receber', 'editar')
    || hasPermission('Financeiro', null, 'editar');

  const { data: titulosVencidos = [] } = useQuery({
    queryKey: ['titulos-vencidos-regua', groupId, empresaId, scopeType, user?.id],
    queryFn: async () => {
      assertAutomacaoContext({ groupId, empresaId, scopeType });
      const todas = await filterInContext('ContaReceber', { status: 'Pendente' }, '-data_vencimento', 200);
      const hoje = new Date();
      return (todas || []).filter((t) => {
        if (!t?.data_vencimento) return false;
        return new Date(t.data_vencimento) < hoje;
      });
    },
    enabled: contextoValido && canView,
  });

  const executarReguaMutation = useMutation({
    mutationFn: async () => {
      assertAutomacaoContext({ groupId, empresaId, scopeType });
      if (!canExecutar) throw new Error('Sem permissao para executar a regua de cobranca.');
      if (!requireAutomacaoHumanConfirm(
        `Confirmar sugestoes da regua para ${titulosVencidos.length} titulo(s)? Nenhuma baixa sera feita; apenas interacoes CRM sugeridas.`,
      )) {
        return stampAutomacaoResult({ executado: false, acoes: [], cancelado: true });
      }

      const hoje = new Date();
      const acoes = [];

      for (const titulo of titulosVencidos) {
        const diasAtraso = Math.floor(
          (hoje - new Date(titulo.data_vencimento)) / (1000 * 60 * 60 * 24),
        );
        let acao = null;

        if (diasAtraso >= 1 && diasAtraso <= 3) {
          acao = {
            tipo: 'whatsapp_lembrete',
            titulo_id: titulo.id,
            diasAtraso,
            tom: 'amigavel',
            mensagem: `Sugestao: lembrete WhatsApp para titulo ${titulo.numero_documento || titulo.descricao} (${diasAtraso} dia(s)).`,
          };
        } else if (diasAtraso >= 4 && diasAtraso <= 10) {
          acao = {
            tipo: 'whatsapp_email_cobranca',
            titulo_id: titulo.id,
            diasAtraso,
            tom: 'firme',
            mensagem: `Sugestao: multi-canal para titulo ${titulo.numero_documento} (${diasAtraso} dias).`,
          };
        } else if (diasAtraso > 10) {
          acao = {
            tipo: 'criar_interacao_crm',
            titulo_id: titulo.id,
            diasAtraso,
            tom: 'cobranca',
            mensagem: `Sugestao CRM: titulo com ${diasAtraso} dias de atraso.`,
          };
          await createInContext('Interacao', {
            tipo: 'Ligação',
            titulo: `Cobrança sugerida - Título vencido há ${diasAtraso} dias`,
            descricao: `Cliente: ${titulo.cliente || titulo.cliente_nome}. Valor: R$ ${Number(titulo.valor || 0).toFixed(2)}. Revisar contato.`,
            data_interacao: new Date().toISOString(),
            cliente_id: titulo.cliente_id,
            cliente_nome: titulo.cliente || titulo.cliente_nome,
            responsavel: titulo.vendedor || 'Financeiro',
            status: 'Agendado',
            prioridade: 'Alta',
            resultado: 'Pendente revisao',
            origem: 'regua_cobranca_ia',
            modo: 'sugestao',
          });
        }

        if (acao) acoes.push(acao);
      }

      await createInContext('AuditLog', {
        usuario: user?.full_name || user?.email || 'Usuario',
        usuario_id: user?.id || null,
        acao: 'Analise',
        modulo: 'Financeiro',
        tipo_auditoria: 'ia',
        entidade: 'ReguaCobranca',
        descricao: `Regua de cobranca executada com confirmacao (${acoes.length} sugestoes)`,
        empresa_id: empresaId,
        group_id: groupId,
        dados_novos: stampAutomacaoResult({ executado: true, total: acoes.length, tipos: acoes.map((a) => a.tipo) }),
        data_hora: new Date().toISOString(),
      });

      return stampAutomacaoResult({ executado: true, acoes });
    },
    onSuccess: (result) => {
      if (result?.cancelado) {
        toast({ title: 'Execucao cancelada', description: 'Nenhuma acao da regua foi aplicada.' });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['titulos-vencidos-regua'] });
      queryClient.invalidateQueries({ queryKey: ['interacoes'] });
      toast({
        title: 'Regua confirmada',
        description: `${(result?.acoes || []).length} sugestao(oes) processada(s) (sem baixa automatica)`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha na regua',
        description: String(error?.message || error),
        variant: 'destructive',
      });
    },
  });

  const handleExecutar = () => {
    setExecutando(true);
    executarReguaMutation.mutate(undefined, {
      onSettled: () => setExecutando(false),
    });
  };

  const hoje = new Date();
  const ate3Dias = titulosVencidos.filter((t) => {
    const dias = Math.floor((hoje - new Date(t.data_vencimento)) / (1000 * 60 * 60 * 24));
    return dias >= 1 && dias <= 3;
  });
  const de4a10Dias = titulosVencidos.filter((t) => {
    const dias = Math.floor((hoje - new Date(t.data_vencimento)) / (1000 * 60 * 60 * 24));
    return dias >= 4 && dias <= 10;
  });
  const acima10Dias = titulosVencidos.filter((t) => {
    const dias = Math.floor((hoje - new Date(t.data_vencimento)) / (1000 * 60 * 60 * 24));
    return dias > 10;
  });

  if (!contextoValido) {
    return (
      <div className="w-full p-4 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-sm">
        Selecione grupo e empresa para a regua de cobranca.
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="w-full p-4 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-sm">
        Sem permissao para visualizar a regua de cobranca.
      </div>
    );
  }

  const content = (
    <Card className="border-purple-200 bg-purple-50 min-h-[200px] w-full">
      <CardHeader className="bg-white/80 border-b px-3 py-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-600" />
            Régua de Cobrança IA
            <Badge variant="outline" className="text-xs">Sugestão</Badge>
          </CardTitle>
        </div>
      </CardHeader>

      <CardContent className="p-3 space-y-3">
        {titulosVencidos.length === 0 ? (
          <div className="text-center py-8 text-green-600">
            <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="font-semibold">Nenhum título vencido!</p>
            <p className="text-sm">Situação financeira em dia</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Card className="border-blue-200 bg-blue-50 min-h-[90px]">
                <CardContent className="p-3 text-center flex flex-col justify-center h-full">
                  <p className="text-xs text-blue-700">1-3 dias</p>
                  <p className="text-xl font-bold text-blue-900">{ate3Dias.length}</p>
                  <p className="text-xs text-blue-600">WhatsApp (sugestão)</p>
                </CardContent>
              </Card>
              <Card className="border-orange-200 bg-orange-50 min-h-[90px]">
                <CardContent className="p-3 text-center flex flex-col justify-center h-full">
                  <p className="text-xs text-orange-700">4-10 dias</p>
                  <p className="text-xl font-bold text-orange-900">{de4a10Dias.length}</p>
                  <p className="text-xs text-orange-600">Multi-canal</p>
                </CardContent>
              </Card>
              <Card className="border-red-200 bg-red-50 min-h-[90px]">
                <CardContent className="p-3 text-center flex flex-col justify-center h-full">
                  <p className="text-xs text-red-700">&gt;10 dias</p>
                  <p className="text-xl font-bold text-red-900">{acima10Dias.length}</p>
                  <p className="text-xs text-red-600">CRM (após confirm)</p>
                </CardContent>
              </Card>
            </div>

            <Alert className="border-purple-300 bg-purple-50">
              <Sparkles className="w-3 h-3 text-purple-600" />
              <AlertDescription className="text-xs text-purple-900">
                Sem intervalo automático. Execução exige confirmação; não altera status nem faz baixa.
              </AlertDescription>
            </Alert>

            <Button
              onClick={handleExecutar}
              disabled={!canExecutar || executando || executarReguaMutation.isPending}
              className="w-full bg-purple-600 hover:bg-purple-700 h-9"
            >
              {executando || executarReguaMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2" />
                  Executando...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Executar régua (confirmar)
                </>
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );

  if (windowMode) {
    return (
      <div className="w-full h-full flex flex-col overflow-auto">
        <div className="p-6 flex-1">{content}</div>
      </div>
    );
  }

  return content;
}
