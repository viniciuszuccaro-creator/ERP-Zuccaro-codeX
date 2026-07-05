import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, FileText } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import usePermissions from "@/components/lib/usePermissions";
import { useContextoVisual } from "@/components/lib/useContextoVisual";

const sanitizeText = (value, max = 500) => String(value ?? "").replace(/[<>]/g, "").slice(0, max).trim();
const sanitizeCode = (value) => String(value ?? "").replace(/[^0-9A-Za-z./-]/g, "").slice(0, 32).trim().toUpperCase();
const toPercent = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

export default function CadastroFiscalForm({ cadastroFiscal, item, data, initialData, defaultValues, onSubmit, isSubmitting }) {
  const dadosIniciais = item || data || initialData || defaultValues || cadastroFiscal;
  const { canCreate, canEdit } = usePermissions();
  const { empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || dadosIniciais?.group_id || null;
  const contextoValido = Boolean(empresaAtual?.id || groupId || dadosIniciais?.empresa_id || dadosIniciais?.group_id);
  const podeCriar = canCreate("Cadastros", "CadastroFiscal") || canCreate("Fiscal", "CadastroFiscal") || canCreate("Cadastros", null);
  const podeEditar = canEdit("Cadastros", "CadastroFiscal") || canEdit("Fiscal", "CadastroFiscal") || canEdit("Cadastros", null);
  const podeSalvar = dadosIniciais?.id ? podeEditar : podeCriar;
  const [formData, setFormData] = useState(dadosIniciais || {
    tipo_cadastro: 'NCM',
    codigo: '',
    descricao: '',
    aliquota_padrao: 0,
    observacoes: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!podeSalvar) {
      alert(dadosIniciais?.id ? 'Sem permissao para editar cadastro fiscal.' : 'Sem permissao para criar cadastro fiscal.');
      return;
    }
    if (!contextoValido) {
      alert('Selecione um grupo ou empresa antes de salvar.');
      return;
    }
    const payload = {
      ...formData,
      tipo_cadastro: sanitizeText(formData.tipo_cadastro, 40),
      codigo: sanitizeCode(formData.codigo),
      descricao: sanitizeText(formData.descricao, 500),
      aliquota_padrao: toPercent(formData.aliquota_padrao),
      observacoes: sanitizeText(formData.observacoes, 1000),
      group_id: groupId || formData.group_id,
      empresa_id: contexto === "empresa" ? empresaAtual?.id : formData.empresa_id,
      nome: sanitizeCode(formData.codigo) + " - " + sanitizeText(formData.descricao, 120)
    };
    if (!payload.tipo_cadastro || !payload.codigo) {
      alert('Preencha os campos obrigatorios');
      return;
    }
    onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Tipo de Cadastro *</Label>
        <Select value={formData.tipo_cadastro} onValueChange={(v) => setFormData({...formData, tipo_cadastro: v})} disabled={!podeSalvar}>
          <SelectTrigger data-permission="Cadastros.CadastroFiscal.editar" data-action="editar-tipo-cadastro-fiscal" data-sensitive>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="NCM">NCM - Nomenclatura Comum Mercosul</SelectItem>
            <SelectItem value="CFOP">CFOP - Codigo Fiscal de Operacoes</SelectItem>
            <SelectItem value="CEST">CEST - Codigo Especificador ST</SelectItem>
            <SelectItem value="CST">CST - Codigo de Situacao Tributaria</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Codigo *</Label>
        <Input
          value={formData.codigo}
          onChange={(e) => setFormData({...formData, codigo: e.target.value})}
          placeholder={
            formData.tipo_cadastro === 'NCM' ? 'Ex: 7213.10.00' :
            formData.tipo_cadastro === 'CFOP' ? 'Ex: 5102' :
            formData.tipo_cadastro === 'CEST' ? 'Ex: 01.001.00' :
            'Ex: 00'
          }
          disabled={!podeSalvar}
          data-permission="Cadastros.CadastroFiscal.editar"
          data-action="editar-codigo-cadastro-fiscal"
          data-sensitive
        />
      </div>

      <div>
        <Label>Descricao *</Label>
        <Textarea
          value={formData.descricao}
          onChange={(e) => setFormData({...formData, descricao: e.target.value})}
          rows={2}
          placeholder="Descricao completa"
          disabled={!podeSalvar}
          data-permission="Cadastros.CadastroFiscal.editar"
          data-action="editar-descricao-cadastro-fiscal"
          data-sensitive
        />
      </div>

      {formData.tipo_cadastro === 'NCM' && (
        <div>
          <Label>Aliquota Padrao IPI (%)</Label>
          <Input
            type="number"
            step="0.01"
            value={formData.aliquota_padrao}
            onChange={(e) => setFormData({...formData, aliquota_padrao: parseFloat(e.target.value)})}
            disabled={!podeSalvar}
            data-permission="Cadastros.CadastroFiscal.editar"
            data-action="editar-aliquota-cadastro-fiscal"
            data-sensitive
          />
        </div>
      )}

      <div>
        <Label>Observacoes</Label>
        <Textarea
          value={formData.observacoes}
          onChange={(e) => setFormData({...formData, observacoes: e.target.value})}
          rows={2}
          disabled={!podeSalvar}
          data-permission="Cadastros.CadastroFiscal.editar"
          data-action="editar-observacoes-cadastro-fiscal"
          data-sensitive
        />
      </div>

      <Alert className="border-purple-200 bg-purple-50">
        <FileText className="w-4 h-4" />
        <AlertDescription className="text-sm">
          IA DIFAL atualiza aliquotas automaticamente via API Sefaz
        </AlertDescription>
      </Alert>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="submit" disabled={isSubmitting || !contextoValido || !podeSalvar} data-permission="Cadastros.CadastroFiscal.salvar" data-action="salvar-cadastro-fiscal" data-sensitive>
          {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {dadosIniciais ? 'Atualizar' : 'Criar Cadastro Fiscal'}
        </Button>
      </div>
    </form>
  );
}
