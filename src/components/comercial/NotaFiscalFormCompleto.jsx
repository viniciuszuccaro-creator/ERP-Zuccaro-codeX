import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  FileText, Plus, Trash2, AlertCircle, CheckCircle2, 
  Building2, Package, DollarSign, Truck, Calculator, Clock
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import GeralTab from "@/components/comercial/nota-fiscal/GeralTab";
import DestinatarioTab from "@/components/comercial/nota-fiscal/DestinatarioTab";
import ItensTab from "@/components/comercial/nota-fiscal/ItensTab";
import TributosTab from "@/components/comercial/nota-fiscal/TributosTab";
import TransporteTab from "@/components/comercial/nota-fiscal/TransporteTab";
import { base44 } from "@/api/base44Client";
import FormWrapper from "@/components/common/FormWrapper";
import usePermissions from "@/components/lib/usePermissions";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import CadastroCodigoRegistroField from "@/components/cadastros/CadastroCodigoRegistroField";

/**
 * FORMULÁRIO COMPLETO DE NOTA FISCAL V21.2
 * FASE 1 COMPLETO + FASE 2 MULTIEMPRESA
 * 
 * Modo Window: w-full h-full responsivo
 * Suporta multiempresa, IA fiscal, validações
 * Emissão NF somente com empresa jurídica no contexto (nunca pelo Grupo genérico).
 */
export default function NotaFiscalFormCompleto({ 
  notaFiscal, 
  pedido,
  windowMode = false,
  onSubmit,
  onCancel 
}) {
  const { canCreate, canEdit } = usePermissions();
  const { empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || notaFiscal?.group_id || pedido?.group_id || null;
  const empresaFaturamentoId = empresaAtual?.id || notaFiscal?.empresa_faturamento_id || pedido?.empresa_id || null;
  const contextoEmpresaValido = Boolean(empresaFaturamentoId);
  const podeCriar = canCreate("Fiscal", "NotaFiscal") || canCreate("Comercial", "NotaFiscal") || canCreate("Fiscal", null);
  const podeEditar = canEdit("Fiscal", "NotaFiscal") || canEdit("Comercial", "NotaFiscal") || canEdit("Fiscal", null);
  const podeSalvar = notaFiscal?.id ? podeEditar : podeCriar;

  const [formData, setFormData] = useState({
    tipo: "NF-e (Saída)",
    numero: "",
    serie: "1",
    modelo: "55",
    natureza_operacao: "Venda de mercadoria",
    cliente_fornecedor: "",
    cliente_fornecedor_id: "",
    cliente_cpf_cnpj: "",
    pedido_id: "",
    numero_pedido: "",
    empresa_faturamento_id: empresaFaturamentoId || "",
    group_id: groupId || "",
    data_emissao: new Date().toISOString().split('T')[0],
    data_saida: new Date().toISOString().split('T')[0],
    hora_emissao: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    hora_saida: "",
    cfop: "5102",
    finalidade: "Normal",
    ambiente: "Homologação",
    valor_produtos: 0,
    valor_servicos: 0,
    valor_desconto: 0,
    valor_frete: 0,
    valor_seguro: 0,
    outras_despesas: 0,
    valor_total: 0,
    observacoes: "",
    informacoes_complementares: "",
    itens: [],
    transportadora: {},
    duplicatas: [],
    status: "Rascunho",
    ...notaFiscal
  });

  const [abaAtiva, setAbaAtiva] = useState("geral");
  const [validacaoIA, setValidacaoIA] = useState(null);
  const [loading, setLoading] = useState(false);

  const schema = z.object({
    numero: z.string().min(1, 'Número obrigatório'),
    cliente_fornecedor: z.string().min(1, 'Cliente/Fornecedor obrigatório'),
    data_emissao: z.string().min(1, 'Data de Emissão obrigatória')
  });

  // Se vier de um pedido, popular dados automaticamente
  useEffect(() => {
    if (pedido && !notaFiscal) {
      setFormData(prev => ({
        ...prev,
        pedido_id: pedido.id,
        numero_pedido: pedido.numero_pedido,
        cliente_fornecedor: pedido.cliente_nome,
        cliente_fornecedor_id: pedido.cliente_id,
        cliente_cpf_cnpj: pedido.cliente_cpf_cnpj,
        valor_produtos: pedido.valor_produtos || pedido.valor_total,
        valor_frete: pedido.valor_frete || 0,
        valor_total: pedido.valor_total,
        empresa_faturamento_id: pedido.empresa_id,
        group_id: pedido.group_id,
      }));
    }
  }, [pedido, notaFiscal]);

  // Calcular valor total
  useEffect(() => {
    const total = 
      (formData.valor_produtos || 0) + 
      (formData.valor_servicos || 0) + 
      (formData.valor_frete || 0) + 
      (formData.valor_seguro || 0) + 
      (formData.outras_despesas || 0) - 
      (formData.valor_desconto || 0);
    
    setFormData(prev => ({ ...prev, valor_total: total }));
  }, [
    formData.valor_produtos, 
    formData.valor_servicos, 
    formData.valor_frete, 
    formData.valor_seguro, 
    formData.outras_despesas, 
    formData.valor_desconto
  ]);

  const handleValidarIA = async () => {
    setLoading(true);
    try {
      const resultado = await base44.integrations.Core.InvokeLLM({
        prompt: `Analise esta NF-e e identifique possíveis erros ou inconsistências fiscais:
        
        Tipo: ${formData.tipo}
        CFOP: ${formData.cfop}
        Natureza: ${formData.natureza_operacao}
        Ambiente: ${formData.ambiente}
        Valor Produtos: R$ ${formData.valor_produtos}
        Valor Total: R$ ${formData.valor_total}
        
        Retorne uma análise com possíveis alertas.`,
        response_json_schema: {
          type: "object",
          properties: {
            valido: { type: "boolean" },
            alertas: { 
              type: "array", 
              items: { 
                type: "object",
                properties: {
                  tipo: { type: "string" },
                  descricao: { type: "string" },
                  severidade: { type: "string" }
                }
              }
            },
            recomendacao: { type: "string" }
          }
        }
      });

      setValidacaoIA(resultado);
      
      if (!resultado.valido) {
        toast.warning("⚠️ IA detectou possíveis inconsistências");
      } else {
        toast.success("✅ Validação IA: Sem problemas detectados");
      }
    } catch (error) {
      toast.error("Erro na validação IA: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();

    if (!contextoEmpresaValido) {
      toast.error("Emissão de NF exige empresa jurídica selecionada (não pelo Grupo genérico).");
      return;
    }
    if (!podeSalvar) {
      toast.error(notaFiscal?.id ? "Sem permissão para editar NF." : "Sem permissão para criar NF.");
      return;
    }
    if (!formData.numero || !formData.cliente_fornecedor) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    if (onSubmit) {
      await onSubmit({
        ...formData,
        group_id: groupId || formData.group_id,
        empresa_faturamento_id: empresaFaturamentoId || formData.empresa_faturamento_id,
        empresa_id: empresaFaturamentoId || formData.empresa_id,
      });
    }
  };

  const containerClass = "w-full h-full flex flex-col overflow-hidden";

  const contentClass = windowMode ? "flex-1 overflow-y-auto p-6" : "flex-1 overflow-y-auto p-6";

  return (
    <div className={containerClass}>
      <div className={contentClass}>
        <FormWrapper schema={schema} withContext onSubmit={(values) => onSubmit && onSubmit(values)} externalData={formData} className="space-y-6">
          <CadastroCodigoRegistroField
            idOnly
            hasId={Boolean(notaFiscal?.id)}
            entityId={notaFiscal?.id}
            action="id-tecnico-nota-fiscal"
          />
          {!contextoEmpresaValido && (
            <Alert className="border-amber-200 bg-amber-50">
              <AlertCircle className="w-4 h-4 text-amber-700" />
              <AlertDescription className="text-sm text-amber-900">
                Selecione a empresa de faturamento. NF não pode ser emitida pela identidade genérica do Grupo.
                {contexto === "grupo" ? " Use a empresa jurídica responsável." : ""}
              </AlertDescription>
            </Alert>
          )}
          {/* VALIDAÇÃO IA */}
          {validacaoIA && (
            <Alert className={validacaoIA.valido ? "border-green-300 bg-green-50" : "border-orange-300 bg-orange-50"}>
              {validacaoIA.valido ? (
                <CheckCircle2 className="w-4 h-4 text-green-600" />
              ) : (
                <AlertCircle className="w-4 h-4 text-orange-600" />
              )}
              <AlertDescription className="text-sm">
                <strong>Validação IA:</strong> {validacaoIA.recomendacao}
                {validacaoIA.alertas?.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {validacaoIA.alertas.map((alerta, idx) => (
                      <li key={idx} className="text-xs">
                        • <strong>{alerta.tipo}:</strong> {alerta.descricao}
                      </li>
                    ))}
                  </ul>
                )}
              </AlertDescription>
            </Alert>
          )}

          <Tabs value={abaAtiva} onValueChange={setAbaAtiva}>
            <TabsList className="grid grid-cols-5 w-full">
              <TabsTrigger value="geral">📄 Geral</TabsTrigger>
              <TabsTrigger value="destinatario">👤 Destinatário</TabsTrigger>
              <TabsTrigger value="itens">📦 Itens</TabsTrigger>
              <TabsTrigger value="tributos">💰 Tributos</TabsTrigger>
              <TabsTrigger value="transporte">🚚 Transporte</TabsTrigger>
            </TabsList>

            {/* ABA GERAL */}
            <TabsContent value="geral" className="space-y-4">
              <GeralTab formData={formData} setFormData={setFormData} />
            </TabsContent>

            {/* ABA DESTINATÁRIO */}
            <TabsContent value="destinatario" className="space-y-4">
              <DestinatarioTab formData={formData} setFormData={setFormData} />
            </TabsContent>

            {/* ABA ITENS */}
            <TabsContent value="itens" className="space-y-4">
              <ItensTab formData={formData} setFormData={setFormData} />
            </TabsContent>

            {/* ABA TRIBUTOS */}
            <TabsContent value="tributos" className="space-y-4">
              <TributosTab formData={formData} setFormData={setFormData} />
            </TabsContent>

            {/* ABA TRANSPORTE */}
            <TabsContent value="transporte" className="space-y-4">
              <TransporteTab formData={formData} setFormData={setFormData} />
            </TabsContent>
          </Tabs>

          {/* FOOTER COM AÇÕES */}
          <div className="flex justify-between items-center pt-6 border-t">
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleValidarIA}
                disabled={loading}
              >
                <Calculator className="w-4 h-4 mr-2" />
                {loading ? "Validando..." : "Validar com IA"}
              </Button>

              {formData.status === "Rascunho" && (
                <Badge className="bg-yellow-100 text-yellow-700">
                  <Clock className="w-3 h-3 mr-1" />
                  Rascunho
                </Badge>
              )}
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
                disabled={loading}
              >
                <FileText className="w-4 h-4 mr-2" />
                {notaFiscal ? 'Atualizar' : 'Salvar'} NF-e
              </Button>
            </div>
          </div>
        </FormWrapper>
      </div>
    </div>
  );
}