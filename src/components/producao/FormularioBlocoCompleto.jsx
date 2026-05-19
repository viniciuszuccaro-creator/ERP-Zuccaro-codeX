
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calculator, Package, Ruler, Layers, Grid3x3 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { useUser } from "@/components/lib/UserContext";

export default function FormularioBlocoCompleto({ onSalvar, onCancelar, blocoInicial = null }) {
  const { toast } = useToast();
  const { empresaAtual, grupoAtual, filterInContext } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const { user } = useUser();
  const empresaId = blocoInicial?.empresa_id || empresaAtual?.id || null;
  const groupId = blocoInicial?.group_id || blocoInicial?.grupo_id || grupoAtual?.id || empresaAtual?.group_id || null;
  const contextoValido = Boolean(groupId || empresaId);
  const contextKey = groupId ? `grupo:${groupId}` : `empresa:${empresaId || "sem-empresa"}`;
  const podeSalvarBloco = hasPermission("Produção", "Engenharia", "criar") ||
    hasPermission("Produção", "Bloco", "criar") ||
    hasPermission("Producao", "Engenharia", "criar") ||
    hasPermission("Producao", "Bloco", "criar");

  const { data: configuracoes } = useQuery({
    queryKey: ['configProducao', 'bloco', contextKey],
    queryFn: async () => {
      const configs = await filterInContext("ConfiguracaoProducao", { tipo: "Configuração Geral" }, "-created_date", 20);
      return configs[0] || { perda_aco_percentual: 5, perda_arame_percentual: 10 };
    },
    enabled: contextoValido,
  });

  const [formData, setFormData] = useState(blocoInicial || {
    identificador: `BLOCO-${Date.now()}`,
    tipo_peca: "Bloco",
    quantidade: 1,
    comprimento: 0, // cm
    altura: 0, // cm
    largura: 0, // cm
    espacamento_ferros: 15, // cm
    
    // Ferros principais
    bitola_principal: "10.0",
    quantidade_ferros_lado1: 0,
    quantidade_ferros_lado2: 0,
    
    // Costelas (reforços)
    quantidade_costelas: 0,
    bitola_costelas: "8.0",
    
    // Estribos
    estribo_bitola: "4.2",
    estribo_largura: 0,
    estribo_altura: 0,
    estribo_distancia: 15,
    quantidade_estribos: 0,
    
    // Calculados
    peso_ferro_principal: 0,
    peso_costelas: 0,
    peso_estribos: 0,
    peso_arame_recozido: 0,
    peso_total_kg: 0,
    
    // Preços
    custo_material: 0,
    custo_mao_obra: 0,
    custo_overhead: 0,
    custo_total: 0,
    preco_venda_unitario: 0,
    preco_venda_total: 0
  });

  const [resumo, setResumo] = useState(null);

  // PESOS POR BITOLA (kg/m)
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

  useEffect(() => {
    if (formData.comprimento > 0 && formData.altura > 0 && formData.largura > 0) {
      calcularAutomatico();
    }
  }, [
    formData.comprimento,
    formData.altura,
    formData.largura,
    formData.espacamento_ferros,
    formData.bitola_principal,
    formData.estribo_distancia,
    formData.quantidade,
    formData.bitola_costelas, // Added for completeness, though config. dependencies are handled via `configuracoes`
    formData.estribo_bitola, // Added for completeness
    configuracoes?.perda_aco_percentual,
    configuracoes?.perda_arame_percentual,
    configuracoes?.preco_aco_kg,
    configuracoes?.preco_arame_kg,
  ]);

  const calcularAutomatico = () => {
    const { comprimento, altura, largura, espacamento_ferros, estribo_distancia } = formData;

    // 1. CALCULAR QUANTIDADE DE FERROS
    // Lado 1 (largura): número de ferros baseado no espaçamento
    const qtdFerrosLado1 = Math.ceil(largura / espacamento_ferros) + 1;
    
    // Lado 2 (altura): número de ferros baseado no espaçamento
    const qtdFerrosLado2 = Math.ceil(altura / espacamento_ferros) + 1;

    // 2. CALCULAR COSTELAS (reforços a cada 30cm ao longo do comprimento)
    const qtdCostelas = Math.floor(comprimento / 30);

    // 3. CALCULAR ESTRIBOS
    const qtdEstribos = Math.ceil(comprimento / estribo_distancia);

    // 4. DIMENSÕES DOS ESTRIBOS (largura x altura do bloco)
    const estriboLargura = largura;
    const estriboAltura = altura;

    // 5. CALCULAR PESOS
    const pesoFerroKgM = PESOS_BITOLA[formData.bitola_principal] || 0.617;
    const pesoCostelasKgM = PESOS_BITOLA[formData.bitola_costelas] || 0.395;
    const pesoEstriboKgM = PESOS_BITOLA[formData.estribo_bitola] || 0.109;

    // Peso dos ferros principais (lado 1 + lado 2)
    const comprimentoTotalFerros = (qtdFerrosLado1 * comprimento) + (qtdFerrosLado2 * comprimento);
    const pesoFerroPrincipal = (comprimentoTotalFerros / 100) * pesoFerroKgM;

    // Peso das costelas
    const comprimentoCostela = (largura + altura) * 2; // perímetro do bloco
    const pesoCostelas = (comprimentoCostela * qtdCostelas / 100) * pesoCostelasKgM;

    // Peso dos estribos
    const perimetroEstribo = (estriboLargura + estriboAltura) * 2 + 10; // +10cm para ganchos
    const pesoEstribos = (perimetroEstribo * qtdEstribos / 100) * pesoEstriboKgM;

    // Peso do arame recozido (10g por amarra, estimativa)
    const qtdAmarras = (qtdFerrosLado1 + qtdFerrosLado2) * qtdEstribos;
    const pesoArame = (qtdAmarras * 10) / 1000; // converter g para kg

    // Total com perdas
    const perdaAco = configuracoes?.perda_aco_percentual || 5;
    const perdaArame = configuracoes?.perda_arame_percentual || 10;

    const pesoTotalAco = (pesoFerroPrincipal + pesoCostelas + pesoEstribos) * (1 + perdaAco / 100);
    const pesoTotalArame = pesoArame * (1 + perdaArame / 100);
    const pesoTotal = pesoTotalAco + pesoTotalArame;

    // 6. CALCULAR CUSTOS
    const precoAcoKg = configuracoes?.preco_aco_kg || 8.5;
    const precoArameKg = configuracoes?.preco_arame_kg || 12.0;

    const custoMaterial = (pesoTotalAco * precoAcoKg) + (pesoTotalArame * precoArameKg);
    const custoMaoObra = custoMaterial * 0.3; // 30% do material
    const custoOverhead = custoMaterial * 0.15; // 15% do material
    const custoTotal = custoMaterial + custoMaoObra + custoOverhead;

    // Margem de 40%
    const precoVendaUnitario = custoTotal * 1.4;
    const precoVendaTotal = precoVendaUnitario * formData.quantidade;

    // ATUALIZAR FORM DATA
    setFormData(prev => ({
      ...prev,
      quantidade_ferros_lado1: qtdFerrosLado1,
      quantidade_ferros_lado2: qtdFerrosLado2,
      quantidade_costelas: qtdCostelas,
      estribo_largura: estriboLargura,
      estribo_altura: estriboAltura,
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

    // GERAR RESUMO
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

  const handleSalvar = () => {
    const auditarBloco = (acao, descricao, sucesso = true, dadosNovos = null) => {
      base44.entities.AuditLog.create({
        usuario: user?.full_name || user?.email || "Usuario local",
        usuario_id: user?.id || null,
        empresa_id: empresaId,
        group_id: groupId,
        grupo_id: groupId,
        acao,
        modulo: "Produção",
        entidade: "FormularioBloco",
        registro_id: blocoInicial?.id || null,
        tipo_auditoria: sucesso ? "operacional" : "seguranca",
        descricao,
        dados_anteriores: blocoInicial,
        dados_novos: dadosNovos,
        sucesso,
        data_hora: new Date().toISOString()
      }).catch((error) => console.warn("Falha ao auditar bloco:", error));
    };

    if (!contextoValido) {
      auditarBloco("FormularioBloco.bloqueado", "Tentativa de adicionar bloco sem contexto grupo/empresa.", false, formData);
      toast({ title: "❌ Contexto obrigatório", description: "Selecione grupo ou empresa antes de adicionar o bloco.", variant: "destructive" });
      return;
    }
    if (!podeSalvarBloco) {
      auditarBloco("FormularioBloco.bloqueado", "Tentativa de adicionar bloco sem permissão.", false, formData);
      toast({ title: "❌ Acesso negado", description: "Seu perfil não pode adicionar blocos.", variant: "destructive" });
      return;
    }
    if (!formData.comprimento || !formData.altura || !formData.largura) {
      toast({
        title: "❌ Erro",
        description: "Preencha comprimento, altura e largura do bloco",
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

    const comprimentoMetros = (formData.comprimento / 100).toFixed(2);
    const descricaoAutomatica = `${formData.quantidade} BLOCO de ${comprimentoMetros}m x ${formData.largura}cm x ${formData.altura}cm – ${formData.quantidade_ferros_lado1 + formData.quantidade_ferros_lado2} ferros ${formData.bitola_principal}mm – ${formData.quantidade_costelas} costelas – ${formData.quantidade_estribos} estribos`;

    const blocoCompleto = {
      ...formData,
      tipo_servico: "armado",
      nome_projeto: formData.identificador,
      empresa_id: empresaId,
      group_id: groupId,
      grupo_id: groupId,
      descricao_automatica: descricaoAutomatica,
      resumo: resumo
    };

    auditarBloco(blocoInicial?.id ? "Edição" : "Criação", "Bloco calculado e adicionado ao pedido.", true, blocoCompleto);
    onSalvar(blocoCompleto);
    toast({ title: "✅ Bloco Adicionado ao Pedido!" });
  };

  return (
    <div className="space-y-6 w-full h-full" data-permission="Producao.Engenharia.criar" data-context-required="true">
      {/* DADOS DO BLOCO */}
      <Card>
        <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50">
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" />
            Dados do Bloco
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Identificador *</Label>
              <Input
                value={formData.identificador}
                onChange={(e) => setFormData({ ...formData, identificador: e.target.value })}
                placeholder="Ex: BLOCO-01"
              />
            </div>
            <div>
              <Label>Quantidade de Blocos *</Label>
              <Input
                type="number"
                min="1"
                value={formData.quantidade}
                onChange={(e) => setFormData({ ...formData, quantidade: parseInt(e.target.value) || 1 })}
              />
            </div>
          </div>

          <Separator />

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

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Bitola Ferros Principais</Label>
              <Select
                value={formData.bitola_principal}
                onValueChange={(v) => setFormData({ ...formData, bitola_principal: v })}
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
              <Label>Bitola Costelas</Label>
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

          <div>
            <Label>Distância entre Estribos (cm)</Label>
            <Input
              type="number"
              step="1"
              value={formData.estribo_distancia}
              onChange={(e) => setFormData({ ...formData, estribo_distancia: parseFloat(e.target.value) || 15 })}
            />
          </div>
        </CardContent>
      </Card>

      {/* BOTÃO CALCULAR */}
      <Button 
        onClick={calcularAutomatico}
        className="w-full h-16 text-lg bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
        disabled={!contextoValido}
        data-action="FormularioBloco.calcular"
        data-permission="Producao.Engenharia.criar"
      >
        <Calculator className="w-6 h-6 mr-2" />
        CALCULAR BLOCO
      </Button>

      {/* RESUMO */}
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
              <div className="grid grid-cols-3 gap-6">
                <div className="text-center p-4 bg-blue-50 rounded">
                  <p className="text-sm text-slate-600 mb-1">Ferros Lado 1</p>
                  <p className="text-3xl font-bold text-blue-600">{resumo.ferros_lado1}</p>
                  <p className="text-xs text-slate-500 mt-1">barras de {formData.bitola_principal}mm</p>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded">
                  <p className="text-sm text-slate-600 mb-1">Ferros Lado 2</p>
                  <p className="text-3xl font-bold text-purple-600">{resumo.ferros_lado2}</p>
                  <p className="text-xs text-slate-500 mt-1">barras de {formData.bitola_principal}mm</p>
                </div>
                <div className="text-center p-4 bg-orange-50 rounded">
                  <p className="text-sm text-slate-600 mb-1">Costelas</p>
                  <p className="text-3xl font-bold text-orange-600">{resumo.costelas}</p>
                  <p className="text-xs text-slate-500 mt-1">reforços de {formData.bitola_costelas}mm</p>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded">
                  <p className="text-sm text-slate-600 mb-1">Estribos</p>
                  <p className="text-2xl font-bold">{resumo.estribos} unidades</p>
                  <p className="text-xs text-slate-500">{formData.estribo_largura}x{formData.estribo_altura}cm - {formData.estribo_bitola}mm</p>
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
                  <p className="text-xs text-slate-500">por bloco</p>
                </div>
                <div className="p-4 bg-green-100 rounded">
                  <p className="text-sm text-slate-600 mb-1">Preço de Venda</p>
                  <p className="text-2xl font-bold text-green-700">R$ {formData.preco_venda_total.toFixed(2)}</p>
                  <p className="text-xs text-slate-500">{formData.quantidade} bloco(s) × R$ {formData.preco_venda_unitario.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="p-4 bg-blue-50 border border-blue-200 rounded">
            <div className="flex items-start gap-3">
              <Package className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-blue-800 mb-1">📋 Descrição Automática:</p>
                <p className="text-base font-bold text-slate-900 leading-relaxed">
                  {formData.quantidade} BLOCO de {(formData.comprimento / 100).toFixed(2)}m x {formData.largura}cm x {formData.altura}cm – {formData.quantidade_ferros_lado1 + formData.quantidade_ferros_lado2} ferros {formData.bitola_principal}mm – {formData.quantidade_costelas} costelas – {formData.quantidade_estribos} estribos
                </p>
                <Badge className="bg-blue-600 mt-2">Gerado Automaticamente</Badge>
              </div>
            </div>
          </div>
        </>
      )}

      {/* BOTÕES */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onCancelar}>
          Cancelar
        </Button>
        <Button
          onClick={handleSalvar}
          disabled={!resumo || !contextoValido || !podeSalvarBloco}
          className="bg-green-600 hover:bg-green-700 min-w-[200px]"
          data-action="FormularioBloco.salvar"
          data-permission="Producao.Engenharia.criar"
          data-sensitive
        >
          <Package className="w-4 h-4 mr-2" />
          Adicionar Bloco ao Pedido
        </Button>
      </div>
    </div>
  );
}
