
import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calculator, Package, Ruler, Layers, Grid3x3, Building, Columns, Box as BoxIcon, FileText, Save } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Switch } from "@/components/ui/switch";
import DescricaoAutomaticaArmado from "./DescricaoAutomaticaArmado";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { useUser } from "@/components/lib/UserContext";

export default function FormularioArmadoCompleto({ onSalvar, onCancelar, itemInicial = null }) {
  const { toast } = useToast();
  const { empresaAtual, grupoAtual, filterInContext } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const { user } = useUser();
  const empresaId = itemInicial?.empresa_id || empresaAtual?.id || null;
  const groupId = itemInicial?.group_id || itemInicial?.grupo_id || grupoAtual?.id || empresaAtual?.group_id || null;
  const contextoValido = Boolean(groupId || empresaId);
  const contextKey = groupId ? `grupo:${groupId}` : `empresa:${empresaId || "sem-empresa"}`;
  const podeSalvarArmado = hasPermission("Produção", "Engenharia", "criar") ||
    hasPermission("Produção", "Engenharia", "editar") ||
    hasPermission("Produção", "Armado", "criar") ||
    hasPermission("Producao", "Engenharia", "criar") ||
    hasPermission("Producao", "Armado", "criar");
  const [tipoSelecionado, setTipoSelecionado] = useState(itemInicial?.tipo_peca || null);

  const [elementoEstrutural, setElementoEstrutural] = useState(itemInicial?.identificador || "");
  const [elementoObrigatorio] = useState(itemInicial?.origem_ia || false);

  const { data: configuracoes } = useQuery({
    queryKey: ['configProducao', 'armado', contextKey],
    queryFn: async () => {
      const configs = await filterInContext("ConfiguracaoProducao", { tipo: "Configuração Geral" }, "-created_date", 20);
      return configs[0] || { perda_aco_percentual: 5, perda_arame_percentual: 10 };
    },
    enabled: contextoValido,
  });

  const PESOS_BITOLA = {
    "4.2": 0.109,
    "5.0": 0.154,
    "6.3": 0.245,
    "8.0": 0.395,
    "10.0": 0.617,
    "12.5": 0.963,
    "16.0": 1.578,
    "20.0": 2.466,
    "25.0": 3.853
  };

  const [formData, setFormData] = useState(itemInicial || {
    identificador: `ARM-${Date.now()}`,
    tipo_peca: "",
    quantidade: 1,
    comprimento: 0,
    altura: 0,
    largura: 0,
    estribo_diametro: 0,
    espacamento_ferros: 15,
    ferro_principal_bitola: "10.0",
    ferro_principal_quantidade: 4,
    quantidade_ferros_lado1: 0,
    quantidade_ferros_lado2: 0,
    usar_costelas: false,
    quantidade_costelas: 0,
    bitola_costelas: "8.0",
    estribo_bitola: "4.2",
    estribo_largura: 0,
    estribo_altura: 0,
    estribo_distancia: 15,
    quantidade_estribos: 0,
    peso_ferro_principal: 0,
    peso_costelas: 0,
    peso_estribos: 0,
    peso_arame_recozido: 0,
    peso_total_kg: 0,
    custo_material: 0,
    custo_mao_obra: 0,
    custo_overhead: 0,
    custo_total: 0,
    preco_venda_unitario: 0,
    preco_venda_total: 0
  });

  const [resumo, setResumo] = useState(null);

  useEffect(() => {
    if (tipoSelecionado === "Bloco" && formData.comprimento > 0 && formData.altura > 0 && formData.largura > 0) {
      calcularBloco();
    } else if (tipoSelecionado && tipoSelecionado !== "Bloco" && formData.comprimento > 0) {
      calcularElemento();
    }
  }, [
    tipoSelecionado,
    formData.comprimento,
    formData.altura,
    formData.largura,
    formData.estribo_diametro,
    formData.espacamento_ferros,
    formData.ferro_principal_bitola,
    formData.ferro_principal_quantidade,
    formData.estribo_distancia,
    formData.usar_costelas,
    formData.quantidade_costelas,
    formData.bitola_costelas,
    formData.estribo_bitola,
    formData.estribo_largura,
    formData.estribo_altura,
    formData.quantidade,
    configuracoes // Added to re-calculate if configs change
  ]);

  const calcularBloco = () => {
    const { comprimento, altura, largura, espacamento_ferros, usar_costelas, quantidade_costelas, bitola_costelas } = formData;

    const qtdFerrosLado1 = Math.ceil(largura / espacamento_ferros) + 1;
    const qtdFerrosLado2 = Math.ceil(altura / espacamento_ferros) + 1;
    
    // Costelas apenas se o usuário ativar e tiver quantidade > 0
    const qtdCostelas = usar_costelas ? quantidade_costelas : 0;
    
    // Para bloco, estribos a cada 20cm fixo
    const qtdEstribos = Math.ceil(comprimento / 20);
    const estriboLargura = largura;
    const estriboAltura = altura;

    const pesoFerroKgM = PESOS_BITOLA[formData.ferro_principal_bitola] || 0.617;
    const pesoCostelasKgM = PESOS_BITOLA[bitola_costelas] || 0.395;
    const pesoEstriboKgM = PESOS_BITOLA["4.2"] || 0.109; // Bloco sempre usa 4.2mm

    const comprimentoTotalFerros = (qtdFerrosLado1 * comprimento) + (qtdFerrosLado2 * comprimento);
    const pesoFerroPrincipal = (comprimentoTotalFerros / 100) * pesoFerroKgM;

    // Peso das costelas (apenas se usar_costelas = true e qtdCostelas > 0)
    let pesoCostelas = 0;
    if (usar_costelas && qtdCostelas > 0) {
      const comprimentoCostela = (largura + altura) * 2;
      pesoCostelas = (comprimentoCostela * qtdCostelas / 100) * pesoCostelasKgM;
    }

    const perimetroEstribo = (estriboLargura + estriboAltura) * 2 + 10;
    const pesoEstribos = (perimetroEstribo * qtdEstribos / 100) * pesoEstriboKgM;

    const qtdAmarras = (qtdFerrosLado1 + qtdFerrosLado2) * qtdEstribos;
    const pesoArame = (qtdAmarras * 10) / 1000;

    const perdaAco = configuracoes?.perda_aco_percentual || 5;
    const perdaArame = configuracoes?.perda_arame_percentual || 10;

    const pesoTotalAco = (pesoFerroPrincipal + pesoCostelas + pesoEstribos) * (1 + perdaAco / 100);
    const pesoTotalArame = pesoArame * (1 + perdaArame / 100);
    const pesoTotal = pesoTotalAco + pesoTotalArame;

    const precoAcoKg = configuracoes?.preco_aco_kg || 8.5;
    const precoArameKg = configuracoes?.preco_arame_kg || 12.0;

    const custoMaterial = (pesoTotalAco * precoAcoKg) + (pesoTotalArame * precoArameKg);
    const custoMaoObra = custoMaterial * 0.3;
    const custoOverhead = custoMaterial * 0.15;
    const custoTotal = custoMaterial + custoMaoObra + custoOverhead;

    const precoVendaUnitario = custoTotal * 1.4;
    const precoVendaTotal = precoVendaUnitario * formData.quantidade;

    setFormData(prev => ({
      ...prev,
      quantidade_ferros_lado1: qtdFerrosLado1,
      quantidade_ferros_lado2: qtdFerrosLado2,
      quantidade_costelas: qtdCostelas, // Ensure this is updated based on `usar_costelas`
      estribo_largura: estriboLargura,
      estribo_altura: estriboAltura,
      estribo_distancia: 20, // Fixed for Bloco
      estribo_bitola: "4.2", // Fixed for Bloco
      quantidade_estribos: qtdEstribos,
      peso_ferro_principal: pesoFerroPrincipal,
      peso_costelas: pesoCostelas,
      peso_estribos: pesoEstribos,
      peso_arame_recozido: pesoTotalArame,
      peso_total_kg: pesoTotal,
      custo_material: custoMaterial,
      custo_mao_obra: custoMaoObra,
      custo_overhead: custoOverhead,
      custo_total: custoTotal,
      preco_venda_unitario: precoVendaUnitario,
      preco_venda_total: precoVendaTotal
    }));

    setResumo({
      ferros_lado1: qtdFerrosLado1,
      ferros_lado2: qtdFerrosLado2,
      costelas: qtdCostelas,
      estribos: qtdEstribos,
      peso_aco: pesoTotalAco,
      peso_arame: pesoTotalArame,
      peso_total: pesoTotal
    });
  };

  const calcularElemento = () => {
    const { comprimento, ferro_principal_quantidade, estribo_largura, estribo_altura, estribo_diametro, estribo_distancia } = formData;

    const pesoFerroKgM = PESOS_BITOLA[formData.ferro_principal_bitola] || 0.617;
    const pesoEstriboKgM = PESOS_BITOLA[formData.estribo_bitola] || 0.109;

    const comprimentoTotal = comprimento / 100;
    const pesoFerroPrincipal = comprimentoTotal * ferro_principal_quantidade * pesoFerroKgM;

    const qtdEstribos = Math.ceil(comprimento / estribo_distancia);
    
    // Para Estaca/Broca usa diâmetro, outros usam largura x altura
    const perimetroEstribo = tipoSelecionado === "Estaca/Broca" 
      ? (Math.PI * estribo_diametro + 10) 
      : ((estribo_largura + estribo_altura) * 2 + 10);
    
    const pesoEstribos = (perimetroEstribo * qtdEstribos / 100) * pesoEstriboKgM;

    const qtdAmarras = ferro_principal_quantidade * qtdEstribos;
    const pesoArame = (qtdAmarras * 10) / 1000;

    const perdaAco = configuracoes?.perda_aco_percentual || 5;
    const perdaArame = configuracoes?.perda_arame_percentual || 10;

    const pesoTotalAco = (pesoFerroPrincipal + pesoEstribos) * (1 + perdaAco / 100);
    const pesoTotalArame = pesoArame * (1 + perdaArame / 100);
    const pesoTotal = pesoTotalAco + pesoTotalArame;

    const precoAcoKg = configuracoes?.preco_aco_kg || 8.5;
    const precoArameKg = configuracoes?.preco_arame_kg || 12.0;

    const custoMaterial = (pesoTotalAco * precoAcoKg) + (pesoTotalArame * precoArameKg);
    const custoMaoObra = custoMaterial * 0.3;
    const custoOverhead = custoMaterial * 0.15;
    const custoTotal = custoMaterial + custoMaoObra + custoOverhead;

    const precoVendaUnitario = custoTotal * 1.4;
    const precoVendaTotal = precoVendaUnitario * formData.quantidade;

    setFormData(prev => ({
      ...prev,
      quantidade_estribos: qtdEstribos,
      peso_ferro_principal: pesoFerroPrincipal,
      peso_estribos: pesoEstribos,
      peso_arame_recozido: pesoTotalArame,
      peso_total_kg: pesoTotal,
      custo_material: custoMaterial,
      custo_mao_obra: custoMaoObra,
      custo_overhead: custoOverhead,
      custo_total: custoTotal,
      preco_venda_unitario: precoVendaUnitario,
      preco_venda_total: precoVendaTotal
    }));

    setResumo({
      ferros: ferro_principal_quantidade,
      estribos: qtdEstribos,
      peso_aco: pesoTotalAco,
      peso_arame: pesoTotalArame,
      peso_total: pesoTotal
    });
  };

  // Gerar descrição automática
  const descricaoAutomatica = useMemo(() => {
    if (!tipoSelecionado || !formData.comprimento || (tipoSelecionado === "Bloco" && (!formData.altura || !formData.largura))) {
      return "";
    }
    return DescricaoAutomaticaArmado({
      quantidade: formData.quantidade,
      tipoPeca: tipoSelecionado,
      comprimento: formData.comprimento,
      largura: formData.largura,
      altura: formData.altura,
      estribo_diametro: formData.estribo_diametro,
      ferro_principal_quantidade: formData.ferro_principal_quantidade,
      ferro_principal_bitola: formData.ferro_principal_bitola,
      estribo_largura: formData.estribo_largura,
      estribo_altura: formData.estribo_altura,
      estribo_distancia: formData.estribo_distancia,
      usar_costelas: formData.usar_costelas,
      quantidade_costelas: formData.quantidade_costelas,
      bitola_costelas: formData.bitola_costelas,
      quantidade_ferros_lado1: formData.quantidade_ferros_lado1,
      quantidade_ferros_lado2: formData.quantidade_ferros_lado2,
      // `quantidade_estribos` is a computed value, it will reflect the state after `calcularBloco` or `calcularElemento` has run.
      quantidade_estribos: formData.quantidade_estribos
    });
  }, [
    formData.quantidade, tipoSelecionado, formData.comprimento, formData.largura, formData.altura,
    formData.estribo_diametro, formData.ferro_principal_quantidade, formData.ferro_principal_bitola,
    formData.estribo_largura, formData.estribo_altura, formData.estribo_distancia,
    formData.usar_costelas, formData.quantidade_costelas, formData.bitola_costelas,
    formData.quantidade_ferros_lado1, formData.quantidade_ferros_lado2, formData.quantidade_estribos
  ]);

  const handleSalvar = () => {
    const auditarArmado = (acao, descricao, sucesso = true, dadosNovos = null) => {
      base44.entities.AuditLog.create({
        usuario: user?.full_name || user?.email || "Usuario local",
        usuario_id: user?.id || null,
        empresa_id: empresaId,
        group_id: groupId,
        grupo_id: groupId,
        acao,
        modulo: "Produção",
        entidade: "FormularioArmado",
        registro_id: itemInicial?.id || null,
        tipo_auditoria: sucesso ? "operacional" : "seguranca",
        descricao,
        dados_anteriores: itemInicial,
        dados_novos: dadosNovos,
        sucesso,
        data_hora: new Date().toISOString()
      }).catch((error) => console.warn("Falha ao auditar armado:", error));
    };

    if (!contextoValido) {
      auditarArmado("FormularioArmado.bloqueado", "Tentativa de adicionar armado sem contexto grupo/empresa.", false, formData);
      toast({ title: "❌ Contexto obrigatório", description: "Selecione grupo ou empresa antes de adicionar o item.", variant: "destructive" });
      return;
    }
    if (!podeSalvarArmado) {
      auditarArmado("FormularioArmado.bloqueado", "Tentativa de adicionar armado sem permissão.", false, formData);
      toast({ title: "❌ Acesso negado", description: "Seu perfil não pode adicionar itens armados.", variant: "destructive" });
      return;
    }
    if (!tipoSelecionado) {
      toast({
        title: "❌ Erro",
        description: "Selecione o tipo de elemento estrutural",
        variant: "destructive"
      });
      return;
    }

    if (!formData.comprimento) {
      toast({
        title: "❌ Erro",
        description: "Preencha o comprimento",
        variant: "destructive"
      });
      return;
    }

    if (tipoSelecionado === "Bloco" && (!formData.altura || !formData.largura)) {
      toast({
        title: "❌ Erro",
        description: "Preencha altura e largura do bloco",
        variant: "destructive"
      });
      return;
    }

    if (!resumo) {
      toast({
        title: "❌ Erro",
        description: "Clique em CALCULAR antes de salvar",
        variant: "destructive"
      });
      return;
    }

    // Validação: elemento estrutural obrigatório se veio de IA
    if (elementoObrigatorio && !elementoEstrutural.trim()) {
      toast({
        title: "⚠️ Elemento Estrutural Obrigatório!",
        description: "Este item foi processado por IA e requer o preenchimento do elemento estrutural (ex: V1, V2, C1, B1).",
        variant: "destructive"
      });
      return;
    }

    const itemCompleto = {
      ...formData,
      tipo_peca: tipoSelecionado,
      tipo_servico: "armado",
      identificador: elementoEstrutural.trim() || descricaoAutomatica, // Use trimmed elementoEstrutural if present, else auto-description
      origem_ia: itemInicial?.origem_ia || false,
      empresa_id: empresaId,
      group_id: groupId,
      grupo_id: groupId,
      descricao_automatica: descricaoAutomatica,
      resumo: resumo
    };

    auditarArmado(itemInicial?.id ? "Edição" : "Criação", "Item armado calculado e adicionado ao pedido.", true, itemCompleto);
    onSalvar(itemCompleto);
    toast({ title: "✅ Item Adicionado ao Pedido!" });
  };

  const handleSelecionarTipo = (tipo) => {
    setTipoSelecionado(tipo);
    setFormData(prev => ({
      ...prev,
      tipo_peca: tipo, // Still useful for internal formData consistency
      identificador: `${tipo.toUpperCase().substring(0, 3)}-${Date.now()}` // Keep for internal tracking / default
    }));
    setResumo(null);
  };

  return (
    <div className="space-y-6 w-full h-full" data-permission="Producao.Engenharia.criar" data-context-required="true">
      <Card>
        <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50">
          <CardTitle>Armado Sob Medida - Cálculo Automático</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <Label className="mb-3 block">Selecione o Tipo de Elemento Estrutural:</Label>
          <div className="grid grid-cols-4 gap-4">
            <button
              onClick={() => handleSelecionarTipo("Coluna")}
              className={`p-6 border-2 rounded-lg transition-all ${
                tipoSelecionado === "Coluna"
                  ? "border-blue-500 bg-blue-50"
                  : "border-slate-200 hover:border-blue-300"
              }`}
            >
              <Columns className="w-12 h-12 mx-auto mb-2 text-slate-600" />
              <p className="font-semibold">Coluna</p>
            </button>

            <button
              onClick={() => handleSelecionarTipo("Viga")}
              className={`p-6 border-2 rounded-lg transition-all ${
                tipoSelecionado === "Viga"
                  ? "border-purple-500 bg-purple-50"
                  : "border-slate-200 hover:border-purple-300"
              }`}
            >
              <div className="w-12 h-3 mx-auto mb-4 bg-slate-600 rounded" />
              <p className="font-semibold">Viga</p>
            </button>

            <button
              onClick={() => handleSelecionarTipo("Estaca/Broca")}
              className={`p-6 border-2 rounded-lg transition-all ${
                tipoSelecionado === "Estaca/Broca"
                  ? "border-orange-500 bg-orange-50"
                  : "border-slate-200 hover:border-orange-300"
              }`}
            >
              <Building className="w-12 h-12 mx-auto mb-2 text-slate-600" />
              <p className="font-semibold">Estaca/Broca</p>
            </button>

            <button
              onClick={() => handleSelecionarTipo("Bloco")}
              className={`p-6 border-2 rounded-lg transition-all ${
                tipoSelecionado === "Bloco"
                  ? "border-green-500 bg-green-50"
                  : "border-slate-200 hover:border-green-300"
              }`}
            >
              <BoxIcon className="w-12 h-12 mx-auto mb-2 text-slate-600" />
              <p className="font-semibold">Bloco de Fundação</p>
            </button>
          </div>
        </CardContent>
      </Card>

      {tipoSelecionado && (
        <>
          {/* DESCRIÇÃO AUTOMÁTICA */}
          {descricaoAutomatica && (
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <h4 className="font-semibold text-blue-900">Descrição Automática</h4>
                </div>
                <p className="text-sm text-blue-800 font-mono">
                  {descricaoAutomatica}
                </p>
              </CardContent>
            </Card>
          )}

          {/* ELEMENTO ESTRUTURAL */}
          <div>
            <Label>
              Elemento Estrutural (Ex: V1, V2, C1, B1)
              {elementoObrigatorio && <span className="text-red-600 ml-1">*</span>}
            </Label>
            <Input
              value={elementoEstrutural}
              onChange={(e) => setElementoEstrutural(e.target.value)}
              placeholder={descricaoAutomatica || "V1, V2, C1, C2, B1..."}
              required={elementoObrigatorio}
              className={elementoObrigatorio ? "border-red-300" : ""}
            />
            {elementoObrigatorio && (
              <p className="text-xs text-red-600 mt-1">
                ⚠️ Obrigatório: item processado por IA
              </p>
            )}
            {!elementoEstrutural && descricaoAutomatica && (
              <p className="text-xs text-blue-600 mt-1">
                💡 Deixe vazio para usar a descrição automática
              </p>
            )}
          </div>

          <Card>
            <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100">
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-600" />
                Dados Básicos
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Identificador Interno</Label>
                  <Input
                    value={formData.identificador}
                    disabled // Disable editing of internal ID
                    placeholder={`Ex: ${tipoSelecionado}-01`}
                  />
                </div>
                <div>
                  <Label>Quantidade de Peças *</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.quantidade}
                    onChange={(e) => setFormData({ ...formData, quantidade: parseInt(e.target.value) || 1 })}
                  />
                </div>
              </div>

              <Separator />

              {tipoSelecionado === "Bloco" ? (
                <>
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <Label>Comprimento (cm) *</Label>
                      <div className="relative">
                        <Input
                          type="number"
                          step="1"
                          value={formData.comprimento}
                          onChange={(e) => setFormData({ ...formData, comprimento: parseFloat(e.target.value) || 0 })}
                        />
                        <Ruler className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      </div>
                    </div>
                    <div>
                      <Label>Altura (cm) *</Label>
                      <div className="relative">
                        <Input
                          type="number"
                          step="1"
                          value={formData.altura}
                          onChange={(e) => setFormData({ ...formData, altura: parseFloat(e.target.value) || 0 })}
                        />
                        <Ruler className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      </div>
                    </div>
                    <div>
                      <Label>Largura (cm) *</Label>
                      <div className="relative">
                        <Input
                          type="number"
                          step="1"
                          value={formData.largura}
                          onChange={(e) => setFormData({ ...formData, largura: parseFloat(e.target.value) || 0 })}
                        />
                        <Ruler className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      </div>
                    </div>
                    <div>
                      <Label>Espaçamento (cm) *</Label>
                      <div className="relative">
                        <Input
                          type="number"
                          step="1"
                          value={formData.espacamento_ferros}
                          onChange={(e) => setFormData({ ...formData, espacamento_ferros: parseFloat(e.target.value) || 15 })}
                        />
                        <Grid3x3 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label>Bitola Ferros Principais</Label>
                    <Select
                      value={formData.ferro_principal_bitola}
                      onValueChange={(v) => setFormData({ ...formData, ferro_principal_bitola: v })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.keys(PESOS_BITOLA).filter(b => parseFloat(b) >= 8.0).map(bitola => (
                          <SelectItem key={bitola} value={bitola}>{bitola}mm</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between p-4 bg-yellow-50 rounded border border-yellow-200">
                    <div>
                      <Label className="font-semibold">Reforço - Bitola (Opcional)</Label>
                      <p className="text-sm text-slate-600 mt-1">Adicionar costelas de reforço ao bloco</p>
                    </div>
                    <Switch
                      checked={formData.usar_costelas}
                      onCheckedChange={(checked) => setFormData({ ...formData, usar_costelas: checked })}
                    />
                  </div>

                  {formData.usar_costelas && (
                    <div className="grid grid-cols-2 gap-4 p-4 bg-yellow-50 rounded border border-yellow-200">
                      <div>
                        <Label>Quantidade de Costelas *</Label>
                        <Input
                          type="number"
                          min="0"
                          value={formData.quantidade_costelas}
                          onChange={(e) => setFormData({ ...formData, quantidade_costelas: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                      <div>
                        <Label>Bitola das Costelas *</Label>
                        <Select
                          value={formData.bitola_costelas}
                          onValueChange={(v) => setFormData({ ...formData, bitola_costelas: v })}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.keys(PESOS_BITOLA).filter(b => parseFloat(b) >= 6.3 && parseFloat(b) <= 10.0).map(bitola => (
                              <SelectItem key={bitola} value={bitola}>{bitola}mm</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </>
              ) : tipoSelecionado === "Estaca/Broca" ? (
                <>
                  <div>
                    <Label>Comprimento (cm) *</Label>
                    <Input
                      type="number"
                      step="1"
                      value={formData.comprimento}
                      onChange={(e) => setFormData({ ...formData, comprimento: parseFloat(e.target.value) || 0 })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Bitola Principal</Label>
                      <Select
                        value={formData.ferro_principal_bitola}
                        onValueChange={(v) => setFormData({ ...formData, ferro_principal_bitola: v })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.keys(PESOS_BITOLA).filter(b => parseFloat(b) >= 8.0).map(bitola => (
                            <SelectItem key={bitola} value={bitola}>{bitola}mm</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Quantidade de Ferros</Label>
                      <Input
                        type="number"
                        min="1"
                        value={formData.ferro_principal_quantidade}
                        onChange={(e) => setFormData({ ...formData, ferro_principal_quantidade: parseInt(e.target.value) || 4 })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>Diâmetro do Estribo (cm)</Label>
                      <Input
                        type="number"
                        step="1"
                        value={formData.estribo_diametro}
                        onChange={(e) => setFormData({ ...formData, estribo_diametro: parseFloat(e.target.value) || 0 })}
                      />
                    </div>

                    <div>
                      <Label>Distância entre Estribos (cm)</Label>
                      <Input
                        type="number"
                        step="1"
                        value={formData.estribo_distancia}
                        onChange={(e) => setFormData({ ...formData, estribo_distancia: parseFloat(e.target.value) || 15 })}
                      />
                    </div>

                    <div>
                      <Label>Bitola Estribos</Label>
                      <Select
                        value={formData.estribo_bitola}
                        onValueChange={(v) => setFormData({ ...formData, estribo_bitola: v })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="4.2">4.2mm</SelectItem>
                          <SelectItem value="5.0">5.0mm</SelectItem>
                          <SelectItem value="6.3">6.3mm</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </>
              ) : ( // Default for Coluna, Viga
                <>
                  <div>
                    <Label>Comprimento (cm) *</Label>
                    <Input
                      type="number"
                      step="1"
                      value={formData.comprimento}
                      onChange={(e) => setFormData({ ...formData, comprimento: parseFloat(e.target.value) || 0 })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Bitola Principal</Label>
                      <Select
                        value={formData.ferro_principal_bitola}
                        onValueChange={(v) => setFormData({ ...formData, ferro_principal_bitola: v })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.keys(PESOS_BITOLA).filter(b => parseFloat(b) >= 8.0).map(bitola => (
                            <SelectItem key={bitola} value={bitola}>{bitola}mm</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Quantidade de Ferros</Label>
                      <Input
                        type="number"
                        min="1"
                        value={formData.ferro_principal_quantidade}
                        onChange={(e) => setFormData({ ...formData, ferro_principal_quantidade: parseInt(e.target.value) || 4 })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>Largura Estribo (cm)</Label>
                      <Input
                        type="number"
                        step="1"
                        value={formData.estribo_largura}
                        onChange={(e) => setFormData({ ...formData, estribo_largura: parseFloat(e.target.value) || 0 })}
                      />
                    </div>

                    <div>
                      <Label>Altura Estribo (cm)</Label>
                      <Input
                        type="number"
                        step="1"
                        value={formData.estribo_altura}
                        onChange={(e) => setFormData({ ...formData, estribo_altura: parseFloat(e.target.value) || 0 })}
                      />
                    </div>

                    <div>
                      <Label>Distância (cm)</Label>
                      <Input
                        type="number"
                        step="1"
                        value={formData.estribo_distancia}
                        onChange={(e) => setFormData({ ...formData, estribo_distancia: parseFloat(e.target.value) || 15 })}
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Bitola Estribos</Label>
                    <Select
                      value={formData.estribo_bitola}
                      onValueChange={(v) => setFormData({ ...formData, estribo_bitola: v })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="4.2">4.2mm</SelectItem>
                        <SelectItem value="5.0">5.0mm</SelectItem>
                        <SelectItem value="6.3">6.3mm</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Button 
            onClick={tipoSelecionado === "Bloco" ? calcularBloco : calcularElemento}
            className="w-full h-16 text-lg bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
            disabled={!contextoValido}
            data-action="FormularioArmado.calcular"
            data-permission="Producao.Engenharia.criar"
          >
            <Calculator className="w-6 h-6 mr-2" />
            CALCULAR {tipoSelecionado.toUpperCase()}
          </Button>

          {resumo && (
            <>
              <Card className="border-2 border-green-500">
                <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50">
                  <CardTitle className="flex items-center gap-2">
                    <Layers className="w-5 h-5 text-green-600" />
                    Resumo Calculado
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  {tipoSelecionado === "Bloco" ? (
                    <>
                      <div className="grid grid-cols-3 gap-6">
                        <div className="text-center p-4 bg-blue-50 rounded">
                          <p className="text-sm text-slate-600 mb-1">Ferros Lado 1</p>
                          <p className="text-3xl font-bold text-blue-600">{resumo.ferros_lado1}</p>
                          <p className="text-xs text-slate-500 mt-1">barras de {formData.ferro_principal_bitola}mm</p>
                        </div>
                        <div className="text-center p-4 bg-purple-50 rounded">
                          <p className="text-sm text-slate-600 mb-1">Ferros Lado 2</p>
                          <p className="text-3xl font-bold text-purple-600">{resumo.ferros_lado2}</p>
                          <p className="text-xs text-slate-500 mt-1">barras de {formData.ferro_principal_bitola}mm</p>
                        </div>
                        <div className="text-center p-4 bg-orange-50 rounded">
                          <p className="text-sm text-slate-600 mb-1">Costelas</p>
                          <p className="text-3xl font-bold text-orange-600">{resumo.costelas}</p>
                          <p className="text-xs text-slate-500 mt-1">{resumo.costelas > 0 ? `reforços de ${formData.bitola_costelas}mm` : 'sem costelas'}</p>
                        </div>
                      </div>
                      <Separator className="my-4" />
                    </>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-6">
                        <div className="text-center p-4 bg-blue-50 rounded">
                          <p className="text-sm text-slate-600 mb-1">Ferros Principais</p>
                          <p className="text-3xl font-bold text-blue-600">{resumo.ferros}</p>
                          <p className="text-xs text-slate-500 mt-1">barras de {formData.ferro_principal_bitola}mm</p>
                        </div>
                        <div className="text-center p-4 bg-orange-50 rounded">
                          <p className="text-sm text-slate-600 mb-1">Estribos</p>
                          <p className="text-3xl font-bold text-orange-600">{resumo.estribos}</p>
                          <p className="text-xs text-slate-500 mt-1">{formData.estribo_bitola}mm</p>
                        </div>
                      </div>
                      <Separator className="my-4" />
                    </>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 rounded">
                      <p className="text-sm text-slate-600 mb-1">Estribos Totais</p>
                      <p className="text-2xl font-bold">{resumo.estribos} unidades</p>
                      {tipoSelecionado === "Bloco" && (
                        <p className="text-xs text-slate-500">{formData.estribo_largura}x{formData.estribo_altura}cm - 4.2mm (fixo)</p>
                      )}
                      {tipoSelecionado === "Estaca/Broca" && (
                        <p className="text-xs text-slate-500">Ø{formData.estribo_diametro}cm - {formData.estribo_bitola}mm</p>
                      )}
                      {(tipoSelecionado === "Coluna" || tipoSelecionado === "Viga") && (
                        <p className="text-xs text-slate-500">{formData.estribo_largura}x{formData.estribo_altura}cm - {formData.estribo_bitola}mm</p>
                      )}
                    </div>
                    <div className="p-4 bg-green-50 rounded">
                      <p className="text-sm text-slate-600 mb-1">Peso Total</p>
                      <p className="text-2xl font-bold text-green-600">{resumo.peso_total.toFixed(2)} kg</p>
                      <p className="text-xs text-slate-500">Aço: {resumo.peso_aco.toFixed(2)} kg + Arame: {resumo.peso_arame.toFixed(2)} kg</p>
                    </div>
                  </div>

                  <Separator className="my-4" />

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-yellow-50 rounded">
                      <p className="text-sm text-slate-600 mb-1">Custo Total</p>
                      <p className="text-2xl font-bold text-yellow-700">R$ {formData.custo_total.toFixed(2)}</p>
                      <p className="text-xs text-slate-500">por peça</p>
                    </div>
                    <div className="p-4 bg-green-100 rounded">
                      <p className="text-sm text-slate-600 mb-1">Preço de Venda</p>
                      <p className="text-2xl font-bold text-green-700">R$ {formData.preco_venda_total.toFixed(2)}</p>
                      <p className="text-xs text-slate-500">{formData.quantidade} peça(s) × R$ {formData.preco_venda_unitario.toFixed(2)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancelar}>
          Cancelar
        </Button>
        <Button type="button" onClick={handleSalvar} disabled={!resumo || !contextoValido || !podeSalvarArmado} className="bg-blue-600 hover:bg-blue-700" data-action="FormularioArmado.salvar" data-permission="Producao.Engenharia.criar" data-sensitive>
          <Save className="w-4 h-4 mr-2" />
          Adicionar Item
        </Button>
      </div>
    </div>
  );
}
