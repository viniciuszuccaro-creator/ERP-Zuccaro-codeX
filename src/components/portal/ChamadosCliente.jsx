import React, { useState, Suspense } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Eye, MessageSquare, Star, CheckCircle2, XCircle } from "lucide-react";
import { format } from "date-fns";
import { sanitizeOnWrite } from "@/components/lib/sanitizeOnWrite";
const ChatbotWidgetAvancado = React.lazy(() => import("@/components/chatbot/ChatbotWidgetAvancado"));

const reportCustomerTicketFailure = (operation, error, context = {}) => {
  console.error('[ChamadosCliente] ' + operation, {
    error: error?.message || String(error),
    ...context,
  });
};

/**
 * V21.5 - Chamados/Suporte Cliente COMPLETO
 * ✅ Abertura de chamados com categorização
 * ✅ Histórico completo de mensagens
 * ✅ Avaliação de atendimento
 * ✅ Priorização visual
 * ✅ 100% Responsivo w-full h-full
 */
export default function ChamadosCliente({ clienteId, clienteNome }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [chamadoSelecionado, setChamadoSelecionado] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [formChamado, setFormChamado] = useState({
    titulo: "",
    descricao: "",
    categoria: "Suporte Técnico",
    prioridade: "Média"
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: clienteData } = useQuery({
    queryKey: ['cliente-portal-by-id', clienteId],
    enabled: !!clienteId,
    queryFn: async () => {
      const rows = await base44.entities.Cliente.filter({ id: clienteId });
      return rows?.[0] || null;
    }
  });

  const { data: chamados = [] } = useQuery({
    queryKey: ['chamados', clienteId, clienteData?.empresa_id, clienteData?.group_id],
    enabled: Boolean(clienteId && clienteData?.empresa_id && clienteData?.group_id),
    queryFn: async () => {
      if (!clienteId || !clienteData?.empresa_id || !clienteData?.group_id) {
        throw new Error('Contexto de Grupo e Empresa obrigatorio para consultar chamados.');
      }
      const filtros = {
        cliente_id: clienteId,
        ...(clienteData?.empresa_id ? { empresa_id: clienteData.empresa_id } : {}),
        ...(clienteData?.group_id ? { group_id: clienteData.group_id } : {}),
      };
      return await base44.entities.Chamado.filter(filtros, '-created_date');
    }
  });

  const criarChamadoMutation = useMutation({
    mutationFn: async (data) => {
      const cli = clienteData || (await base44.entities.Cliente.filter({ id: clienteId }).then(r=>r?.[0]));
      if (!cli?.group_id || !cli?.empresa_id) {
        throw new Error('Contexto de Grupo e Empresa obrigatorio para abrir chamado.');
      }
      const payload = sanitizeOnWrite({
        ...data,
        cliente_id: clienteId,
        cliente_nome: clienteNome,
        status: 'Aberto',
        data_abertura: new Date().toISOString().split('T')[0],
        mensagens: [],
        empresa_id: cli.empresa_id,
        group_id: cli.group_id,
      });
      return base44.entities.Chamado.create(payload);
    },
    onSuccess: async (chamado) => {
      queryClient.invalidateQueries({ queryKey: ['chamados', clienteId] });
      setDialogOpen(false);
      resetForm();
      toast({
        title: "✅ Chamado Aberto!",
        description: "Seu chamado foi registrado e será atendido em breve"
      });
      try { await base44.entities.AuditLog.create({
        acao: 'Criação', modulo: 'Portal', tipo_auditoria: 'entidade', entidade: 'Chamado',
        registro_id: chamado?.id,
        descricao: 'Chamado aberto via Portal', data_hora: new Date().toISOString(),
        empresa_id: clienteData?.empresa_id,
        group_id: clienteData?.group_id,
      }); } catch (error) {
        reportCustomerTicketFailure('Falha ao auditar abertura de chamado', error, {
          chamadoId: chamado?.id,
          clienteId,
        });
      }
    },
    onError: (error) => {
      reportCustomerTicketFailure('Falha ao abrir chamado', error, { clienteId });
      toast({
        title: 'Não foi possível abrir o chamado',
        description: error?.message || 'Revise o contexto e tente novamente.',
        variant: 'destructive',
      });
    },
  });

  const avaliarChamadoMutation = useMutation({
    mutationFn: ({ chamadoId, avaliacao }) => {
      return base44.entities.Chamado.update(chamadoId, { avaliacao });
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['chamados', clienteId] });
      toast({ title: '✅ Obrigado!', description: 'Sua avaliação foi registrada' });
      try {
        const cli = clienteData || (await base44.entities.Cliente.filter({ id: clienteId }).then(r=>r?.[0]));
        const novo = Number(cli?.pontos_fidelidade || 0) + 10;
        await base44.entities.Cliente.update(clienteId, {
          pontos_fidelidade: novo,
          empresa_id: cli?.empresa_id || undefined,
          group_id: cli?.group_id || undefined,
        });
        try { await base44.entities.AuditLog.create({
          acao: 'Edição', modulo: 'Portal', tipo_auditoria: 'entidade', entidade: 'Cliente', registro_id: clienteId,
          descricao: 'Gamificação: feedback registrado (+10)', dados_novos: { pontos_fidelidade: novo }, data_hora: new Date().toISOString(),
          empresa_id: cli?.empresa_id,
          group_id: cli?.group_id,
        }); } catch (error) {
          reportCustomerTicketFailure('Falha ao auditar pontos de feedback', error, { clienteId });
        }
      } catch (error) {
        reportCustomerTicketFailure('Falha ao atualizar pontos de feedback', error, { clienteId });
      }
      try {
        await queryClient.invalidateQueries({ queryKey: ['portal-has-feedback'] });
      } catch (error) {
        reportCustomerTicketFailure('Falha ao atualizar cache de feedback', error, { clienteId });
      }
      try {
        await queryClient.invalidateQueries({ queryKey: ['cliente-portal'] });
      } catch (error) {
        reportCustomerTicketFailure('Falha ao atualizar cache do cliente', error, { clienteId });
      }
    },
  });

  const resetForm = () => {
    setFormChamado({
      titulo: "",
      descricao: "",
      categoria: "Suporte Técnico",
      prioridade: "Média"
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    criarChamadoMutation.mutate(formChamado);
  };

  const getStatusColor = (status) => {
    const cores = {
      'Aberto': 'bg-green-100 text-green-700',
      'Em Andamento': 'bg-blue-100 text-blue-700',
      'Aguardando Cliente': 'bg-yellow-100 text-yellow-700',
      'Resolvido': 'bg-purple-100 text-purple-700',
      'Fechado': 'bg-slate-100 text-slate-700',
    };
    return cores[status] || 'bg-slate-100 text-slate-700';
  };

  const getPrioridadeColor = (prioridade) => {
    const cores = {
      'Baixa': 'bg-blue-100 text-blue-700',
      'Média': 'bg-yellow-100 text-yellow-700',
      'Alta': 'bg-orange-100 text-orange-700',
      'Urgente': 'bg-red-100 text-red-700',
    };
    return cores[prioridade] || 'bg-slate-100 text-slate-700';
  };

  return (
    <div className="space-y-6 w-full h-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Meus Chamados</h2>
          <p className="text-sm text-slate-600">Acompanhe suas solicitações de suporte</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-permission="Portal.Suporte.criar" className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Novo Chamado
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Abrir Novo Chamado</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Categoria *</Label>
                <Select
                  value={formChamado.categoria}
                  onValueChange={(value) => setFormChamado({ ...formChamado, categoria: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Suporte Técnico">Suporte Técnico</SelectItem>
                    <SelectItem value="Financeiro">Financeiro</SelectItem>
                    <SelectItem value="Comercial">Comercial</SelectItem>
                    <SelectItem value="Entrega">Entrega</SelectItem>
                    <SelectItem value="Produto">Produto</SelectItem>
                    <SelectItem value="Outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Prioridade *</Label>
                <Select
                  value={formChamado.prioridade}
                  onValueChange={(value) => setFormChamado({ ...formChamado, prioridade: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Baixa">Baixa</SelectItem>
                    <SelectItem value="Média">Média</SelectItem>
                    <SelectItem value="Alta">Alta</SelectItem>
                    <SelectItem value="Urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Título *</Label>
                <Input
                  value={formChamado.titulo}
                  onChange={(e) => setFormChamado({ ...formChamado, titulo: e.target.value })}
                  placeholder="Resumo do problema"
                  required
                />
              </div>

              <div>
                <Label>Descrição Detalhada *</Label>
                <Textarea
                  value={formChamado.descricao}
                  onChange={(e) => setFormChamado({ ...formChamado, descricao: e.target.value })}
                  placeholder="Descreva o problema com o máximo de detalhes possível..."
                  rows={5}
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={criarChamadoMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {criarChamadoMutation.isPending ? 'Abrindo...' : 'Abrir Chamado'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        <Button
          variant="outline"
          data-permission="Portal.Suporte.chat"
          onClick={() => setChatOpen(true)}
        >
          Atendimento via Chat
        </Button>
        </div>

      <Card className="border-0 shadow-md w-full">
        <CardContent className="p-0 w-full overflow-x-auto">
          <Table className="w-full">
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Nº</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data Abertura</TableHead>
                <TableHead>Mensagens</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {chamados.map((chamado, idx) => (
                <TableRow key={chamado.id} className="hover:bg-slate-50">
                  <TableCell className="font-mono text-sm">
                    #{String(idx + 1).padStart(4, '0')}
                  </TableCell>
                  <TableCell className="font-medium">{chamado.titulo}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{chamado.categoria}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={getPrioridadeColor(chamado.prioridade)}>
                      {chamado.prioridade}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(chamado.status)}>
                      {chamado.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {format(new Date(chamado.data_abertura), 'dd/MM/yyyy')}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <MessageSquare className="w-4 h-4 text-slate-400" />
                      <span className="text-sm">{(chamado.mensagens || []).length}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setChamadoSelecionado(chamado)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Ver
                      </Button>
                      {chamado.status === 'Resolvido' && !chamado.avaliacao && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-amber-600"
                          onClick={() => {
                            const nota = prompt("Avalie de 1 a 5:");
                            if (nota && !isNaN(nota) && nota >= 1 && nota <= 5) {
                              avaliarChamadoMutation.mutate({
                                chamadoId: chamado.id,
                                avaliacao: { nota: parseInt(nota), comentario: "" }
                              });
                            }
                          }}
                        >
                          <Star className="w-4 h-4 mr-1" />
                          Avaliar
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {chamados.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="font-semibold">Nenhum chamado aberto</p>
              <p className="text-sm mt-2">Abra um chamado para solicitar suporte</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog Detalhes do Chamado */}
      {chamadoSelecionado && (
        <Dialog open={!!chamadoSelecionado} onOpenChange={() => setChamadoSelecionado(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                Chamado #{chamados.findIndex(c => c.id === chamadoSelecionado.id) + 1} - {chamadoSelecionado.titulo}
                <Badge className={getStatusColor(chamadoSelecionado.status)}>
                  {chamadoSelecionado.status}
                </Badge>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-600">Categoria</p>
                  <p className="font-semibold">{chamadoSelecionado.categoria}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Prioridade</p>
                  <Badge className={getPrioridadeColor(chamadoSelecionado.prioridade)}>
                    {chamadoSelecionado.prioridade}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Data Abertura</p>
                  <p className="font-semibold">
                    {format(new Date(chamadoSelecionado.data_abertura), 'dd/MM/yyyy')}
                  </p>
                </div>
                {chamadoSelecionado.responsavel_nome && (
                  <div>
                    <p className="text-sm text-slate-600">Responsável</p>
                    <p className="font-semibold">{chamadoSelecionado.responsavel_nome}</p>
                  </div>
                )}
              </div>

              <div>
                <p className="text-sm text-slate-600 mb-2">Descrição</p>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p>{chamadoSelecionado.descricao}</p>
                </div>
              </div>

              {(chamadoSelecionado.mensagens || []).length > 0 && (
                <div>
                  <p className="text-sm text-slate-600 mb-3">Histórico de Atendimento</p>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {chamadoSelecionado.mensagens.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg ${
                          msg.tipo === 'Cliente' ? 'bg-blue-50 border-l-4 border-blue-600' : 'bg-slate-50 border-l-4 border-slate-400'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-semibold text-sm">{msg.autor}</span>
                          <span className="text-xs text-slate-500">
                            {format(new Date(msg.data), 'dd/MM/yyyy HH:mm')}
                          </span>
                        </div>
                        <p className="text-sm">{msg.mensagem}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {chamadoSelecionado.avaliacao && (
                <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="text-sm font-semibold text-amber-900 mb-2">Avaliação do Atendimento</p>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-5 h-5 ${
                          star <= chamadoSelecionado.avaliacao.nota
                            ? 'text-amber-500 fill-amber-500'
                            : 'text-slate-300'
                        }`}
                      />
                    ))}
                    <span className="ml-2 text-sm text-amber-900">
                      {chamadoSelecionado.avaliacao.nota}/5
                    </span>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Chatbot integrado para abertura/consulta de chamados */}
      <Dialog open={chatOpen} onOpenChange={setChatOpen}>
        <DialogContent className="max-w-3xl h-[80vh]">
          <DialogHeader>
            <DialogTitle>Assistente de Suporte</DialogTitle>
          </DialogHeader>
          <div className="w-full h-full">
            <Suspense fallback={<div className="w-full h-full bg-white/60 animate-pulse rounded" />}> 
              <ChatbotWidgetAvancado
                clienteId={clienteId}
                canal="Portal-Suporte"
                exibirBotaoFlutuante={false}
                habilitarAvaliacao={true}
              />
            </Suspense>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
