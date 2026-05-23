import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { CheckCircle, XCircle, AlertTriangle, Package, Camera, QrCode, List } from "lucide-react";
import { useUser } from "@/components/lib/UserContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";

import ScannerQRCode from './ScannerQRCode'; // Import the new ScannerQRCode component

/**
 * Separação e Conferência de Itens (Picking) para Entregas
 */
export default function SeparacaoConferencia({ entregaId, pedido, empresaId, onClose, windowMode = false }) {
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { empresaAtual, grupoAtual, filterInContext, createInContext, updateInContext } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const contextoBaseValido = Boolean(grupoAtual?.id || empresaAtual?.id || empresaId);
  const canConcluirSeparacao = hasPermission("Expedicao", "Entrega", "editar") ||
    hasPermission("Expedicao", "Separacao", "criar") ||
    hasPermission("Expedicao", "Separacao", "editar");

  const [activeTab, setActiveTab] = useState("scanner");
  
  const containerClass = windowMode ? "w-full h-full flex flex-col overflow-auto" : "space-y-6";

  // Fetch the delivery details (only if entregaId provided and no pedido)
  const { data: entrega, isLoading, isError, error } = useQuery({
    queryKey: ['entrega', entregaId],
    queryFn: async () => {
      const entregas = await filterInContext("Entrega", {}, "-created_date", 500);
      return entregas.find(e => e.id === entregaId);
    },
    enabled: !!entregaId && !pedido && contextoBaseValido && canConcluirSeparacao,
  });

  const [itens, setItens] = useState([]);

  // Use pedido if provided, otherwise use entrega
  const dadosParaSeparacao = pedido || entrega;
  const effectiveEmpresaId = dadosParaSeparacao?.empresa_id || empresaId || empresaAtual?.id || null;
  const effectiveGroupId = dadosParaSeparacao?.group_id || dadosParaSeparacao?.grupo_id || grupoAtual?.id || empresaAtual?.group_id || null;
  const contextoValido = Boolean(effectiveGroupId || effectiveEmpresaId);

  const auditarSeparacao = async ({ acao, descricao, sucesso = true, dadosNovos = {}, dadosAnteriores = null, registroId = null }) => {
    try {
      await base44.entities.AuditLog.create({
        usuario: user?.full_name || user?.email || "Usuario",
        usuario_id: user?.id,
        acao,
        modulo: "Expedicao",
        tipo_auditoria: sucesso ? "operacional" : "seguranca",
        entidade: "SeparacaoConferencia",
        registro_id: registroId || dadosParaSeparacao?.id || entregaId || pedido?.id,
        descricao,
        empresa_id: effectiveEmpresaId,
        group_id: effectiveGroupId,
        grupo_id: effectiveGroupId,
        sucesso,
        dados_anteriores: dadosAnteriores,
        dados_novos: dadosNovos,
        data_hora: new Date().toISOString(),
      });
    } catch (auditError) {
      console.warn("Falha ao auditar separacao/conferencia:", auditError);
    }
  };

  useEffect(() => {
    if (dadosParaSeparacao?.itens_revenda && dadosParaSeparacao.itens_revenda.length > 0) {
      const initialItens = dadosParaSeparacao.itens_revenda.map(i => ({
        ...i,
        quantidade_pedida: i.quantidade,
        quantidade_separada: 0,
        status_item: "aguardando",
        divergencia: false,
        observacao_item: "",
      }));
      setItens(initialItens);
    } else if ((entregaId || pedido) && !isLoading && !dadosParaSeparacao) {
      // If no delivery found or items array is empty
      toast({
        title: "Nenhum dado encontrado",
        description: "Não foi possível carregar os itens.",
        variant: "destructive",
      });
    }
  }, [dadosParaSeparacao, entregaId, pedido, isLoading, toast]);

  const [checklist, setChecklist] = useState({
    conferiu_quantidade: false,
    conferiu_qualidade: false,
    conferiu_embalagem: false,
    conferiu_etiquetas: false,
    conferiu_documentos: false,
    observacoes_checklist: ""
  });

  const criarSeparacaoMutation = useMutation({
    mutationFn: async () => {
      if (!dadosParaSeparacao) {
        throw new Error("Dados não disponíveis para criar separação.");
      }
      if (!contextoValido) {
        await auditarSeparacao({
          acao: "SeparacaoConferencia.bloqueado",
          descricao: "Tentativa de concluir separacao sem contexto grupo/empresa.",
          sucesso: false,
          dadosNovos: { motivo: "contexto_obrigatorio" },
        });
        throw new Error("Contexto multiempresa obrigatorio para concluir separacao.");
      }
      if (!canConcluirSeparacao) {
        await auditarSeparacao({
          acao: "SeparacaoConferencia.bloqueado",
          descricao: "Tentativa de concluir separacao sem permissao.",
          sucesso: false,
          dadosNovos: { motivo: "permissao_negada" },
        });
        throw new Error("Sem permissao para concluir separacao/conferencia.");
      }

      const temDivergencia = itens.some(i => i.divergencia);
      
      const separacao = await createInContext("SeparacaoConferencia", {
        group_id: effectiveGroupId,
        grupo_id: effectiveGroupId,
        empresa_id: effectiveEmpresaId,
        numero_separacao: `SEP-${Date.now()}`,
        pedido_id: dadosParaSeparacao.id,
        numero_pedido: dadosParaSeparacao.numero_pedido || dadosParaSeparacao.numero_entrega,
        cliente_id: dadosParaSeparacao.cliente_id,
        cliente_nome: dadosParaSeparacao.cliente_nome,
        tipo: "conferencia",
        data_inicio: new Date().toISOString(),
        data_conclusao: new Date().toISOString(),
        responsavel_nome: (user?.full_name || user?.email || "Conferente"),
        itens: itens,
        status: temDivergencia ? "com_divergencia" : "concluido",
        tem_divergencia: temDivergencia,
        divergencias_resumo: temDivergencia 
          ? `${itens.filter(i => i.divergencia).length} item(ns) com divergência`
          : "",
        checklist: checklist,
        tempo_separacao_min: 0
      });

      // Se não tem divergência, atualizar status do pedido
      if (!temDivergencia && dadosParaSeparacao) {
        if (entrega?.id) {
          await updateInContext("Entrega", entrega.id, {
            status: "Pronto para Expedir",
            group_id: effectiveGroupId,
            grupo_id: effectiveGroupId,
            empresa_id: effectiveEmpresaId,
            historico_status: [
              ...(entrega.historico_status || []),
              {
                status: "Pronto para Expedir",
                data_hora: new Date().toISOString(),
                usuario: user?.full_name || user?.email || "Sistema",
                usuario_id: user?.id,
                observacao: "Separacao e conferencia concluida sem divergencia."
              }
            ]
          });
        }
        
        if (pedido?.id) {
          await updateInContext("Pedido", pedido.id, {
            status: "Pronto para Faturar",
            group_id: effectiveGroupId,
            grupo_id: effectiveGroupId,
            empresa_id: effectiveEmpresaId
          });
        }

        // Registrar histórico
        await base44.entities.HistoricoCliente.create({
          group_id: effectiveGroupId,
          grupo_id: effectiveGroupId,
          empresa_id: effectiveEmpresaId,
          cliente_id: dadosParaSeparacao.cliente_id,
          cliente_nome: dadosParaSeparacao.cliente_nome,
          modulo_origem: "Expedicao",
          referencia_id: separacao.id,
          referencia_tipo: "SeparacaoConferencia",
          tipo_evento: "Finalizacao",
          titulo_evento: "Separação e conferência concluída",
          descricao_detalhada: `Separação conferida e liberada para expedição.`,
          usuario_responsavel: (user?.full_name || user?.email || 'Sistema'),
          data_evento: new Date().toISOString(),
          status_relacionado: "Pronto para Expedir"
        });
      }

      return separacao;
    },
    onSuccess: async (separacao) => {
      // Auditoria mínima
      try {
        await base44.entities.AuditLog.create({
          usuario: user?.full_name || user?.email || 'Usuario',
          usuario_id: user?.id,
          empresa_id: separacao?.empresa_id || effectiveEmpresaId || null,
          group_id: separacao?.group_id || effectiveGroupId || null,
          grupo_id: separacao?.grupo_id || separacao?.group_id || effectiveGroupId || null,
          acao: 'SeparacaoConferencia.concluir',
          modulo: 'Expedicao',
          tipo_auditoria: 'operacional',
          entidade: 'SeparacaoConferencia',
          registro_id: separacao?.id,
          descricao: `Separacao concluida (${separacao?.numero_separacao || ''})`,
          dados_anteriores: dadosParaSeparacao,
          dados_novos: separacao,
          sucesso: true,
          data_hora: new Date().toISOString()
        });
      } catch (_) {}
      queryClient.invalidateQueries({ queryKey: ['entregas'] }); // Invalidate deliveries query
      queryClient.invalidateQueries({ queryKey: ['separacoes'] });
      toast({
        title: "✅ Conferência concluída!",
        description: "Itens conferidos com sucesso"
      });
      // Optionally, navigate away or update parent component
    },
    onError: (error) => {
      console.error("Erro ao concluir conferência:", error);
      toast({
        title: "Erro ao concluir conferência",
        description: error.message || "Ocorreu um erro ao salvar a conferência.",
        variant: "destructive",
      });
    }
  });

  const atualizarItem = (index, campo, valor) => {
    const novosItens = [...itens];
    novosItens[index] = { ...novosItens[index], [campo]: valor };

    // Auto-calcular divergência
    if (campo === "quantidade_separada") {
      const item = novosItens[index];
      const divergente = item.quantidade_separada !== item.quantidade_pedida;
      novosItens[index].divergencia = divergente;
      novosItens[index].status_item = divergente ? "divergente" : (item.quantidade_separada > 0 ? "ok" : "aguardando");
    }

    setItens(novosItens);
  };

  const handleItemEscaneado = (scannedItem) => {
    setItens(prevItens => {
      const newItens = [...prevItens];
      const itemIndex = newItens.findIndex(
        i => i.id === scannedItem.id || i.codigo_sku === scannedItem.codigo_sku // Match by ID or SKU
      );

      if (itemIndex !== -1) {
        const item = newItens[itemIndex];
        // Increment quantidade_separada by 1 for each scan
        const newQuantidadeSeparada = (item.quantidade_separada || 0) + 1;

        // Ensure we don't separate more than requested, unless explicit override is allowed.
        // For now, let's allow over-separation but mark as divergent
        
        const isDivergent = newQuantidadeSeparada !== item.quantidade_pedida;
        
        newItens[itemIndex] = {
          ...item,
          quantidade_separada: newQuantidadeSeparada,
          divergencia: isDivergent,
          status_item: isDivergent ? "divergente" : "ok", // 'ok' if >0 and not divergent
        };
        toast({
          title: "Item escaneado!",
          description: `${item.descricao} - Qtd: ${newQuantidadeSeparada}`,
        });
      } else {
        toast({
          title: "⚠️ Item não esperado",
          description: `O item escaneado "${scannedItem.descricao || scannedItem.codigo_sku || 'SKU Desconhecido'}" não faz parte desta entrega.`,
          variant: "destructive",
        });
      }
      return newItens;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!contextoValido || !canConcluirSeparacao) {
      await auditarSeparacao({
        acao: "SeparacaoConferencia.submit_bloqueado",
        descricao: "Tentativa de concluir separacao bloqueada antes da validacao final.",
        sucesso: false,
        dadosNovos: { motivo: !contextoValido ? "contexto_obrigatorio" : "permissao_negada" },
      });
      toast({
        title: "Acesso negado",
        description: "Selecione contexto valido e confirme permissao para concluir a conferencia.",
        variant: "destructive"
      });
      return;
    }

    const todosConferidos = itens.every(i => i.quantidade_separada === i.quantidade_pedida); // Check exact match
    const todosSeparadosMinimo = itens.every(i => i.quantidade_separada > 0); // Check if at least some quantity separated

    if (!todosSeparadosMinimo) {
      toast({
        title: "⚠️ Itens não conferidos",
        description: "Pelo menos um item não teve sua quantidade separada informada ou é zero.",
        variant: "destructive"
      });
      return;
    }

    if (!checklist.conferiu_quantidade || !checklist.conferiu_qualidade || !checklist.conferiu_embalagem || !checklist.conferiu_etiquetas || !checklist.conferiu_documentos) {
      toast({
        title: "⚠️ Checklist incompleto",
        description: "Por favor, marque todos os itens do checklist de conferência.",
        variant: "destructive"
      });
      return;
    }

    criarSeparacaoMutation.mutate();
  };

  const itensDivergentes = itens.filter(i => i.divergencia);

  if (isLoading) {
    return <p>Carregando dados da entrega...</p>;
  }

  if (isError) {
    return <p className="text-red-500">Erro ao carregar entrega: {error?.message}</p>;
  }

  if (!dadosParaSeparacao) {
    return <p className="text-gray-500">Nenhum dado encontrado.</p>;
  }

  const containerClass2 = windowMode ? "w-full h-full flex flex-col overflow-auto" : "space-y-6";

  return (
    <div className={containerClass2} data-permission="Expedicao.Separacao.criar" data-context-required="true">
      <div className={windowMode ? "p-6 space-y-6 flex-1" : "space-y-6"}>
      {/* Info Pedido (now Entrega) */}
      <Card className="border-2 border-blue-200 bg-blue-50">
        <CardContent className="p-5">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-600">Referência</p>
              <p className="font-bold text-lg">{dadosParaSeparacao.numero_pedido || dadosParaSeparacao.numero_entrega}</p>
            </div>
            <div>
              <p className="text-slate-600">Cliente</p>
              <p className="font-bold text-lg">{dadosParaSeparacao.cliente_nome}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="scanner">
            <QrCode className="w-4 h-4 mr-2" />
            Scanner QR Code
          </TabsTrigger>
          <TabsTrigger value="manual">
            <List className="w-4 h-4 mr-2" />
            Conferência Manual
          </TabsTrigger>
        </TabsList>

        {/* NOVA: Tab Scanner */}
        <TabsContent value="scanner">
          <ScannerQRCode
            entregaId={entregaId}
            itensEsperados={dadosParaSeparacao?.itens_revenda || []}
            modo="separacao"
            onItemEscaneado={handleItemEscaneado}
          />
        </TabsContent>

        <TabsContent value="manual">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Alerta Divergência */}
            {itensDivergentes.length > 0 && (
              <Card className="border-2 border-red-300 bg-red-50">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-red-900 mb-1">Divergências Detectadas</p>
                      <p className="text-sm text-red-700">
                        {itensDivergentes.length} item(ns) com quantidade divergente.
                        Verifique e tome ação antes de liberar.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Tabela de Itens */}
            <Card className="border-0 shadow-md">
              <CardHeader className="bg-slate-50 border-b">
                <CardTitle className="text-base">Itens para Separação</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Item</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-center">Qtd Pedida</TableHead>
                      <TableHead className="text-center">Qtd Separada</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Obs</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itens.map((item, idx) => (
                      <TableRow key={item.id || idx} className={item.divergencia ? 'bg-red-50' : ''}>
                        <TableCell>
                          <p className="font-medium">{item.descricao}</p>
                          <p className="text-xs text-slate-500">
                            {item.codigo_sku && `SKU: ${item.codigo_sku}`}
                            {item.elemento && `Elemento: ${item.elemento}`}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={
                            item.tipo_item === "revenda" ? "border-blue-500 text-blue-700" : "border-purple-500 text-purple-700"
                          }>
                            {item.tipo_item === "revenda" ? "Revenda" : (item.tipo_item === "producao" ? "Produção" : "N/A")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center font-semibold">
                          {item.quantidade_pedida} {item.unidade}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.quantidade_separada}
                            onChange={(e) => atualizarItem(idx, "quantidade_separada", parseFloat(e.target.value) || 0)}
                            disabled={!contextoValido || !canConcluirSeparacao}
                            data-permission="Expedicao.Separacao.criar"
                            data-context-required="true"
                            className="text-center font-semibold h-10"
                          />
                        </TableCell>
                        <TableCell>
                          {item.divergencia ? (
                            <Badge className="bg-red-100 text-red-700">Divergente</Badge>
                          ) : item.quantidade_separada > 0 && item.quantidade_separada === item.quantidade_pedida ? (
                            <Badge className="bg-green-100 text-green-700">OK</Badge>
                          ) : (
                            <Badge variant="outline">Aguardando</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="text"
                            value={item.observacao_item || ""}
                            onChange={(e) => atualizarItem(idx, "observacao_item", e.target.value)}
                            disabled={!contextoValido || !canConcluirSeparacao}
                            data-permission="Expedicao.Separacao.criar"
                            data-context-required="true"
                            placeholder="Obs..."
                            className="text-sm h-8"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Checklist */}
            <Card className="border-0 shadow-md">
              <CardHeader className="bg-green-50 border-b">
                <CardTitle className="text-base">Checklist de Conferência</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-3">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={checklist.conferiu_quantidade}
                    onCheckedChange={(v) => setChecklist({ ...checklist, conferiu_quantidade: v })}
                    id="conferiu_quantidade"
                  />
                  <Label htmlFor="conferiu_quantidade" className="text-base">Conferiu quantidade de todos os itens</Label>
                </div>
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={checklist.conferiu_qualidade}
                    onCheckedChange={(v) => setChecklist({ ...checklist, conferiu_qualidade: v })}
                    id="conferiu_qualidade"
                  />
                  <Label htmlFor="conferiu_qualidade" className="text-base">Conferiu qualidade visual (sem avarias)</Label>
                </div>
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={checklist.conferiu_embalagem}
                    onCheckedChange={(v) => setChecklist({ ...checklist, conferiu_embalagem: v })}
                    id="conferiu_embalagem"
                  />
                  <Label htmlFor="conferiu_embalagem" className="text-base">Conferiu embalagem adequada</Label>
                </div>
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={checklist.conferiu_etiquetas}
                    onCheckedChange={(v) => setChecklist({ ...checklist, conferiu_etiquetas: v })}
                    id="conferiu_etiquetas"
                  />
                  <Label htmlFor="conferiu_etiquetas" className="text-base">Conferiu etiquetas e identificação</Label>
                </div>
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={checklist.conferiu_documentos}
                    onCheckedChange={(v) => setChecklist({ ...checklist, conferiu_documentos: v })}
                    id="conferiu_documentos"
                  />
                  <Label htmlFor="conferiu_documentos" className="text-base">Conferiu documentos (NF, pedido, etc.)</Label>
                </div>
                <div className="mt-4">
                  <Label htmlFor="observacoes_checklist">Observações do Checklist</Label>
                  <Textarea
                    id="observacoes_checklist"
                    value={checklist.observacoes_checklist}
                    onChange={(e) => setChecklist({ ...checklist, observacoes_checklist: e.target.value })}
                    rows={3}
                    className="mt-2"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Resumo */}
            <Card className="border-0 shadow-md bg-slate-50">
              <CardContent className="p-5">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs text-slate-600">Total Itens</p>
                    <p className="text-2xl font-bold">{itens.length}</p>
                  </div>
                  <div>
                    <p className="text-xs text-green-700">Conferidos OK</p>
                    <p className="text-2xl font-bold text-green-900">
                      {itens.filter(i => i.status_item === "ok").length}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-red-700">Divergências</p>
                    <p className="text-2xl font-bold text-red-900">{itensDivergentes.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Botões */}
            <div className="flex gap-3">
              <Button
                type="submit"
                disabled={criarSeparacaoMutation.isPending || !contextoValido || !canConcluirSeparacao}
                data-permission="Expedicao.Separacao.criar"
                data-action="SeparacaoConferencia.concluir"
                data-context-required="true"
                data-sensitive
                className="flex-1 h-14 text-lg bg-green-600 hover:bg-green-700"
              >
                {criarSeparacaoMutation.isPending ? 'Salvando...' : 'Concluir Conferência'}
              </Button>
            </div>
          </form>
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}