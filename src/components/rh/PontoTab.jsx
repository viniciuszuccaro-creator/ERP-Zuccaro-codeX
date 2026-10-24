import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Clock, Check, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import PontoForm from "./PontoForm";
import { useWindow } from "@/components/lib/useWindow";
import { toast } from "sonner";

export default function PontoTab({ pontos, colaboradores }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { openWindow } = useWindow();
  const [formData, setFormData] = useState({
    colaborador_id: "",
    colaborador_nome: "",
    data: new Date().toISOString().split('T')[0],
    entrada_manha: "",
    saida_almoco: "",
    retorno_almoco: "",
    saida_tarde: "",
    tipo_dia: "Normal",
    observacoes: "",
    status: "Pendente"
  });

  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (/** @type {typeof formData} */ data) => {
      // Calcular horas trabalhadas
      const calcularHoras = () => {
        if (!data.entrada_manha || !data.saida_tarde) return { horas_trabalhadas: undefined, horas_extras: undefined };
        
        const entrada = new Date(`2000-01-01T${data.entrada_manha}`);
        const saida = new Date(`2000-01-01T${data.saida_tarde}`);
        const almoco = data.saida_almoco && data.retorno_almoco 
          ? (new Date(`2000-01-01T${data.retorno_almoco}`).getTime() - new Date(`2000-01-01T${data.saida_almoco}`).getTime()) / (1000 * 60 * 60)
          : 0;
        
        const horasTotais = (saida.getTime() - entrada.getTime()) / (1000 * 60 * 60) - almoco;
        const horasExtras = Math.max(0, horasTotais - 8);
        
        return {
          horas_trabalhadas: horasTotais,
          horas_extras: horasExtras
        };
      };

      const { horas_trabalhadas, horas_extras } = calcularHoras();

      return base44.entities.Ponto.create({
        ...data,
        horas_trabalhadas,
        horas_extras
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pontos'] });
      setIsDialogOpen(false);
      resetForm();
    },
  });

  const aprovarMutation = useMutation({
    mutationFn: (/** @type {{id: string}} */ { id }) => base44.entities.Ponto.update(id, {
      status: 'Aprovado',
      aprovado_por: 'Sistema'
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pontos'] });
    },
  });

  const rejeitarMutation = useMutation({
    mutationFn: (/** @type {{id: string}} */ { id }) => base44.entities.Ponto.update(id, {
      status: 'Rejeitado'
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pontos'] });
    },
  });

  const resetForm = () => {
    setFormData({
      colaborador_id: "",
      colaborador_nome: "",
      data: new Date().toISOString().split('T')[0],
      entrada_manha: "",
      saida_almoco: "",
      retorno_almoco: "",
      saida_tarde: "",
      tipo_dia: "Normal",
      observacoes: "",
      status: "Pendente"
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const statusColors = {
    'Pendente': 'bg-yellow-100 text-yellow-700',
    'Aprovado': 'bg-green-100 text-green-700',
    'Rejeitado': 'bg-red-100 text-red-700'
  };

  const tipoDiaColors = {
    'Normal': 'bg-blue-100 text-blue-700',
    'Feriado': 'bg-purple-100 text-purple-700',
    'Fim de Semana': 'bg-gray-100 text-gray-700',
    'Folga': 'bg-cyan-100 text-cyan-700'
  };

  // Agrupar por mês
  const pontosPorMes = pontos.reduce((acc, ponto) => {
    const mes = new Date(ponto.data).toLocaleDateString('pt-BR', { year: 'numeric', month: 'long' });
    if (!acc[mes]) acc[mes] = [];
    acc[mes].push(ponto);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex gap-4">
          <Card className="px-4 py-2">
            <div className="text-sm text-slate-600">Registros Pendentes</div>
            <div className="text-2xl font-bold text-yellow-600">
              {pontos.filter(p => p.status === 'Pendente').length}
            </div>
          </Card>
          <Card className="px-4 py-2">
            <div className="text-sm text-slate-600">Horas Extras (Mês)</div>
            <div className="text-2xl font-bold text-orange-600">
              {pontos
                .filter(p => new Date(p.data).getMonth() === new Date().getMonth())
                .reduce((sum, p) => sum + (p.horas_extras || 0), 0)
                .toFixed(1)}h
            </div>
          </Card>
        </div>

        <Button 
          className="bg-pink-600 hover:bg-pink-700"
          onClick={() => openWindow(PontoForm, {
            windowMode: true,
            onSubmit: async (data) => {
              try {
                await createMutation.mutateAsync(data);
                toast.success("✅ Ponto registrado!");
              } catch (error) {
                toast.error("Erro ao registrar ponto");
              }
            }
          }, {
            title: '🕐 Registrar Ponto',
            width: 900,
            height: 650
          })}
        >
          <Plus className="w-4 h-4 mr-2" />
          Registrar Ponto
        </Button>

        {/* BACKUP: Dialog removido */}
        <Dialog open={false}>
          <DialogTrigger asChild>
            <Button className="hidden">Removido</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Registrar Ponto</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="colaborador">Colaborador *</Label>
                  <Select
                    value={formData.colaborador_id}
                    onValueChange={(value) => {
                      const colab = colaboradores.find(c => c.id === value);
                      setFormData({ 
                        ...formData, 
                        colaborador_id: value,
                        colaborador_nome: colab?.nome_completo || ''
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o colaborador" />
                    </SelectTrigger>
                    <SelectContent>
                      {colaboradores.filter(c => c.status === 'Ativo').map((colab) => (
                        <SelectItem key={colab.id} value={colab.id}>
                          {colab.nome_completo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="data">Data *</Label>
                  <Input
                    id="data"
                    type="date"
                    value={formData.data}
                    onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="tipo_dia">Tipo de Dia</Label>
                  <Select
                    value={formData.tipo_dia}
                    onValueChange={(value) => setFormData({ ...formData, tipo_dia: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Normal">Normal</SelectItem>
                      <SelectItem value="Feriado">Feriado</SelectItem>
                      <SelectItem value="Fim de Semana">Fim de Semana</SelectItem>
                      <SelectItem value="Folga">Folga</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="entrada_manha">Entrada Manhã</Label>
                  <Input
                    id="entrada_manha"
                    type="time"
                    value={formData.entrada_manha}
                    onChange={(e) => setFormData({ ...formData, entrada_manha: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="saida_almoco">Saída Almoço</Label>
                  <Input
                    id="saida_almoco"
                    type="time"
                    value={formData.saida_almoco}
                    onChange={(e) => setFormData({ ...formData, saida_almoco: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="retorno_almoco">Retorno Almoço</Label>
                  <Input
                    id="retorno_almoco"
                    type="time"
                    value={formData.retorno_almoco}
                    onChange={(e) => setFormData({ ...formData, retorno_almoco: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="saida_tarde">Saída Tarde</Label>
                  <Input
                    id="saida_tarde"
                    type="time"
                    value={formData.saida_tarde}
                    onChange={(e) => setFormData({ ...formData, saida_tarde: e.target.value })}
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="observacoes">Observações</Label>
                  <Textarea
                    id="observacoes"
                    value={formData.observacoes}
                    onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                    rows={2}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="submit" disabled={createMutation.isPending} className="bg-pink-600 hover:bg-pink-700">
                  {createMutation.isPending ? 'Salvando...' : 'Registrar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-0 shadow-md">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Data</TableHead>
                <TableHead>Colaborador</TableHead>
                <TableHead>Entrada</TableHead>
                <TableHead>Saída Almoço</TableHead>
                <TableHead>Retorno</TableHead>
                <TableHead>Saída</TableHead>
                <TableHead>Horas</TableHead>
                <TableHead>Extras</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pontos.map((ponto) => (
                <TableRow key={ponto.id} className="hover:bg-slate-50">
                  <TableCell>
                    {new Date(ponto.data).toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell className="font-medium">{ponto.colaborador_nome}</TableCell>
                  <TableCell className="font-mono text-sm">{ponto.entrada_manha || '-'}</TableCell>
                  <TableCell className="font-mono text-sm">{ponto.saida_almoco || '-'}</TableCell>
                  <TableCell className="font-mono text-sm">{ponto.retorno_almoco || '-'}</TableCell>
                  <TableCell className="font-mono text-sm">{ponto.saida_tarde || '-'}</TableCell>
                  <TableCell className="font-semibold">
                    {ponto.horas_trabalhadas ? `${ponto.horas_trabalhadas.toFixed(1)}h` : '-'}
                  </TableCell>
                  <TableCell className={ponto.horas_extras > 0 ? "font-semibold text-orange-600" : ""}>
                    {ponto.horas_extras ? `${ponto.horas_extras.toFixed(1)}h` : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge className={tipoDiaColors[ponto.tipo_dia]}>
                      {ponto.tipo_dia}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[ponto.status]}>
                      {ponto.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {ponto.status === 'Pendente' && (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => aprovarMutation.mutate({ id: ponto.id })}
                          className="text-green-600 hover:text-green-700 hover:bg-green-50"
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => rejeitarMutation.mutate({ id: ponto.id })}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {pontos.length === 0 && (
          <div className="text-center py-12">
            <Clock className="w-16 h-16 mx-auto mb-4 opacity-30 text-slate-400" />
            <p className="text-slate-500">Nenhum registro de ponto encontrado</p>
          </div>
        )}
      </Card>
    </div>
  );
}
