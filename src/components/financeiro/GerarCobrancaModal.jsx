import React, { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreditCard, QrCode, Link2, CheckCircle2, Copy, X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import GeradorLinkPagamento from "./GeradorLinkPagamento";
import useContextoVisual from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { persistOperationalAudit } from "@/components/lib/uiAudit";

const sanitizeText = (value) => String(value || "")
  .replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, "")
  .replace(/javascript:\s*/gi, "")
  .trim();

const sanitizeLinhaDigitavel = (value) => sanitizeText(value).replace(/[^0-9 .-]/g, "");

const isSafeUrl = (value) => {
  try {
    const url = new URL(String(value || ""));
    return ["https:", "http:"].includes(url.protocol);
  } catch {
    return false;
  }
};

export default function GerarCobrancaModal({ isOpen, onClose, contaReceber }) {
  const queryClient = useQueryClient();
  const [tipoCobranca, setTipoCobranca] = useState("pix");
  const [gerando, setGerando] = useState(false);
  const [cobrancaGerada, setCobrancaGerada] = useState(null);
  const {
    empresaAtual,
    grupoAtual,
    filterInContext,
    createInContext,
    updateInContext
  } = useContextoVisual();
  const { canCreate, canEdit, hasPermission } = usePermissions();

  const groupId = contaReceber?.group_id || contaReceber?.grupo_id || grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = contaReceber?.empresa_id || empresaAtual?.id || null;
  const contextKey = empresaId || groupId || "sem-contexto";
  const contextoValido = contextKey !== "sem-contexto";
  const valorTitulo = Number(contaReceber?.valor || contaReceber?.valor_total || 0);
  const clienteNome = sanitizeText(contaReceber?.cliente || contaReceber?.cliente_nome);
  const podeGerarCobranca = canCreate("Financeiro", "Cobranca")
    || canCreate("Financeiro", "Cobranca Bancaria")
    || canEdit("Financeiro", "Contas a Receber")
    || canEdit("Financeiro", "ContaReceber")
    || hasPermission("Financeiro", null, "editar");
  const bloqueado = !contextoValido || !empresaId || !podeGerarCobranca;

  const withContext = (payload = {}) => ({
    ...payload,
    ...(groupId ? { group_id: groupId, grupo_id: groupId } : {}),
    ...(empresaId ? { empresa_id: empresaId } : {})
  });

  const auditCobranca = async (acao, sucesso, detalhes = {}) => {
    await persistOperationalAudit({
      acao,
      sucesso,
      detalhes,
      modulo: "Financeiro",
      entidade: "ContaReceber",
      registro_id: contaReceber?.id || null,
      descricao: `Geracao de cobranca: ${acao}`,
      empresa_id: empresaId,
      group_id: groupId,
    });
  };

  const validarAcaoSensivel = async (tipo) => {
    if (!contaReceber?.id) throw new Error("Titulo financeiro nao informado.");
    if (!contextoValido || !empresaId) {
      await auditCobranca(`bloqueado_${tipo}_sem_contexto`, false, { tipo });
      throw new Error("Selecione uma empresa do grupo antes de gerar cobranca.");
    }
    if (!podeGerarCobranca) {
      await auditCobranca(`bloqueado_${tipo}_sem_permissao`, false, { tipo, permissao: "Financeiro.ContaReceber.editar" });
      throw new Error("Seu perfil nao permite gerar cobrancas.");
    }
    if (!valorTitulo || valorTitulo <= 0) {
      await auditCobranca(`bloqueado_${tipo}_valor_invalido`, false, { tipo, valor: valorTitulo });
      throw new Error("Titulo sem valor valido para cobranca.");
    }
    const confirmado = window.confirm(`Gerar ${tipo === "pix" ? "PIX" : "boleto"} para este titulo? Esta acao sera auditada.`);
    if (!confirmado) {
      await auditCobranca(`cancelado_${tipo}_pelo_usuario`, false, { tipo, valor: valorTitulo });
      throw new Error("Geracao cancelada pelo usuario.");
    }
  };

  const { data: configsCobranca = [] } = useQuery({
    queryKey: ["configs-cobranca", contextKey],
    queryFn: () => filterInContext("ConfiguracaoCobrancaEmpresa", {}, "-created_date", 50),
    enabled: contextoValido,
  });

  const config = configsCobranca.find((c) => c.empresa_id === empresaId) || configsCobranca[0] || {};

  const gerarBoletoMutation = useMutation({
    mutationFn: async () => {
      await validarAcaoSensivel("boleto");
      setGerando(true);

      const payload = withContext({
        customer: clienteNome,
        value: valorTitulo,
        dueDate: contaReceber.data_vencimento,
        description: sanitizeText(contaReceber.descricao),
        billingType: "BOLETO",
        fine: { value: Number(config?.multa_pos_vencimento_percent || 2) },
        interest: { value: Number(config?.juros_ao_dia_percent || 0.033) }
      });

      const retornoMock = {
        id: `bol_${Date.now()}`,
        status: "PENDING",
        invoiceUrl: `https://boleto.simulado.com/${encodeURIComponent(contaReceber.id)}`,
        bankSlipUrl: `https://boleto.simulado.com/pdf/${encodeURIComponent(contaReceber.id)}`,
        identificationField: sanitizeLinhaDigitavel("34191.09008 12345.678901 12345.678901 1 99990000012345"),
        nossoNumero: String(Date.now()).substring(0, 10)
      };

      if (!isSafeUrl(retornoMock.bankSlipUrl) || !isSafeUrl(retornoMock.invoiceUrl)) {
        await auditCobranca("bloqueado_boleto_url_insegura", false, { retorno: retornoMock });
        throw new Error("URL do boleto invalida.");
      }

      await createInContext("LogCobranca", withContext({
        conta_receber_id: contaReceber.id,
        tipo_operacao: "gerar_boleto",
        provedor: sanitizeText(config?.provedor_cobranca || "Asaas"),
        data_hora: new Date().toISOString(),
        payload_enviado: payload,
        retorno_recebido: retornoMock,
        status_operacao: "simulado",
        mensagem: "Boleto gerado em modo simulacao"
      }));

      await updateInContext("ContaReceber", contaReceber.id, withContext({
        forma_cobranca: "Boleto",
        id_cobranca_externa: retornoMock.id,
        boleto_id_integracao: retornoMock.id,
        linha_digitavel: retornoMock.identificationField,
        url_boleto_pdf: retornoMock.bankSlipUrl,
        url_fatura: retornoMock.invoiceUrl,
        status_cobranca: "gerada_simulada",
        provedor_pagamento: sanitizeText(config?.provedor_cobranca || "Asaas")
      }));

      await auditCobranca("boleto_gerado", true, { tipo: "boleto", valor: valorTitulo, cobranca_id: retornoMock.id });
      setGerando(false);
      return retornoMock;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["contasReceber"] });
      queryClient.invalidateQueries({ queryKey: ["contas-receber"] });
      setCobrancaGerada({ tipo: "boleto", dados: data });
      toast.success("Boleto gerado!");
    },
    onError: (error) => {
      setGerando(false);
      toast.error(error.message || "Erro ao gerar boleto");
    }
  });

  const gerarPixMutation = useMutation({
    mutationFn: async () => {
      await validarAcaoSensivel("pix");
      setGerando(true);

      const pixCopiaCola = sanitizeText(`00020126580014br.gov.bcb.pix0136${contaReceber.id}52040000530398654${valorTitulo.toFixed(2)}5802BR6009SAO PAULO`);
      const qrCodeBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

      const retornoMock = {
        id: `pix_${Date.now()}`,
        status: "PENDING",
        encodedImage: qrCodeBase64,
        payload: pixCopiaCola,
        expirationDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      };

      await createInContext("LogCobranca", withContext({
        conta_receber_id: contaReceber.id,
        tipo_operacao: "gerar_pix",
        provedor: sanitizeText(config?.provedor_cobranca || "Asaas"),
        data_hora: new Date().toISOString(),
        retorno_recebido: retornoMock,
        status_operacao: "simulado",
        mensagem: "PIX gerado em modo simulacao"
      }));

      await updateInContext("ContaReceber", contaReceber.id, withContext({
        forma_cobranca: "PIX",
        id_cobranca_externa: retornoMock.id,
        pix_id_integracao: retornoMock.id,
        pix_qrcode: qrCodeBase64,
        pix_copia_cola: pixCopiaCola,
        status_cobranca: "gerada_simulada",
        provedor_pagamento: sanitizeText(config?.provedor_cobranca || "Asaas")
      }));

      await auditCobranca("pix_gerado", true, { tipo: "pix", valor: valorTitulo, cobranca_id: retornoMock.id });
      setGerando(false);
      return retornoMock;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["contasReceber"] });
      queryClient.invalidateQueries({ queryKey: ["contas-receber"] });
      setCobrancaGerada({ tipo: "pix", dados: data });
      toast.success("PIX gerado!");
    },
    onError: (error) => {
      setGerando(false);
      toast.error(error.message || "Erro ao gerar PIX");
    }
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 border-b sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-blue-600" />
              Gerar Cobranca
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={onClose} title="Fechar">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <Card className="bg-slate-50">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs text-slate-600">Cliente</Label>
                  <p className="font-semibold">{clienteNome || "-"}</p>
                </div>
                <div>
                  <Label className="text-xs text-slate-600">Vencimento</Label>
                  <p className="font-semibold">
                    {contaReceber?.data_vencimento ? new Date(contaReceber.data_vencimento).toLocaleDateString("pt-BR") : "-"}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-slate-600">Valor</Label>
                  <p className="text-xl font-bold text-green-600">
                    R$ {valorTitulo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {bloqueado && (
            <Alert className="border-amber-300 bg-amber-50">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <AlertDescription className="text-amber-900">
                {!contextoValido || !empresaId
                  ? "Selecione uma empresa do grupo antes de gerar cobranca."
                  : "Seu perfil nao tem permissao para gerar cobrancas."}
              </AlertDescription>
            </Alert>
          )}

          {!cobrancaGerada ? (
            <Tabs value={tipoCobranca} onValueChange={setTipoCobranca}>
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="pix" disabled={(!config?.habilitar_pix && configsCobranca.length > 0) || bloqueado}>
                  <QrCode className="w-4 h-4 mr-2" />
                  PIX
                </TabsTrigger>
                <TabsTrigger value="boleto" disabled={(!config?.habilitar_boleto && configsCobranca.length > 0) || bloqueado}>
                  <CreditCard className="w-4 h-4 mr-2" />
                  Boleto
                </TabsTrigger>
                <TabsTrigger value="link" disabled={bloqueado}>
                  <Link2 className="w-4 h-4 mr-2" />
                  Link
                </TabsTrigger>
              </TabsList>

              <TabsContent value="pix" className="space-y-4">
                <Alert className="border-green-300 bg-green-50">
                  <AlertDescription>
                    <strong>PIX instantaneo</strong> - Pagamento em tempo real com QR Code
                  </AlertDescription>
                </Alert>
                <Button
                  onClick={() => gerarPixMutation.mutate()}
                  disabled={gerando || bloqueado}
                  className="w-full bg-green-600 hover:bg-green-700"
                  data-action="gerar-pix-cobranca"
                  data-permission="Financeiro.ContaReceber.editar"
                  data-context-required="group_id,empresa_id"
                  data-sensitive="true"
                >
                  <QrCode className="w-4 h-4 mr-2" />
                  {gerando ? "Gerando..." : "Gerar PIX"}
                </Button>
              </TabsContent>

              <TabsContent value="boleto" className="space-y-4">
                <Alert className="border-orange-300 bg-orange-50">
                  <AlertDescription>
                    <strong>Boleto bancario</strong> - Prazo conforme vencimento
                  </AlertDescription>
                </Alert>
                <Button
                  onClick={() => gerarBoletoMutation.mutate()}
                  disabled={gerando || bloqueado}
                  className="w-full bg-orange-600 hover:bg-orange-700"
                  data-action="gerar-boleto-cobranca"
                  data-permission="Financeiro.ContaReceber.editar"
                  data-context-required="group_id,empresa_id"
                  data-sensitive="true"
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  {gerando ? "Gerando..." : "Gerar Boleto"}
                </Button>
              </TabsContent>

              <TabsContent value="link" className="space-y-4">
                <GeradorLinkPagamento titulo={contaReceber} onClose={onClose} />
              </TabsContent>
            </Tabs>
          ) : (
            <div className="space-y-4">
              <Alert className="border-green-400 bg-green-50">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <AlertDescription>
                  <strong>{cobrancaGerada.tipo === "pix" ? "PIX" : "Boleto"} gerado com sucesso!</strong>
                </AlertDescription>
              </Alert>

              {cobrancaGerada.tipo === "pix" && (
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <div className="bg-white border rounded p-3">
                      <Label className="text-xs text-slate-600 mb-2 block">PIX Copia e Cola</Label>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-xs bg-slate-50 p-2 rounded overflow-x-auto">
                          {cobrancaGerada.dados.payload}
                        </code>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            navigator.clipboard.writeText(cobrancaGerada.dados.payload);
                            toast.success("PIX copiado!");
                          }}
                          title="Copiar PIX"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 text-center">
                      Valido ate: {new Date(cobrancaGerada.dados.expirationDate).toLocaleString("pt-BR")}
                    </p>
                  </CardContent>
                </Card>
              )}

              {cobrancaGerada.tipo === "boleto" && (
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <div>
                      <Label className="text-xs text-slate-600 mb-2 block">Linha Digitavel</Label>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-xs bg-slate-50 p-2 rounded">
                          {sanitizeLinhaDigitavel(cobrancaGerada.dados.identificationField)}
                        </code>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            navigator.clipboard.writeText(sanitizeLinhaDigitavel(cobrancaGerada.dados.identificationField));
                            toast.success("Linha digitavel copiada!");
                          }}
                          title="Copiar linha digitavel"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    {isSafeUrl(cobrancaGerada.dados.bankSlipUrl) && (
                      <Button
                        onClick={() => window.open(cobrancaGerada.dados.bankSlipUrl, "_blank", "noopener,noreferrer")}
                        variant="outline"
                        className="w-full"
                        data-action="abrir-pdf-boleto-cobranca"
                        data-sensitive="true"
                      >
                        Ver Boleto PDF
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}

              <Button onClick={onClose} className="w-full">Fechar</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
