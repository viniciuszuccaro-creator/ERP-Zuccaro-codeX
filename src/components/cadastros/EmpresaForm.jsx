import React, { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { z } from "zod";
import FormWrapper from "@/components/common/FormWrapper";
import { Loader2, Building2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import usePermissions from "@/components/lib/usePermissions";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import { hasCadastroEntityPermission } from "@/components/cadastros/cadastroEditLoadPolicy";

const sanitizeText = (value, max = 500) => String(value ?? "").replace(/[<>]/g, "").slice(0, max).trim();
const sanitizeDocument = (value, max = 32) => String(value ?? "").replace(/[^0-9A-Za-z.\-/]/g, "").slice(0, max).trim();
const toInteger = (value, fallback = 0) => Number.isFinite(Number(value)) ? parseInt(value, 10) : fallback;

const EMPRESA_FORM_DEFAULTS = Object.freeze({
  razao_social: "",
  nome_fantasia: "",
  cnpj: "",
  inscricao_estadual: "",
  regime_tributario: "Simples Nacional",
  tipo: "Matriz",
  status: "Ativa",
  certificado_digital: Object.freeze({
    tipo: "A1",
    arquivo_certificado: "",
    senha_certificado: "",
    data_validade: "",
  }),
  configuracao_fiscal: Object.freeze({
    ambiente_nfe: "Homologacao",
    serie_nfe: "1",
    proximo_numero_nfe: 1,
    autoriza_emissao_producao: false,
  }),
});

function mergeEmpresaFormData(partial) {
  const src = partial && typeof partial === "object" ? partial : {};
  return {
    ...EMPRESA_FORM_DEFAULTS,
    ...src,
    certificado_digital: {
      ...EMPRESA_FORM_DEFAULTS.certificado_digital,
      ...(src.certificado_digital && typeof src.certificado_digital === "object" ? src.certificado_digital : {}),
    },
    configuracao_fiscal: {
      ...EMPRESA_FORM_DEFAULTS.configuracao_fiscal,
      ...(src.configuracao_fiscal && typeof src.configuracao_fiscal === "object" ? src.configuracao_fiscal : {}),
    },
  };
}

/**
 * V21.1.2 - WINDOW MODE READY
 * Consolida #226 (deep-merge/tenant) + #227 (ID visível, Organizacional, certificado granular).
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
  const { canCreate, canEdit, hasPermission, hasPermissionKey } = usePermissions();
  const { empresaAtual, grupoAtual } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || dadosIniciais?.group_id || null;
  const contextoValido = Boolean(empresaAtual?.id || groupId || dadosIniciais?.empresa_id || dadosIniciais?.group_id);
  const permCheckers = { hasPermission, canCreate, canEdit };
  const podeCriar = hasCadastroEntityPermission("Empresa", "criar", permCheckers);
  const podeEditar = hasCadastroEntityPermission("Empresa", "editar", permCheckers);
  const podeSalvar = dadosIniciais?.id ? podeEditar : podeCriar;
  const permissaoFormulario = dadosIniciais?.id
    ? "Cadastros.Organizacional.editar"
    : "Cadastros.Organizacional.criar";
  const permissaoCertificado = "Cadastros.Empresa.Certificado.editar";
  const podeEditarCertificado = podeSalvar && hasPermissionKey(permissaoCertificado);
  const saveBlocked = Boolean(isLoadingRecord || loadIncomplete);
  const [formData, setFormData] = useState(() => mergeEmpresaFormData(dadosIniciais));

  const [alertaCertificado, setAlertaCertificado] = useState(null);

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
      tipo: sanitizeText(formData.tipo, 40),
      status: sanitizeText(formData.status, 40),
      group_id: formData.group_id || groupId,
      grupo_id: formData.grupo_id || formData.group_id || groupId,
    };

    // Update: não reenviar configuração fiscal oculta — merge no Visualizador preserva a carregada (#227).
    if (!dadosIniciais?.id) {
      payload.configuracao_fiscal = {
        ambiente_nfe: sanitizeText(formData.configuracao_fiscal?.ambiente_nfe || "Homologacao", 40),
        serie_nfe: sanitizeText(formData.configuracao_fiscal?.serie_nfe || "1", 20),
        proximo_numero_nfe: toInteger(formData.configuracao_fiscal?.proximo_numero_nfe, 1),
        autoriza_emissao_producao: Boolean(formData.configuracao_fiscal?.autoriza_emissao_producao),
      };
    } else {
      delete payload.configuracao_fiscal;
    }

    if (podeEditarCertificado) {
      payload.certificado_digital = {
        tipo: sanitizeText(formData.certificado_digital?.tipo || "A1", 10),
        arquivo_certificado: sanitizeText(formData.certificado_digital?.arquivo_certificado, 500),
        senha_certificado: sanitizeText(formData.certificado_digital?.senha_certificado, 500),
        data_validade: sanitizeText(formData.certificado_digital?.data_validade, 20),
      };
    } else {
      delete payload.certificado_digital;
    }

    // Tenant master: nao carimbar empresa_id do contexto atual sobre o registro.
    if (formData.empresa_id != null && formData.empresa_id !== "") {
      payload.empresa_id = formData.empresa_id;
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
      {dadosIniciais?.id && (
        <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <span className="font-medium">ID do cadastro (somente leitura): </span>
          <code className="break-all select-text">{dadosIniciais.id}</code>
        </div>
      )}
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

      <div className="p-4 bg-amber-50 rounded border border-amber-200">
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

        {alertaCertificado && (
          <Alert className={alertaCertificado.tipo === "error" ? "border-red-200 bg-red-50" : "border-orange-200 bg-orange-50"}>
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription className="text-sm">
              {alertaCertificado.mensagem}
            </AlertDescription>
          </Alert>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
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
