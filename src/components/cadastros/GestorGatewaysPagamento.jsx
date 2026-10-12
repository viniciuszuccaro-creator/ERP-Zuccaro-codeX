import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { useWindow } from "@/components/lib/useWindow";
import useContextoVisual from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { CreditCard, Plus, Edit2, Trash2, Play, Pause, BarChart3, Zap } from "lucide-react";
import GatewayPagamentoForm from "./GatewayPagamentoForm";

/**
 * GESTOR DE GATEWAYS DE PAGAMENTO V21.8
 * 
 * Gerencia integrações com processadores de pagamento
 * (Pagar.me, Stripe, Asaas, etc)
 */
export default function GestorGatewaysPagamento({ windowMode = false }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { openWindow } = useWindow();
  const { empresaAtual, grupoAtual, filterInContext, createInContext, updateInContext, deleteInContext } = useContextoVisual();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const [searchTerm, setSearchTerm] = useState("");
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const contextKey = empresaAtual?.id || groupId || "sem-contexto";
  const contextoValido = contextKey !== "sem-contexto";
  const podeCriar = canCreate("Cadastros", "GatewayPagamento") || canCreate("Cadastros", null);
  const podeEditar = canEdit("Cadastros", "GatewayPagamento") || canEdit("Cadastros", null);
  const podeExcluir = canDelete("Cadastros", "GatewayPagamento") || canDelete("Cadastros", null);

  const { data: gateways = [] } = useQuery({
    queryKey: ['gateways-pagamento', contextKey],
    queryFn: () => filterInContext('GatewayPagamento', {}, '-created_date', 200),
    enabled: contextoValido,
  });

  const toggleAtivoMutation = useMutation({
    mutationFn: async ({ id, ativo }) => {
      if (!contextoValido || !podeEditar) throw new Error("Sem contexto ou permissão para alterar.");
      await updateInContext('GatewayPagamento', id, { ativo: !ativo });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gateways-pagamento'] });
      toast({ title: "✅ Status alterado!" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => {
      if (!podeExcluir) throw new Error("Sem permissão para excluir.");
      return deleteInContext('GatewayPagamento', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gateways-pagamento'] });
      toast({ title: "✅ Gateway excluído!" });
    }
  });

  const gatewaysFiltrados = gateways.filter(g =>
    g.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    g.provedor?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalAtivos = gateways.filter(g => g.ativo).length;
  const totalProcessado = gateways.reduce((sum, g) => sum + (g.estatisticas?.total_valor_processado || 0), 0);

  return (
    <div className={windowMode ? "w-full h-full flex flex-col overflow-auto" : "space-y-4"}><div className={windowMode ? "p-6 space-y-4 flex-1" : "space-y-4"}>
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total de Gateways</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{gateways.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Gateways Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{totalAtivos}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Processado</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">
              R$ {totalProcessado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-blue-600" />
              Gateways de Pagamento
            </CardTitle>
            <div className="flex gap-2">
              <Input
                placeholder="Buscar gateway..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-xs"
              />
              <Button
                onClick={() => openWindow(GatewayPagamentoForm, {
                  windowMode: true,
                  onSubmit: async (data) => {
                    try {
                      if (!contextoValido || !podeCriar) throw new Error("Sem contexto ou permissão para criar.");
                      await createInContext('GatewayPagamento', data);
                      queryClient.invalidateQueries({ queryKey: ['gateways-pagamento'] });
                      toast({ title: "✅ Gateway cadastrado!" });
                    } catch (error) {
                      toast({ title: "❌ Erro", description: error.message, variant: "destructive" });
                    }
                  }
                }, {
                  title: '💳 Novo Gateway de Pagamento',
                  width: 900,
                  height: 600
                })}
                disabled={!contextoValido || !podeCriar}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Novo Gateway
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Nome</TableHead>
                <TableHead>Provedor</TableHead>
                <TableHead>Ambiente</TableHead>
                <TableHead>Tipos Suportados</TableHead>
                <TableHead>Transações</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gatewaysFiltrados.map((gateway) => (
                <TableRow key={gateway.id}>
                  <TableCell className="font-medium">{gateway.nome}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{gateway.provedor}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={
                      gateway.ambiente === 'Produção' ? 'bg-green-100 text-green-700' :
                      gateway.ambiente === 'Homologação' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-slate-100 text-slate-700'
                    }>
                      {gateway.ambiente}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {gateway.tipos_pagamento_suportados?.slice(0, 3).map((tipo, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {tipo}
                        </Badge>
                      ))}
                      {gateway.tipos_pagamento_suportados?.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{gateway.tipos_pagamento_suportados.length - 3}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {gateway.estatisticas?.total_transacoes || 0}
                  </TableCell>
                  <TableCell>
                    {gateway.ativo ? (
                      <Badge className="bg-green-100 text-green-700">Ativo</Badge>
                    ) : (
                      <Badge variant="outline">Inativo</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleAtivoMutation.mutate({ id: gateway.id, ativo: gateway.ativo })}
                        disabled={!contextoValido || !podeEditar || toggleAtivoMutation.isPending}
                        title={gateway.ativo ? "Desativar" : "Ativar"}
                      >
                        {gateway.ativo ? (
                          <Pause className="w-4 h-4 text-orange-600" />
                        ) : (
                          <Play className="w-4 h-4 text-green-600" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openWindow(GatewayPagamentoForm, {
                          gateway,
                          windowMode: true,
                          onSubmit: async (data) => {
                            try {
                              if (!contextoValido || !podeEditar) throw new Error("Sem contexto ou permissão para editar.");
                              await updateInContext('GatewayPagamento', gateway.id, data);
                              queryClient.invalidateQueries({ queryKey: ['gateways-pagamento'] });
                              toast({ title: "✅ Gateway atualizado!" });
                            } catch (error) {
                              toast({ title: "❌ Erro", description: error.message, variant: "destructive" });
                            }
                          }
                        }, {
                          title: `✏️ Editar: ${gateway.nome}`,
                          width: 900,
                          height: 600
                        })}
                        disabled={!contextoValido || !podeEditar}
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4 text-blue-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm('Deseja realmente excluir este gateway?')) {
                            deleteMutation.mutate(gateway.id);
                          }
                        }}
                        disabled={!podeExcluir || deleteMutation.isPending}
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {gatewaysFiltrados.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <CreditCard className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p>Nenhum gateway de pagamento configurado</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div></div>
  );
}
