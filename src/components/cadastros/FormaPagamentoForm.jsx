import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, CreditCard, Trash2, Power, PowerOff } from "lucide-react";
import { z } from "zod";
import FormWrapper from "@/components/common/FormWrapper";
import usePermissions from "@/components/lib/usePermissions";
import { useContextoVisual } from "@/components/lib/useContextoVisual";

const sanitizeText = (value, max = 500) => String(value ?? "").replace(/[<>]/g, "").slice(0, max).trim();
const toNumber = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const toInteger = (value, fallback = 0) => Number.isFinite(Number(value)) ? parseInt(value, 10) : fallback;

/**
 * V21.1.2 - WINDOW MODE READY
 */
export default function FormaPagamentoForm({ forma, item, data, initialData, defaultValues, onSubmit, isSubmitting, windowMode = false }) {
  const dadosIniciais = item || data || initialData || defaultValues || forma;
  const { canCreate, canEdit, canDelete } = usePermissions();
  const { empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || dadosIniciais?.group_id || null;
  const contextoValido = Boolean(empresaAtual?.id || groupId || dadosIniciais?.empresa_id || dadosIniciais?.group_id);
  const podeCriar = canCreate("Cadastros", "FormaPagamento") || canCreate("Financeiro", "FormaPagamento") || canCreate("Cadastros", null);
  const podeEditar = canEdit("Cadastros", "FormaPagamento") || canEdit("Financeiro", "FormaPagamento") || canEdit("Cadastros", null);
  const podeExcluir = canDelete("Cadastros", "FormaPagamento") || canDelete("Financeiro", "FormaPagamento") || canDelete("Cadastros", null);
  const podeSalvar = dadosIniciais?.id ? podeEditar : podeCriar;
  const [formData, setFormData] = useState(dadosIniciais || {
    codigo: "",
    descricao: "",
    tipo: "Dinheiro",
    ativa: true,
    aceita_desconto: true,
    percentual_desconto_padrao: 0,
    aplicar_acrescimo: false,
    percentual_acrescimo_padrao: 0,
    prazo_compensacao_dias: 0,
    gerar_cobranca_online: false,
    permite_parcelamento: false,
    maximo_parcelas: 1,
    intervalo_parcelas_dias: 30
  });

  const schema = z.object({
    descricao: z.string().min(1, "Descricao e obrigatoria"),
    tipo: z.string().min(1, "Tipo e obrigatorio")
  });

  const buildPayload = (extra = {}) => ({
    ...formData,
    ...extra,
    codigo: sanitizeText(formData.codigo, 80),
    descricao: sanitizeText(formData.descricao, 180),
    nome: sanitizeText(formData.descricao, 180),
    tipo: sanitizeText(formData.tipo, 80),
    percentual_desconto_padrao: toNumber(formData.percentual_desconto_padrao, 0),
    percentual_acrescimo_padrao: toNumber(formData.percentual_acrescimo_padrao, 0),
    prazo_compensacao_dias: toInteger(formData.prazo_compensacao_dias, 0),
    maximo_parcelas: toInteger(formData.maximo_parcelas, 1),
    intervalo_parcelas_dias: toInteger(formData.intervalo_parcelas_dias, 30),
    group_id: groupId || formData.group_id,
    empresa_id: contexto === "empresa" ? empresaAtual?.id : formData.empresa_id
  });

  const handleSubmit = async () => {
    if (!podeSalvar) {
      alert(dadosIniciais?.id ? "Sem permissao para editar formas de pagamento." : "Sem permissao para criar formas de pagamento.");
      return;
    }
    if (!contextoValido) {
      alert("Selecione um grupo ou empresa antes de salvar.");
      return;
    }
    const payload = buildPayload();
    if (!payload.descricao || !payload.tipo) {
      alert("Descricao e tipo sao obrigatorios.");
      return;
    }
    onSubmit(payload);
  };

  const handleExcluir = () => {
    if (!podeExcluir) {
      alert("Sem permissao para excluir formas de pagamento.");
      return;
    }
    if (!window.confirm(`Tem certeza que deseja excluir a forma de pagamento "${sanitizeText(formData.descricao, 180)}"? Esta acao nao pode ser desfeita.`)) {
      return;
    }
    if (onSubmit) {
      onSubmit(buildPayload({ _action: "delete" }));
    }
  };

  const handleAlternarStatus = () => {
    if (!podeEditar) {
      alert("Sem permissao para alterar status da forma de pagamento.");
      return;
    }
    const novoStatus = !formData.ativa;
    setFormData({ ...formData, ativa: novoStatus });
  };

  const formContent = (
    <FormWrapper schema={schema} defaultValues={formData} onSubmit={handleSubmit} externalData={formData} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Descricao *</Label>
          <Input value={formData.descricao} onChange={(e) => setFormData({ ...formData, descricao: e.target.value })} placeholder="Ex: PIX, Boleto 30 dias" disabled={!podeSalvar} data-permission="Cadastros.FormaPagamento.editar" data-action="editar-descricao-forma-pagamento" data-sensitive />
        </div>

        <div>
          <Label>Codigo (opcional)</Label>
          <Input value={formData.codigo} onChange={(e) => setFormData({ ...formData, codigo: e.target.value })} placeholder="PIX-01" disabled={!podeSalvar} data-permission="Cadastros.FormaPagamento.editar" data-action="editar-codigo-forma-pagamento" data-sensitive />
        </div>
      </div>

      <div>
        <Label>Tipo de Pagamento *</Label>
        <Select value={formData.tipo} onValueChange={(v) => setFormData({ ...formData, tipo: v })} disabled={!podeSalvar}>
          <SelectTrigger data-permission="Cadastros.FormaPagamento.editar" data-action="selecionar-tipo-forma-pagamento" data-sensitive>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Dinheiro">Dinheiro</SelectItem>
            <SelectItem value="PIX">PIX</SelectItem>
            <SelectItem value="Boleto">Boleto</SelectItem>
            <SelectItem value="Cartao Credito">Cartao Credito</SelectItem>
            <SelectItem value="Cartao Debito">Cartao Debito</SelectItem>
            <SelectItem value="Transferencia">Transferencia</SelectItem>
            <SelectItem value="Cheque">Cheque</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Prazo Compensacao (dias)</Label>
          <Input type="number" value={formData.prazo_compensacao_dias} onChange={(e) => setFormData({ ...formData, prazo_compensacao_dias: parseInt(e.target.value, 10) || 0 })} placeholder="0" disabled={!podeSalvar} data-permission="Cadastros.FormaPagamento.editar" data-action="editar-prazo-compensacao" data-sensitive />
        </div>

        <div>
          <Label>Desconto Padrao (%)</Label>
          <Input type="number" step="0.01" value={formData.percentual_desconto_padrao} onChange={(e) => setFormData({ ...formData, percentual_desconto_padrao: parseFloat(e.target.value) || 0 })} placeholder="0.00" disabled={!podeSalvar} data-permission="Cadastros.FormaPagamento.editar" data-action="editar-desconto-padrao" data-sensitive />
        </div>
      </div>

      <div className="flex items-center justify-between p-3 bg-slate-50 rounded">
        <div>
          <Label>Permite Parcelamento</Label>
          <p className="text-xs text-slate-500">Habilita parcelamento nesta forma</p>
        </div>
        <Switch checked={formData.permite_parcelamento} onCheckedChange={(v) => setFormData({ ...formData, permite_parcelamento: v })} disabled={!podeSalvar} data-permission="Cadastros.FormaPagamento.editar" data-action="alternar-parcelamento" data-sensitive />
      </div>

      {formData.permite_parcelamento && (
        <div className="grid grid-cols-2 gap-4 p-4 bg-blue-50 rounded border">
          <div>
            <Label>Maximo de Parcelas</Label>
            <Input type="number" value={formData.maximo_parcelas} onChange={(e) => setFormData({ ...formData, maximo_parcelas: parseInt(e.target.value, 10) || 1 })} placeholder="12" disabled={!podeSalvar} data-permission="Cadastros.FormaPagamento.editar" data-action="editar-maximo-parcelas" data-sensitive />
          </div>

          <div>
            <Label>Intervalo (dias)</Label>
            <Input type="number" value={formData.intervalo_parcelas_dias} onChange={(e) => setFormData({ ...formData, intervalo_parcelas_dias: parseInt(e.target.value, 10) || 30 })} placeholder="30" disabled={!podeSalvar} data-permission="Cadastros.FormaPagamento.editar" data-action="editar-intervalo-parcelas" data-sensitive />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between p-3 bg-slate-50 rounded">
        <Label>Forma Ativa</Label>
        <Switch checked={formData.ativa} onCheckedChange={(v) => setFormData({ ...formData, ativa: v })} disabled={!podeSalvar} data-permission="Cadastros.FormaPagamento.alterarStatus" data-action="alternar-forma-ativa" data-sensitive />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        {dadosIniciais && (
          <>
            <Button type="button" variant="outline" onClick={handleAlternarStatus} disabled={!podeEditar} data-permission="Cadastros.FormaPagamento.alterarStatus" data-sensitive className={formData.ativa ? "border-orange-300 text-orange-700" : "border-green-300 text-green-700"}>
              {formData.ativa ? (
                <><PowerOff className="w-4 h-4 mr-2" />Inativar</>
              ) : (
                <><Power className="w-4 h-4 mr-2" />Ativar</>
              )}
            </Button>
            <Button type="button" variant="destructive" onClick={handleExcluir} disabled={!podeExcluir} data-permission="Cadastros.FormaPagamento.excluir" data-sensitive>
              <Trash2 className="w-4 h-4 mr-2" />Excluir
            </Button>
          </>
        )}
        <Button type="submit" disabled={isSubmitting || !podeSalvar} data-permission="Cadastros.FormaPagamento.salvar" data-sensitive>
          {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {dadosIniciais ? "Atualizar" : "Criar Forma de Pagamento"}
        </Button>
      </div>
    </FormWrapper>
  );

  if (windowMode) {
    return (
      <div className="w-full h-full overflow-auto bg-white p-6">
        <div className="mb-4 pb-4 border-b">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-600" />
            {dadosIniciais ? "Editar Forma de Pagamento" : "Nova Forma de Pagamento"}
          </h2>
        </div>
        {formContent}
      </div>
    );
  }

  return formContent;
}
