import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { 
  ArrowRightLeft, 
  User, 
  Users,
  Building,
  MessageCircle,
  Check,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import usePermissions from '@/components/lib/usePermissions';

/**
 * V21.6 - TRANSFERIR CONVERSA
 * 
 * Permite transferir para:
 * ✅ Outro atendente
 * ✅ Departamento específico
 * ✅ Fila geral
 * ✅ Com ou sem nota interna
 */
export default function TransferirConversa({ conversa, onTransferido }) {
  const [tipo, setTipo] = useState('atendente'); // atendente, departamento, fila
  const [destinoId, setDestinoId] = useState('');
  const [nota, setNota] = useState('');
  const queryClient = useQueryClient();
  const { empresaAtual, grupoAtual, filterInContext, updateInContext, createInContext } = useContextoVisual();
  const { user, hasPermission } = usePermissions();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || conversa?.group_id || conversa?.grupo_id || null;
  const empresaId = empresaAtual?.id || conversa?.empresa_id || null;
  const contextKey = empresaId || groupId || 'sem-contexto';
  const contextoValido = contextKey !== 'sem-contexto';
  const canTransferir = hasPermission('CRM', 'Atendimento', 'editar') || hasPermission('Sistema', 'Integracoes', 'editar');
  const contextoPayload = {
    ...(groupId ? { group_id: groupId, grupo_id: groupId } : {}),
    ...(empresaId ? { empresa_id: empresaId } : {})
  };

  // Buscar atendentes disponíveis
  const { data: atendentes = [] } = useQuery({
    queryKey: ['atendentes-disponiveis', contextKey],
    queryFn: async () => {
      const usuarios = await filterInContext('User', {}, 'full_name', 500);
      return usuarios.filter(u => u.id !== user?.id);
    },
    enabled: contextoValido && canTransferir
  });

  const departamentos = [
    { id: 'Comercial', nome: 'Comercial', icone: '💼' },
    { id: 'Financeiro', nome: 'Financeiro', icone: '💰' },
    { id: 'Suporte', nome: 'Suporte Técnico', icone: '🔧' },
    { id: 'Logística', nome: 'Logística', icone: '🚚' },
    { id: 'Técnico', nome: 'Técnico', icone: '⚙️' }
  ];

  const transferirMutation = useMutation({
    mutationFn: async () => {
      if (!contextoValido) {
        throw new Error('Contexto de grupo ou empresa obrigatorio para transferir conversa.');
      }
      if (!canTransferir) {
        throw new Error('Usuario sem permissao para transferir conversa.');
      }

      const updates = {
        ...contextoPayload,
        status: tipo === 'fila' ? 'Não Atribuída' : 'Aguardando',
        transferido_em: new Date().toISOString(),
        transferido_por: user?.id,
        motivo_transferencia: nota || 'Transferência manual',
        observacoes_internas: nota 
          ? `${conversa.observacoes_internas || ''}\n[${new Date().toLocaleString('pt-BR')}] Transferido por ${user?.full_name}: ${nota}`
          : conversa.observacoes_internas
      };

      if (tipo === 'atendente') {
        const atendente = atendentes.find(a => a.id === destinoId);
        updates.atendente_id = destinoId;
        updates.atendente_nome = atendente?.full_name;
      } else if (tipo === 'departamento') {
        updates.departamento = destinoId;
        updates.atendente_id = null;
        updates.atendente_nome = null;
      } else {
        updates.atendente_id = null;
        updates.atendente_nome = null;
        updates.departamento = null;
      }

      await updateInContext('ConversaOmnicanal', conversa.id, updates);

      // Criar mensagem de sistema
      await createInContext('MensagemOmnicanal', {
        ...contextoPayload,
        conversa_id: conversa.id,
        sessao_id: conversa.sessao_id,
        canal: conversa.canal,
        tipo_remetente: 'Sistema',
        remetente_nome: 'Sistema',
        mensagem: tipo === 'atendente' 
          ? `Conversa transferida para ${atendentes.find(a => a.id === destinoId)?.full_name}`
          : tipo === 'departamento'
          ? `Conversa transferida para o departamento ${destinoId}`
          : 'Conversa retornada para a fila geral',
        tipo_conteudo: 'texto',
        data_envio: new Date().toISOString(),
        interno: true
      });

      // Notificar novo atendente
      if (tipo === 'atendente' && destinoId) {
        await createInContext('Notificacao', {
          ...contextoPayload,
          titulo: '📨 Conversa Transferida',
          mensagem: `${user?.full_name} transferiu uma conversa para você.\nCliente: ${conversa.cliente_nome}\nCanal: ${conversa.canal}${nota ? `\nNota: ${nota}` : ''}`,
          tipo: 'info',
          categoria: 'Atendimento',
          prioridade: conversa.prioridade === 'Urgente' ? 'Alta' : 'Normal',
          destinatario_id: destinoId,
          link_acao: `/hub-atendimento?conversa=${conversa.id}`
        });
      }

      await createInContext('AuditLog', {
        ...contextoPayload,
        usuario: user?.full_name || user?.email || 'Usuario',
        usuario_id: user?.id || null,
        acao: 'Transferencia',
        modulo: 'CRM',
        tipo_auditoria: 'operacional',
        entidade: 'ConversaOmnicanal',
        registro_id: conversa.id,
        descricao: `Conversa transferida para ${tipo}`,
        dados_anteriores: conversa,
        dados_novos: { ...updates, tipo_transferencia: tipo, destino_id: destinoId || null },
        data_hora: new Date().toISOString()
      });
    },
    onSuccess: () => {
      toast.success('Conversa transferida!');
      queryClient.invalidateQueries({ queryKey: ['conversas-omnicanal'] });
      onTransferido?.();
    },
    onError: (error) => {
      toast.error(error?.message || 'Erro ao transferir');
    }
  });

  return (
    <Card
      className="w-full h-full"
      data-permission="CRM.Atendimento.editar"
      data-context-required="group_id|empresa_id"
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-blue-900">
          <ArrowRightLeft className="w-5 h-5 text-blue-600" />
          Transferir Conversa
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {(!contextoValido || !canTransferir) && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>
              Selecione um grupo/empresa e confirme a permissao de atendimento para transferir conversas.
            </span>
          </div>
        )}

        {/* Tipo de transferência */}
        <div className="grid grid-cols-3 gap-2">
          <Button
            variant={tipo === 'atendente' ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setTipo('atendente'); setDestinoId(''); }}
            disabled={!contextoValido || !canTransferir}
            className="flex-col h-auto py-3"
            data-action="selecionar-transferencia-atendente"
            data-permission="CRM.Atendimento.editar"
          >
            <User className="w-5 h-5 mb-1" />
            <span className="text-xs">Atendente</span>
          </Button>
          <Button
            variant={tipo === 'departamento' ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setTipo('departamento'); setDestinoId(''); }}
            disabled={!contextoValido || !canTransferir}
            className="flex-col h-auto py-3"
            data-action="selecionar-transferencia-departamento"
            data-permission="CRM.Atendimento.editar"
          >
            <Building className="w-5 h-5 mb-1" />
            <span className="text-xs">Depto</span>
          </Button>
          <Button
            variant={tipo === 'fila' ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setTipo('fila'); setDestinoId(''); }}
            disabled={!contextoValido || !canTransferir}
            className="flex-col h-auto py-3"
            data-action="selecionar-transferencia-fila"
            data-permission="CRM.Atendimento.editar"
          >
            <Users className="w-5 h-5 mb-1" />
            <span className="text-xs">Fila</span>
          </Button>
        </div>

        {/* Seleção de destino */}
        {tipo === 'atendente' && (
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {atendentes.map(atendente => (
              <button
                key={atendente.id}
                onClick={() => setDestinoId(atendente.id)}
                disabled={!contextoValido || !canTransferir}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                  destinoId === atendente.id 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-slate-200 hover:border-blue-300'
                }`}
              >
                <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-slate-600" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium">{atendente.full_name}</p>
                  <p className="text-xs text-slate-500">{atendente.email}</p>
                </div>
                {destinoId === atendente.id && (
                  <Check className="w-5 h-5 text-blue-600" />
                )}
              </button>
            ))}
          </div>
        )}

        {tipo === 'departamento' && (
          <div className="grid grid-cols-2 gap-2">
            {departamentos.map(depto => (
              <button
                key={depto.id}
                onClick={() => setDestinoId(depto.id)}
                disabled={!contextoValido || !canTransferir}
                className={`p-3 rounded-lg border-2 text-center transition-all ${
                  destinoId === depto.id 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-slate-200 hover:border-blue-300'
                }`}
              >
                <span className="text-2xl">{depto.icone}</span>
                <p className="text-sm font-medium mt-1">{depto.nome}</p>
              </button>
            ))}
          </div>
        )}

        {tipo === 'fila' && (
          <div className="p-4 bg-slate-50 rounded-lg text-center">
            <Users className="w-10 h-10 mx-auto mb-2 text-slate-400" />
            <p className="text-sm text-slate-600">
              A conversa voltará para a fila geral e poderá ser assumida por qualquer atendente disponível.
            </p>
          </div>
        )}

        {/* Nota de transferência */}
        <div>
          <p className="text-xs text-slate-600 mb-1">Nota (opcional)</p>
          <Textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            disabled={!contextoValido || !canTransferir}
            placeholder="Adicione contexto para o próximo atendente..."
            className="h-20 text-sm"
          />
        </div>

        {/* Botão transferir */}
        <Button
          onClick={() => transferirMutation.mutate()}
          disabled={transferirMutation.isPending || !contextoValido || !canTransferir || (tipo !== 'fila' && !destinoId)}
          className="w-full bg-blue-600 hover:bg-blue-700"
          data-action="transferir-conversa"
          data-permission="CRM.Atendimento.editar"
          data-context-required="group_id|empresa_id"
        >
          {transferirMutation.isPending ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
          ) : (
            <>
              <ArrowRightLeft className="w-4 h-4 mr-2" />
              Transferir
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
