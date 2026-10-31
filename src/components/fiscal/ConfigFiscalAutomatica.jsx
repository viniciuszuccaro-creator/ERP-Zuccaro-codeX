import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import { useUser } from "@/components/lib/UserContext";
import { a1CertificateApi, central360SessionKey } from "@/api/httpApiClient";
import { readErpHttpSession } from "@/api/erpHttpSession";
import { sanitizeAuditPayload } from "@/components/lib/sanitizeOnWrite";
import CertificadoA1Panel from "./CertificadoA1Panel";
import {
  FileText,
  Shield,
  Settings,
  AlertTriangle,
  CheckCircle,
  Download,
  Lock,
  Building2
} from "lucide-react";

/**
 * Configuração Fiscal Automática por Empresa
 * Certificado, Séries, Alíquotas, Provedor NF-e
 */
export default function ConfigFiscalAutomatica({ empresaId, groupId }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useUser();

  const { data: empresa } = useQuery({
    queryKey: ['empresa', empresaId],
    queryFn: async () => {
      const empresas = await base44.entities.Empresa.list();
      return empresas.find(e => e.id === empresaId);
    },
    enabled: !!empresaId,
  });

  const { data: config } = useQuery({
    queryKey: ['config-fiscal', empresaId],
    queryFn: async () => {
      const configs = await base44.entities.ConfigFiscalEmpresa.filter({
        empresa_id: empresaId
      });
      return configs[0] || null;
    },
    enabled: !!empresaId,
  });

  const a1Scope = { groupId: groupId || empresa?.group_id || empresa?.grupo_id, empresaId, actorId: user?.id };
  const certificateQueryKey = ['a1-certificate', a1Scope.groupId, empresaId, user?.id,
    central360SessionKey(readErpHttpSession()?.token)];
  const certificateQuery = useQuery({
    queryKey: certificateQueryKey,
    queryFn: ({ signal }) => a1CertificateApi.metadata(a1Scope, { signal }),
    enabled: !!a1Scope.groupId && !!empresaId && !!user?.id,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  const certificate = certificateQuery.data;

  const [fiscalFormData, setFormData] = useState({
    ambiente_nfe: config?.ambiente || "Homologação",
    provedor_nf: config?.provedor_nf || "Nenhum",
    api_url: config?.api_url || "",
    api_key: config?.api_key || "",
    serie_nfe: config?.serie_nfe || "1",
    serie_nfce: config?.serie_nfce || "1",
    serie_nfse: config?.serie_nfse || "1",
    proximo_numero_nfe: config?.proximo_numero_nfe || 1,
    proximo_numero_nfce: config?.proximo_numero_nfce || 1,
    proximo_numero_nfse: config?.proximo_numero_nfse || 1,
    certificado_tipo: config?.certificado_tipo || "A1",
    data_validade_certificado: config?.data_validade_certificado || "",
    cfop_padrao_dentro_estado: config?.cfop_padrao_dentro_estado || "5102",
    cfop_padrao_fora_estado: config?.cfop_padrao_fora_estado || "6102",
    aliquota_padrao_icms: config?.aliquota_padrao_icms || 18,
    aliquota_padrao_pis: config?.aliquota_padrao_pis || 1.65,
    aliquota_padrao_cofins: config?.aliquota_padrao_cofins || 7.6,
    aliquota_padrao_ipi: config?.aliquota_padrao_ipi || 0,
    aliquota_padrao_iss: config?.aliquota_padrao_iss || 5,
    observacoes_padrao_nfe: config?.observacoes_padrao_nfe || "",
    emite_nfe: config?.emite_nfe !== false,
    emite_nfce: config?.emite_nfce || false,
    emite_nfse: config?.emite_nfse || false,
    permite_emissao_sem_estoque: config?.permite_emissao_sem_estoque || false
  });
  const formData = { ...fiscalFormData, data_validade_certificado: fiscalFormData.certificado_tipo === 'A1'
    ? certificate?.validTo || '' : fiscalFormData.data_validade_certificado };

  React.useEffect(() => {
    if (config) {
      setFormData({
        ambiente_nfe: config.ambiente || "Homologação",
        provedor_nf: config.provedor_nf || "Nenhum",
        api_url: config.api_url || "",
        api_key: config.api_key || "",
        serie_nfe: config.serie_nfe || "1",
        serie_nfce: config.serie_nfce || "1",
        serie_nfse: config.serie_nfse || "1",
        proximo_numero_nfe: config.proximo_numero_nfe || 1,
        proximo_numero_nfce: config.proximo_numero_nfce || 1,
        proximo_numero_nfse: config.proximo_numero_nfse || 1,
        certificado_tipo: config.certificado_tipo || "A1",
        data_validade_certificado: config.data_validade_certificado || "",
        cfop_padrao_dentro_estado: config.cfop_padrao_dentro_estado || "5102",
        cfop_padrao_fora_estado: config.cfop_padrao_fora_estado || "6102",
        aliquota_padrao_icms: config.aliquota_padrao_icms || 18,
        aliquota_padrao_pis: config.aliquota_padrao_pis || 1.65,
        aliquota_padrao_cofins: config.aliquota_padrao_cofins || 7.6,
        aliquota_padrao_ipi: config.aliquota_padrao_ipi || 0,
        aliquota_padrao_iss: config.aliquota_padrao_iss || 5,
        observacoes_padrao_nfe: config.observacoes_padrao_nfe || "",
        emite_nfe: config.emite_nfe !== false,
        emite_nfce: config.emite_nfce || false,
        emite_nfse: config.emite_nfse || false,
        permite_emissao_sem_estoque: config.permite_emissao_sem_estoque || false
      });
    }
  }, [config]);

  const salvarMutation = useMutation({
    mutationFn: async () => {
      if (!empresaId) {
        throw new Error("Selecione uma empresa antes de salvar a configuracao fiscal.");
      }
      if (formData.certificado_tipo === 'A1' && (!certificateQuery.isSuccess || certificateQuery.isFetching)) {
        throw new Error('Consulte o cofre A1 antes de salvar a configuracao.');
      }

      const diasExpiracao = formData.data_validade_certificado
        ? Math.floor((new Date(formData.data_validade_certificado).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
        : null;

      const alertas = [];
      if (diasExpiracao !== null && diasExpiracao < 30) {
        alertas.push({
          tipo: "certificado_vencendo",
          mensagem: `Certificado expira em ${diasExpiracao} dias`,
          data: new Date().toISOString()
        });
      }

      if (!certificate && formData.certificado_tipo === "A1") {
        alertas.push({
          tipo: "configuracao_incompleta",
          mensagem: "Certificado A1 não enviado",
          data: new Date().toISOString()
        });
      }

      const dadosCompletos = {
        empresa_id: empresaId,
        group_id: groupId || empresa?.group_id || empresa?.grupo_id || null,
        empresa_nome: empresa?.nome_fantasia || empresa?.razao_social,
        razao_social: empresa?.razao_social,
        nome_fantasia: empresa?.nome_fantasia,
        cnpj: empresa?.cnpj,
        inscricao_estadual: empresa?.inscricao_estadual,
        inscricao_municipal: empresa?.inscricao_municipal,
        regime_tributario: empresa?.regime_tributario || "Simples Nacional",
        cnpj_emitente: empresa?.cnpj,
        uf_emitente: empresa?.endereco?.estado || "",
        ...formData,
        certificado_expira_em_dias: diasExpiracao,
        alertas,
        data_ultima_verificacao_certificado: new Date().toISOString(),
        historico_alteracoes: [
          ...(config?.historico_alteracoes || []),
          {
            data: new Date().toISOString(),
            usuario: "Sistema",
            campo_alterado: "configuracao_geral",
            valor_anterior: JSON.stringify(sanitizeAuditPayload({ ...config, historico_alteracoes: undefined })),
            valor_novo: JSON.stringify(sanitizeAuditPayload(formData))
          }
        ]
      };

      if (config?.id) {
        const result = await base44.entities.ConfigFiscalEmpresa.update(config.id, dadosCompletos);
        return { ...result, __auditAction: "Edicao", __auditPrevious: sanitizeAuditPayload({ ...config, historico_alteracoes: undefined }) };
      } else {
        const result = await base44.entities.ConfigFiscalEmpresa.create(dadosCompletos);
        return { ...result, __auditAction: "Criacao" };
      }
    },
    onSuccess: async (result) => {
      queryClient.invalidateQueries({ queryKey: ['config-fiscal'] });
      try {
        await base44.entities.AuditLog.create({
          usuario: user?.full_name || user?.email || "Sistema",
          usuario_id: user?.id || null,
          empresa_id: empresaId || null,
          group_id: groupId || empresa?.group_id || empresa?.grupo_id || null,
          acao: result?.__auditAction || "Edicao",
          modulo: "Fiscal",
          entidade: "ConfigFiscalEmpresa",
          registro_id: result?.id || config?.id || null,
          descricao: "Configuracao fiscal da empresa salva",
          dados_anteriores: result?.__auditPrevious || null,
          dados_novos: sanitizeAuditPayload(formData),
          sucesso: true,
          data_hora: new Date().toISOString(),
        });
      } catch (auditError) {
        console.warn("[Fiscal] Falha ao auditar configuracao fiscal:", auditError);
      }
      toast({ title: "✅ Configuração fiscal salva!" });
    },
    onError: (error) => {
      toast({ title: "Erro ao salvar configuracao fiscal", description: String(error?.message || error), variant: "destructive" });
    },
  });

  if (!empresaId) {
    return (
      <Card>
        <CardContent className="p-12 text-center text-slate-500">
          <Building2 className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p>Selecione uma empresa para configurar</p>
        </CardContent>
      </Card>
    );
  }

  const certificadoValido = formData.data_validade_certificado && new Date(formData.data_validade_certificado) > new Date();
  const diasRestantes = formData.data_validade_certificado
    ? Math.floor((new Date(formData.data_validade_certificado).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <form onSubmit={(e) => { e.preventDefault(); salvarMutation.mutate(); }} className="space-y-6">
      {/* Empresa Selecionada */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-5">
          <div className="flex items-center gap-3">
            <Building2 className="w-6 h-6 text-blue-600" />
            <div>
              <p className="font-bold text-lg text-blue-900">
                {empresa?.nome_fantasia || empresa?.razao_social}
              </p>
              <p className="text-sm text-blue-700">
                CNPJ: {empresa?.cnpj} | IE: {empresa?.inscricao_estadual || '-'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alertas de Certificado */}
      {diasRestantes !== null && diasRestantes < 30 && (
        <Alert variant={diasRestantes < 0 ? "destructive" : "default"} className="border-2">
          <AlertTriangle className="h-5 w-5" />
          <AlertDescription>
            {diasRestantes < 0 ? (
              <p className="font-semibold text-red-900">⚠️ Certificado VENCIDO há {Math.abs(diasRestantes)} dias!</p>
            ) : (
              <p className="font-semibold text-orange-900">⚠️ Certificado expira em {diasRestantes} dias</p>
            )}
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="provedor">
        <TabsList className="bg-white border">
          <TabsTrigger value="provedor">
            <FileText className="w-4 h-4 mr-2" />
            Provedor NF-e
          </TabsTrigger>
          <TabsTrigger value="certificado">
            <Shield className="w-4 h-4 mr-2" />
            Certificado
          </TabsTrigger>
          <TabsTrigger value="series">
            <Settings className="w-4 h-4 mr-2" />
            Séries e Numeração
          </TabsTrigger>
          <TabsTrigger value="impostos">
            <FileText className="w-4 h-4 mr-2" />
            Alíquotas e CFOP
          </TabsTrigger>
        </TabsList>

        {/* TAB: Provedor */}
        <TabsContent value="provedor" className="space-y-4">
          <Card>
            <CardHeader className="bg-purple-50">
              <CardTitle className="text-base">Provedor de NF-e</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div>
                <Label>Ambiente *</Label>
                <Select
                  value={formData.ambiente_nfe}
                  onValueChange={(v) => setFormData({ ...formData, ambiente_nfe: v })}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Homologação">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-yellow-500">Teste</Badge>
                        <span>Homologação</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="Produção">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-green-600">Real</Badge>
                        <span>Produção</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Provedor de NF-e *</Label>
                <Select
                  value={formData.provedor_nf}
                  onValueChange={(v) => setFormData({ ...formData, provedor_nf: v })}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Nenhum">Nenhum (Mock/Simulação)</SelectItem>
                    <SelectItem value="eNotas">eNotas</SelectItem>
                    <SelectItem value="Focus NFe">Focus NFe</SelectItem>
                    <SelectItem value="NFe.io">NFe.io</SelectItem>
                    <SelectItem value="Bling">Bling</SelectItem>
                    <SelectItem value="WebMania">WebMania</SelectItem>
                    <SelectItem value="Outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.provedor_nf !== "Nenhum" && (
                <>
                  <div>
                    <Label>URL da API</Label>
                    <Input
                      value={formData.api_url}
                      onChange={(e) => setFormData({ ...formData, api_url: e.target.value })}
                      placeholder="https://api.enotas.com.br/..."
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label>API Key / Token</Label>
                    <Input
                      type="password"
                      value={formData.api_key}
                      onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                      placeholder="Sua chave de API"
                      className="mt-2"
                    />
                  </div>

                  <Alert className="border-blue-200 bg-blue-50">
                    <CheckCircle className="h-5 w-5 text-blue-600" />
                    <AlertDescription className="text-blue-900">
                      <strong>Modo Simulação:</strong> Enquanto o provedor estiver como "Nenhum", 
                      o sistema gera XMLs locais mas não transmite para SEFAZ.
                    </AlertDescription>
                  </Alert>
                </>
              )}

              <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="emite-nfe"
                    checked={formData.emite_nfe}
                    onChange={(e) => setFormData({ ...formData, emite_nfe: e.target.checked })}
                  />
                  <Label htmlFor="emite-nfe">Emitir NF-e</Label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="emite-nfce"
                    checked={formData.emite_nfce}
                    onChange={(e) => setFormData({ ...formData, emite_nfce: e.target.checked })}
                  />
                  <Label htmlFor="emite-nfce">Emitir NFC-e</Label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="emite-nfse"
                    checked={formData.emite_nfse}
                    onChange={(e) => setFormData({ ...formData, emite_nfse: e.target.checked })}
                  />
                  <Label htmlFor="emite-nfse">Emitir NFS-e</Label>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: Certificado */}
        <TabsContent value="certificado" className="space-y-4">
          <Card>
            <CardHeader className="bg-green-50">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="w-5 h-5 text-green-600" />
                Certificado Digital
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div>
                <Label>Tipo de Certificado</Label>
                <Select
                  value={formData.certificado_tipo}
                  onValueChange={(v) => setFormData({ ...formData, certificado_tipo: v })}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A1">A1 (Arquivo .pfx)</SelectItem>
                    <SelectItem value="A3">A3 (Token/Smartcard)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.certificado_tipo === "A1" && <>
                <CertificadoA1Panel key={`${a1Scope.groupId}:${empresaId}:${user?.id}`}
                  scope={a1Scope} metadata={certificate} ready={certificateQuery.isSuccess && !certificateQuery.isFetching}
                  onUploaded={() => queryClient.invalidateQueries({ queryKey: certificateQueryKey })} />
                {certificateQuery.isError && <p role="alert" className="text-sm text-red-700">Cofre A1 indisponivel. Nenhum envio ou validade foi confirmado.</p>}
              </>}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Data de Validade</Label>
                  <Input
                    type="date"
                    value={formData.data_validade_certificado?.slice(0, 10)}
                    readOnly={formData.certificado_tipo === 'A1'}
                    onChange={(e) => setFormData({ ...formData, data_validade_certificado: e.target.value })}
                    className="mt-2"
                  />
                </div>
              </div>

              {certificadoValido && (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <AlertDescription className="text-green-900">
                    Certificado válido por mais {diasRestantes} dias
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: Séries e Numeração */}
        <TabsContent value="series" className="space-y-4">
          <div className="grid md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="bg-blue-50">
                <CardTitle className="text-sm">NF-e (Modelo 55)</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div>
                  <Label>Série</Label>
                  <Input
                    value={formData.serie_nfe}
                    onChange={(e) => setFormData({ ...formData, serie_nfe: e.target.value })}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label>Próximo Número</Label>
                  <Input
                    type="number"
                    value={formData.proximo_numero_nfe}
                    onChange={(e) => setFormData({ ...formData, proximo_numero_nfe: parseInt(e.target.value) })}
                    className="mt-2"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="bg-purple-50">
                <CardTitle className="text-sm">NFC-e (Modelo 65)</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div>
                  <Label>Série</Label>
                  <Input
                    value={formData.serie_nfce}
                    onChange={(e) => setFormData({ ...formData, serie_nfce: e.target.value })}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label>Próximo Número</Label>
                  <Input
                    type="number"
                    value={formData.proximo_numero_nfce}
                    onChange={(e) => setFormData({ ...formData, proximo_numero_nfce: parseInt(e.target.value) })}
                    className="mt-2"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="bg-green-50">
                <CardTitle className="text-sm">NFS-e</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div>
                  <Label>Série</Label>
                  <Input
                    value={formData.serie_nfse}
                    onChange={(e) => setFormData({ ...formData, serie_nfse: e.target.value })}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label>Próximo Número</Label>
                  <Input
                    type="number"
                    value={formData.proximo_numero_nfse}
                    onChange={(e) => setFormData({ ...formData, proximo_numero_nfse: parseInt(e.target.value) })}
                    className="mt-2"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB: Impostos e CFOP */}
        <TabsContent value="impostos" className="space-y-4">
          <Card>
            <CardHeader className="bg-orange-50">
              <CardTitle className="text-base">CFOP Padrão</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>CFOP Dentro do Estado</Label>
                  <Input
                    value={formData.cfop_padrao_dentro_estado}
                    onChange={(e) => setFormData({ ...formData, cfop_padrao_dentro_estado: e.target.value })}
                    placeholder="5102"
                    className="mt-2"
                  />
                  <p className="text-xs text-slate-500 mt-1">Ex: 5102 - Venda de mercadoria</p>
                </div>
                <div>
                  <Label>CFOP Fora do Estado</Label>
                  <Input
                    value={formData.cfop_padrao_fora_estado}
                    onChange={(e) => setFormData({ ...formData, cfop_padrao_fora_estado: e.target.value })}
                    placeholder="6102"
                    className="mt-2"
                  />
                  <p className="text-xs text-slate-500 mt-1">Ex: 6102 - Venda interestadual</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="bg-blue-50">
              <CardTitle className="text-base">Alíquotas Padrão (%)</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>ICMS (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.aliquota_padrao_icms}
                    onChange={(e) => setFormData({ ...formData, aliquota_padrao_icms: parseFloat(e.target.value) })}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label>PIS (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.aliquota_padrao_pis}
                    onChange={(e) => setFormData({ ...formData, aliquota_padrao_pis: parseFloat(e.target.value) })}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label>COFINS (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.aliquota_padrao_cofins}
                    onChange={(e) => setFormData({ ...formData, aliquota_padrao_cofins: parseFloat(e.target.value) })}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label>IPI (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.aliquota_padrao_ipi}
                    onChange={(e) => setFormData({ ...formData, aliquota_padrao_ipi: parseFloat(e.target.value) })}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label>ISS (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.aliquota_padrao_iss}
                    onChange={(e) => setFormData({ ...formData, aliquota_padrao_iss: parseFloat(e.target.value) })}
                    className="mt-2"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="bg-slate-50">
              <CardTitle className="text-base">Observações Padrão</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <Label>Mensagem que aparece em todas as NF-e</Label>
              <Textarea
                value={formData.observacoes_padrao_nfe}
                onChange={(e) => setFormData({ ...formData, observacoes_padrao_nfe: e.target.value })}
                rows={3}
                placeholder="Ex: Mercadoria sob encomenda. Prazo de entrega: 7 dias úteis."
                className="mt-2"
              />
            </CardContent>
          </Card>

          <div className="flex items-center gap-3 p-4 bg-red-50 rounded border border-red-200">
            <input
              type="checkbox"
              id="permite-sem-estoque"
              checked={formData.permite_emissao_sem_estoque}
              onChange={(e) => setFormData({ ...formData, permite_emissao_sem_estoque: e.target.checked })}
            />
            <div>
              <Label htmlFor="permite-sem-estoque" className="font-semibold text-red-900 cursor-pointer">
                Permitir emissão sem estoque disponível
              </Label>
              <p className="text-sm text-red-700">
                ⚠️ Não recomendado. Pode gerar divergências fiscais.
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Botão Salvar */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button
          type="submit"
          disabled={salvarMutation.isPending || !empresaId}
          className="bg-green-600 hover:bg-green-700 min-w-[200px]"
          data-action="Fiscal.ConfigFiscal.salvar"
        >
          {salvarMutation.isPending ? 'Salvando...' : 'Salvar Configurações'}
        </Button>
      </div>
    </form>
  );
}
