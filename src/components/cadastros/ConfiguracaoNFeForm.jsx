import React, { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Save, Upload } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import useContextoVisual from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { requireAutomacaoHumanConfirm } from "@/components/lib/automacaoAvancadaPolicy";

export default function ConfiguracaoNFeForm({ config, onSubmit, isSubmitting, windowMode = false, empresaId, groupId, scope: scopeProp }) {
  const { toast } = useToast();
  const { empresaAtual, grupoAtual, filterInContext, createInContext, updateInContext } = useContextoVisual();
  const { canCreate, canEdit, hasPermission } = usePermissions();
  const [localSubmitting, setLocalSubmitting] = useState(false);
  const [formData, setFormData] = useState(config || {
    provedor: "eNotas",
    api_url: "",
    api_key: "",
    certificado_digital_url: "",
    senha_certificado: "",
    ambiente: "Homologação",
    serie_nfe: "1",
    proximo_numero: 1,
    emitir_automatico: false,
    enviar_email_automatico: true,
    ativo: true,
    autoriza_emissao_producao: false,
    observacoes: ""
  });
  const grupoIdAtual = groupId || grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaIdAtual = empresaId || empresaAtual?.id || null;
  const scope = scopeProp || (empresaIdAtual ? { empresa_id: empresaIdAtual, group_id: grupoIdAtual } : null);
  const contextoValido = Boolean(empresaIdAtual && (grupoIdAtual || scope?.group_id));
  const salvando = !!isSubmitting || localSubmitting;
  const podeSalvar = config?.id
    ? (canEdit("Fiscal", "ConfiguracaoNFe") || canEdit("Fiscal", "NF-e") || canEdit("Fiscal", "NotaFiscal"))
    : (canCreate("Fiscal", "ConfiguracaoNFe") || canCreate("Fiscal", "NF-e") || canCreate("Fiscal", "NotaFiscal"));
  const podeAutorizarProducao = hasPermission("Fiscal", "ConfiguracaoNFe", "configurar")
    || hasPermission("Fiscal", "NF-e", "configurar")
    || hasPermission("Fiscal", "NotaFiscal", "configurar")
    || podeSalvar;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!contextoValido) {
      toast({ title: "Selecione a empresa emitente antes de salvar NF-e.", variant: "destructive" });
      return;
    }
    if (!podeSalvar) {
      toast({ title: "Seu perfil nao permite salvar configuracao de NF-e.", variant: "destructive" });
      return;
    }
    if (formData.autoriza_emissao_producao && !podeAutorizarProducao) {
      toast({ title: "Sem permissao para autorizar emissao em producao.", variant: "destructive" });
      return;
    }

    const payload = { ...formData, nome: formData.nome || (formData.provedor + ' - ' + formData.ambiente), ...scope, empresa_id: empresaIdAtual, group_id: grupoIdAtual || scope?.group_id };

    if (onSubmit) {
      await onSubmit(payload);
      return;
    }

    setLocalSubmitting(true);
    try {
      const existentes = config?.id
        ? []
        : await filterInContext('ConfiguracaoNFe', { nome: payload.nome, ...scope }, undefined, 1);
      const result = config?.id
        ? await updateInContext('ConfiguracaoNFe', config.id, payload)
        : existentes?.[0]?.id
          ? await updateInContext('ConfiguracaoNFe', existentes[0].id, { ...existentes[0], ...payload })
          : await createInContext('ConfiguracaoNFe', payload);

      toast({ title: "Configuracao NF-e salva!" });
    } catch (error) {
      toast({ title: "Erro ao salvar NF-e", description: String(error?.message || error), variant: "destructive" });
    } finally {
      setLocalSubmitting(false);
    }
  };

  const form = (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            Configuração NF-e
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Provedor *</Label>
              <Select value={formData.provedor} disabled={!contextoValido || salvando} onValueChange={(val) => setFormData({ ...formData, provedor: val })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="eNotas">eNotas</SelectItem>
                  <SelectItem value="NFe.io">NFe.io</SelectItem>
                  <SelectItem value="Focus NFe">Focus NFe</SelectItem>
                  <SelectItem value="Outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Ambiente</Label>
              <Select value={formData.ambiente} disabled={!contextoValido || salvando} onValueChange={(val) => setFormData({ ...formData, ambiente: val })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Homologação">Homologação</SelectItem>
                  <SelectItem value="Produção">Produção</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>URL da API</Label>
            <Input
              value={formData.api_url}
              onChange={(e) => setFormData({ ...formData, api_url: e.target.value })}
              placeholder="https://api.enotas.com.br"
              disabled={!contextoValido || salvando}
            />
          </div>

          <div>
            <Label>API Key *</Label>
            <Input
              type="password"
              value={formData.api_key}
              onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
              placeholder="Insira a chave da API"
              disabled={!contextoValido || salvando}
            />
          </div>

          <div>
            <Label>Senha do Certificado Digital</Label>
            <Input
              type="password"
              value={formData.senha_certificado}
              onChange={(e) => setFormData({ ...formData, senha_certificado: e.target.value })}
              placeholder="Senha do certificado A1"
              disabled={!contextoValido || salvando}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Série NF-e</Label>
              <Input
                value={formData.serie_nfe}
                onChange={(e) => setFormData({ ...formData, serie_nfe: e.target.value })}
                placeholder="1"
                disabled={!contextoValido || salvando}
              />
            </div>
            <div>
              <Label>Próximo Número</Label>
              <Input
                type="number"
                value={formData.proximo_numero}
                onChange={(e) => setFormData({ ...formData, proximo_numero: e.target.value === "" ? "" : parseInt(e.target.value, 10) || 1 })}
                disabled={!contextoValido || salvando}
              />
            </div>
          </div>

          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded">
              <div>
                <Label>Emitir Automaticamente após Faturamento</Label>
                <p className="text-xs text-slate-500 mt-1">
                  Só dispara NF-e no pedido se esta flag estiver ativa na empresa.
                </p>
              </div>
              <Switch
                checked={formData.emitir_automatico}
                onCheckedChange={(val) => {
                  if (val && !requireAutomacaoHumanConfirm(
                    'Ativar emissao automatica de NF-e ao aprovar/faturar pedido? Acao fiscal critica.',
                  )) {
                    return;
                  }
                  setFormData({ ...formData, emitir_automatico: val });
                }}
                disabled={!contextoValido || salvando}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded">
              <Label>Enviar Email com DANFE Automaticamente</Label>
              <Switch
                checked={formData.enviar_email_automatico}
                onCheckedChange={(val) => setFormData({ ...formData, enviar_email_automatico: val })}
                disabled={!contextoValido || salvando}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded">
              <Label>Autorizar emissao em producao</Label>
              <Switch
                checked={Boolean(formData.autoriza_emissao_producao)}
                onCheckedChange={(val) => {
                  if (val && !requireAutomacaoHumanConfirm(
                    'Autorizar emissao de NF-e em PRODUCAO? Confirme somente com certificado e provedor validos.',
                  )) {
                    return;
                  }
                  setFormData({ ...formData, autoriza_emissao_producao: val });
                }}
                disabled={!contextoValido || salvando || !podeAutorizarProducao}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded">
              <Label>Configuração Ativa</Label>
              <Switch
                checked={formData.ativo}
                onCheckedChange={(val) => setFormData({ ...formData, ativo: val })}
                disabled={!contextoValido || salvando}
              />
            </div>
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea
              value={formData.observacoes}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              rows={2}
              disabled={!contextoValido || salvando}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={salvando || !contextoValido || !podeSalvar} data-action="Fiscal.NFe.salvar">
          <Save className="w-4 h-4 mr-2" />
          {salvando ? 'Salvando...' : config ? 'Atualizar' : 'Criar'}
        </Button>
      </div>
    </form>
  );

  if (windowMode) {
    return (
      <div className="w-full h-full overflow-auto bg-white p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b">
            <FileText className="w-8 h-8 text-blue-600" />
            <h2 className="text-2xl font-bold text-slate-900">
              {config ? 'Editar Configuração NF-e' : 'Nova Configuração NF-e'}
            </h2>
          </div>
          {form}
        </div>
      </div>
    );
  }

  return form;
}
