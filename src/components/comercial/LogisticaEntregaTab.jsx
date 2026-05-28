import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Truck, MapPin, Plus, Package, Calculator, CheckCircle, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import SeletorEnderecoEntregaPedido from "./SeletorEnderecoEntregaPedido";
import BuscaCEP from "./BuscaCEP";
import usePermissions from "@/components/lib/usePermissions";
import CriarEtapaEntregaModal from "./CriarEtapaEntregaModal";

const sanitizeText = (value) => String(value || "").replace(/[<>]/g, "").trim();
const sanitizeUrl = (value) => {
  const text = sanitizeText(value);
  if (!text) return "";
  if (/^https:\/\/(www\.)?(google\.|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(text)) return text;
  return text.startsWith("http") ? "" : text;
};

/**
 * Aba 5: Logistica e Entrega.
 * Gerencia endereco, frete, previsao e etapas de entrega/faturamento parcial do pedido.
 */
export default function LogisticaEntregaTab({ formData, setFormData, clientes = [], onNext }) {
  const { hasPermission, isAdmin, canApprove } = usePermissions();
  const [modalEtapaOpen, setModalEtapaOpen] = useState(false);

  const clienteSelecionado = clientes?.find(c => c.id === formData?.cliente_id) || null;
  const freteGratis = (Number(formData?.peso_total_kg) || 0) >= 30;
  const canManageStages = isAdmin || canApprove || hasPermission?.("Comercial", "Pedido", "editar") || hasPermission?.("Expedicao", "Entrega", "editar");

  const etapas = formData.etapas_entrega || [];
  const totalItensAlocados = etapas.reduce((sum, e) => sum + (Number(e.quantidade_total_itens) || 0), 0);
  const totalItens =
    (formData.itens_revenda?.length || 0) +
    (formData.itens_armado_padrao?.length || 0) +
    (formData.itens_corte_dobra?.length || 0);

  const handleCriarEtapa = (novaEtapa) => {
    if (!canManageStages) {
      toast.error("Sem permissao para criar etapa de entrega.");
      return;
    }
    if (!window.confirm("Confirma incluir esta nova etapa de entrega/faturamento no pedido?")) return;

    const etapasAtuais = formData.etapas_entrega || [];
    const etapaCompleta = {
      ...novaEtapa,
      nome_etapa: sanitizeText(novaEtapa.nome_etapa),
      descricao_etapa: sanitizeText(novaEtapa.descricao_etapa),
      id: `etapa_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      sequencia: etapasAtuais.length + 1,
      data_criacao: new Date().toISOString()
    };

    setFormData(prev => ({
      ...prev,
      etapas_entrega: [...etapasAtuais, etapaCompleta]
    }));

    toast.success(`Etapa "${etapaCompleta.nome_etapa}" criada com ${etapaCompleta.quantidade_total_itens} itens`);
  };

  const removerEtapa = (etapaId) => {
    if (!canManageStages) {
      toast.error("Sem permissao para remover etapa de entrega.");
      return;
    }
    if (!window.confirm("Confirma remover esta etapa do pedido?")) return;

    setFormData(prev => {
      const updatedEtapas = (prev.etapas_entrega || []).filter(e => e.id !== etapaId);
      const reSequencedEtapas = updatedEtapas.map((etapa, index) => ({ ...etapa, sequencia: index + 1 }));
      return { ...prev, etapas_entrega: reSequencedEtapas };
    });
    toast.success("Etapa removida");
  };

  const calcularFreteAutomatico = async () => {
    if (!formData?.endereco_entrega_principal?.cep) {
      toast.error("Configure o endereco de entrega primeiro");
      return;
    }

    const peso = Number(formData.peso_total_kg) || 0;
    if (peso === 0) {
      toast.error("Adicione itens ao pedido primeiro");
      return;
    }

    if (peso >= 30) {
      setFormData(prev => ({ ...prev, valor_frete: 0, tipo_frete: "CIF" }));
      toast.success("Frete gratis aplicado para peso acima de 30 kg");
      return;
    }

    const valorFrete = peso * 2.5;
    setFormData(prev => ({ ...prev, valor_frete: Number(valorFrete.toFixed(2)) }));
    toast.success(`Frete calculado: R$ ${valorFrete.toFixed(2)}`);
  };

  const sugerirDataEntrega = () => {
    const temProducao = (formData?.itens_armado_padrao?.length || 0) > 0 || (formData?.itens_corte_dobra?.length || 0) > 0;
    const diasProducao = temProducao ? 7 : 2;
    const diasFrete = 3;
    const dataEntrega = new Date();
    dataEntrega.setDate(dataEntrega.getDate() + diasProducao + diasFrete);
    const dataFormatada = dataEntrega.toISOString().split("T")[0];

    setFormData(prev => ({ ...prev, data_prevista_entrega: dataFormatada }));
    toast.success(`Data sugerida: ${diasProducao} dias de producao + ${diasFrete} dias de frete`);
  };

  return (
    <div className="w-full h-full space-y-6" data-permission="Comercial.Pedido.editar" data-context-required="true">
      {freteGratis && (
        <Alert className="border-green-300 bg-green-50">
          <Truck className="w-5 h-5 text-green-600" />
          <AlertDescription>
            <p className="font-semibold text-green-900">Frete gratis</p>
            <p className="text-sm text-green-700">
              Peso total: {formData?.peso_total_kg?.toFixed(2) || "0.00"} kg acima de 30 kg.
            </p>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-600" />
            Endereco de Entrega
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {clienteSelecionado ? (
            <SeletorEnderecoEntregaPedido
              cliente={clienteSelecionado}
              enderecoSelecionado={formData?.endereco_entrega_principal || {}}
              onSelect={(endereco) => setFormData(prev => ({ ...prev, endereco_entrega_principal: endereco }))}
            />
          ) : (
            <Alert className="border-orange-300 bg-orange-50">
              <AlertDescription className="text-sm text-orange-700">
                Selecione um cliente na aba Identificacao primeiro.
              </AlertDescription>
            </Alert>
          )}

          <BuscaCEP onEnderecoEncontrado={(endereco) => setFormData(prev => ({ ...prev, endereco_entrega_principal: endereco }))} />

          <div className="border-t pt-4">
            <Label>Link do Google Maps (opcional para roteirizacao precisa)</Label>
            <div className="flex gap-2 mt-2">
              <Input
                value={formData?.endereco_entrega_principal?.mapa_url || ""}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  endereco_entrega_principal: {
                    ...(prev?.endereco_entrega_principal || {}),
                    mapa_url: sanitizeUrl(e.target.value)
                  }
                }))}
                placeholder="Cole o link do Google Maps aqui..."
                className="flex-1"
              />
              {formData?.endereco_entrega_principal?.mapa_url && (
                <Button variant="outline" size="icon" onClick={() => window.open(formData.endereco_entrega_principal.mapa_url, "_blank", "noopener,noreferrer")}>
                  <MapPin className="w-4 h-4" />
                </Button>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Cole o link do Google Maps para ajudar a roteirizacao e a entrega.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-2 border-blue-200">
        <CardHeader className="bg-blue-50">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-600" />
              Etapas de Entrega / Faturamento Parcial
            </CardTitle>
            <Button
              onClick={() => setModalEtapaOpen(true)}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
              disabled={!canManageStages}
              data-action="Pedido.etapa_entrega.criar"
              data-permission="Comercial.Pedido.editar"
              data-context-required="true"
              data-sensitive="true"
            >
              <Plus className="w-4 h-4 mr-2" />
              Criar Etapa
            </Button>
          </div>
          <p className="text-xs text-blue-700 mt-1">
            Divida o pedido em etapas para producao, faturamento e entrega separados.
          </p>
        </CardHeader>
        <CardContent className="p-4">
          {etapas.length === 0 ? (
            <Alert className="border-slate-200 bg-slate-50">
              <AlertDescription className="text-sm text-slate-600">
                Nenhuma etapa criada. Use Criar Etapa para dividir o pedido.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3">
              {etapas.map((etapa) => (
                <div key={etapa.id} className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border-2 border-blue-200">
                  <div className="flex items-start justify-between mb-3 gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className="bg-blue-600">Etapa {etapa.sequencia}</Badge>
                        <h3 className="font-bold text-slate-900">{sanitizeText(etapa.nome_etapa)}</h3>
                      </div>
                      {etapa.descricao_etapa && <p className="text-xs text-slate-600">{sanitizeText(etapa.descricao_etapa)}</p>}
                    </div>
                    <Badge className={etapa.status_etapa === "Faturada" ? "bg-green-600" : etapa.status_etapa === "Em Producao" || etapa.status_etapa === "Em Produção" ? "bg-orange-600" : "bg-slate-600"}>
                      {sanitizeText(etapa.status_etapa)}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                    <div className="bg-white p-2 rounded border text-center"><p className="text-xs text-slate-600">Itens</p><p className="text-lg font-bold text-blue-600">{etapa.quantidade_total_itens}</p></div>
                    <div className="bg-white p-2 rounded border text-center"><p className="text-xs text-slate-600">Peso (kg)</p><p className="text-lg font-bold text-purple-600">{etapa.peso_total_etapa_kg?.toFixed(2) || "0.00"}</p></div>
                    <div className="bg-white p-2 rounded border text-center"><p className="text-xs text-slate-600">Valor</p><p className="text-lg font-bold text-green-600">R$ {(etapa.valor_total_etapa || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p></div>
                    <div className="bg-white p-2 rounded border text-center"><p className="text-xs text-slate-600">Previsao</p><p className="text-sm font-semibold text-slate-700">{etapa.data_prevista_entrega ? new Date(etapa.data_prevista_entrega).toLocaleDateString("pt-BR") : "-"}</p></div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      onClick={() => removerEtapa(etapa.id)}
                      size="sm"
                      variant="outline"
                      className="text-red-600 border-red-300"
                      disabled={!canManageStages}
                      data-action="Pedido.etapa_entrega.remover"
                      data-permission="Comercial.Pedido.editar"
                      data-context-required="true"
                      data-sensitive="true"
                    >
                      Remover
                    </Button>
                  </div>
                </div>
              ))}

              <div className="p-3 bg-green-50 rounded border border-green-200 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-green-800">{totalItensAlocados} de {totalItens} itens alocados em etapas</span>
                  {totalItensAlocados === totalItens && <Badge className="bg-green-600"><CheckCircle className="w-3 h-3 mr-1" />100% Alocado</Badge>}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2"><Truck className="w-5 h-5 text-orange-600" />Informacoes de Frete</CardTitle>
            <Button size="sm" variant="outline" onClick={calcularFreteAutomatico} data-action="Pedido.frete.calcular" data-sensitive="true">
              <Calculator className="w-4 h-4 mr-2" />Calcular Frete
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Tipo de Logistica *</Label>
              <select
                value={formData?.tipo_frete || "CIF"}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, tipo_frete: e.target.value, ...(e.target.value === "Retirada" ? { valor_frete: 0 } : {}) }));
                  toast.info(e.target.value === "Retirada" ? "Pedido configurado para retirada no local." : "Pedido configurado para entrega ao cliente.");
                }}
                className="w-full p-2 border rounded-lg"
              >
                <option value="CIF">ENTREGA - CIF (por nossa conta)</option>
                <option value="FOB">ENTREGA - FOB (por conta do cliente)</option>
                <option value="Retirada">RETIRADA no local</option>
              </select>
              <p className="text-xs text-slate-500 mt-1">{formData?.tipo_frete === "Retirada" ? "Cliente retirara o pedido na empresa." : "Pedido sera entregue no endereco informado."}</p>
            </div>

            <div>
              <Label>Valor do Frete</Label>
              <Input type="number" step="0.01" value={freteGratis ? 0 : (formData?.valor_frete || 0)} onChange={(e) => !freteGratis && setFormData(prev => ({ ...prev, valor_frete: parseFloat(e.target.value) || 0 }))} disabled={freteGratis} className={freteGratis ? "bg-green-50 font-bold text-green-600" : ""} />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2"><Label>Previsao Entrega</Label><Button size="sm" variant="ghost" onClick={sugerirDataEntrega} className="h-6 text-xs">Sugerir</Button></div>
              <Input type="date" value={formData?.data_prevista_entrega || ""} onChange={(e) => setFormData(prev => ({ ...prev, data_prevista_entrega: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label>Janela de Entrega - Inicio</Label><Input type="time" value={formData?.endereco_entrega_principal?.horario_inicio || ""} onChange={(e) => setFormData(prev => ({ ...prev, endereco_entrega_principal: { ...(prev?.endereco_entrega_principal || {}), horario_inicio: e.target.value } }))} /></div>
            <div><Label>Janela de Entrega - Fim</Label><Input type="time" value={formData?.endereco_entrega_principal?.horario_fim || ""} onChange={(e) => setFormData(prev => ({ ...prev, endereco_entrega_principal: { ...(prev?.endereco_entrega_principal || {}), horario_fim: e.target.value } }))} /></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Instrucoes de Entrega</CardTitle></CardHeader>
        <CardContent>
          <textarea
            value={formData?.endereco_entrega_principal?.instrucoes_entrega || ""}
            onChange={(e) => setFormData(prev => ({ ...prev, endereco_entrega_principal: { ...(prev?.endereco_entrega_principal || {}), instrucoes_entrega: sanitizeText(e.target.value) } }))}
            className="w-full p-3 border rounded-lg"
            rows="4"
            placeholder="Ex: Portaria 2, avisar com 30 min de antecedencia..."
          />
        </CardContent>
      </Card>

      <div className="flex justify-end pt-4 border-t">
        <Button onClick={onNext} className="bg-blue-600 hover:bg-blue-700">Proximo: Financeiro<ChevronRight className="w-4 h-4 ml-2" /></Button>
      </div>

      <CriarEtapaEntregaModal open={modalEtapaOpen} onClose={() => setModalEtapaOpen(false)} pedidoData={formData} onCriarEtapa={handleCriarEtapa} />
    </div>
  );
}
