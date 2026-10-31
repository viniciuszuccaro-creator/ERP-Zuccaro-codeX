import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useWindow } from "@/components/lib/useWindow";
import SolicitacaoCompraForm from "@/components/compras/SolicitacaoCompraForm";
import { useToast } from "@/components/ui/use-toast";
import usePermissions from "@/components/lib/usePermissions";
import { useContextoVisual } from "@/components/lib/useContextoVisual";

export default function SolicitacoesTab({ solicitacoes, produtos }) {
  const { openWindow } = useWindow();
  const { toast } = useToast();
  const { canCreate, canApprove, canEdit } = usePermissions();
  const { empresaAtual, grupoAtual, createInContext, updateInContext } = useContextoVisual();
  const contextoValido = Boolean(empresaAtual?.id || grupoAtual?.id);
  const podeCriarSolicitacao = canCreate('Estoque', 'Solicitações Compra') || canCreate('Estoque', 'Solicitacoes Compra') || canCreate('Compras', 'Solicitações') || canCreate('Compras', 'Solicitacoes');
  const podeAprovarSolicitacao = canApprove('Estoque', 'Solicitações Compra') || canApprove('Estoque', 'Solicitacoes Compra') || canApprove('Compras', 'Solicitações') || canApprove('Compras', 'Solicitacoes') || canEdit('Compras', 'Solicitações') || canEdit('Compras', 'Solicitacoes');
  const [searchTerm, setSearchTerm] = useState("");

  const queryClient = useQueryClient();

  const aprovarSolicitacaoMutation = useMutation({
    mutationFn: async (/** @type {{solicitacao: Record<string, unknown> & {id: string}, aprovador: string}} */ { solicitacao, aprovador }) => {
      if (!podeAprovarSolicitacao) throw new Error("Sem permissao para aprovar solicitacao.");
      const updated = await updateInContext('SolicitacaoCompra', solicitacao.id, {
        status: 'Aprovada',
        aprovador: aprovador,
        data_aprovacao: new Date().toISOString().split('T')[0]
      });
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solicitacoes'] });
    },
  });

  const rejeitarSolicitacaoMutation = useMutation({
    mutationFn: async (/** @type {{solicitacao: Record<string, unknown> & {id: string}, aprovador: string, motivo: string}} */ { solicitacao, aprovador, motivo }) => {
      if (!podeAprovarSolicitacao) throw new Error("Sem permissao para rejeitar solicitacao.");
      const updated = await updateInContext('SolicitacaoCompra', solicitacao.id, {
        status: 'Rejeitada',
        aprovador: aprovador,
        motivo_rejeicao: motivo || null
      });
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solicitacoes'] });
    },
  });

  const handleAprovar = async (solicitacao) => {
    const user = await base44.auth.me();
    aprovarSolicitacaoMutation.mutate({
      solicitacao,
      aprovador: user?.full_name || 'Sistema'
    });
  };

  const handleRejeitar = async (solicitacao) => {
    const user = await base44.auth.me();
    const motivo = prompt('Motivo da rejeição:');
    if (motivo) {
      rejeitarSolicitacaoMutation.mutate({
        solicitacao,
        aprovador: user?.full_name || 'Sistema',
        motivo
      });
    }
  };

  const filteredSolicitacoes = solicitacoes.filter(s => {
    const searchLower = searchTerm.toLowerCase();
    return s.produto_nome?.toLowerCase().includes(searchLower) ||
      s.produto_descricao?.toLowerCase().includes(searchLower) ||
      s.numero_solicitacao?.toLowerCase().includes(searchLower) ||
      s.solicitante?.toLowerCase().includes(searchLower) ||
      s.setor?.toLowerCase().includes(searchLower) ||
      s.aprovador?.toLowerCase().includes(searchLower) ||
      s.justificativa?.toLowerCase().includes(searchLower) ||
      s.prioridade?.toLowerCase().includes(searchLower) ||
      s.status?.toLowerCase().includes(searchLower) ||
      s.observacoes?.toLowerCase().includes(searchLower);
  });

  const statusColors = {
    'Pendente': 'bg-yellow-100 text-yellow-700',
    'Em Análise': 'bg-blue-100 text-blue-700',
    'Aprovada': 'bg-green-100 text-green-700',
    'Rejeitada': 'bg-red-100 text-red-700',
    'Compra Gerada': 'bg-purple-100 text-purple-700',
    'Finalizada': 'bg-gray-100 text-gray-700'
  };

  const prioridadeColors = {
    'Baixa': 'bg-slate-100 text-slate-700',
    'Normal': 'bg-blue-100 text-blue-700', // Changed from Média
    'Alta': 'bg-orange-100 text-orange-700',
    'Urgente': 'bg-red-100 text-red-700'
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por produto, nº solicitação, solicitante, setor, status, aprovador..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button 
          className="bg-indigo-600 hover:bg-indigo-700"
          disabled={!contextoValido || !podeCriarSolicitacao}
          onClick={() => openWindow(SolicitacaoCompraForm, {
            windowMode: true,
            onSubmit: async (data) => {
              try {
                const user = await base44.auth.me();
                await createInContext('SolicitacaoCompra', {
                  ...data,
                  solicitante: user?.full_name || 'Sistema'
                });
                queryClient.invalidateQueries({ queryKey: ['solicitacoes'] });
                toast({ title: "✅ Solicitação enviada!" });
              } catch (error) {
                toast({ title: "❌ Erro", description: error.message, variant: "destructive" });
              }
            }
          }, {
            title: '🛒 Nova Solicitação de Compra',
            width: 900,
            height: 650
          })}
        >
          <Plus className="w-4 h-4 mr-2" />
          Nova Solicitação
        </Button>
      </div>

      <Card className="border-0 shadow-md">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Data</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Quantidade</TableHead>
                <TableHead>Solicitante</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSolicitacoes.map((sol) => (
                <TableRow key={sol.id} className="hover:bg-slate-50">
                  <TableCell>
                    {new Date(sol.data_solicitacao).toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell className="font-medium max-w-xs truncate">{sol.produto_nome}</TableCell>
                  <TableCell>
                    {sol.quantidade} {sol.unidade_medida || 'UN'}
                  </TableCell>
                  <TableCell>{sol.solicitante}</TableCell>
                  <TableCell>
                    <Badge className={prioridadeColors[sol.prioridade]}>
                      {sol.prioridade}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[sol.status]}>
                      {sol.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {sol.status === 'Pendente' && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAprovar(sol)}
                          disabled={aprovarSolicitacaoMutation.isPending || !podeAprovarSolicitacao}
                          className="text-green-600 hover:bg-green-50 text-xs"
                        >
                          Aprovar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRejeitar(sol)}
                          disabled={rejeitarSolicitacaoMutation.isPending || !podeAprovarSolicitacao}
                          className="text-red-600 hover:bg-red-50 text-xs"
                        >
                          Rejeitar
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {filteredSolicitacoes.length === 0 && (
          <div className="text-center py-12">
            <p className="text-slate-500">Nenhuma solicitação encontrada</p>
          </div>
        )}
      </Card>
    </div>
  );
}
