import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Copy, Calendar, CheckCircle2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import useContextoVisual from "@/components/lib/useContextoVisual";
import { buildFinanceiroQueryScopeKey } from "@/components/financeiro/financeiroLaunchpadAccess";

/**
 * DUPLICAR MÊS ANTERIOR V21.8
 * 
 * Permite duplicar despesas do mês anterior para o mês atual
 * Útil para despesas recorrentes que ainda não estão configuradas
 */
export default function DuplicarMesAnterior({ empresaId }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { empresaAtual, grupoAtual, filterInContext, createInContext } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaContextoId = empresaAtual?.id || null;
  const scopeKey = buildFinanceiroQueryScopeKey({ groupId, empresaId: empresaContextoId });
  const contextoValido = scopeKey !== 'sem-contexto';
  const [dialogOpen, setDialogOpen] = useState(false);
  const [empresaSelecionada, setEmpresaSelecionada] = useState(empresaId || empresaContextoId || '');
  const [incluirRecorrentes, setIncluirRecorrentes] = useState(false);
  const [mesReferencia, setMesReferencia] = useState(() => {
    const hoje = new Date();
    const mesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
    return mesAnterior.toISOString().split('T')[0].substring(0, 7);
  });
  const [mesDestino, setMesDestino] = useState(() => {
    const hoje = new Date();
    return hoje.toISOString().split('T')[0].substring(0, 7);
  });
  const [contasSelecionadas, setContasSelecionadas] = useState([]);

  // Escopo multiempresa: Empresa/Config via filterInContext (não list unscoped).
  const { data: empresas = [], isError: isErrorEmpresasDuplicar } = useQuery({
    queryKey: ['empresas', scopeKey],
    queryFn: () => filterInContext('Empresa', {}, 'nome_fantasia', 500),
    enabled: contextoValido && dialogOpen,
  });

  const { data: configsRecorrentes = [], isError: isErrorConfigsDuplicar } = useQuery({
    queryKey: ['configs-recorrentes', scopeKey],
    queryFn: () => filterInContext('ConfiguracaoDespesaRecorrente', {}, '-created_date', 500),
    enabled: contextoValido && dialogOpen && !incluirRecorrentes,
  });

  const { data: contasMesAnterior = [] } = useQuery({
    queryKey: ['contas-pagar-mes-anterior', scopeKey, empresaSelecionada, mesReferencia, incluirRecorrentes],
    queryFn: async () => {
      const [ano, mes] = mesReferencia.split('-');
      const inicio = new Date(parseInt(ano), parseInt(mes) - 1, 1);
      const fim = new Date(parseInt(ano), parseInt(mes), 0);

      const list = await filterInContext('ContaPagar', { empresa_id: empresaSelecionada }, '-data_vencimento', 500);

      let contasFiltradas = list.filter(c => {
        const dataVenc = new Date(c.data_vencimento);
        return dataVenc >= inicio && dataVenc <= fim;
      });

      if (!incluirRecorrentes) {
        const descricoesRecorrentes = configsRecorrentes.map(cr => cr.descricao);
        contasFiltradas = contasFiltradas.filter(c => !descricoesRecorrentes.includes(c.descricao));
      }

      return contasFiltradas;
    },
    enabled: contextoValido && dialogOpen && !!empresaSelecionada,
  });

  const duplicarMutation = useMutation({
    mutationFn: async () => {
      if (!contextoValido) throw new Error('Selecione grupo ou empresa antes de duplicar.');
      if (!empresaSelecionada) throw new Error('Selecione a empresa destino.');
      if (isErrorEmpresasDuplicar || isErrorConfigsDuplicar) {
        throw new Error('Masters indisponíveis (erro ≠ zero).');
      }
      const contasDuplicar = contasMesAnterior.filter(c => contasSelecionadas.includes(c.id));
      const [anoDestino, mesDestino_] = mesDestino.split('-');

      const novasContas = [];
      for (const conta of contasDuplicar) {
        const diaVencimento = new Date(conta.data_vencimento).getDate();
        const novaDataVencimento = new Date(parseInt(anoDestino), parseInt(mesDestino_) - 1, diaVencimento);

        const payload = {
          ...conta,
          id: undefined,
          created_date: undefined,
          updated_date: undefined,
          empresa_id: empresaSelecionada,
          data_emissao: new Date().toISOString().split('T')[0],
          data_vencimento: novaDataVencimento.toISOString().split('T')[0],
          status: "Pendente",
          data_pagamento: null,
          valor_pago: null,
          observacoes: (conta.observacoes || '') + ` [Duplicado de ${mesReferencia}]`
        };
        delete payload.id;
        delete payload.created_date;
        delete payload.updated_date;
        novasContas.push(await createInContext('ContaPagar', payload));
      }
      return novasContas;
    },
    onSuccess: (novasContas) => {
      queryClient.invalidateQueries({ queryKey: ['contasPagar'] });
      toast({ title: `✅ ${novasContas.length} despesa(s) duplicada(s) para ${mesDestino}!` });
      setDialogOpen(false);
      setContasSelecionadas([]);
    },
    onError: (error) => {
      toast({ title: String(error?.message || error), variant: 'destructive' });
    },
  });

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-purple-300 text-purple-700 hover:bg-purple-50">
          <Copy className="w-4 h-4 mr-2" />
          Duplicar Mês Anterior
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Duplicar Despesas do Mês Anterior</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-auto">
          {!contextoValido && (
            <p className="text-xs text-amber-700">Selecione grupo ou empresa para duplicar despesas.</p>
          )}
          {(isErrorEmpresasDuplicar || isErrorConfigsDuplicar) && (
            <p className="text-xs text-slate-500">Masters indisponíveis (erro de carga ≠ zero).</p>
          )}
          <div>
            <Label>Empresa</Label>
            <Select value={empresaSelecionada} onValueChange={setEmpresaSelecionada} disabled={!contextoValido}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a empresa" />
              </SelectTrigger>
              <SelectContent>
                {empresas.map(emp => (
                  <SelectItem key={emp.id} value={emp.id}>{emp.nome_fantasia || emp.razao_social}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Mês de Referência (Origem)</Label>
              <Input
                type="month"
                value={mesReferencia}
                onChange={(e) => setMesReferencia(e.target.value)}
              />
            </div>
            <div>
              <Label>Mês Destino</Label>
              <Input
                type="month"
                value={mesDestino}
                onChange={(e) => setMesDestino(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center space-x-2 p-3 border rounded bg-slate-50">
            <Checkbox
              id="incluir-recorrentes"
              checked={incluirRecorrentes}
              onCheckedChange={(checked) => setIncluirRecorrentes(checked === true)}
            />
            <label htmlFor="incluir-recorrentes" className="text-sm">
              Incluir despesas recorrentes (já geradas automaticamente)
            </label>
          </div>

          <Alert className="bg-blue-50 border-blue-200">
            <AlertDescription>
              <p className="text-sm font-medium text-blue-900">
                📊 {contasMesAnterior.length} despesa(s) encontrada(s) em {mesReferencia}
              </p>
              <p className="text-xs text-blue-700 mt-1">
                Selecione as despesas que deseja duplicar para {mesDestino}
              </p>
            </AlertDescription>
          </Alert>

          {contasMesAnterior.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="w-12">
                      <Checkbox
                        checked={contasSelecionadas.length === contasMesAnterior.length}
                        onCheckedChange={(checked) => {
                          setContasSelecionadas(
                            checked ? contasMesAnterior.map(c => c.id) : []
                          );
                        }}
                      />
                    </TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contasMesAnterior.map((conta) => (
                    <TableRow key={conta.id}>
                      <TableCell>
                        <Checkbox
                          checked={contasSelecionadas.includes(conta.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setContasSelecionadas([...contasSelecionadas, conta.id]);
                            } else {
                              setContasSelecionadas(contasSelecionadas.filter(id => id !== conta.id));
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{conta.fornecedor}</TableCell>
                      <TableCell className="text-sm">{conta.descricao}</TableCell>
                      <TableCell className="text-sm">
                        {new Date(conta.data_vencimento).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell className="font-semibold">
                        R$ {conta.valor?.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={() => setDialogOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => duplicarMutation.mutate()}
            disabled={!contextoValido || !empresaSelecionada || contasSelecionadas.length === 0 || duplicarMutation.isPending || isErrorEmpresasDuplicar || isErrorConfigsDuplicar}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Duplicar {contasSelecionadas.length} Despesa(s)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
