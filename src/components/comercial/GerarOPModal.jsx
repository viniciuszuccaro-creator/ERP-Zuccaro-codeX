import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Factory, CheckCircle, Loader2, AlertTriangle, 
  Package, Calendar, Clock, User, AlertCircle
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";

// Assuming a useAuth hook exists for user information, otherwise 'user' needs to be mocked or passed.
// For this implementation, we'll assume a placeholder for user.
// In a real application, you might have: import { useAuth } from "@/hooks/useAuth";
const useAuth = () => ({ user: { full_name: "Sistema", id: "system-user" } }); // Mock for demonstration if useAuth is not provided in context

/**
 * V21.1.2 - WINDOW MODE READY
 */
export default function GerarOPModal({ isOpen, onClose, pedido, windowMode = false }) {
  const { toast } = useToast();
  const [step, setStep] = useState(1); // 1=Seleção, 2=Configuração, 3=Processando, 4=Concluído
  const [gerando, setGerando] = useState(false);
  const [opsGeradas, setOpsGeradas] = useState([]); // This will now hold a single OP when generated automatically
  const [itensSelecionados, setItensSelecionados] = useState([]); // Kept for UI, though new mutation processes all items
  
  const [configGlobal, setConfigGlobal] = useState({
    data_emissao: new Date().toISOString().split('T')[0],
    data_inicio_prevista: "",
    setor_producao: "Produção",
    responsavel: "",
    turno: "Manhã",
    prioridade: "Normal"
  });

  const [configProducao, setConfigProducao] = useState(null);

  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Fetch all active products for the company to look up bitolas
  const { data: produtos = [] } = useQuery({
    queryKey: ['produtos', pedido?.empresa_id],
    queryFn: async () => {
      if (!pedido?.empresa_id) return [];
      const response = await base44.entities.Produto.filter({ empresa_id: pedido.empresa_id, status: "Ativo" });
      return response;
    },
    enabled: !!pedido?.empresa_id && isOpen,
  });

  // Load production configuration for the company
  useEffect(() => {
    if (isOpen && pedido?.empresa_id) {
      base44.entities.ConfiguracaoProducao.filter({
        empresa_id: pedido.empresa_id
      }).then(configs => {
        if (configs[0]) {
          setConfigProducao(configs[0]);
          // Pre-fill configGlobal with defaults from configProducao if available and not already set
          setConfigGlobal(prev => ({
            ...prev,
            setor_producao: configs[0].setor_producao_padrao || prev.setor_producao,
            turno: configs[0].turno_padrao || prev.turno,
            prioridade: configs[0].prioridade_padrao || prev.prioridade,
            // Optionally set data_inicio_prevista to today if not set, or based on config
            data_inicio_prevista: prev.data_inicio_prevista || new Date().toISOString().split('T')[0],
          }));
        }
      });
    }
  }, [isOpen, pedido]);

  // Carregar itens de produção do pedido
  useEffect(() => {
    if (isOpen && pedido?.itens_producao) {
      // Pre-selecionar itens marcados para OP automática
      const itemsComOP = pedido.itens_producao
        .map((item, index) => ({
          ...item,
          index,
          selecionado: item.gerar_op_automaticamente !== false, // Keeps UI selection state
          numero_op: `ITEM-${String(index + 1).padStart(2, '0')}` // Renamed from OP- to ITEM- to avoid confusion with the single OP number
        }));
      
      setItensSelecionados(itemsComOP);
    }
  }, [isOpen, pedido]);

  // Toggle seleção de item
  const toggleItem = (index) => {
    setItensSelecionados(prev => 
      prev.map((item, i) => 
        i === index ? {...item, selecionado: !item.selecionado} : item
      )
    );
  };

  // Selecionar/desselecionar todos
  const toggleAll = () => {
    const todosSelecionados = itensSelecionados.every(i => i.selecionado);
    setItensSelecionados(prev => 
      prev.map(item => ({...item, selecionado: !todosSelecionados}))
    );
  };

  // Validar antes de gerar - ADAPTED for the new mutation logic
  const validar = () => {
    // The automatic OP generation mutation processes ALL items in the pedido,
    // so `itensSelecionados` count is for UI flow, not a hard requirement for the mutation itself.
    // However, we maintain this check to ensure the user actively intends to generate.
    if (itensSelecionados.filter(i => i.selecionado).length === 0) {
      toast({
        title: "⚠️ Nenhum item selecionado",
        description: "Selecione ao menos um item ou clique 'Selecionar Todos' para continuar.",
        variant: "destructive"
      });
      return false;
    }

    if (!configGlobal.data_inicio_prevista) {
      toast({
        title: "⚠️ Data de início obrigatória",
        description: "Informe a data prevista para início da produção",
        variant: "destructive"
      });
      return false;
    }

    return true;
  };

  // Avançar para configuração - ADAPTED
  const avancarParaConfig = () => {
    // Maintains the UI flow to ensure user selects at least one item
    if (itensSelecionados.filter(i => i.selecionado).length === 0) {
      toast({
        title: "⚠️ Nenhum item selecionado",
        description: "Selecione ao menos um item para avançar.",
        variant: "destructive"
      });
      return;
    }
    setStep(2);
  };

  // Gerar OPs (single automatic OP)
  const gerarOPAutomaticaMutation = useMutation({
    mutationFn: async () => {
      if (!pedido || !pedido.itens_producao || pedido.itens_producao.length === 0) {
        throw new Error("Pedido sem itens de produção");
      }

      // Calcular BOM (Bill of Materials) for the entire pedido
      const materiaisNecessarios = [];
      const bitolaMap = {};
      
      for (const item of pedido.itens_producao) {
        // Bitola principal
        if (item.ferro_principal_bitola && item.ferro_principal_peso_kg > 0) {
          const key = item.ferro_principal_bitola;
          if (!bitolaMap[key]) {
            bitolaMap[key] = {
              bitola: key,
              peso_total: 0,
              descricao: `Bitola ${key}`
            };
          }
          bitolaMap[key].peso_total += item.ferro_principal_peso_kg;
        }
        
        // Estribo
        if (item.estribo_bitola && item.estribo_peso_kg > 0) {
          const key = item.estribo_bitola;
          if (!bitolaMap[key]) {
            bitolaMap[key] = {
              bitola: key,
              peso_total: 0,
              descricao: `Bitola ${key} (Estribo)`
            };
          }
          bitolaMap[key].peso_total += item.estribo_peso_kg;
        }
      }
      
      // Convert to array and find corresponding products
      for (const [bitola, dados] of Object.entries(bitolaMap)) {
        const bitolaProduto = produtos.find(p => 
          p.eh_bitola && 
          p.descricao?.includes(bitola) &&
          p.empresa_id === pedido.empresa_id &&
          p.status === "Ativo"
        );
        
        if (bitolaProduto) {
          const disponivel = (bitolaProduto.estoque_atual || 0) - (bitolaProduto.estoque_reservado || 0);
          
          materiaisNecessarios.push({
            produto_id: bitolaProduto.id,
            bitola_id: bitolaProduto.id,
            descricao: dados.descricao,
            quantidade_kg: dados.peso_total,
            unidade: "KG",
            disponivel_estoque: disponivel >= dados.peso_total,
            reservado: false
          });
        } else {
          // Bitola not found as a product
          materiaisNecessarios.push({
            produto_id: null,
            bitola_id: null,
            descricao: dados.descricao,
            quantidade_kg: dados.peso_total,
            unidade: "KG",
            disponivel_estoque: false,
            reservado: false
          });
        }
      }
      
      // Calculate loss (from config)
      const perdaPercentual = configProducao?.perda_aco_percentual || 5;
      const pesoTeorico = pedido.itens_producao.reduce((sum, i) => 
        sum + (i.peso_total_kg || 0), 0
      );
      const perdaKg = (pesoTeorico * perdaPercentual) / 100;
      
      // Check for stock shortage
      const faltaEstoque = materiaisNecessarios.some(m => !m.disponivel_estoque);

      // Calculate planned completion date based on configGlobal start date and configProducao default days
      const inicio = new Date(configGlobal.data_inicio_prevista || new Date().toISOString().split('T')[0]);
      inicio.setDate(inicio.getDate() + (configProducao?.prazo_padrao_op_dias || 7));
      const dataConclusaoPrevista = inicio.toISOString().split('T')[0];
      
      // Create OP
      const op = await base44.entities.OrdemProducao.create({
        group_id: pedido.group_id,
        empresa_id: pedido.empresa_id,
        pedido_id: pedido.id,
        numero_pedido: pedido.numero_pedido,
        cliente_id: pedido.cliente_id,
        cliente_nome: pedido.cliente_nome,
        origem: "pedido",
        gerada_automaticamente: true,
        tipo_producao: configProducao?.tipo_producao_padrao || "misto",
        data_emissao: configGlobal.data_emissao,
        data_inicio_prevista: configGlobal.data_inicio_prevista,
        data_conclusao_prevista: dataConclusaoPrevista,
        prazo_dias: configProducao?.prazo_padrao_op_dias || 7,
        prioridade: configGlobal.prioridade,
        status: faltaEstoque ? "Aguardando Matéria-Prima" : "Liberada",
        setor_producao: configGlobal.setor_producao,
        responsavel: configGlobal.responsavel,
        turno: configGlobal.turno,
        itens_producao: pedido.itens_producao.map(item => ({
          origem_item_pedido_id: item.identificador,
          elemento: item.identificador,
          tipo_peca: item.tipo_peca,
          modalidade: item.modelo_base?.includes('armad') ? 'armado' : 'corte_dobra',
          bitola_principal: item.ferro_principal_bitola,
          quantidade_barras_principal: item.ferro_principal_quantidade,
          comprimento_barra: item.comprimento, // Use item.comprimento or item.comprimento_calculado_cm if preferred
          estribo_bitola: item.estribo_bitola,
          estribo_largura: item.estribo_largura,
          estribo_altura: item.estribo_altura,
          estribo_distancia: item.estribo_distancia,
          estribo_quantidade_calculada: item.estribo_quantidade,
          quantidade_pecas: item.quantidade,
          peso_teorico_total: item.peso_total_kg,
          descricao_automatica: `${item.tipo_peca} - ${item.identificador}`,
          apontado: false
        })),
        materiais_necessarios: materiaisNecessarios,
        peso_teorico_total_kg: pesoTeorico,
        perda_percentual_configurada: perdaPercentual,
        perda_kg_prevista: perdaKg,
        alerta_falta_estoque: faltaEstoque,
        estoque_reservado: false,
        estoque_baixado: false,
        percentual_conclusao: 0,
        itens_total: pedido.itens_producao.length,
        itens_concluidos: 0,
        observacoes: configProducao?.observacoes_padrao || "",
        historico_status: [{
          status_anterior: null,
          status_novo: faltaEstoque ? "Aguardando Matéria-Prima" : "Liberada",
          data_hora: new Date().toISOString(),
          usuario: user?.full_name || "Sistema",
          observacao: `OP gerada automaticamente do pedido ${pedido.numero_pedido}`
        }]
      });
      
      // Reserve stock (if available)
      if (!faltaEstoque) {
        const reservasIds = [];
        
        for (const material of materiaisNecessarios) {
          if (!material.produto_id || !material.disponivel_estoque) continue;
          
          // Re-fetch product to get latest stock before reservation to avoid race conditions
          const currentProduct = await base44.entities.Produto.get(material.produto_id);
          if (!currentProduct) continue;

          const movReserva = await base44.entities.MovimentacaoEstoque.create({
            group_id: pedido.group_id,
            empresa_id: pedido.empresa_id,
            origem_movimento: "producao",
            origem_documento_id: op.id,
            tipo_movimento: "reserva",
            produto_id: material.produto_id,
            produto_descricao: material.descricao,
            quantidade: material.quantidade_kg,
            unidade_medida: "KG",
            estoque_anterior: currentProduct.estoque_atual || 0,
            estoque_atual: currentProduct.estoque_atual || 0,
            reservado_anterior: currentProduct.estoque_reservado || 0,
            reservado_atual: (currentProduct.estoque_reservado || 0) + material.quantidade_kg,
            disponivel_anterior: (currentProduct.estoque_atual || 0) - (currentProduct.estoque_reservado || 0),
            disponivel_atual: (currentProduct.estoque_atual || 0) - ((currentProduct.estoque_reservado || 0) + material.quantidade_kg),
            data_movimentacao: new Date().toISOString(),
            documento: op.numero_op,
            motivo: "Reserva para produção",
            responsavel: user?.full_name || "Sistema"
          });
          
          reservasIds.push(movReserva.id);
          
          // Update product with reserved stock
          await base44.entities.Produto.update(material.produto_id, {
            estoque_reservado: (currentProduct.estoque_reservado || 0) + material.quantidade_kg
          });
        }
        
        // Update OP with reservation IDs
        await base44.entities.OrdemProducao.update(op.id, {
          estoque_reservado: true,
          reserva_estoque_ids: reservasIds
        });
      }
      
      // Update pedido
      await base44.entities.Pedido.update(pedido.id, {
        ordem_producao_ids: [...(pedido.ordem_producao_ids || []), op.id],
        status: faltaEstoque ? "Aguardando Matéria-Prima" : "Em Produção"
      });
      
      // Record history
      await base44.entities.HistoricoCliente.create({
        group_id: pedido.group_id,
        empresa_id: pedido.empresa_id,
        cliente_id: pedido.cliente_id,
        cliente_nome: pedido.cliente_nome,
        modulo_origem: "Producao",
        referencia_id: op.id,
        referencia_tipo: "OrdemProducao",
        referencia_numero: op.numero_op,
        tipo_evento: "Criacao",
        titulo_evento: "OP gerada automaticamente",
        descricao_detalhada: `Ordem de Produção ${op.numero_op} gerada a partir do pedido ${pedido.numero_pedido}. Peso teórico: ${pesoTeorico.toFixed(2)} kg${faltaEstoque ? '. ATENÇÃO: Falta material em estoque.' : ''}`,
        usuario_responsavel: user?.full_name || "Sistema",
        data_evento: new Date().toISOString()
      });
      
      return op;
    },
    onSuccess: (op) => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      queryClient.invalidateQueries({ queryKey: ['ordens-producao'] });
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      queryClient.invalidateQueries({ queryKey: ['movimentacoes'] });
      
      toast({
        title: "✅ OP gerada com sucesso!",
        description: `Número: ${op.numero_op}`
      });
      
      setOpsGeradas([op]); // Set the single generated OP for display in Step 4
      setStep(4);
      setGerando(false);
    },
    onError: (error) => {
        console.error("Erro ao gerar OPs:", error);
        toast({
            title: "❌ Erro ao gerar OPs",
            description: error.message || "Ocorreu um erro inesperado.",
            variant: "destructive"
        });
        setGerando(false);
        setStep(2); // Go back to config step
    }
  });

  // This `gerarOPs` now acts as a wrapper to trigger the single automatic OP mutation
  const gerarOPs = async () => {
    if (!validar()) return;

    setGerando(true);
    setStep(3); // Move to processing step
    
    gerarOPAutomaticaMutation.mutate();
  };

  const fechar = () => {
    setStep(1);
    setOpsGeradas([]);
    gerarOPAutomaticaMutation.reset(); // Reset mutation state when closing
    onClose();
  };

  if (!pedido) return null;

  const content = (
    <div className={`space-y-6 ${windowMode ? 'p-6 h-full overflow-auto' : ''}`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Factory className="w-5 h-5 text-amber-600" />
            Gerar Ordem de Produção Automática
            {step > 1 && (
              <Badge className="ml-2">
                {step === 2 ? "Configuração" : step === 3 ? "Processando" : "Concluído"}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* STEP 1: SELEÇÃO DE ITENS - Adjusted message to reflect single OP generation */}
        {step === 1 && (
          <div className="space-y-6">
            <Card className="p-4 bg-blue-50 border-blue-200">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-semibold mb-1">Sobre a Geração Automática de OP</p>
                  <p>
                    Uma única Ordem de Produção será gerada para todos os itens de produção deste pedido. 
                    Revise os itens abaixo e as configurações na próxima etapa.
                  </p>
                </div>
              </div>
            </Card>

            <div className="flex justify-between items-center">
              <h3 className="font-semibold">
                Itens de Produção do Pedido {pedido.numero_pedido}
              </h3>
              {/* Keep Toggle All for UI consistency, even if all items are processed by mutation */}
              <Button type="button" variant="outline" size="sm" onClick={toggleAll}>
                {itensSelecionados.every(i => i.selecionado) ? 'Desmarcar Todos' : 'Selecionar Todos'}
              </Button>
            </div>

            {itensSelecionados.length === 0 ? (
              <Card className="p-8 text-center">
                <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
                <p className="text-slate-600 font-semibold mb-2">
                  Este pedido não possui itens de produção
                </p>
                <p className="text-sm text-slate-500">
                  Apenas pedidos com itens de produção sob medida podem gerar OPs.
                </p>
              </Card>
            ) : (
              <div className="space-y-3">
                {itensSelecionados.map((item, index) => (
                  <Card 
                    key={index} 
                    className={`p-4 cursor-pointer transition-colors ${
                      item.selecionado ? 'border-amber-500 border-2 bg-amber-50' : 'hover:bg-slate-50'
                    }`}
                    onClick={() => toggleItem(index)}
                  >
                    <div className="flex items-start gap-4">
                      <Checkbox 
                        checked={item.selecionado}
                        onCheckedChange={() => toggleItem(index)}
                        className="mt-1"
                      />
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className="bg-blue-600">{item.tipo_peca}</Badge>
                          <Badge variant="outline">{item.identificador}</Badge>
                          <Badge className="bg-purple-100 text-purple-700">
                            {item.quantidade}x
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-4 gap-3 text-sm">
                          <div>
                            <Label className="text-xs text-slate-500">Dimensões</Label>
                            <p className="font-medium">
                              {item.altura} × {item.largura} × {item.comprimento} cm
                            </p>
                          </div>
                          <div>
                            <Label className="text-xs text-slate-500">Peso Total</Label>
                            <p className="font-medium">{item.peso_total_kg.toFixed(0)} kg</p>
                          </div>
                          <div>
                            <Label className="text-xs text-slate-500">Prazo Entrega</Label>
                            <p className="font-medium">{item.prazo_entrega_dias || 7} dias</p>
                          </div>
                          <div>
                            <Label className="text-xs text-slate-500">Ref. Item</Label>
                            <p className="font-medium text-amber-600">{item.numero_op}</p>
                          </div>
                        </div>

                        {item.observacoes_tecnicas && (
                          <p className="text-xs text-slate-600 mt-2 italic">
                            {item.observacoes_tecnicas}
                          </p>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={fechar}>
                Cancelar
              </Button>
              <Button 
                type="button" 
                onClick={avancarParaConfig}
                disabled={itensSelecionados.filter(i => i.selecionado).length === 0}
                className="bg-amber-600 hover:bg-amber-700"
              >
                Continuar
                <span className="ml-2 bg-white text-amber-600 px-2 py-0.5 rounded-full text-xs font-bold">
                  {itensSelecionados.filter(i => i.selecionado).length}
                </span>
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: CONFIGURAÇÃO */}
        {step === 2 && (
          <div className="space-y-6">
            <Card className="p-4 bg-amber-50 border-amber-200">
              <div className="flex items-start gap-3">
                <Factory className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                  <p className="font-semibold mb-1">Configurações para a Ordem de Produção Única</p>
                  <p>
                    Estas configurações serão aplicadas à única OP que será gerada para este pedido.
                  </p>
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data de Emissão</Label>
                <Input
                  type="date"
                  value={configGlobal.data_emissao}
                  onChange={(e) => setConfigGlobal(prev => ({...prev, data_emissao: e.target.value}))}
                />
              </div>
              <div>
                <Label>Data Início Prevista *</Label>
                <Input
                  type="date"
                  value={configGlobal.data_inicio_prevista}
                  onChange={(e) => setConfigGlobal(prev => ({...prev, data_inicio_prevista: e.target.value}))}
                  required
                />
              </div>
              <div>
                <Label>Setor de Produção</Label>
                <Input
                  value={configGlobal.setor_producao}
                  onChange={(e) => setConfigGlobal(prev => ({...prev, setor_producao: e.target.value}))}
                />
              </div>
              <div>
                <Label>Responsável</Label>
                <Input
                  value={configGlobal.responsavel}
                  onChange={(e) => setConfigGlobal(prev => ({...prev, responsavel: e.target.value}))}
                  placeholder="Nome do responsável"
                />
              </div>
              <div>
                <Label>Turno</Label>
                <Select 
                  value={configGlobal.turno} 
                  onValueChange={(value) => setConfigGlobal(prev => ({...prev, turno: value}))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Manhã">Manhã</SelectItem>
                    <SelectItem value="Tarde">Tarde</SelectItem>
                    <SelectItem value="Noite">Noite</SelectItem>
                    <SelectItem value="24h">24h</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prioridade</Label>
                <Select 
                  value={configGlobal.prioridade} 
                  onValueChange={(value) => setConfigGlobal(prev => ({...prev, prioridade: value}))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Baixa">Baixa</SelectItem>
                    <SelectItem value="Normal">Normal</SelectItem>
                    <SelectItem value="Alta">Alta</SelectItem>
                    <SelectItem value="Urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Card className="p-4 bg-green-50 border-green-200">
              <div className="flex items-start gap-3">
                <Package className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-green-800">
                  <p className="font-semibold mb-1">O que será gerado automaticamente:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Lista de materiais necessários (concreto, aço), totalizada para o pedido.</li>
                    <li>Etapas do processo produtivo (padrão da empresa).</li>
                    <li>Cálculo de custos consolidado para a OP.</li>
                    <li>Data de conclusão prevista (baseada no prazo padrão da empresa).</li>
                    <li>Vinculação com o pedido original.</li>
                    {configProducao?.perda_aco_percentual && (
                        <li>Considerada perda de aço de {configProducao.perda_aco_percentual}%</li>
                    )}
                  </ul>
                </div>
              </div>
            </Card>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setStep(1)}>
                Voltar
              </Button>
              <Button 
                type="button" 
                onClick={gerarOPs}
                className="bg-green-600 hover:bg-green-700"
                disabled={gerarOPAutomaticaMutation.isPending}
              >
                <Factory className="w-4 h-4 mr-2" />
                Gerar Ordem de Produção Única
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: PROCESSANDO */}
        {step === 3 && (
          <div className="py-12 text-center">
            <Loader2 className="w-16 h-16 text-amber-600 animate-spin mx-auto mb-6" />
            <h3 className="text-2xl font-bold text-slate-900 mb-2">Gerando Ordem de Produção...</h3>
            <p className="text-slate-600 mb-4">Aguarde enquanto criamos a OP e reservamos estoque</p>
            
            <div className="max-w-md mx-auto space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span>Validando dados e configurações</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Clock className="w-5 h-5 text-amber-600 animate-pulse" />
                <span>Calculando materiais e peso total</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-400">
                <Clock className="w-5 h-5" />
                <span>Criando registro da OP</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-400">
                <Clock className="w-5 h-5" />
                <span>Verificando estoque e reservando materiais</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-400">
                <Clock className="w-5 h-5" />
                <span>Vinculando OP ao pedido</span>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: CONCLUÍDO */}
        {step === 4 && (
          <div className="space-y-6">
            <Card className="p-8 text-center bg-green-50 border-green-200">
              <CheckCircle className="w-20 h-20 text-green-600 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-green-900 mb-2">
                OP Gerada com Sucesso!
              </h3>
              <p className="text-green-800 mb-4">
                Uma Ordem de Produção foi criada e vinculada ao pedido.
              </p>
              <Badge className="bg-green-600 text-lg px-4 py-2">
                Pedido agora em: {opsGeradas[0]?.status}
              </Badge>
            </Card>

            <div>
              <h3 className="font-semibold mb-3">OP Criada:</h3>
              <div className="space-y-2">
                {opsGeradas.map((op, index) => ( // Will typically contain only one OP now
                  <Card key={index} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                          <Factory className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                          <p className="font-semibold">{op.numero_op}</p>
                          <p className="text-sm text-slate-600">Total de {op.itens_total} itens de produção</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge className="bg-blue-100 text-blue-700">{op.status}</Badge>
                        <p className="text-xs text-slate-500 mt-1">
                          Peso total planejado: {op.peso_teorico_total_kg.toFixed(0)} kg
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            <Card className="p-4 bg-blue-50 border-blue-200">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-semibold mb-1">Próximos Passos:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Acesse o módulo Produção para acompanhar a OP criada.</li>
                    <li>Verifique os materiais necessários e o status do estoque.</li>
                    <li>Inicie a produção e registre o progresso das etapas.</li>
                    <li>Ao concluir, marque a OP como "Concluída".</li>
                  </ul>
                </div>
              </div>
            </Card>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" onClick={fechar} className="bg-green-600 hover:bg-green-700">
                <CheckCircle className="w-4 h-4 mr-2" />
                Concluir
              </Button>
            </div>
          </div>
        )}
    </div>
  );

  if (windowMode) {
    return <div className="w-full h-full bg-white">{content}</div>;
  }

  return (
    <Dialog open={isOpen} onOpenChange={fechar}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Factory className="w-5 h-5 text-amber-600" />
            Gerar Ordem de Produção Automática
            {step > 1 && (
              <Badge className="ml-2">
                {step === 2 ? "Configuração" : step === 3 ? "Processando" : "Concluído"}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}