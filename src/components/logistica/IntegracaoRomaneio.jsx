import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText, Truck, User, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { useUser } from "@/components/lib/UserContext";

const sanitizeText = (value) => String(value || "").replace(/[<>]/g, "").replace(/javascript:/gi, "").trim();
const sanitizePlaca = (value) => sanitizeText(value).toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 8);

/**
 * INTEGRACAO COM ROMANEIO V21.5
 * Cria romaneios automaticamente com entregas selecionadas.
 */
export default function IntegracaoRomaneio({ pedidosSelecionados = [], onClose, windowMode = false }) {
  const [motorista, setMotorista] = useState("");
  const [veiculo, setVeiculo] = useState("");
  const [placa, setPlaca] = useState("");
  const [pedidosSelecionadosIds, setPedidosSelecionadosIds] = useState(pedidosSelecionados.map(p => p.id));

  const queryClient = useQueryClient();
  const { empresaAtual, grupoAtual, filterInContext, createInContext, updateInContext } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const { user } = useUser();

  const effectiveEmpresaId = pedidosSelecionados.find(p => p?.empresa_id)?.empresa_id || empresaAtual?.id || null;
  const pedidoComGrupo = pedidosSelecionados.find(p => p?.group_id || p?.grupo_id);
  const effectiveGroupId = pedidoComGrupo?.group_id || pedidoComGrupo?.grupo_id || grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const contextoValido = Boolean(effectiveGroupId || effectiveEmpresaId);
  const canCreateRomaneio = hasPermission("Expedicao", "Romaneio", "criar") || hasPermission("Expedicao", "Entregas", "editar") || hasPermission("Comercial", "Pedido", "editar");
  const withContextData = (payload = {}) => ({
    ...payload,
    group_id: payload.group_id || effectiveGroupId,
    grupo_id: payload.grupo_id || payload.group_id || effectiveGroupId,
    empresa_id: payload.empresa_id || effectiveEmpresaId,
  });

  const auditRomaneio = async ({ acao, sucesso = true, motivo = null, detalhes = {}, dadosNovos = null, dadosAnteriores = null }) => {
    try {
      await base44.entities.AuditLog.create({
        usuario: user?.full_name || user?.email || "Usuario",
        usuario_id: user?.id,
        acao,
        modulo: "Expedicao",
        entidade: "Romaneio",
        tipo_auditoria: sucesso ? "operacional" : "seguranca",
        empresa_id: effectiveEmpresaId,
        group_id: effectiveGroupId,
        grupo_id: effectiveGroupId,
        sucesso,
        resultado: sucesso ? "sucesso" : "bloqueado",
        motivo,
        detalhes,
        dados_anteriores: dadosAnteriores,
        dados_novos: dadosNovos,
        data_hora: new Date().toISOString()
      });
    } catch (error) {
      console.warn("Falha ao auditar romaneio", error);
    }
  };

  const { data: pedidos = [] } = useQuery({
    queryKey: ["pedidos-romaneio", effectiveGroupId, effectiveEmpresaId],
    queryFn: () => filterInContext("Pedido", {}, "-created_date", 1000),
    enabled: contextoValido && canCreateRomaneio,
  });

  const { data: motoristas = [] } = useQuery({
    queryKey: ["motoristas-romaneio", effectiveGroupId, effectiveEmpresaId],
    queryFn: () => filterInContext("Motorista", {}, "nome", 300),
    enabled: contextoValido && canCreateRomaneio,
  });

  const { data: veiculos = [] } = useQuery({
    queryKey: ["veiculos-romaneio", effectiveGroupId, effectiveEmpresaId],
    queryFn: () => filterInContext("Veiculo", {}, "modelo", 300),
    enabled: contextoValido && canCreateRomaneio,
  });

  const pedidosElegiveis = pedidos.filter(p =>
    ["Faturado", "Em Expedição", "Em Expedicao", "Pronto para Faturar"].includes(p.status) &&
    p.tipo_frete !== "Retirada"
  );

  const criarRomaneioMutation = useMutation({
    mutationFn: async () => {
      if (!contextoValido || !canCreateRomaneio) {
        await auditRomaneio({ acao: "Romaneio.criar_bloqueado", sucesso: false, motivo: !contextoValido ? "contexto_obrigatorio" : "permissao_negada", detalhes: { selecionados: pedidosSelecionadosIds.length } });
        throw new Error("Contexto e permissao sao obrigatorios para criar romaneio.");
      }

      const motoristaSanitizado = sanitizeText(motorista);
      const veiculoSanitizado = sanitizeText(veiculo);
      const placaSanitizada = sanitizePlaca(placa);
      if (!motoristaSanitizado || !veiculoSanitizado || !placaSanitizada || pedidosSelecionadosIds.length === 0) {
        throw new Error("Motorista, veiculo, placa e pelo menos um pedido sao obrigatorios.");
      }

      if (!window.confirm(`Confirmar criacao do romaneio com ${pedidosSelecionadosIds.length} entrega(s)?`)) {
        await auditRomaneio({ acao: "Romaneio.criar_cancelado", sucesso: false, motivo: "confirmacao_cancelada", detalhes: { selecionados: pedidosSelecionadosIds.length } });
        throw new Error("Criacao cancelada pelo usuario.");
      }

      const pedidosParaRomaneio = pedidos.filter(p => pedidosSelecionadosIds.includes(p.id));
      const pesoTotal = pedidosParaRomaneio.reduce((sum, p) => sum + (p.peso_total_kg || 0), 0);
      const valorTotal = pedidosParaRomaneio.reduce((sum, p) => sum + (p.valor_total || 0), 0);

      const romaneio = await createInContext("Romaneio", withContextData({
        data_saida: new Date().toISOString(),
        motorista: motoristaSanitizado,
        veiculo: veiculoSanitizado,
        placa: placaSanitizada,
        quantidade_entregas: pedidosParaRomaneio.length,
        peso_total_kg: pesoTotal,
        valor_total_mercadorias: valorTotal,
        status: "Em Rota",
        responsavel_criacao: user?.full_name || user?.email || "Sistema",
        empresa_id: pedidosParaRomaneio[0]?.empresa_id || effectiveEmpresaId
      }));

      for (const pedido of pedidosParaRomaneio) {
        await createInContext("Entrega", withContextData({
          pedido_id: pedido.id,
          numero_pedido: sanitizeText(pedido.numero_pedido),
          cliente_id: pedido.cliente_id,
          cliente_nome: sanitizeText(pedido.cliente_nome),
          empresa_id: pedido.empresa_id || effectiveEmpresaId,
          endereco_entrega_completo: pedido.endereco_entrega_principal,
          romaneio_id: romaneio.id,
          motorista: motoristaSanitizado,
          veiculo: veiculoSanitizado,
          placa: placaSanitizada,
          data_saida: new Date().toISOString(),
          status: "Saiu para Entrega",
          peso_total_kg: pedido.peso_total_kg,
          valor_mercadoria: pedido.valor_total
        }));

        await updateInContext("Pedido", pedido.id, withContextData({
          status: "Em Trânsito",
          historico_status: [
            ...(pedido.historico_status || []),
            {
              status: "Em Trânsito",
              data_hora: new Date().toISOString(),
              usuario: user?.full_name || user?.email || "Sistema",
              usuario_id: user?.id,
              observacao: `Romaneio ${romaneio.id} criado para entrega.`
            }
          ]
        }));
      }

      await auditRomaneio({ acao: "Romaneio.criar", detalhes: { romaneio_id: romaneio.id, entregas: pedidosParaRomaneio.length }, dadosNovos: romaneio });
      return romaneio;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos-romaneio"] });
      queryClient.invalidateQueries({ queryKey: ["entregas"] });
      queryClient.invalidateQueries({ queryKey: ["romaneios"] });
      toast.success(`Romaneio criado com ${pedidosSelecionadosIds.length} entrega(s).`);
      onClose?.();
    },
    onError: (error) => {
      if (error?.message !== "Criacao cancelada pelo usuario.") toast.error(error?.message || "Erro ao criar romaneio.");
    }
  });

  const togglePedido = (pedidoId) => {
    setPedidosSelecionadosIds(prev =>
      prev.includes(pedidoId)
        ? prev.filter(id => id !== pedidoId)
        : [...prev, pedidoId]
    );
  };

  const pedidosSelecionadosLista = pedidos.filter(p => pedidosSelecionadosIds.includes(p.id));
  const pesoTotalSelecionado = pedidosSelecionadosLista.reduce((sum, p) => sum + (p.peso_total_kg || 0), 0);
  const valorTotalSelecionado = pedidosSelecionadosLista.reduce((sum, p) => sum + (p.valor_total || 0), 0);
  const containerClass = windowMode ? "w-full h-full flex flex-col" : "";

  return (
    <Card className={`border-0 shadow-xl ${containerClass}`} data-permission="Expedicao.Romaneio.criar" data-context-required="true">
      <CardHeader className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Criar Romaneio de Entrega
        </CardTitle>
        <p className="text-sm opacity-90">Agrupe entregas e envie para rota</p>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        {(!contextoValido || !canCreateRomaneio) && (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="p-4 text-sm text-yellow-800">
              Selecione contexto grupo/empresa e confirme permissao para criar romaneio.
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="flex items-center gap-2"><User className="w-4 h-4" />Motorista *</Label>
            <Input value={motorista} onChange={(e) => setMotorista(sanitizeText(e.target.value))} placeholder="Nome do motorista" list="motoristas-list" disabled={!contextoValido || !canCreateRomaneio} />
            <datalist id="motoristas-list">
              {motoristas.map(m => <option key={m.id} value={sanitizeText(m.nome)} />)}
            </datalist>
          </div>

          <div>
            <Label className="flex items-center gap-2"><Truck className="w-4 h-4" />Veiculo *</Label>
            <Input value={veiculo} onChange={(e) => setVeiculo(sanitizeText(e.target.value))} placeholder="Modelo do veiculo" list="veiculos-list" disabled={!contextoValido || !canCreateRomaneio} />
            <datalist id="veiculos-list">
              {veiculos.map(v => <option key={v.id} value={sanitizeText(v.modelo)} />)}
            </datalist>
          </div>

          <div>
            <Label>Placa *</Label>
            <Input value={placa} onChange={(e) => setPlaca(sanitizePlaca(e.target.value))} placeholder="ABC-1234" maxLength={8} disabled={!contextoValido || !canCreateRomaneio} />
          </div>
        </div>

        <Card className="bg-blue-50 border-blue-300">
          <CardContent className="p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div><p className="text-sm text-blue-700">Entregas</p><p className="text-2xl font-bold text-blue-900">{pedidosSelecionadosIds.length}</p></div>
              <div><p className="text-sm text-blue-700">Peso Total</p><p className="text-2xl font-bold text-blue-900">{pesoTotalSelecionado.toFixed(0)} kg</p></div>
              <div><p className="text-sm text-blue-700">Valor</p><p className="text-2xl font-bold text-blue-900">R$ {valorTotalSelecionado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="bg-slate-50 border-b">
            <CardTitle className="text-base">Selecionar Entregas ({pedidosElegiveis.length} disponivel(is))</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {pedidosElegiveis.map(pedido => (
                <div key={pedido.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer" onClick={() => togglePedido(pedido.id)}>
                  <Checkbox checked={pedidosSelecionadosIds.includes(pedido.id)} onCheckedChange={() => togglePedido(pedido.id)} />
                  <div className="flex-1">
                    <p className="font-semibold text-sm">#{sanitizeText(pedido.numero_pedido)} - {sanitizeText(pedido.cliente_nome)}</p>
                    <p className="text-xs text-slate-600">{sanitizeText(pedido.endereco_entrega_principal?.cidade)} - {(pedido.peso_total_kg || 0)} kg - R$ {(pedido.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <Badge className={pedido.status === "Faturado" ? "bg-blue-600" : pedido.status === "Em Expedição" || pedido.status === "Em Expedicao" ? "bg-orange-600" : "bg-indigo-600"}>{pedido.status}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button
            onClick={() => criarRomaneioMutation.mutate()}
            disabled={!contextoValido || !canCreateRomaneio || !motorista.trim() || !veiculo.trim() || !placa.trim() || pedidosSelecionadosIds.length === 0 || criarRomaneioMutation.isPending}
            className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            data-action="Romaneio.criar"
            data-permission="Expedicao.Romaneio.criar"
            data-context-required="true"
            data-sensitive="true"
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            {criarRomaneioMutation.isPending ? "Criando..." : `Criar Romaneio (${pedidosSelecionadosIds.length})`}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}