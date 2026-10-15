import React, { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Save, DollarSign, Calculator } from "lucide-react";
import { toast } from "sonner";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import CadastroCodigoRegistroField from "@/components/cadastros/CadastroCodigoRegistroField";

const sanitizeText = (value, max = 500) => String(value ?? "").replace(/[<>]/g, "").slice(0, max).trim();
const toNumber = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

const emptyForm = {
  vendedor: "",
  vendedor_id: "",
  pedido_id: "",
  numero_pedido: "",
  cliente: "",
  data_venda: new Date().toISOString().split("T")[0],
  valor_venda: 0,
  percentual_comissao: 5,
  valor_comissao: 0,
  status: "Pendente",
  observacoes: "",
};

/**
 * Comissão de vendas — multiempresa, RBAC fail-closed, ID técnico separado.
 * Pedidos filtrados pelo contexto visual (grupo/empresa).
 */
export default function ComissaoForm({
  comissao,
  item,
  data,
  initialData,
  defaultValues,
  onSubmit,
  windowMode = false,
}) {
  const dadosIniciais = item || data || initialData || defaultValues || comissao;
  const { empresaAtual, grupoAtual, contexto, filterInContext } = useContextoVisual();
  const { canCreate, canEdit } = usePermissions();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || dadosIniciais?.group_id || null;
  const empresaId = contexto === "empresa" ? empresaAtual?.id : (dadosIniciais?.empresa_id || null);
  const contextKey = empresaId || groupId || "sem-contexto";
  const contextoValido = contextKey !== "sem-contexto";
  const podeCriar = canCreate("Comercial", "Comissao") || canCreate("Cadastros", "Comissao") || canCreate("Comercial", null);
  const podeEditar = canEdit("Comercial", "Comissao") || canEdit("Cadastros", "Comissao") || canEdit("Comercial", null);
  const podeSalvar = dadosIniciais?.id ? podeEditar : podeCriar;

  const [formData, setFormData] = useState(() => ({
    ...emptyForm,
    ...(dadosIniciais || {}),
    group_id: dadosIniciais?.group_id || groupId || "",
    empresa_id: dadosIniciais?.empresa_id || empresaId || "",
  }));

  const prevIdRef = useRef(dadosIniciais?.id);
  useEffect(() => {
    if (dadosIniciais?.id && dadosIniciais.id !== prevIdRef.current) {
      prevIdRef.current = dadosIniciais.id;
      setFormData({
        ...emptyForm,
        ...dadosIniciais,
        group_id: dadosIniciais.group_id || groupId || "",
        empresa_id: dadosIniciais.empresa_id || empresaId || "",
      });
    }
  }, [dadosIniciais?.id, groupId, empresaId]);

  const { data: pedidos = [] } = useQuery({
    queryKey: ["pedidos-comissao", contextKey],
    queryFn: () => filterInContext("Pedido", empresaId ? { empresa_id: empresaId } : {}, "-data_pedido", 500),
    enabled: contextoValido,
  });

  const handlePedidoChange = (pedidoId) => {
    const pedido = pedidos.find((p) => p.id === pedidoId);
    if (!pedido) return;
    const percentual = toNumber(formData.percentual_comissao, 5);
    const valorVenda = toNumber(pedido.valor_total, 0);
    setFormData((prev) => ({
      ...prev,
      pedido_id: pedidoId,
      numero_pedido: pedido.numero_pedido || "",
      cliente: pedido.cliente_nome || "",
      vendedor: pedido.vendedor || "",
      vendedor_id: pedido.vendedor_id || "",
      data_venda: (pedido.data_pedido || "").slice(0, 10) || prev.data_venda,
      valor_venda: valorVenda,
      valor_comissao: valorVenda * (percentual / 100),
      group_id: pedido.group_id || groupId || prev.group_id,
      empresa_id: pedido.empresa_id || empresaId || prev.empresa_id,
    }));
  };

  const handlePercentualChange = (percentual) => {
    const pct = toNumber(percentual, 0);
    setFormData((prev) => ({
      ...prev,
      percentual_comissao: pct,
      valor_comissao: toNumber(prev.valor_venda, 0) * (pct / 100),
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!contextoValido) {
      toast.error("Selecione um grupo ou empresa antes de salvar a comissão.");
      return;
    }
    if (!podeSalvar) {
      toast.error(dadosIniciais?.id ? "Sem permissão para editar comissão." : "Sem permissão para criar comissão.");
      return;
    }
    if (!formData.pedido_id) {
      toast.error("Selecione um pedido.");
      return;
    }
    const payload = {
      ...formData,
      vendedor: sanitizeText(formData.vendedor, 160),
      cliente: sanitizeText(formData.cliente, 240),
      numero_pedido: sanitizeText(formData.numero_pedido, 80),
      observacoes: sanitizeText(formData.observacoes, 1000),
      status: sanitizeText(formData.status || "Pendente", 40),
      valor_venda: toNumber(formData.valor_venda, 0),
      percentual_comissao: toNumber(formData.percentual_comissao, 0),
      valor_comissao: toNumber(formData.valor_comissao, 0),
      group_id: groupId || formData.group_id,
      empresa_id: contexto === "empresa" ? empresaAtual?.id : (formData.empresa_id || undefined),
    };
    onSubmit?.(payload);
  };

  const content = (
    <form onSubmit={handleSubmit} className={`space-y-6 ${windowMode ? "p-6 h-full overflow-auto" : ""}`}>
      {!contextoValido && (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertDescription className="text-sm text-amber-900">
            Selecione um grupo ou empresa para listar pedidos e registrar comissão.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="p-6 space-y-4">
          <h3 className="font-bold text-lg flex items-center gap-2 text-sky-800">
            <DollarSign className="w-5 h-5 text-sky-600" />
            Comissão de Vendas
          </h3>

          <CadastroCodigoRegistroField
            idOnly
            hasId={Boolean(dadosIniciais?.id)}
            entityId={dadosIniciais?.id}
            action="id-tecnico-comissao"
          />

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Pedido *</Label>
              <Select
                value={formData.pedido_id || undefined}
                onValueChange={handlePedidoChange}
                disabled={!podeSalvar || !contextoValido}
                required
              >
                <SelectTrigger
                  data-permission="Comercial.Comissao.editar"
                  data-action="selecionar-pedido-comissao"
                  data-sensitive
                >
                  <SelectValue placeholder={contextoValido ? "Selecione..." : "Sem contexto"} />
                </SelectTrigger>
                <SelectContent>
                  {pedidos
                    .filter((p) => p.status === "Aprovado" || p.status === "Faturado")
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.numero_pedido} - {p.cliente_nome} - R$ {(p.valor_total || 0).toLocaleString("pt-BR")}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Vendedor</Label>
              <Input value={formData.vendedor} readOnly className="bg-slate-50" />
            </div>

            <div>
              <Label>Cliente</Label>
              <Input value={formData.cliente} readOnly className="bg-slate-50" />
            </div>

            <div>
              <Label>Data da Venda</Label>
              <Input type="date" value={formData.data_venda || ""} readOnly className="bg-slate-50" />
            </div>

            <div>
              <Label>Valor da Venda</Label>
              <Input
                value={`R$ ${toNumber(formData.valor_venda, 0).toLocaleString("pt-BR")}`}
                readOnly
                className="bg-slate-50 font-semibold"
              />
            </div>

            <div>
              <Label>Percentual Comissão (%)</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.percentual_comissao}
                  onChange={(e) => handlePercentualChange(parseFloat(e.target.value) || 0)}
                  disabled={!podeSalvar}
                  className="flex-1"
                  data-permission="Comercial.Comissao.editar"
                  data-action="editar-percentual-comissao"
                  data-sensitive
                />
                <Button type="button" variant="outline" size="icon" title="Calcular" disabled={!podeSalvar}>
                  <Calculator className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div>
              <Label>Valor da Comissão</Label>
              <Input
                value={`R$ ${toNumber(formData.valor_comissao, 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                readOnly
                className="bg-sky-50 font-bold text-sky-800"
              />
            </div>

            <div className="col-span-2">
              <Label>Observações</Label>
              <Textarea
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                rows={3}
                placeholder="Observações sobre a comissão..."
                disabled={!podeSalvar}
                data-permission="Comercial.Comissao.editar"
                data-action="editar-observacoes-comissao"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3 pt-4 border-t sticky bottom-0 bg-white">
        <Button
          type="submit"
          disabled={!contextoValido || !podeSalvar}
          className="bg-sky-600 hover:bg-sky-700"
          data-permission="Comercial.Comissao.salvar"
          data-action="salvar-comissao"
          data-sensitive
        >
          <Save className="w-4 h-4 mr-2" />
          {dadosIniciais?.id ? "Atualizar" : "Registrar"} Comissão
        </Button>
      </div>
    </form>
  );

  if (windowMode) {
    return <div className="w-full h-full bg-white">{content}</div>;
  }

  return content;
}
