import React, { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { z } from "zod";
import FormWrapper from "@/components/common/FormWrapper";
import { Loader2, Building2, AlertTriangle, Upload, Power, PowerOff } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import usePermissions from "@/components/lib/usePermissions";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import { hasCadastroEntityPermission } from "@/components/cadastros/cadastroEditLoadPolicy";
import CadastroCodigoRegistroField from "@/components/cadastros/CadastroCodigoRegistroField";
import BuscaCEP from "@/components/comercial/BuscaCEP";
import {
  mergeEmpresaFormData,
  sanitizeDocument,
  sanitizeEndereco,
  sanitizeText,
  sanitizeUrl,
  toInteger,
} from "@/components/cadastros/empresaFormShared";

/**
 * V21.1.2 - WINDOW MODE READY
 * Consolida #226/#227/#228 + fiscal/webhooks recuperados do Completo (UI visível → payload enviável).
 */
export default function EmpresaForm({
  empresa,
  item,
  data,
  initialData,
  defaultValues,
  onSubmit,
  isSubmitting,
  windowMode = false,
  loadIncomplete = false,
  isLoadingRecord = false,
}) {
  const dadosIniciais = item || data || initialData || defaultValues || empresa;
  const { canCreate, canEdit, canDelete, hasPermission, hasPermissionKey } = usePermissions();
  const { empresaAtual, grupoAtual } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || dadosIniciais?.group_id || null;
  const contextoValido = Boolean(empresaAtual?.id || groupId || dadosIniciais?.empresa_id || dadosIniciais?.group_id);
  const permCheckers = { hasPermission, canCreate, canEdit, canDelete };
  const podeCriar = hasCadastroEntityPermission("Empresa", "criar", permCheckers);
  const podeEditar = hasCadastroEntityPermission("Empresa", "editar", permCheckers);
  const podeExcluir = hasCadastroEntityPermission("Empresa", "excluir", permCheckers);
  const podeSalvar = dadosIniciais?.id ? podeEditar : podeCriar;
  const permissaoFormulario = dadosIniciais?.id
    ? "Cadastros.Organizacional.editar"
    : "Cadastros.Organizacional.criar";
  const permissaoCertificado = "Cadastros.Empresa.Certificado.editar";
  const podeEditarCertificado = podeSalvar && hasPermissionKey(permissaoCertificado);
  const saveBlocked = Boolean(isLoadingRecord || loadIncomplete);
  const [formData, setFormData] = useState(() => mergeEmpresaFormData(dadosIniciais));

  const [alertaCertificado, setAlertaCertificado] = useState(null);

  const { data: empresasGrupo = [] } = useQuery({
    queryKey: ["empresas-matriz-picker", groupId],
    queryFn: () => base44.entities.Empresa.list(),
    enabled: Boolean(groupId),
  });

  const matrizes = useMemo(() => empresasGrupo.filter((empresa) => {
    const mesmoGrupo = !groupId
      || empresa.group_id === groupId
      || empresa.grupo_id === groupId;
    const isMatriz = String(empresa.tipo || "").toLowerCase() === "matriz";
    const notSelf = !dadosIniciais?.id || empresa.id !== dadosIniciais.id;
    return isMatriz && mesmoGrupo && notSelf;
  }), [empresasGrupo, groupId, dadosIniciais?.id]);

  useEffect(() => {
    if (!dadosIniciais) return;
    setFormData(mergeEmpresaFormData(dadosIniciais));
  }, [
    dadosIniciais?.id,
    dadosIniciais?.updated_date,
    dadosIniciais?.razao_social,
    dadosIniciais?.cnpj,
    dadosIniciais?.nome_fantasia,
  ]);

  useEffect(() => {
    if (formData.certificado_digital?.data_validade) {
      const dataValidade = new Date(formData.certificado_digital.data_validade);
      const hoje = new Date();
      const diasRestantes = Math.floor((dataValidade - hoje) / (1000 * 60 * 60 * 24));

      if (diasRestantes <= 30 && diasRestantes > 0) {
        setAlertaCertificado({
          tipo: "warning",
          mensagem: `Certificado vence em ${diasRestantes} dias. Renove antes do vencimento.`
        });
      } else if (diasRestantes <= 0) {
        setAlertaCertificado({
          tipo: "error",
          mensagem: "Certificado vencido. Emissao de NF-e deve permanecer bloqueada."
        });
      } else {
        setAlertaCertificado(null);
      }
    }
  }, [formData.certificado_digital?.data_validade]);

  const schema = z.object({
    razao_social: z.string().min(1, "Razao Social e obrigatoria"),
    cnpj: z.string().min(11, "CNPJ e obrigatorio")
  });

  const handleCertificadoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!podeEditarCertificado || saveBlocked) {
      toast.error("Sem permissao ou registro incompleto para alterar certificado.");
      return;
    }
    if (!String(file.name || "").toLowerCase().endsWith(".pfx")) {
      toast.error("Apenas arquivos .pfx sao aceitos.");
      return;
    }
    try {
      toast.info("Enviando certificado...");
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData((prev) => ({
        ...prev,
        certificado_digital: {
          ...prev.certificado_digital,
          arquivo_certificado: sanitizeUrl(file_url, 500),
          tipo: "A1",
        },
      }));
      toast.success("Certificado enviado.");
    } catch (err) {
      toast.error(err?.message || "Falha no upload do certificado.");
    }
  };

  const buildPayload = () => {
    const payload = {
      ...formData,
      id: formData.id || dadosIniciais?.id,
      razao_social: sanitizeText(formData.razao_social, 180),
      nome_fantasia: sanitizeText(formData.nome_fantasia, 180),
      nome: sanitizeText(formData.nome_fantasia || formData.razao_social, 180),
      cnpj: sanitizeDocument(formData.cnpj, 32),
      inscricao_estadual: sanitizeDocument(formData.inscricao_estadual, 32),
      regime_tributario: sanitizeText(formData.regime_tributario, 80),
      tipo: sanitizeText(formData.tipo, 40) === "Filial" ? "Filial" : "Matriz",
      matriz_id: sanitizeText(formData.tipo, 40) === "Filial" ? sanitizeText(formData.matriz_id, 120) : "",
      status: sanitizeText(formData.status, 40),
      permite_emissao_fiscal: formData.permite_emissao_fiscal !== false,
      endereco: sanitizeEndereco(formData.endereco),
      contato: {
        telefone: sanitizeText(formData.contato?.telefone, 40),
        email: sanitizeText(formData.contato?.email, 180).toLowerCase(),
      },
      // Fiscal/webhooks visíveis no form canônico — enviáveis em create e update (sem wipe oculto).
      configuracao_fiscal: {
        ambiente_nfe: sanitizeText(formData.configuracao_fiscal?.ambiente_nfe || "Homologacao", 40),
        serie_nfe: sanitizeText(formData.configuracao_fiscal?.serie_nfe || "1", 20),
        proximo_numero_nfe: toInteger(formData.configuracao_fiscal?.proximo_numero_nfe, 1),
        autoriza_emissao_producao: Boolean(formData.configuracao_fiscal?.autoriza_emissao_producao),
      },
      urls_webhook_padrao: {
        pagamento_recebido: sanitizeUrl(formData.urls_webhook_padrao?.pagamento_recebido, 500),
        nfe_emitida: sanitizeUrl(formData.urls_webhook_padrao?.nfe_emitida, 500),
      },
      // Preferir group_id do registro carregado (#228); nunca carimbar empresa operacional.
      group_id: dadosIniciais?.group_id || formData.group_id || groupId,
      grupo_id: dadosIniciais?.grupo_id || dadosIniciais?.group_id || formData.grupo_id || formData.group_id || groupId,
    };

    if (podeEditarCertificado) {
      payload.certificado_digital = {
        tipo: sanitizeText(formData.certificado_digital?.tipo || "A1", 10),
        arquivo_certificado: sanitizeUrl(formData.certificado_digital?.arquivo_certificado, 500),
        senha_certificado: sanitizeText(formData.certificado_digital?.senha_certificado, 500),
        data_validade: sanitizeText(formData.certificado_digital?.data_validade, 20),
      };
    } else {
      delete payload.certificado_digital;
    }

    // Tenant master: só preserva empresa_id já existente no registro; não carimba contexto (#228).
    if (dadosIniciais?.empresa_id != null && dadosIniciais.empresa_id !== "") {
      payload.empresa_id = dadosIniciais.empresa_id;
    } else {
      delete payload.empresa_id;
    }
    return payload;
  };

  const handleSubmit = async () => {
    if (saveBlocked) {
      toast.error("Aguarde o carregamento completo do registro antes de salvar.");
      return;
    }
    if (!podeSalvar) {
      toast.error(dadosIniciais?.id ? "Seu perfil nao permite editar empresas." : "Seu perfil nao permite criar empresas.");
      return;
    }
    if (!contextoValido) {
      toast.error("Selecione um grupo ou empresa antes de salvar a empresa.");
      return;
    }

    const payload = buildPayload();
    if (dadosIniciais?.id && payload.id !== dadosIniciais.id) {
      toast.error("ID da empresa nao pode ser alterado.");
      return;
    }
    if (!payload.razao_social || !payload.cnpj) {
      toast.error("Razao Social e CNPJ sao obrigatorios.");
      return;
    }
    onSubmit(payload);
  };

  const formContent = (
    <FormWrapper schema={schema} defaultValues={formData} onSubmit={handleSubmit} externalData={formData} className="space-y-4">
      {saveBlocked && (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription className="text-sm">
            {isLoadingRecord
              ? "Carregando registro completo. Salvamento bloqueado."
              : "Carregamento incompleto ou falha da API. Salvamento bloqueado; campos exibidos foram preservados."}
          </AlertDescription>
        </Alert>
      )}
      <CadastroCodigoRegistroField
        idOnly
        hasId={Boolean(dadosIniciais?.id)}
        entityId={dadosIniciais?.id}
        action="id-tecnico-empresa"
      />
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Razao Social *</Label>
          <Input value={formData.razao_social} onChange={(e) => setFormData({ ...formData, razao_social: e.target.value })} disabled={!podeSalvar || saveBlocked} data-permission={permissaoFormulario} data-action="editar-razao-social-empresa" data-sensitive />
        </div>

        <div>
          <Label>Nome Fantasia</Label>
          <Input value={formData.nome_fantasia} onChange={(e) => setFormData({ ...formData, nome_fantasia: e.target.value })} disabled={!podeSalvar || saveBlocked} data-permission={permissaoFormulario} data-action="editar-nome-fantasia-empresa" data-sensitive />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>CNPJ *</Label>
          <Input value={formData.cnpj} onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })} placeholder="00.000.000/0000-00" disabled={!podeSalvar || saveBlocked} data-permission={permissaoFormulario} data-action="editar-cnpj-empresa" data-sensitive />
        </div>

        <div>
          <Label>Inscricao Estadual</Label>
          <Input value={formData.inscricao_estadual} onChange={(e) => setFormData({ ...formData, inscricao_estadual: e.target.value })} disabled={!podeSalvar || saveBlocked} data-permission={permissaoFormulario} data-action="editar-inscricao-estadual-empresa" data-sensitive />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Regime Tributario</Label>
          <Select value={formData.regime_tributario} onValueChange={(v) => setFormData({ ...formData, regime_tributario: v })} disabled={!podeSalvar || saveBlocked}>
            <SelectTrigger data-permission={permissaoFormulario} data-action="selecionar-regime-tributario-empresa" data-sensitive>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Simples Nacional">Simples Nacional</SelectItem>
              <SelectItem value="Lucro Presumido">Lucro Presumido</SelectItem>
              <SelectItem value="Lucro Real">Lucro Real</SelectItem>
              <SelectItem value="MEI">MEI</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Tipo</Label>
          <Select
            value={formData.tipo === "Filial" ? "Filial" : "Matriz"}
            onValueChange={(v) => setFormData({
              ...formData,
              tipo: v === "Filial" ? "Filial" : "Matriz",
              matriz_id: v === "Filial" ? formData.matriz_id : "",
            })}
            disabled={!podeSalvar || saveBlocked}
          >
            <SelectTrigger data-permission={permissaoFormulario} data-action="selecionar-tipo-empresa" data-sensitive>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Matriz">Matriz</SelectItem>
              <SelectItem value="Filial">Filial</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {formData.tipo === "Filial" && (
        <div data-action="empresa-matriz-secao">
          <Label>Matriz</Label>
          <Select
            value={formData.matriz_id || ""}
            onValueChange={(v) => setFormData({ ...formData, matriz_id: v })}
            disabled={!podeSalvar || saveBlocked}
          >
            <SelectTrigger data-permission={permissaoFormulario} data-action="selecionar-matriz-empresa" data-sensitive>
              <SelectValue placeholder="Selecione a matriz" />
            </SelectTrigger>
            <SelectContent>
              {matrizes.map((matriz) => (
                <SelectItem key={matriz.id} value={matriz.id}>
                  {matriz.razao_social || matriz.nome_fantasia || matriz.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-3 rounded border border-slate-200 bg-slate-50/80 p-4" data-action="empresa-contato-secao">
        <h4 className="font-semibold text-slate-800">Contato</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Telefone</Label>
            <Input
              value={formData.contato?.telefone || ""}
              onChange={(e) => setFormData({ ...formData, contato: { ...formData.contato, telefone: e.target.value } })}
              disabled={!podeSalvar || saveBlocked}
              data-permission={permissaoFormulario}
              data-action="editar-telefone-empresa"
              data-sensitive
            />
          </div>
          <div>
            <Label>E-mail</Label>
            <Input
              type="email"
              value={formData.contato?.email || ""}
              onChange={(e) => setFormData({ ...formData, contato: { ...formData.contato, email: e.target.value } })}
              disabled={!podeSalvar || saveBlocked}
              data-permission={permissaoFormulario}
              data-action="editar-email-empresa"
              data-sensitive
            />
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded border border-slate-200 bg-slate-50/80 p-4" data-action="empresa-endereco-secao">
        <h4 className="font-semibold text-slate-800">Endereço</h4>
        <BuscaCEP
          onEnderecoEncontrado={(endereco) => {
            if (!podeSalvar || saveBlocked) return;
            setFormData((prev) => ({
              ...prev,
              endereco: {
                ...prev.endereco,
                ...(endereco && typeof endereco === "object" ? endereco : {}),
              },
            }));
          }}
        />
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Logradouro</Label>
            <Input
              value={formData.endereco?.logradouro || ""}
              onChange={(e) => setFormData({ ...formData, endereco: { ...formData.endereco, logradouro: e.target.value } })}
              disabled={!podeSalvar || saveBlocked}
              data-permission={permissaoFormulario}
              data-action="editar-endereco-logradouro-empresa"
              data-sensitive
            />
          </div>
          <div>
            <Label>Número</Label>
            <Input
              value={formData.endereco?.numero || ""}
              onChange={(e) => setFormData({ ...formData, endereco: { ...formData.endereco, numero: e.target.value } })}
              disabled={!podeSalvar || saveBlocked}
              data-permission={permissaoFormulario}
              data-action="editar-endereco-numero-empresa"
              data-sensitive
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Bairro</Label>
            <Input
              value={formData.endereco?.bairro || ""}
              onChange={(e) => setFormData({ ...formData, endereco: { ...formData.endereco, bairro: e.target.value } })}
              disabled={!podeSalvar || saveBlocked}
              data-permission={permissaoFormulario}
              data-action="editar-endereco-bairro-empresa"
              data-sensitive
            />
          </div>
          <div>
            <Label>Complemento</Label>
            <Input
              value={formData.endereco?.complemento || ""}
              onChange={(e) => setFormData({ ...formData, endereco: { ...formData.endereco, complemento: e.target.value } })}
              disabled={!podeSalvar || saveBlocked}
              data-permission={permissaoFormulario}
              data-action="editar-endereco-complemento-empresa"
              data-sensitive
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label>Cidade</Label>
            <Input value={formData.endereco?.cidade || ""} readOnly disabled className="bg-white" data-action="endereco-cidade-empresa" />
          </div>
          <div>
            <Label>Estado</Label>
            <Input value={formData.endereco?.estado || ""} readOnly disabled className="bg-white" data-action="endereco-estado-empresa" />
          </div>
          <div>
            <Label>CEP</Label>
            <Input value={formData.endereco?.cep || ""} readOnly disabled className="bg-white" data-action="endereco-cep-empresa" />
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded border border-slate-200 bg-slate-50/80 p-4" data-action="empresa-fiscal-secao">
        <h4 className="font-semibold text-slate-800">Configuração fiscal</h4>
        <div>
          <Label>Ambiente NF-e</Label>
          <Select
            value={formData.configuracao_fiscal?.ambiente_nfe || "Homologacao"}
            onValueChange={(v) => setFormData({ ...formData, configuracao_fiscal: { ...formData.configuracao_fiscal, ambiente_nfe: v } })}
            disabled={!podeSalvar || saveBlocked}
          >
            <SelectTrigger data-permission={permissaoFormulario} data-action="selecionar-ambiente-nfe-empresa" data-sensitive>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Homologacao">Homologacao (testes)</SelectItem>
              <SelectItem value="Homologação">Homologação (testes)</SelectItem>
              <SelectItem value="Producao">Producao</SelectItem>
              <SelectItem value="Produção">Produção</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(formData.configuracao_fiscal?.autoriza_emissao_producao)}
            onChange={(e) => setFormData({
              ...formData,
              configuracao_fiscal: {
                ...formData.configuracao_fiscal,
                autoriza_emissao_producao: e.target.checked,
              },
            })}
            disabled={!podeSalvar || saveBlocked}
            data-permission={permissaoFormulario}
            data-action="autorizar-emissao-producao-empresa"
          />
          Autorizar emissao em producao
        </label>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Série NF-e</Label>
            <Input
              value={formData.configuracao_fiscal?.serie_nfe || ""}
              onChange={(e) => setFormData({ ...formData, configuracao_fiscal: { ...formData.configuracao_fiscal, serie_nfe: e.target.value } })}
              disabled={!podeSalvar || saveBlocked}
              data-permission={permissaoFormulario}
              data-action="editar-serie-nfe-empresa"
              data-sensitive
            />
          </div>
          <div>
            <Label>Próximo número</Label>
            <Input
              type="number"
              value={formData.configuracao_fiscal?.proximo_numero_nfe ?? 1}
              onChange={(e) => setFormData({ ...formData, configuracao_fiscal: { ...formData.configuracao_fiscal, proximo_numero_nfe: Number(e.target.value) } })}
              disabled={!podeSalvar || saveBlocked}
              data-permission={permissaoFormulario}
              data-action="editar-proximo-numero-nfe-empresa"
              data-sensitive
            />
          </div>
        </div>
      </div>

      <div className="p-4 bg-amber-50 rounded border border-amber-200" data-action="empresa-certificado-secao">
        <h4 className="font-semibold mb-3">Certificado Digital</h4>
        {!podeEditarCertificado && (
          <p className="text-xs text-amber-800 mb-3">
            Edicao de certificado exige permissao especifica. Alteracoes nesta secao estao bloqueadas.
          </p>
        )}

        <div className="grid grid-cols-2 gap-4 mb-3">
          <div>
            <Label>Data de Validade</Label>
            <Input type="date" value={formData.certificado_digital?.data_validade || ""} onChange={(e) => setFormData({ ...formData, certificado_digital: { ...formData.certificado_digital, data_validade: e.target.value } })} disabled={!podeEditarCertificado || saveBlocked} data-permission={permissaoCertificado} data-action="editar-validade-certificado" data-sensitive />
          </div>

          <div>
            <Label>Tipo</Label>
            <Select value={formData.certificado_digital?.tipo || "A1"} onValueChange={(v) => setFormData({ ...formData, certificado_digital: { ...formData.certificado_digital, tipo: v } })} disabled={!podeEditarCertificado || saveBlocked}>
              <SelectTrigger data-permission={permissaoCertificado} data-action="selecionar-tipo-certificado" data-sensitive>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="A1">A1 (arquivo)</SelectItem>
                <SelectItem value="A3">A3 (token)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="border border-dashed rounded-lg p-4 text-center mb-3">
          <Upload className="w-6 h-6 mx-auto mb-2 text-slate-400" />
          <input
            type="file"
            accept=".pfx"
            onChange={handleCertificadoUpload}
            className="hidden"
            id="upload-cert-empresa-form"
            disabled={!podeEditarCertificado || saveBlocked}
          />
          <label htmlFor="upload-cert-empresa-form" className="inline-block">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!podeEditarCertificado || saveBlocked}
              data-permission={permissaoCertificado}
              data-action="upload-certificado-empresa"
              onClick={() => document.getElementById("upload-cert-empresa-form")?.click()}
            >
              Selecionar certificado (.pfx)
            </Button>
          </label>
          {formData.certificado_digital?.arquivo_certificado && (
            <p className="text-xs text-green-700 mt-2">Certificado carregado</p>
          )}
        </div>

        {alertaCertificado && (
          <Alert className={alertaCertificado.tipo === "error" ? "border-red-200 bg-red-50" : "border-orange-200 bg-orange-50"}>
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription className="text-sm">
              {alertaCertificado.mensagem}
            </AlertDescription>
          </Alert>
        )}
      </div>

      <div className="space-y-3 rounded border border-slate-200 bg-slate-50/80 p-4" data-action="empresa-webhooks-secao">
        <h4 className="font-semibold text-slate-800">Webhooks padrão</h4>
        <div>
          <Label>Pagamento recebido</Label>
          <Input
            value={formData.urls_webhook_padrao?.pagamento_recebido || ""}
            onChange={(e) => setFormData({ ...formData, urls_webhook_padrao: { ...formData.urls_webhook_padrao, pagamento_recebido: e.target.value } })}
            placeholder="https://api.exemplo.com/webhook/pagamento"
            disabled={!podeSalvar || saveBlocked}
            data-permission={permissaoFormulario}
            data-action="editar-webhook-pagamento-empresa"
            data-sensitive
          />
        </div>
        <div>
          <Label>NF-e emitida</Label>
          <Input
            value={formData.urls_webhook_padrao?.nfe_emitida || ""}
            onChange={(e) => setFormData({ ...formData, urls_webhook_padrao: { ...formData.urls_webhook_padrao, nfe_emitida: e.target.value } })}
            placeholder="https://api.exemplo.com/webhook/nfe"
            disabled={!podeSalvar || saveBlocked}
            data-permission={permissaoFormulario}
            data-action="editar-webhook-nfe-empresa"
            data-sensitive
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        {dadosIniciais?.id && (
          <>
            <Button
              type="button"
              variant="outline"
              disabled={!podeEditar || saveBlocked || !contextoValido}
              data-permission={permissaoFormulario}
              data-action="alternar-status-empresa"
              data-sensitive
              className={formData.status === "Ativa" ? "border-orange-300 text-orange-700" : "border-green-300 text-green-700"}
              onClick={() => setFormData({ ...formData, status: formData.status === "Ativa" ? "Inativa" : "Ativa" })}
            >
              {formData.status === "Ativa" ? <><PowerOff className="w-4 h-4 mr-2" />Inativar</> : <><Power className="w-4 h-4 mr-2" />Ativar</>}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!podeExcluir || saveBlocked || !contextoValido}
              data-permission="Cadastros.Organizacional.excluir"
              data-action="excluir-empresa"
              data-sensitive
              onClick={() => {
                if (!podeExcluir) {
                  toast.error("Seu perfil nao permite excluir empresas.");
                  return;
                }
                if (!window.confirm(`Excluir a empresa "${formData.razao_social}"?`)) return;
                onSubmit({ ...buildPayload(), _action: "delete" });
              }}
            >
              Excluir
            </Button>
          </>
        )}
        <Button type="submit" disabled={isSubmitting || !podeSalvar || saveBlocked} data-permission={permissaoFormulario} data-action="salvar-empresa" data-sensitive>
          {(isSubmitting || isLoadingRecord) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {dadosIniciais?.id ? "Atualizar" : "Criar Empresa"}
        </Button>
      </div>
    </FormWrapper>
  );

  if (windowMode) {
    return (
      <div className="w-full h-full overflow-auto bg-white p-6">
        <div className="mb-4 pb-4 border-b">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            {dadosIniciais?.id ? "Editar Empresa" : "Nova Empresa"}
          </h2>
        </div>
        {formContent}
      </div>
    );
  }

  return formContent;
}
