import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Receipt, Calculator, AlertCircle, Sparkles, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import usePermissions from "@/components/lib/usePermissions";
import { useContextoVisual } from "@/components/lib/useContextoVisual";

/**
 * FORMULÁRIO DE TABELA FISCAL V21.2 - FASE 2
 * Configurações fiscais por empresa, regime e cenário
 * Com IA de Compliance Fiscal integrada
 */
export default function TabelaFiscalForm({ 
  tabela, 
  windowMode = false,
  onSubmit,
  onCancel 
}) {
  const { hasPermission } = usePermissions();
  const { empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || tabela?.group_id || null;
  const contextoValido = Boolean(empresaAtual?.id || groupId || tabela?.empresa_id || tabela?.group_id);
  const podeCriar = hasPermission?.("Cadastros.TabelaFiscal.criar") || hasPermission?.("Financeiro.TabelaFiscal.criar");
  const podeEditar = hasPermission?.("Cadastros.TabelaFiscal.editar") || hasPermission?.("Financeiro.TabelaFiscal.editar");
  const podeUsarIA = hasPermission?.("Cadastros.TabelaFiscal.ia") || hasPermission?.("Financeiro.TabelaFiscal.ia") || podeEditar || podeCriar;
  const podeSalvar = tabela?.id ? podeEditar : podeCriar;

  const [formData, setFormData] = useState({
    nome_regra: "",
    empresa_id: "",
    regime_tributario: "Simples Nacional",
    cenario_operacao: "Venda Consumidor Final",
    ncm: "",
    cfop: "",
    destino_operacao: "Dentro do Estado",
    tipo_cliente: "Pessoa Física",
    icms_cst_csosn: "",
    icms_aliquota: 0,
    icms_reducao_base: 0,
    icms_st_aliquota: 0,
    icms_st_mva: 0,
    pis_cst: "",
    pis_aliquota: 0,
    cofins_cst: "",
    cofins_aliquota: 0,
    ipi_cst: "",
    ipi_aliquota: 0,
    fcp_aliquota: 0,
    diferencial_aliquota: 0,
    origem_mercadoria: "0 - Nacional",
    regra_ativa: true,
    prioridade: 100,
    ...tabela
  });

  const [abaAtiva, setAbaAtiva] = useState("configuracao");
  const [validandoIA, setValidandoIA] = useState(false);
  const [sugestaoIA, setSugestaoIA] = useState(null);

  const handleValidarIA = async () => {
    if (!podeUsarIA) {
      toast.error("Sem permissão para validar tabela fiscal com IA.");
      return;
    }
    setValidandoIA(true);
    try {
      const resultado = await base44.integrations.Core.InvokeLLM({
        prompt: `Você é um especialista fiscal brasileiro. Analise esta configuração tributária e sugira as alíquotas corretas:

Regime: ${formData.regime_tributario}
Cenário: ${formData.cenario_operacao}
NCM: ${formData.ncm}
CFOP: ${formData.cfop}
Destino: ${formData.destino_operacao}
Tipo Cliente: ${formData.tipo_cliente}

Sugira:
- CST/CSOSN apropriado
- Alíquotas de ICMS, PIS, COFINS, IPI
- Possíveis alertas ou inconsistências
- Legislação de base

Seja preciso e cite a legislação aplicável.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            icms_cst_sugerido: { type: "string" },
            icms_aliquota_sugerida: { type: "number" },
            pis_cst_sugerido: { type: "string" },
            pis_aliquota_sugerida: { type: "number" },
            cofins_cst_sugerido: { type: "string" },
            cofins_aliquota_sugerida: { type: "number" },
            alertas: { 
              type: "array",
              items: { type: "string" }
            },
            recomendacao: { type: "string" },
            legislacao: { type: "string" }
          }
        }
      });

      setSugestaoIA(resultado);
      toast.success("✨ IA analisou a configuração fiscal");
    } catch (error) {
      toast.error("Erro na validação IA: " + error.message);
    } finally {
      setValidandoIA(false);
    }
  };

  const handleAplicarSugestaoIA = () => {
    if (!sugestaoIA) return;
    if (!podeSalvar) {
      toast.error("Sem permissão para aplicar sugestões na tabela fiscal.");
      return;
    }

    setFormData(prev => ({
      ...prev,
      icms_cst_csosn: sugestaoIA.icms_cst_sugerido || prev.icms_cst_csosn,
      icms_aliquota: sugestaoIA.icms_aliquota_sugerida || prev.icms_aliquota,
      pis_cst: sugestaoIA.pis_cst_sugerido || prev.pis_cst,
      pis_aliquota: sugestaoIA.pis_aliquota_sugerida || prev.pis_aliquota,
      cofins_cst: sugestaoIA.cofins_cst_sugerido || prev.cofins_cst,
      cofins_aliquota: sugestaoIA.cofins_aliquota_sugerida || prev.cofins_aliquota,
      validado_ia: true,
      ultima_validacao_ia: new Date().toISOString(),
      confianca_ia: 85,
      legislacao_base: sugestaoIA.legislacao
    }));

    toast.success("✅ Sugestões da IA aplicadas");
  };

  const handleSubmitForm = (e) => {
    e.preventDefault();
    if (!formData.nome_regra || !formData.cfop) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }
    if (!contextoValido) {
      toast.error("Selecione um grupo ou empresa antes de salvar.");
      return;
    }
    if (!podeSalvar) {
      toast.error("Sem permissão para salvar tabela fiscal.");
      return;
    }
    if (onSubmit) {
      onSubmit({
        ...formData,
        empresa_id: contexto === "empresa" ? empresaAtual?.id : formData.empresa_id,
        group_id: groupId || formData.group_id,
        nome: formData.nome_regra,
        descricao: formData.cfop + ' - ' + formData.regime_tributario
      });
    }
  };

  const containerClass = windowMode 
    ? "w-full h-full flex flex-col overflow-hidden" 
    : "p-6";

  const contentClass = windowMode 
    ? "flex-1 overflow-y-auto p-6" 
    : "";

  return (
    <div className={containerClass}>
      <div className={contentClass}>
        <form onSubmit={handleSubmitForm} className="space-y-6">
          {/* SUGESTÃO IA */}
          {sugestaoIA && (
            <Alert className="border-purple-300 bg-purple-50">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <AlertDescription className="text-sm">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <strong>Sugestão da IA Fiscal:</strong>
                    <p className="mt-1">{sugestaoIA.recomendacao}</p>
                    {sugestaoIA.alertas?.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {sugestaoIA.alertas.map((alerta, idx) => (
                          <li key={idx} className="text-xs">• {alerta}</li>
                        ))}
                      </ul>
                    )}
                    {sugestaoIA.legislacao && (
                      <p className="text-xs mt-2 text-purple-700">
                        <strong>Base Legal:</strong> {sugestaoIA.legislacao}
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAplicarSugestaoIA}
                    disabled={!podeSalvar}
                    data-permission="Cadastros.TabelaFiscal.ia"
                    data-sensitive="true"
                    className="ml-4 bg-purple-600 hover:bg-purple-700"
                  >
                    Aplicar Sugestões
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          <Tabs value={abaAtiva} onValueChange={setAbaAtiva}>
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="configuracao">⚙️ Configuração</TabsTrigger>
              <TabsTrigger value="tributos">💰 Tributos</TabsTrigger>
              <TabsTrigger value="validacao">✅ Validação</TabsTrigger>
            </TabsList>

            {/* ABA CONFIGURAÇÃO */}
            <TabsContent value="configuracao" className="space-y-4">
              <div>
                <Label>Nome da Regra *</Label>
                <Input
                  value={formData.nome_regra}
                  onChange={(e) => setFormData({ ...formData, nome_regra: e.target.value })}
                  placeholder="Ex: Venda Simples Nacional - Dentro do Estado"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Regime Tributário *</Label>
                  <Select
                    value={formData.regime_tributario}
                    onValueChange={(value) => setFormData({ ...formData, regime_tributario: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Simples Nacional">Simples Nacional</SelectItem>
                      <SelectItem value="Lucro Presumido">Lucro Presumido</SelectItem>
                      <SelectItem value="Lucro Real">Lucro Real</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Cenário de Operação *</Label>
                  <Select
                    value={formData.cenario_operacao}
                    onValueChange={(value) => setFormData({ ...formData, cenario_operacao: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Venda Consumidor Final">Venda Consumidor Final</SelectItem>
                      <SelectItem value="Venda para Revenda">Venda para Revenda</SelectItem>
                      <SelectItem value="Venda Industrialização">Venda Industrialização</SelectItem>
                      <SelectItem value="Devolução">Devolução</SelectItem>
                      <SelectItem value="Remessa">Remessa</SelectItem>
                      <SelectItem value="Transferência">Transferência</SelectItem>
                      <SelectItem value="Compra Nacional">Compra Nacional</SelectItem>
                      <SelectItem value="Importação">Importação</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>NCM</Label>
                  <Input
                    value={formData.ncm}
                    onChange={(e) => setFormData({ ...formData, ncm: e.target.value })}
                    placeholder="Ex: 72142000"
                  />
                </div>

                <div>
                  <Label>CFOP *</Label>
                  <Input
                    value={formData.cfop}
                    onChange={(e) => setFormData({ ...formData, cfop: e.target.value })}
                    placeholder="Ex: 5102"
                    required
                  />
                </div>

                <div>
                  <Label>Destino</Label>
                  <Select
                    value={formData.destino_operacao}
                    onValueChange={(value) => setFormData({ ...formData, destino_operacao: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Dentro do Estado">Dentro do Estado</SelectItem>
                      <SelectItem value="Fora do Estado">Fora do Estado</SelectItem>
                      <SelectItem value="Exterior">Exterior</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Tipo de Cliente</Label>
                <Select
                  value={formData.tipo_cliente}
                  onValueChange={(value) => setFormData({ ...formData, tipo_cliente: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pessoa Física">Pessoa Física</SelectItem>
                    <SelectItem value="Pessoa Jurídica">Pessoa Jurídica</SelectItem>
                    <SelectItem value="Contribuinte ICMS">Contribuinte ICMS</SelectItem>
                    <SelectItem value="Não Contribuinte">Não Contribuinte</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            {/* ABA TRIBUTOS */}
            <TabsContent value="tributos" className="space-y-4">
              <Card className="bg-blue-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">ICMS</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs">CST/CSOSN</Label>
                      <Input
                        value={formData.icms_cst_csosn}
                        onChange={(e) => setFormData({ ...formData, icms_cst_csosn: e.target.value })}
                        placeholder="Ex: 102"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Alíquota (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.icms_aliquota}
                        onChange={(e) => setFormData({ ...formData, icms_aliquota: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs">Redução Base (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.icms_reducao_base}
                        onChange={(e) => setFormData({ ...formData, icms_reducao_base: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">MVA ST (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.icms_st_mva}
                        onChange={(e) => setFormData({ ...formData, icms_st_mva: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-2 gap-4">
                <Card className="bg-green-50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">PIS</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label className="text-xs">CST</Label>
                      <Input
                        value={formData.pis_cst}
                        onChange={(e) => setFormData({ ...formData, pis_cst: e.target.value })}
                        placeholder="Ex: 01"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Alíquota (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.pis_aliquota}
                        onChange={(e) => setFormData({ ...formData, pis_aliquota: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-purple-50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">COFINS</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label className="text-xs">CST</Label>
                      <Input
                        value={formData.cofins_cst}
                        onChange={(e) => setFormData({ ...formData, cofins_cst: e.target.value })}
                        placeholder="Ex: 01"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Alíquota (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.cofins_aliquota}
                        onChange={(e) => setFormData({ ...formData, cofins_aliquota: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Card className="bg-orange-50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">IPI</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label className="text-xs">CST</Label>
                      <Input
                        value={formData.ipi_cst}
                        onChange={(e) => setFormData({ ...formData, ipi_cst: e.target.value })}
                        placeholder="Ex: 53"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Alíquota (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.ipi_aliquota}
                        onChange={(e) => setFormData({ ...formData, ipi_aliquota: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-red-50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Outros</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label className="text-xs">FCP (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.fcp_aliquota}
                        onChange={(e) => setFormData({ ...formData, fcp_aliquota: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">DIFAL (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.diferencial_aliquota}
                        onChange={(e) => setFormData({ ...formData, diferencial_aliquota: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ABA VALIDAÇÃO */}
            <TabsContent value="validacao" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Status de Validação IA</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {formData.validado_ia ? (
                    <Alert className="border-green-300 bg-green-50">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      <AlertDescription>
                        <strong>Validado pela IA</strong>
                        <p className="text-xs mt-1">
                          Confiança: {formData.confianca_ia}%
                        </p>
                        {formData.ultima_validacao_ia && (
                          <p className="text-xs">
                            Última validação: {new Date(formData.ultima_validacao_ia).toLocaleString('pt-BR')}
                          </p>
                        )}
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <Alert className="border-orange-300 bg-orange-50">
                      <AlertCircle className="w-4 h-4 text-orange-600" />
                      <AlertDescription>
                        Esta regra fiscal ainda não foi validada pela IA.
                        Clique em "Validar com IA" para obter sugestões.
                      </AlertDescription>
                    </Alert>
                  )}

                  <Button
                    type="button"
                    onClick={handleValidarIA}
                    disabled={validandoIA || !podeUsarIA}
                    data-permission="Cadastros.TabelaFiscal.ia"
                    data-sensitive="true"
                    className="w-full"
                    variant="outline"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    {validandoIA ? "Validando com IA..." : "Validar com IA Fiscal"}
                  </Button>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs">Prioridade</Label>
                      <Input
                        type="number"
                        value={formData.prioridade}
                        onChange={(e) => setFormData({ ...formData, prioridade: parseInt(e.target.value) || 100 })}
                      />
                      <p className="text-xs text-slate-500 mt-1">Quanto maior, mais prioritária</p>
                    </div>

                    <div>
                      <Label className="text-xs">Origem da Mercadoria</Label>
                      <Select
                        value={formData.origem_mercadoria}
                        onValueChange={(value) => setFormData({ ...formData, origem_mercadoria: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0 - Nacional">0 - Nacional</SelectItem>
                          <SelectItem value="1 - Estrangeira Importação Direta">1 - Estrangeira Importação Direta</SelectItem>
                          <SelectItem value="2 - Estrangeira Mercado Interno">2 - Estrangeira Mercado Interno</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label>Legislação Base</Label>
                    <Textarea
                      value={formData.legislacao_base || ""}
                      onChange={(e) => setFormData({ ...formData, legislacao_base: e.target.value })}
                      placeholder="Referência à legislação..."
                      rows={2}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* FOOTER */}
          <div className="flex items-center justify-between pt-6 border-t">
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.regra_ativa}
                onCheckedChange={(checked) => setFormData({ ...formData, regra_ativa: checked })}
                disabled={!podeSalvar}
                data-permission="Cadastros.TabelaFiscal.alterarStatus"
                data-sensitive="true"
              />
              <Label>Regra Ativa</Label>
            </div>

            <div className="flex gap-3">
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancelar
                </Button>
              )}
              <Button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700"
                disabled={!contextoValido || !podeSalvar}
                data-permission="Cadastros.TabelaFiscal.salvar"
                data-sensitive="true"
              >
                <Receipt className="w-4 h-4 mr-2" />
                {tabela ? 'Atualizar' : 'Criar'} Tabela Fiscal
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
