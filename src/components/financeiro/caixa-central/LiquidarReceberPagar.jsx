import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import useContextoVisual from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { useUser } from "@/components/lib/UserContext";
import { useToast } from "@/components/ui/use-toast";
import {
  TrendingUp,
  TrendingDown,
  Send,
  ArrowRight,
  AlertCircle,
  CheckCircle2
} from "lucide-react";

const sanitizeText = (value) => String(value || "")
  .replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, "")
  .replace(/javascript:\s*/gi, "")
  .trim();

const formatCurrency = (value) => Number(value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
const formatDate = (value) => value ? new Date(value).toLocaleDateString("pt-BR") : "-";

export default function LiquidarReceberPagar() {
  const { filterInContext, empresaAtual, grupoAtual, createInContext } = useContextoVisual();
  const { canCreate, hasPermission } = usePermissions();
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [abaAtiva, setAbaAtiva] = useState("receber");
  const [titulosSelecionadosReceber, setTitulosSelecionadosReceber] = useState([]);
  const [titulosSelecionadosPagar, setTitulosSelecionadosPagar] = useState([]);

  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const contextKey = empresaId || groupId || "sem-contexto";
  const contextoValido = Boolean(groupId || empresaId);
  const podeEnviarCaixa = canCreate("Financeiro", "Caixa")
    || canCreate("Financeiro", "Caixa Central")
    || canCreate("Financeiro", "CaixaOrdemLiquidacao")
    || hasPermission("Financeiro", "ContaReceber", "baixar")
    || hasPermission("Financeiro", "ContaPagar", "baixar")
    || hasPermission("Financeiro", null, "editar");
  const bloqueado = !contextoValido || !empresaId || !podeEnviarCaixa;

  const withContext = (payload = {}) => ({
    ...payload,
    ...(groupId ? { group_id: groupId, grupo_id: groupId } : {}),
    ...(empresaId ? { empresa_id: empresaId } : {})
  });

  const auditLiquidacao = async (acao, sucesso, detalhes = {}) => {
    try {
      await base44.entities.AuditLog.create(withContext({
        usuario_id: user?.id || null,
        usuario_nome: user?.full_name || user?.email || "Usuario",
        acao,
        modulo: "Financeiro",
        entidade: "CaixaOrdemLiquidacao",
        tipo_auditoria: sucesso ? "entidade" : "seguranca",
        descricao: `Liquidacao receber/pagar: ${acao}`,
        sucesso,
        detalhes,
        data_hora: new Date().toISOString()
      }));
    } catch {}
  };

  const { data: contasReceber = [] } = useQuery({
    queryKey: ["contasReceber-liquidacao", contextKey],
    queryFn: () => filterInContext("ContaReceber", { status: { $in: ["Pendente", "Atrasado"] } }, "-data_vencimento", 100),
    enabled: contextoValido,
  });

  const { data: contasPagar = [] } = useQuery({
    queryKey: ["contasPagar-liquidacao", contextKey],
    queryFn: () => filterInContext("ContaPagar", { status: { $in: ["Pendente", "Aprovado"] } }, "-data_vencimento", 100),
    enabled: contextoValido,
  });

  const enviarParaCaixaMutation = useMutation({
    mutationFn: async ({ titulos, tipo }) => {
      const lista = Array.isArray(titulos) ? titulos.filter(Boolean) : [];
      if (!contextoValido || !empresaId) {
        await auditLiquidacao("bloqueado_sem_contexto", false, { tipo, quantidade: lista.length });
        throw new Error("Selecione uma empresa do grupo antes de enviar ao caixa.");
      }
      if (!podeEnviarCaixa) {
        await auditLiquidacao("bloqueado_sem_permissao", false, { tipo, quantidade: lista.length });
        throw new Error("Sem permissao para enviar titulos ao caixa.");
      }
      if (!lista.length) {
        throw new Error("Selecione pelo menos um titulo.");
      }
      const total = lista.reduce((sum, titulo) => sum + Number(titulo.valor || 0), 0);
      if (total <= 0) {
        await auditLiquidacao("bloqueado_valor_invalido", false, { tipo, total });
        throw new Error("Os titulos selecionados nao possuem valor valido.");
      }
      const confirmado = window.confirm(`Enviar ${lista.length} titulo(s) para o Caixa? Total R$ ${formatCurrency(total)}. Esta acao sera auditada.`);
      if (!confirmado) {
        await auditLiquidacao("cancelado_pelo_usuario", false, { tipo, quantidade: lista.length, total });
        throw new Error("Envio cancelado pelo usuario.");
      }

      const ordens = await Promise.all(lista.map(async (titulo) => {
        const valor = Number(titulo.valor || 0);
        if (valor <= 0) return null;
        const ordemData = withContext({
          tipo_operacao: tipo === "receber" ? "Recebimento" : "Pagamento",
          origem: tipo === "receber" ? "Contas a Receber" : "Contas a Pagar",
          valor_total: valor,
          forma_pagamento_pretendida: tipo === "receber" ? "PIX" : "Transferencia",
          status: "Pendente",
          titulos_vinculados: [{
            titulo_id: titulo.id,
            tipo_titulo: tipo === "receber" ? "ContaReceber" : "ContaPagar",
            numero_titulo: sanitizeText(titulo.numero_documento || titulo.descricao),
            cliente_fornecedor_nome: sanitizeText(tipo === "receber" ? titulo.cliente : titulo.fornecedor),
            valor_titulo: valor,
            group_id: groupId,
            empresa_id: empresaId
          }],
          data_ordem: new Date().toISOString(),
          usuario_solicitante_id: user?.id || null,
          usuario_solicitante_nome: user?.full_name || user?.email || "Usuario"
        });
        return await createInContext("CaixaOrdemLiquidacao", ordemData);
      }));

      const ordensValidas = ordens.filter(Boolean);
      await auditLiquidacao("titulos_enviados_caixa", true, {
        tipo,
        quantidade: ordensValidas.length,
        total,
        titulos_ids: lista.map((titulo) => titulo.id)
      });
      return ordensValidas;
    },
    onSuccess: (ordens) => {
      queryClient.invalidateQueries({ queryKey: ["caixa-ordens-liquidacao"] });
      queryClient.invalidateQueries({ queryKey: ["ordens-liquidacao"] });
      toast({ title: `${ordens.length} titulo(s) enviado(s) para Caixa!` });
      setTitulosSelecionadosReceber([]);
      setTitulosSelecionadosPagar([]);
    },
    onError: (error) => {
      toast({ title: error.message || "Erro ao enviar titulos para o Caixa", variant: "destructive" });
    }
  });

  const toggleSelecao = (id, tipo) => {
    if (bloqueado) return;
    const setter = tipo === "receber" ? setTitulosSelecionadosReceber : setTitulosSelecionadosPagar;
    setter((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]);
  };

  const selecionarTodos = (checked, tipo, lista) => {
    if (bloqueado) return;
    const ids = checked ? lista.map((conta) => conta.id) : [];
    if (tipo === "receber") setTitulosSelecionadosReceber(ids);
    else setTitulosSelecionadosPagar(ids);
  };

  const renderTabela = (tipo, lista, selecionados) => {
    const isReceber = tipo === "receber";
    const labelNome = isReceber ? "Cliente" : "Fornecedor";
    const statusClass = (status) => isReceber
      ? (status === "Atrasado" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700")
      : (status === "Pendente" ? "bg-yellow-100 text-yellow-700" : "bg-blue-100 text-blue-700");

    return (
      <Card className="border-0 shadow-md">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="w-12">
                  <Checkbox
                    checked={selecionados.length === lista.length && lista.length > 0}
                    onCheckedChange={(checked) => selecionarTodos(checked, tipo, lista)}
                    disabled={bloqueado || lista.length === 0}
                  />
                </TableHead>
                <TableHead>{labelNome}</TableHead>
                <TableHead>Descricao</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lista.map((conta) => (
                <TableRow key={conta.id}>
                  <TableCell>
                    <Checkbox
                      checked={selecionados.includes(conta.id)}
                      onCheckedChange={() => toggleSelecao(conta.id, tipo)}
                      disabled={bloqueado}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{sanitizeText(isReceber ? conta.cliente : conta.fornecedor) || "-"}</TableCell>
                  <TableCell className="max-w-xs truncate">{sanitizeText(conta.descricao)}</TableCell>
                  <TableCell className="text-sm">{formatDate(conta.data_vencimento)}</TableCell>
                  <TableCell className="font-semibold">R$ {formatCurrency(conta.valor)}</TableCell>
                  <TableCell>
                    <Badge className={statusClass(conta.status)}>{sanitizeText(conta.status)}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => enviarParaCaixaMutation.mutate({ titulos: [conta], tipo })}
                      disabled={bloqueado || enviarParaCaixaMutation.isPending}
                      data-action={`enviar-${tipo}-caixa`}
                      data-permission="Financeiro.Caixa.criar"
                      data-context-required="group_id,empresa_id"
                      data-sensitive="true"
                    >
                      <ArrowRight className="w-4 h-4 mr-1" />
                      Enviar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {lista.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <CheckCircle2 className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p>Nenhuma conta {isReceber ? "a receber" : "a pagar"} pendente</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="w-full h-full space-y-4">
      {bloqueado && (
        <Alert className="border-amber-300 bg-amber-50">
          <AlertCircle className="w-4 h-4 text-amber-600" />
          <AlertDescription className="text-amber-900">
            {!contextoValido || !empresaId
              ? "Selecione uma empresa do grupo antes de enviar titulos ao Caixa."
              : "Seu perfil nao tem permissao para enviar titulos ao Caixa."}
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={abaAtiva} onValueChange={setAbaAtiva}>
        <TabsList className="bg-white border shadow-sm">
          <TabsTrigger value="receber" className="data-[state=active]:bg-green-600 data-[state=active]:text-white">
            <TrendingUp className="w-4 h-4 mr-2" />
            Liquidar Receber
          </TabsTrigger>
          <TabsTrigger value="pagar" className="data-[state=active]:bg-red-600 data-[state=active]:text-white">
            <TrendingDown className="w-4 h-4 mr-2" />
            Liquidar Pagar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="receber" className="space-y-4">
          <Alert className="border-green-300 bg-green-50">
            <AlertDescription className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-green-900">Liquidacao de Contas a Receber</p>
                <p className="text-xs text-green-700">Selecione titulos para enviar ao Caixa</p>
              </div>
              {titulosSelecionadosReceber.length > 0 && (
                <Button
                  onClick={() => enviarParaCaixaMutation.mutate({
                    titulos: contasReceber.filter((c) => titulosSelecionadosReceber.includes(c.id)),
                    tipo: "receber"
                  })}
                  disabled={bloqueado || enviarParaCaixaMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                  data-action="enviar-receber-caixa-lote"
                  data-permission="Financeiro.Caixa.criar"
                  data-context-required="group_id,empresa_id"
                  data-sensitive="true"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Enviar {titulosSelecionadosReceber.length} para Caixa
                </Button>
              )}
            </AlertDescription>
          </Alert>
          {renderTabela("receber", contasReceber, titulosSelecionadosReceber)}
        </TabsContent>

        <TabsContent value="pagar" className="space-y-4">
          <Alert className="border-red-300 bg-red-50">
            <AlertDescription className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-red-900">Liquidacao de Contas a Pagar</p>
                <p className="text-xs text-red-700">Selecione titulos para enviar ao Caixa</p>
              </div>
              {titulosSelecionadosPagar.length > 0 && (
                <Button
                  onClick={() => enviarParaCaixaMutation.mutate({
                    titulos: contasPagar.filter((c) => titulosSelecionadosPagar.includes(c.id)),
                    tipo: "pagar"
                  })}
                  disabled={bloqueado || enviarParaCaixaMutation.isPending}
                  className="bg-red-600 hover:bg-red-700"
                  data-action="enviar-pagar-caixa-lote"
                  data-permission="Financeiro.Caixa.criar"
                  data-context-required="group_id,empresa_id"
                  data-sensitive="true"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Enviar {titulosSelecionadosPagar.length} para Caixa
                </Button>
              )}
            </AlertDescription>
          </Alert>
          {renderTabela("pagar", contasPagar, titulosSelecionadosPagar)}
        </TabsContent>
      </Tabs>
    </div>
  );
}
