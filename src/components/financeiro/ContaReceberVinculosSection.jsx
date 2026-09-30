import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  applyPedidoVinculoAoForm,
  filterPedidosParaTitulo,
} from "@/components/lib/financeiroTituloPolicy";

const PEDIDO_NENHUM = "__none__";

function labelPedido(pedido) {
  const numero = pedido?.numero_pedido || pedido?.numero || pedido?.id || "—";
  const cliente = pedido?.cliente_nome || pedido?.cliente || "sem cliente";
  const valor = Number(pedido?.valor_total ?? pedido?.total ?? pedido?.valor);
  const valorTxt = Number.isFinite(valor) ? `R$ ${valor.toFixed(2)}` : "";
  return [numero, cliente, valorTxt].filter(Boolean).join(" - ");
}

export default function ContaReceberVinculosSection({
  formData,
  setFormData,
  pedidos = [],
  centrosCusto = [],
  planosContas = [],
  groupId,
  empresaId,
}) {
  const empresaEscopo = empresaId || formData.empresa_id;
  const groupEscopo = groupId || formData.group_id || formData.grupo_id;
  const pedidosEscopo = filterPedidosParaTitulo({
    pedidos,
    groupId: groupEscopo,
    empresaId: empresaEscopo,
  });
  const pedidoSelecionado = formData.pedido_id || PEDIDO_NENHUM;

  const onPedidoChange = (value) => {
    if (!value || value === PEDIDO_NENHUM) {
      setFormData(applyPedidoVinculoAoForm({ form: formData, pedido: null }));
      return;
    }
    const pedido = pedidosEscopo.find((item) => item.id === value);
    setFormData(applyPedidoVinculoAoForm({ form: formData, pedido: pedido || { id: value } }));
  };

  return (
    <div className="space-y-4 w-full">
      <div>
        <Label>Pedido Vinculado</Label>
        <Select value={pedidoSelecionado} onValueChange={onPedidoChange} disabled={!empresaEscopo}>
          <SelectTrigger>
            <SelectValue placeholder={empresaEscopo ? "Nenhum pedido vinculado..." : "Selecione a empresa primeiro"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={PEDIDO_NENHUM}>Nenhum</SelectItem>
            {pedidosEscopo.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {labelPedido(p)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!empresaEscopo && (
          <p className="text-xs text-slate-500 mt-1">Informe a empresa do título para listar pedidos do mesmo escopo.</p>
        )}
      </div>

      <div>
        <Label>Centro de Custo *</Label>
        <Select
          value={formData.centro_custo_id}
          onValueChange={(v) => {
            const cc = centrosCusto.find((c) => c.id === v);
            setFormData({ ...formData, centro_custo_id: v, centro_custo: cc?.nome || "" });
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione..." />
          </SelectTrigger>
          <SelectContent>
            {centrosCusto.map((cc) => (
              <SelectItem key={cc.id} value={cc.id}>
                {cc.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Plano de Contas *</Label>
        <Select value={formData.plano_contas_id} onValueChange={(v) => setFormData({ ...formData, plano_contas_id: v })}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione..." />
          </SelectTrigger>
          <SelectContent>
            {planosContas.map((pc) => (
              <SelectItem key={pc.id} value={pc.id}>
                {pc.codigo || pc.id} - {pc.descricao || pc.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Projeto/Obra</Label>
        <Input
          value={formData.projeto_obra}
          onChange={(e) => setFormData({ ...formData, projeto_obra: e.target.value })}
          placeholder="Nome do projeto ou obra..."
        />
      </div>
    </div>
  );
}
