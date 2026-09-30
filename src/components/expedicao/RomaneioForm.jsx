import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import FormWrapper from "@/components/common/FormWrapper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { FileText, Truck, CheckCircle, MapPin } from "lucide-react";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { useUser } from "@/components/lib/UserContext";
import { filterEntregasList, listCidadesFromEntregas } from "@/components/lib/expedicaoEntregaPolicy";
import {
  resolveRomaneioDespacho,
  selectEntregasParaRomaneio,
} from "@/components/lib/expedicaoFluxoOperacionalPolicy";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * Formulário para Geração de Romaneio
 */
export default function RomaneioForm({ isOpen, onClose, empresaId, windowMode = false }) {
  const containerClass = windowMode ? "w-full h-full flex flex-col overflow-hidden" : "";
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { empresaAtual, grupoAtual, filterInContext, createInContext, updateInContext } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const { user } = useUser();
  const effectiveEmpresaId = empresaId || empresaAtual?.id || null;
  const effectiveGroupId = grupoAtual?.id || empresaAtual?.group_id || null;
  const contextoValido = Boolean(effectiveGroupId && effectiveEmpresaId);
  const canGerarRomaneio =
    hasPermission("Expedicao", "Romaneios", "criar") ||
    hasPermission("Expedicao", "Romaneio", "criar") ||
    hasPermission("Expedicao", "Entrega", "editar") ||
    hasPermission("Logistica", "Romaneios", "criar");

  const [formData, setFormData] = useState({
    motorista: "",
    motorista_id: "",
    motorista_email: "",
    motorista_telefone: "",
    veiculo: "",
    placa: "",
    tipo_veiculo: "Caminhão",
    instrucoes_motorista: "",
    entregas_selecionadas: []
  });
  const [cidadeFiltro, setCidadeFiltro] = useState("todas");
  const [soFuturasRomaneio, setSoFuturasRomaneio] = useState(false);
  const [dataDeRomaneio, setDataDeRomaneio] = useState("");
  const [dataAteRomaneio, setDataAteRomaneio] = useState("");
  const [clienteIdRomaneio, setClienteIdRomaneio] = useState("todos");

  const [checklist, setChecklist] = useState({
    documentos_ok: false,
    veiculo_ok: false,
    carga_conferida: false,
    combustivel_ok: false,
    observacoes: ""
  });
  const checklistCompleto = checklist.documentos_ok && checklist.veiculo_ok && checklist.carga_conferida && checklist.combustivel_ok;

  const { data: motoristas = [] } = useQuery({
    queryKey: ['motoristas-romaneio', effectiveEmpresaId, effectiveGroupId],
    queryFn: () => filterInContext('Motorista', {}, 'nome_completo', 200),
    enabled: (isOpen || windowMode) && contextoValido && canGerarRomaneio,
  });

  const { data: entregas = [] } = useQuery({
    queryKey: ['entregas-para-romaneio', effectiveEmpresaId, effectiveGroupId],
    queryFn: async () => {
      const todas = await filterInContext('Entrega', {}, '-created_date', 500);
      return todas.filter(e =>
        (!effectiveEmpresaId || e.empresa_id === effectiveEmpresaId) &&
        e.status === "Pronto para Expedir" &&
        !e.romaneio_id
      );
    },
    enabled: (isOpen || windowMode) && contextoValido && canGerarRomaneio,
  });

  const auditRomaneio = async ({ acao, sucesso = true, motivo = null, dadosAnteriores = null, dadosNovos = null }) => {
    try {
      await base44.entities.AuditLog.create({
        acao,
        modulo: "Expedicao",
        entidade: "Romaneio",
        tipo_auditoria: sucesso ? "operacional" : "seguranca",
        usuario_id: user?.id || user?.email || null,
        usuario_nome: user?.full_name || user?.email || "Sistema",
        group_id: effectiveGroupId,
        grupo_id: effectiveGroupId,
        empresa_id: effectiveEmpresaId,
        dados_anteriores: dadosAnteriores,
        dados_novos: dadosNovos,
        resultado: sucesso ? "sucesso" : "bloqueado",
        motivo,
        data_hora: new Date().toISOString()
      });
    } catch (error) {
      console.warn("Falha ao auditar romaneio", error);
    }
  };

  const toggleEntrega = (entregaId) => {
    if (formData.entregas_selecionadas.includes(entregaId)) {
      setFormData({
        ...formData,
        entregas_selecionadas: formData.entregas_selecionadas.filter(id => id !== entregaId)
      });
    } else {
      setFormData({
        ...formData,
        entregas_selecionadas: [...formData.entregas_selecionadas, entregaId]
      });
    }
  };

  const gerarRomaneioMutation = useMutation({
    mutationFn: async () => {
      if (!contextoValido) {
        await auditRomaneio({ acao: "Romaneio.gerar.bloqueado", sucesso: false, motivo: "contexto_obrigatorio" });
        throw new Error("Selecione a empresa da expedicao antes de gerar o romaneio.");
      }

      if (!canGerarRomaneio) {
        await auditRomaneio({ acao: "Romaneio.gerar.bloqueado", sucesso: false, motivo: "permissao_negada" });
        throw new Error("Voce nao tem permissao para gerar romaneio.");
      }

      if (!checklistCompleto) {
        await auditRomaneio({ acao: "Romaneio.gerar.bloqueado", sucesso: false, motivo: "checklist_incompleto" });
        throw new Error("Conclua o checklist de saida antes de gerar o romaneio.");
      }

      let entregasSelecionadas;
      try {
        entregasSelecionadas = selectEntregasParaRomaneio(entregas, {
          empresaId: effectiveEmpresaId,
          groupId: effectiveGroupId,
          selectedIds: formData.entregas_selecionadas,
          exigirSelecao: true,
        });
      } catch (selectionError) {
        await auditRomaneio({
          acao: "Romaneio.gerar.bloqueado",
          sucesso: false,
          motivo: "selecao_invalida",
          dadosNovos: { message: String(selectionError?.message || selectionError) },
        });
        throw selectionError;
      }

      if (!String(formData.motorista_id || '').trim() && !String(formData.motorista || '').trim()) {
        throw new Error("Informe o motorista.");
      }
      if (!String(formData.veiculo || '').trim() && !String(formData.placa || '').trim()) {
        throw new Error("Informe o veiculo ou a placa.");
      }

      const pesoTotal = entregasSelecionadas.reduce((sum, e) => sum + (e.peso_total_kg || 0), 0);
      const volumesTotal = entregasSelecionadas.reduce((sum, e) => sum + (e.volumes || 0), 0);
      const valorTotal = entregasSelecionadas.reduce((sum, e) => sum + (e.valor_mercadoria || 0), 0);
      const now = new Date().toISOString();
      const groupId = effectiveGroupId || entregasSelecionadas[0].group_id || null;
      const selectedEmpresaId = effectiveEmpresaId || entregasSelecionadas[0].empresa_id || null;

      const motoristaCadastro = motoristas.find((m) => String(m.id) === String(formData.motorista_id));
      const motoristaNome = motoristaCadastro?.nome_completo || motoristaCadastro?.nome || formData.motorista;
      const motoristaEmail = motoristaCadastro?.email || formData.motorista_email || '';
      const motoristaTelefone = motoristaCadastro?.whatsapp || motoristaCadastro?.telefone || formData.motorista_telefone;

      const fluxo = resolveRomaneioDespacho({
        entregasSelecionadas,
        empresaId: selectedEmpresaId,
        groupId,
        motorista_id: formData.motorista_id || motoristaCadastro?.id || null,
        motorista_nome: motoristaNome,
        motorista: motoristaNome,
        veiculo: formData.veiculo,
        placa: formData.placa,
        tipo_veiculo: formData.tipo_veiculo,
        instrucoes_motorista: formData.instrucoes_motorista,
        checklist_saida: checklist,
        confirmed: true,
        now,
        usuario: user?.full_name || user?.email || "Sistema",
        usuario_id: user?.id || user?.email || null,
        romaneiosExistentes: [],
      });

      if (fluxo.reuse) {
        await auditRomaneio({
          acao: "Romaneio.gerar.retry",
          sucesso: true,
          dadosNovos: { reuse_id: fluxo.reuse.id },
        });
        return fluxo.reuse;
      }

      const romaneio = await createInContext("Romaneio", {
        ...fluxo.romaneioRecord,
        motorista_email: motoristaEmail,
        motorista_telefone: motoristaTelefone,
        quantidade_volumes: volumesTotal,
        peso_total_kg: pesoTotal,
        valor_total_mercadoria: valorTotal,
        entregas_realizadas: 0,
        entregas_frustradas: 0
      });

      const entregasById = new Map(entregasSelecionadas.map((e) => [String(e.id), { ...e }]));
      const patchesComRomaneio = fluxo.despachoPatches.map((item) => {
        const historico = Array.isArray(item.patch.historico_status) ? [...item.patch.historico_status] : [];
        if (historico.length > 0) {
          historico[historico.length - 1] = {
            ...historico[historico.length - 1],
            observacao: "Incluido no romaneio " + (romaneio.numero_romaneio || romaneio.id),
          };
        }
        return {
          entregaId: item.entregaId,
          patch: {
            ...item.patch,
            romaneio_id: romaneio.id,
            sequencia_rota: item.patch.sequencia_rota,
            motorista_email: motoristaEmail,
            motorista_telefone: motoristaTelefone,
            motorista_usuario_id: motoristaCadastro?.usuario_id || null,
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
              data_saida: snap.before.data_saida || null,
              historico_status: snap.before.historico_status || [],
              group_id: snap.before.group_id || groupId,
              grupo_id: snap.before.grupo_id || groupId,
              empresa_id: snap.before.empresa_id || selectedEmpresaId,
            });
          } catch (rollbackError) {
            console.error("Falha no rollback de despacho", rollbackError);
          }
        }
        await auditRomaneio({
          acao: "Romaneio.gerar.rollback",
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

      await auditRomaneio({
        acao: "Romaneio.gerar",
        sucesso: true,
        dadosAnteriores: { entregas: entregasSelecionadas.map(e => ({ id: e.id, status: e.status, romaneio_id: e.romaneio_id || null })) },
        dadosNovos: { romaneio_id: romaneio.id, numero_romaneio: romaneio.numero_romaneio, entregas_ids: formData.entregas_selecionadas }
      });

      return romaneio;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entregas'] });
      queryClient.invalidateQueries({ queryKey: ['romaneios'] });
      queryClient.invalidateQueries({ queryKey: ['entregas-para-romaneio'] });
      toast({ title: "Romaneio gerado com sucesso!" });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Erro ao gerar romaneio",
        description: error?.message || "Nao foi possivel gerar o romaneio.",
        variant: "destructive"
      });
    },
  });

  const unifiedSubmit = React.useCallback(async () => {
    if (!contextoValido) {
      await auditRomaneio({ acao: "Romaneio.gerar.bloqueado", sucesso: false, motivo: "contexto_obrigatorio" });
      toast({ title: "Contexto obrigatorio", description: "Selecione um grupo ou empresa antes de gerar o romaneio.", variant: "destructive" });
      return;
    }

    if (!canGerarRomaneio) {
      await auditRomaneio({ acao: "Romaneio.gerar.bloqueado", sucesso: false, motivo: "permissao_negada" });
      toast({ title: "Permissao negada", description: "Voce nao tem permissao para gerar romaneio.", variant: "destructive" });
      return;
    }

    if (!window.confirm("Confirmar inclusao do romaneio com " + formData.entregas_selecionadas.length + " entrega(s)?")) {
      await auditRomaneio({ acao: "Romaneio.gerar.cancelado", sucesso: false, motivo: "confirmacao_cancelada" });
      return;
    }

    gerarRomaneioMutation.mutate();
  }, [auditRomaneio, canGerarRomaneio, contextoValido, formData.entregas_selecionadas.length, gerarRomaneioMutation, toast]);
  const cidadesRomaneio = listCidadesFromEntregas(entregas);
  const clientesRomaneio = React.useMemo(() => {
    const map = new Map();
    for (const e of entregas) {
      if (e?.cliente_id && !map.has(String(e.cliente_id))) {
        map.set(String(e.cliente_id), e.cliente_nome || e.cliente_id);
      }
    }
    return [...map.entries()].map(([id, nome]) => ({ id, nome }));
  }, [entregas]);
  const entregasFiltradas = filterEntregasList(entregas, {
    empresaId: effectiveEmpresaId,
    cidade: cidadeFiltro !== "todas" ? cidadeFiltro : "",
    clienteId: clienteIdRomaneio !== "todos" ? clienteIdRomaneio : "",
    dataDe: dataDeRomaneio,
    dataAte: dataAteRomaneio,
    soFuturas: soFuturasRomaneio,
  });
  const entregasSelecionadas = entregasFiltradas.filter(e => formData.entregas_selecionadas.includes(e.id));

  const content = (
    <div className={containerClass} data-permission="Expedicao.Romaneios.criar" data-context-required="true">
      {windowMode && (
        <div className="flex-shrink-0 p-6 border-b">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="w-6 h-6 text-purple-600" />
            Gerar Romaneio de Entrega
          </h2>
        </div>
      )}
      
      <FormWrapper onSubmit={unifiedSubmit} externalData={{...formData, checklist}} className={`space-y-6 ${windowMode ? 'flex-1 overflow-auto p-6' : ''}`}>
          {/* Dados do Motorista */}
          <Card>
            <CardHeader className="bg-blue-50 border-b">
              <CardTitle className="text-base">Dados do Motorista e Veículo</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Motorista *</Label>
                  <select
                    value={formData.motorista_id}
                    onChange={(e) => {
                      const selected = motoristas.find((m) => String(m.id) === String(e.target.value));
                      setFormData({
                        ...formData,
                        motorista_id: e.target.value,
                        motorista: selected?.nome_completo || selected?.nome || '',
                        motorista_email: selected?.email || '',
                        motorista_telefone: selected?.whatsapp || selected?.telefone || formData.motorista_telefone,
                      });
                    }}
                    required
                    className="mt-2 w-full border rounded-md px-3 py-2 text-sm"
                    data-permission="Expedicao.Romaneios.criar"
                    data-context-required="true"
                  >
                    <option value="">Selecione o motorista...</option>
                    {motoristas.map((m) => (
                      <option key={m.id} value={m.id}>{m.nome_completo || m.nome || m.id}</option>
                    ))}
                  </select>
                  {!motoristas.length ? (
                    <Input
                      value={formData.motorista}
                      onChange={(e) => setFormData({ ...formData, motorista: e.target.value })}
                      required
                      className="mt-2"
                      placeholder="Nome do motorista (cadastro vazio)"
                    />
                  ) : null}
                </div>
                <div>
                  <Label>Telefone Motorista</Label>
                  <Input
                    value={formData.motorista_telefone}
                    onChange={(e) => setFormData({ ...formData, motorista_telefone: e.target.value })}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label>Veículo</Label>
                  <Input
                    value={formData.veiculo}
                    onChange={(e) => setFormData({ ...formData, veiculo: e.target.value })}
                    placeholder="Ex: Caminhão Iveco"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label>Placa</Label>
                  <Input
                    value={formData.placa}
                    onChange={(e) => setFormData({ ...formData, placa: e.target.value })}
                    placeholder="ABC-1234"
                    className="mt-2"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Seleção de Entregas */}
          <Card>
            <CardHeader className="bg-green-50 border-b">
              <CardTitle className="text-base">
                Selecionar Entregas ({formData.entregas_selecionadas.length} selecionadas)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-3" data-testid="romaneio-entregas-filtros" data-action="Expedicao.romaneio.filtro-entregas">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <Select value={cidadeFiltro} onValueChange={setCidadeFiltro}>
                  <SelectTrigger className="h-8" data-testid="romaneio-filtro-cidade">
                    <SelectValue placeholder="Cidade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as cidades</SelectItem>
                    {cidadesRomaneio.map((cidade) => (
                      <SelectItem key={cidade} value={cidade}>{cidade}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={clienteIdRomaneio} onValueChange={setClienteIdRomaneio}>
                  <SelectTrigger className="h-8" data-testid="romaneio-filtro-cliente">
                    <SelectValue placeholder="Cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os clientes</SelectItem>
                    {clientesRomaneio.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="date"
                  value={dataDeRomaneio}
                  onChange={(e) => setDataDeRomaneio(e.target.value)}
                  className="h-8"
                  data-testid="romaneio-filtro-data-de"
                  aria-label="Data entrega de"
                />
                <Input
                  type="date"
                  value={dataAteRomaneio}
                  onChange={(e) => setDataAteRomaneio(e.target.value)}
                  className="h-8"
                  data-testid="romaneio-filtro-data-ate"
                  aria-label="Data entrega até"
                />
                <label className="flex items-center gap-2 text-xs text-slate-700 h-8 px-1" data-testid="romaneio-filtro-futuras">
                  <Checkbox
                    checked={soFuturasRomaneio}
                    onCheckedChange={(checked) => setSoFuturasRomaneio(checked === true)}
                  />
                  Só entregas futuras
                </label>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="w-12">
                      <Checkbox
                        checked={entregasFiltradas.length > 0 && formData.entregas_selecionadas.length === entregasFiltradas.length}
                        disabled={!contextoValido || !canGerarRomaneio}
                        data-permission="Expedicao.Romaneios.criar"
                        data-context-required="true"
                        onCheckedChange={(checked) => {
                          setFormData({
                            ...formData,
                            entregas_selecionadas: checked ? entregasFiltradas.map(e => e.id) : []
                          });
                        }}
                      />
                    </TableHead>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Destino</TableHead>
                    <TableHead>Volumes</TableHead>
                    <TableHead>Peso</TableHead>
                    <TableHead>Prioridade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entregasFiltradas.map(entrega => (
                    <TableRow key={entrega.id}>
                      <TableCell>
                        <Checkbox
                          checked={formData.entregas_selecionadas.includes(entrega.id)}
                          disabled={!contextoValido || !canGerarRomaneio}
                          data-permission="Expedicao.Romaneios.criar"
                          data-context-required="true"
                          onCheckedChange={() => toggleEntrega(entrega.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{entrega.numero_pedido || '-'}</TableCell>
                      <TableCell>{entrega.cliente_nome}</TableCell>
                      <TableCell className="text-sm">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-blue-600" />
                          {entrega.endereco_entrega_completo?.cidade}/{entrega.endereco_entrega_completo?.estado}
                        </div>
                      </TableCell>
                      <TableCell>{entrega.volumes || 0}</TableCell>
                      <TableCell>{entrega.peso_total_kg?.toFixed(1) || 0} kg</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={
                          entrega.prioridade === 'Urgente' ? 'border-red-500 text-red-700' :
                          entrega.prioridade === 'Alta' ? 'border-orange-500 text-orange-700' :
                          'border-slate-400'
                        }>
                          {entrega.prioridade}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {entregas.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  <Truck className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p>Nenhuma entrega pronta para romaneio</p>
                </div>
              )}
              {entregas.length > 0 && entregasFiltradas.length === 0 && (
                <div className="text-center py-8 text-slate-500 text-sm" data-testid="romaneio-entregas-filtro-vazio">
                  Nenhuma entrega corresponde aos filtros de cidade/futuras.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Resumo */}
          {entregasSelecionadas.length > 0 && (
            <Card className="bg-purple-50 border-purple-200">
              <CardContent className="p-5">
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-xs text-purple-700">Entregas</p>
                    <p className="text-2xl font-bold text-purple-900">{entregasSelecionadas.length}</p>
                  </div>
                  <div>
                    <p className="text-xs text-purple-700">Volumes</p>
                    <p className="text-2xl font-bold text-purple-900">
                      {entregasSelecionadas.reduce((sum, e) => sum + (e.volumes || 0), 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-purple-700">Peso Total</p>
                    <p className="text-2xl font-bold text-purple-900">
                      {entregasSelecionadas.reduce((sum, e) => sum + (e.peso_total_kg || 0), 0).toFixed(1)} kg
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-purple-700">Valor</p>
                    <p className="text-xl font-bold text-purple-900">
                      R$ {entregasSelecionadas.reduce((sum, e) => sum + (e.valor_mercadoria || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Checklist */}
          <Card>
            <CardHeader className="bg-orange-50 border-b">
              <CardTitle className="text-base">Checklist de Saída</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-3">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={checklist.documentos_ok}
                  onCheckedChange={(v) => setChecklist({ ...checklist, documentos_ok: v })}
                />
                <Label>Documentos conferidos (NF-e, romaneio, etc.)</Label>
              </div>
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={checklist.veiculo_ok}
                  onCheckedChange={(v) => setChecklist({ ...checklist, veiculo_ok: v })}
                />
                <Label>Veículo em boas condições</Label>
              </div>
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={checklist.carga_conferida}
                  onCheckedChange={(v) => setChecklist({ ...checklist, carga_conferida: v })}
                />
                <Label>Carga conferida e amarrada</Label>
              </div>
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={checklist.combustivel_ok}
                  onCheckedChange={(v) => setChecklist({ ...checklist, combustivel_ok: v })}
                />
                <Label>Combustível suficiente</Label>
              </div>
              <div className="mt-3">
                <Label>Observações do Checklist</Label>
                <Textarea
                  value={checklist.observacoes}
                  onChange={(e) => setChecklist({ ...checklist, observacoes: e.target.value })}
                  rows={2}
                  className="mt-2"
                />
              </div>
            </CardContent>
          </Card>

          {/* Instruções */}
          <div>
            <Label>Instruções para o Motorista</Label>
            <Textarea
              value={formData.instrucoes_motorista}
              onChange={(e) => setFormData({ ...formData, instrucoes_motorista: e.target.value })}
              rows={3}
              placeholder="Observações e instruções especiais..."
              className="mt-2"
            />
          </div>

          {/* Botões */}
          <div className="flex gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={
                !contextoValido ||
                !canGerarRomaneio ||
                !checklistCompleto ||
                !formData.motorista ||
                formData.entregas_selecionadas.length === 0 ||
                gerarRomaneioMutation.isPending
              }
              data-action="Romaneio.gerar"
              data-permission="Expedicao.Romaneios.criar"
              data-context-required="true"
              data-sensitive="true"
              className="flex-1 bg-purple-600 hover:bg-purple-700"
            >
              {gerarRomaneioMutation.isPending ? 'Gerando...' : 'Gerar Romaneio'}
            </Button>
          </div>
        </FormWrapper>
      </div>
    );

  if (windowMode) {
    return content;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        {!windowMode && (
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-6 h-6 text-purple-600" />
              Gerar Romaneio de Entrega
            </DialogTitle>
          </DialogHeader>
        )}
        {content}
      </DialogContent>
    </Dialog>
  );
}
