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
import { Repeat, Plus, Edit2, Trash2, Play, Pause, TrendingUp, Calendar } from "lucide-react";
import ConfiguracaoDespesaRecorrenteForm from "./ConfiguracaoDespesaRecorrenteForm";

/**
 * GESTOR DE DESPESAS RECORRENTES V21.8
 * 
 * Gerencia configurações de despesas que se repetem
 * (aluguel, salários, tarifas, etc)
 */
export default function GestorDespesasRecorrentes({ windowMode = false }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { openWindow } = useWindow();
  const { empresaAtual, grupoAtual, filterInContext, createInContext, updateInContext, deleteInContext } = useContextoVisual();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const [searchTerm, setSearchTerm] = useState("");
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const contextKey = empresaAtual?.id || groupId || "sem-contexto";
  const contextoValido = contextKey !== "sem-contexto";
  const podeCriar = canCreate("Cadastros", "ConfiguracaoDespesaRecorrente") || canCreate("Cadastros", null);
  const podeEditar = canEdit("Cadastros", "ConfiguracaoDespesaRecorrente") || canEdit("Cadastros", null);
  const podeExcluir = canDelete("Cadastros", "ConfiguracaoDespesaRecorrente") || canDelete("Cadastros", null);

  const { data: configuracoes = [] } = useQuery({
    queryKey: ['configuracoes-despesas-recorrentes', contextKey],
    queryFn: () => filterInContext('ConfiguracaoDespesaRecorrente', {}, '-created_date', 200),
    enabled: contextoValido,
  });

  const toggleAtivaMutation = useMutation({
    mutationFn: async ({ id, ativa }) => {
      if (!contextoValido || !podeEditar) throw new Error("Sem contexto ou permissÃ£o para alterar.");
      await updateInContext('ConfiguracaoDespesaRecorrente', id, { ativa: !ativa });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configuracoes-despesas-recorrentes'] });
      toast({ title: "✅ Status alterado!" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => {
      if (!podeExcluir) throw new Error("Sem permissÃ£o para excluir.");
      return deleteInContext('ConfiguracaoDespesaRecorrente', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configuracoes-despesas-recorrentes'] });
      toast({ title: "✅ Configuração excluída!" });
    }
  });

  const configsFiltradas = configuracoes.filter(c =>
    c.descricao?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.categoria?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalAtivas = configuracoes.filter(c => c.ativa).length;
  const totalValorMensal = configuracoes
    .filter(c => c.ativa && c.periodicidade === 'Mensal')
    .reduce((sum, c) => sum + (c.valor_base || 0), 0);

  return (
    <div className={windowMode ? "w-full h-full flex flex-col overflow-auto" : "space-y-4"}><div className={windowMode ? "p-6 space-y-4 flex-1" : "space-y-4"}>
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total de Configurações</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{configuracoes.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Configurações Ativas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{totalAtivas}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Valor Mensal Recorrente</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">
              R$ {totalValorMensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Repeat className="w-5 h-5 text-sky-600" />
              Despesas Recorrentes
            </CardTitle>
            <div className="flex gap-2">
              <Input
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-xs"
              />
              <Button
                onClick={() => openWindow(ConfiguracaoDespesaRecorrenteForm, {
                  windowMode: true,
                  onSubmit: async (data) => {
                    try {
                      if (!contextoValido || !podeCriar) throw new Error("Sem contexto ou permissÃ£o para criar.");
                      await createInContext('ConfiguracaoDespesaRecorrente', data);
                      queryClient.invalidateQueries({ queryKey: ['configuracoes-despesas-recorrentes'] });
                      toast({ title: "✅ Configuração criada!" });
                    } catch (error) {
                      toast({ title: "❌ Erro", description: error.message, variant: "destructive" });
                    }
                  }
                }, {
                  title: '🔄 Nova Despesa Recorrente',
                  width: 900,
                  height: 650,
                  uniqueKey: 'Cadastros.ConfiguracaoDespesaRecorrente.gestor-novo',
                })}
                disabled={!contextoValido || !podeCriar}
                className="bg-sky-600 hover:bg-sky-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nova Configuração
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Periodicidade</TableHead>
                <TableHead>Valor Base</TableHead>
                <TableHead>Dia Vencimento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {configsFiltradas.map((config) => (
                <TableRow key={config.id}>
                  <TableCell className="font-medium">{config.descricao}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{config.categoria}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{config.periodicidade}</TableCell>
                  <TableCell className="font-semibold">
                    R$ {config.valor_base?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-sm">Dia {config.dia_vencimento}</TableCell>
                  <TableCell>
                    {config.ativa ? (
                      <Badge className="bg-green-100 text-green-700">Ativa</Badge>
                    ) : (
                      <Badge variant="outline">Inativa</Badge>
                    )}
                    {config.gerar_automaticamente && (
                      <Badge className="ml-1 bg-blue-100 text-blue-700 text-xs">Auto</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleAtivaMutation.mutate({ id: config.id, ativa: config.ativa })}
                        disabled={!contextoValido || !podeEditar || toggleAtivaMutation.isPending}
                        title={config.ativa ? "Desativar" : "Ativar"}
                      >
                        {config.ativa ? (
                          <Pause className="w-4 h-4 text-sky-600" />
                        ) : (
                          <Play className="w-4 h-4 text-green-600" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openWindow(ConfiguracaoDespesaRecorrenteForm, {
                          config,
                          item: config,
                          initialData: config,
                          windowMode: true,
                          onSubmit: async (data) => {
                            try {
                              if (!contextoValido || !podeEditar) throw new Error("Sem contexto ou permissÃ£o para editar.");
                              await updateInContext('ConfiguracaoDespesaRecorrente', config.id, data);
                              queryClient.invalidateQueries({ queryKey: ['configuracoes-despesas-recorrentes'] });
                              toast({ title: "✅ Configuração atualizada!" });
                            } catch (error) {
                              toast({ title: "❌ Erro", description: error.message, variant: "destructive" });
                            }
                          }
                        }, {
                          title: `✏️ Editar: ${config.descricao}`,
                          width: 900,
                          height: 650,
                          uniqueKey: `Cadastros.ConfiguracaoDespesaRecorrente.gestor-${config.id}`,
                        })}
                        disabled={!contextoValido || !podeEditar}
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4 text-sky-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm('Deseja realmente excluir esta configuração?')) {
                            deleteMutation.mutate(config.id);
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

          {configsFiltradas.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <Repeat className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p>Nenhuma configuração de despesa recorrente encontrada</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div></div>
  );
}
