import React, { useMemo, useState } from "react";
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
import {
  planEntregasFromPedidosParaRomaneio,
  resolveEmpresaOperacionalExpedicao,
  resolvePedidoLegadoAposRomaneio,
  resolveRomaneioDespacho,
  selectPedidosParaRomaneio,
} from "@/components/lib/expedicaoFluxoOperacionalPolicy";

const sanitizeText = (value) => String(value || "").replace(/[<>]/g, "").replace(/javascript:/gi, "").trim();
const sanitizePlaca = (value) => sanitizeText(value).toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 8);

/**
 * INTEGRACAO COM ROMANEIO — Pedidos → Entregas (create/reuse) → romaneio canônico → despacho.
 * Policy: expedicaoFluxoOperacionalPolicy (sem módulo paralelo).
 */
export default function IntegracaoRomaneio({ pedidosSelecionados = [], onClose, windowMode = false }) {
  const [motorista, setMotorista] = useState("");
  const [veiculo, setVeiculo] = useState("");
  const [placa, setPlaca] = useState("");
  const [pedidosSelecionadosIds, setPedidosSelecionadosIds] = useState(
    (Array.isArray(pedidosSelecionados) ? pedidosSelecionados : [])
      .filter((p) => p?.id && p?.empresa_id)
      .map((p) => p.id),
  );
  const [checklist, setChecklist] = useState({
    documentos_ok: false,
    veiculo_ok: false,
    carga_conferida: false,
    combustivel_ok: false,
  });

  const queryClient = useQueryClient();
  const { empresaAtual, grupoAtual, filterInContext, createInContext, updateInContext } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const { user } = useUser();

  const storedEmpresaId = (() => {
    try { return localStorage.getItem("empresa_atual_id"); } catch { return null; }
  })();
  // Pedidos sem empresa_id (órfãos de snapshot) não definem empresa — evita falso contexto.
  const pedidosComEmpresa = (Array.isArray(pedidosSelecionados) ? pedidosSelecionados : [])
    .filter((p) => p?.empresa_id);
  const effectiveEmpresaId = resolveEmpresaOperacionalExpedicao({
    pedidosSelecionados: pedidosComEmpresa,
    empresaAtualId: empresaAtual?.id,
    userEmpresaAtualId: user?.empresa_atual_id,
    userEmpresaPadraoId: user?.empresa_padrao_id,
    storedEmpresaId,
  });
  const pedidoComGrupo = pedidosComEmpresa.find((p) => p?.group_id || p?.grupo_id)
    || pedidosSelecionados.find((p) => p?.group_id || p?.grupo_id);
  const effectiveGroupId = pedidoComGrupo?.group_id || pedidoComGrupo?.grupo_id || grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || user?.grupo_atual_id || (() => {
    try { return localStorage.getItem("group_atual_id"); } catch { return null; }
  })() || null;
  const contextoValido = Boolean(effectiveGroupId && effectiveEmpresaId);
  const canCreateRomaneio =
    hasPermission("Expedicao", "Romaneio", "criar") ||
    hasPermission("Expedicao", "Romaneios", "criar") ||
    hasPermission("Expedicao", "Entregas", "editar") ||
    hasPermission("Expedicao", "Entrega", "editar") ||
    hasPermission("Logistica", "Romaneios", "criar");
  const checklistCompleto =
    checklist.documentos_ok && checklist.veiculo_ok && checklist.carga_conferida && checklist.combustivel_ok;

  const auditRomaneio = async ({
    acao,
    sucesso = true,
    motivo = null,
    detalhes = {},
    dadosNovos = null,
    dadosAnteriores = null,
    failClosed = false,
  }) => {
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
        data_hora: new Date().toISOString(),
      });
    } catch (error) {
      if (failClosed) {
        throw new Error(`Falha ao auditar romaneio: ${error?.message || error}`);
      }
      console.warn("Falha ao auditar romaneio", error);
    }
  };

  const { data: pedidos = [] } = useQuery({
    queryKey: ["pedidos-romaneio", effectiveGroupId, effectiveEmpresaId],
    queryFn: () => filterInContext("Pedido", {}, "-created_date", 1000),
    enabled: contextoValido && canCreateRomaneio,
  });

  // Props do launchpad podem trazer pedidos já elegíveis enquanto a query ainda
  // carrega ou falha silenciosamente — unir fontes para não bloquear com seleção fantasma.
  const pedidosBase = useMemo(() => {
    const map = new Map();
    for (const row of [...(Array.isArray(pedidos) ? pedidos : []), ...(Array.isArray(pedidosSelecionados) ? pedidosSelecionados : [])]) {
      if (row?.id) map.set(String(row.id), row);
    }
    return [...map.values()];
  }, [pedidos, pedidosSelecionados]);

  const { data: entregasExistentes = [] } = useQuery({
    queryKey: ["entregas-romaneio-integracao", effectiveGroupId, effectiveEmpresaId],
    queryFn: () => filterInContext("Entrega", {}, "-created_date", 1000),
    enabled: contextoValido && canCreateRomaneio,
  });

  const { data: romaneiosExistentes = [] } = useQuery({
    queryKey: ["romaneios-integracao", effectiveGroupId, effectiveEmpresaId],
    queryFn: () => filterInContext("Romaneio", {}, "-created_date", 300),
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

  const pedidosElegiveis = useMemo(() => {
    if (!contextoValido) return [];
    try {
      return selectPedidosParaRomaneio(pedidosBase, {
        empresaId: effectiveEmpresaId,
        groupId: effectiveGroupId,
      });
    } catch {
      return [];
    }
  }, [pedidosBase, contextoValido, effectiveEmpresaId, effectiveGroupId]);

  const criarRomaneioMutation = useMutation({
    mutationFn: async () => {
      if (!contextoValido || !canCreateRomaneio) {
        await auditRomaneio({
          acao: "Romaneio.integracao_bloqueado",
          sucesso: false,
          motivo: !contextoValido ? "contexto_obrigatorio" : "permissao_negada",
          detalhes: { selecionados: pedidosSelecionadosIds.length },
        });
        throw new Error("Contexto e permissao sao obrigatorios para criar romaneio.");
      }

      const motoristaSanitizado = sanitizeText(motorista);
      const veiculoSanitizado = sanitizeText(veiculo);
      const placaSanitizada = sanitizePlaca(placa);
      if (!motoristaSanitizado || !veiculoSanitizado || !placaSanitizada || pedidosSelecionadosIds.length === 0) {
        throw new Error("Motorista, veiculo, placa e pelo menos um pedido sao obrigatorios.");
      }

      if (!checklistCompleto) {
        await auditRomaneio({
          acao: "Romaneio.integracao_bloqueado",
          sucesso: false,
          motivo: "checklist_incompleto",
          detalhes: { selecionados: pedidosSelecionadosIds.length },
        });
        throw new Error("Conclua o checklist de saida antes de criar o romaneio.");
      }

      if (!window.confirm(`Confirmar criacao do romaneio com ${pedidosSelecionadosIds.length} entrega(s)?`)) {
        await auditRomaneio({
          acao: "Romaneio.integracao_cancelado",
          sucesso: false,
          motivo: "confirmacao_cancelada",
          detalhes: { selecionados: pedidosSelecionadosIds.length },
        });
        throw new Error("Criacao cancelada pelo usuario.");
      }

      let plano;
      try {
        plano = planEntregasFromPedidosParaRomaneio({
          pedidos: pedidosBase,
          entregasExistentes,
          empresaId: effectiveEmpresaId,
          groupId: effectiveGroupId,
          selectedIds: pedidosSelecionadosIds,
        });
      } catch (selectionError) {
        await auditRomaneio({
          acao: "Romaneio.integracao_bloqueado",
          sucesso: false,
          motivo: "selecao_invalida",
          detalhes: { message: String(selectionError?.message || selectionError) },
        });
        throw selectionError;
      }

      const entregasDisponiveis = [...entregasExistentes];
      const createdEntregas = [];
      for (const seed of plano.creates) {
        const criada = await createInContext("Entrega", seed);
        createdEntregas.push(criada);
        entregasDisponiveis.push(criada);
      }

      const entregasParaDespacho = [
        ...plano.reuses,
        ...createdEntregas,
      ];

      const now = new Date().toISOString();
      const pesoTotal = plano.pedidos.reduce((sum, p) => sum + (p.peso_total_kg || 0), 0);
      const valorTotal = plano.pedidos.reduce((sum, p) => sum + (p.valor_total || 0), 0);

      let fluxo;
      try {
        fluxo = resolveRomaneioDespacho({
          entregasSelecionadas: entregasParaDespacho,
          empresaId: effectiveEmpresaId,
          groupId: effectiveGroupId,
          motorista: motoristaSanitizado,
          motorista_nome: motoristaSanitizado,
          veiculo: veiculoSanitizado,
          placa: placaSanitizada,
          checklist_saida: checklist,
          confirmed: true,
          now,
          usuario: user?.full_name || user?.email || "Sistema",
          usuario_id: user?.id || null,
          romaneiosExistentes,
          exigirChecklist: true,
        });
      } catch (fluxoError) {
        await auditRomaneio({
          acao: "Romaneio.integracao_bloqueado",
          sucesso: false,
          motivo: "fluxo_invalido",
          detalhes: { message: String(fluxoError?.message || fluxoError) },
        });
        throw fluxoError;
      }

      if (fluxo.reuse) {
        await auditRomaneio({
          acao: "Romaneio.integracao.retry",
          sucesso: true,
          dadosNovos: { reuse_id: fluxo.reuse.id },
        });
        return fluxo.reuse;
      }

      const romaneio = await createInContext("Romaneio", {
        ...fluxo.romaneioRecord,
        peso_total_kg: pesoTotal,
        valor_total_mercadorias: valorTotal,
        responsavel_criacao: user?.full_name || user?.email || "Sistema",
      });

      const entregasById = new Map(entregasParaDespacho.map((e) => [String(e.id), { ...e }]));
      const patchesComRomaneio = fluxo.despachoPatches.map((item) => {
        const historico = Array.isArray(item.patch.historico_status) ? [...item.patch.historico_status] : [];
        if (historico.length > 0) {
          historico[historico.length - 1] = {
            ...historico[historico.length - 1],
            observacao: `Despacho via IntegracaoRomaneio ${romaneio.numero_romaneio || romaneio.id}`,
          };
        }
        return {
          entregaId: item.entregaId,
          patch: {
            ...item.patch,
            romaneio_id: romaneio.id,
            historico_status: historico,
          },
        };
      });

      const applied = [];
      try {
        for (const item of patchesComRomaneio) {
          const before = entregasById.get(String(item.entregaId));
          applied.push({ id: item.entregaId, before });
          await updateInContext("Entrega", item.entregaId, item.patch);
        }
      } catch (persistError) {
        for (let i = applied.length - 1; i >= 0; i -= 1) {
          const snap = applied[i];
          try {
            await updateInContext("Entrega", snap.id, {
              status: snap.before.status,
              romaneio_id: snap.before.romaneio_id || null,
              sequencia_rota: snap.before.sequencia_rota || null,
              motorista_id: snap.before.motorista_id || null,
              motorista: snap.before.motorista || null,
              veiculo: snap.before.veiculo || null,
              placa: snap.before.placa || null,
              data_saida: snap.before.data_saida || null,
              historico_status: snap.before.historico_status || [],
              group_id: snap.before.group_id || effectiveGroupId,
              grupo_id: snap.before.grupo_id || effectiveGroupId,
              empresa_id: snap.before.empresa_id || effectiveEmpresaId,
            });
          } catch (rollbackError) {
            console.error("Falha no rollback de despacho (IntegracaoRomaneio)", rollbackError);
          }
        }
        await auditRomaneio({
          acao: "Romaneio.integracao.rollback",
          sucesso: false,
          motivo: "persistencia_parcial",
          dadosNovos: {
            romaneio_id: romaneio.id,
            erro: String(persistError?.message || persistError),
            rolled_back: applied.map((a) => a.id),
          },
        });
        throw persistError;
      }

      // Side-effect legado Pedido → Em Trânsito (contrato Codex; patch descritivo).
      const pedidosLegadoAplicados = [];
      try {
        for (const pedido of plano.pedidos) {
          const legadoPatch = resolvePedidoLegadoAposRomaneio({
            pedidoId: pedido.id,
            groupId: effectiveGroupId,
            empresaId: pedido.empresa_id || effectiveEmpresaId,
            romaneioId: romaneio.id,
          });
          if (!legadoPatch) continue;
          const { _legado_side_effect, ...patch } = legadoPatch;
          await updateInContext("Pedido", pedido.id, {
            ...patch,
            historico_status: [
              ...(pedido.historico_status || []),
              {
                status: patch.status,
                data_hora: now,
                usuario: user?.full_name || user?.email || "Sistema",
                usuario_id: user?.id,
                observacao: `Romaneio ${romaneio.id} criado para entrega.`,
                _legado_side_effect,
              },
            ],
          });
          pedidosLegadoAplicados.push(pedido.id);
        }
      } catch (legadoError) {
        await auditRomaneio({
          acao: "Romaneio.integracao.parcial",
          sucesso: false,
          motivo: "pedido_legado_parcial",
          failClosed: false,
          dadosNovos: {
            romaneio_id: romaneio.id,
            pedidos_ok: pedidosLegadoAplicados,
            erro: String(legadoError?.message || legadoError),
          },
        });
        throw new Error(
          `Estado parcial: romaneio/despacho persistido, mas Pedido legado incompleto (${pedidosLegadoAplicados.length}/${plano.pedidos.length}). ${legadoError?.message || legadoError}`,
        );
      }

      await auditRomaneio({
        acao: "Romaneio.integracao",
        failClosed: true,
        detalhes: {
          romaneio_id: romaneio.id,
          entregas: entregasParaDespacho.length,
          creates: createdEntregas.length,
          reuses: plano.reuses.length,
        },
        dadosNovos: romaneio,
      });
      return romaneio;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos-romaneio"] });
      queryClient.invalidateQueries({ queryKey: ["entregas"] });
      queryClient.invalidateQueries({ queryKey: ["entregas-romaneio-integracao"] });
      queryClient.invalidateQueries({ queryKey: ["romaneios"] });
      queryClient.invalidateQueries({ queryKey: ["romaneios-integracao"] });
      toast.success(`Romaneio criado com ${pedidosSelecionadosIds.length} entrega(s).`);
      onClose?.();
    },
    onError: (error) => {
      if (error?.message !== "Criacao cancelada pelo usuario.") {
        toast.error(error?.message || "Erro ao criar romaneio.");
      }
    },
  });

  const togglePedido = (pedidoId) => {
    setPedidosSelecionadosIds((prev) =>
      prev.includes(pedidoId) ? prev.filter((id) => id !== pedidoId) : [...prev, pedidoId],
    );
  };

  const pedidosSelecionadosLista = pedidosElegiveis.filter((p) => pedidosSelecionadosIds.includes(p.id));
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
        <p className="text-sm opacity-90">Agrupe pedidos, gere entregas e envie para rota</p>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        {(!contextoValido || !canCreateRomaneio) && (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="p-4 text-sm text-yellow-800">
              {!contextoValido
                ? "Contexto incompleto: informe grupo e empresa operacional (pedido com empresa_id ou selecao de empresa) para criar romaneio."
                : "Seu perfil nao tem permissao para criar romaneio."}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="flex items-center gap-2"><User className="w-4 h-4" />Motorista *</Label>
            <Input
              value={motorista}
              onChange={(e) => setMotorista(sanitizeText(e.target.value))}
              placeholder="Nome do motorista"
              list="motoristas-list"
              disabled={!contextoValido || !canCreateRomaneio}
            />
            <datalist id="motoristas-list">
              {motoristas.map((m) => <option key={m.id} value={sanitizeText(m.nome)} />)}
            </datalist>
          </div>

          <div>
            <Label className="flex items-center gap-2"><Truck className="w-4 h-4" />Veiculo *</Label>
            <Input
              value={veiculo}
              onChange={(e) => setVeiculo(sanitizeText(e.target.value))}
              placeholder="Modelo do veiculo"
              list="veiculos-list"
              disabled={!contextoValido || !canCreateRomaneio}
            />
            <datalist id="veiculos-list">
              {veiculos.map((v) => <option key={v.id} value={sanitizeText(v.modelo)} />)}
            </datalist>
          </div>

          <div>
            <Label>Placa *</Label>
            <Input
              value={placa}
              onChange={(e) => setPlaca(sanitizePlaca(e.target.value))}
              placeholder="ABC-1234"
              maxLength={8}
              disabled={!contextoValido || !canCreateRomaneio}
            />
          </div>
        </div>

        <Card className="bg-slate-50 border-slate-200">
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Checklist de saida</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-2 pb-4">
            {[
              ["documentos_ok", "Documentos OK"],
              ["veiculo_ok", "Veiculo OK"],
              ["carga_conferida", "Carga conferida"],
              ["combustivel_ok", "Combustivel OK"],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={Boolean(checklist[key])}
                  onCheckedChange={(checked) => setChecklist((prev) => ({ ...prev, [key]: Boolean(checked) }))}
                  disabled={!contextoValido || !canCreateRomaneio}
                />
                {label}
              </label>
            ))}
          </CardContent>
        </Card>

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
            <CardTitle className="text-base">Selecionar Pedidos ({pedidosElegiveis.length} disponivel(is))</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {pedidosElegiveis.map((pedido) => (
                <div
                  key={pedido.id}
                  className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer"
                  onClick={() => togglePedido(pedido.id)}
                >
                  <Checkbox checked={pedidosSelecionadosIds.includes(pedido.id)} onCheckedChange={() => togglePedido(pedido.id)} />
                  <div className="flex-1">
                    <p className="font-semibold text-sm">#{sanitizeText(pedido.numero_pedido)} - {sanitizeText(pedido.cliente_nome)}</p>
                    <p className="text-xs text-slate-600">
                      {sanitizeText(pedido.endereco_entrega_principal?.cidade)} - {(pedido.peso_total_kg || 0)} kg - R$ {(pedido.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <Badge className={pedido.status === "Faturado" ? "bg-blue-600" : pedido.status === "Em Expedição" || pedido.status === "Em Expedicao" ? "bg-orange-600" : "bg-indigo-600"}>
                    {pedido.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button
            onClick={() => criarRomaneioMutation.mutate()}
            disabled={
              !contextoValido ||
              !canCreateRomaneio ||
              !checklistCompleto ||
              !motorista.trim() ||
              !veiculo.trim() ||
              !placa.trim() ||
              pedidosSelecionadosIds.length === 0 ||
              criarRomaneioMutation.isPending
            }
            className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            data-action="Romaneio.integracao"
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
