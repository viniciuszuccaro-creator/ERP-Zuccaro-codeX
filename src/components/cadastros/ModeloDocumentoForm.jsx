import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { FileText } from 'lucide-react';
import CadastroCodigoRegistroField from '@/components/cadastros/CadastroCodigoRegistroField';
import usePermissions from '@/components/lib/usePermissions';
import { useContextoVisual } from '@/components/lib/useContextoVisual';

const sanitizeText = (value, max = 500) => String(value ?? '').replace(/[<>]/g, '').slice(0, max).trim();
const emptyModelo = {
  nome_modelo: '',
  tipo_documento: 'Romaneio',
  descricao: '',
  formato_saida: 'PDF',
  tamanho_papel: 'A4',
  incluir_logo_empresa: true,
  incluir_qrcode: true,
  ativo: true,
};

export default function ModeloDocumentoForm({
  modelo, modeloDocumento, item, data, initialData, defaultValues, onSubmit, windowMode = false,
}) {
  const dadosIniciais = item || data || initialData || defaultValues || modeloDocumento || modelo;
  const { canCreate, canEdit } = usePermissions();
  const { empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || dadosIniciais?.group_id || null;
  const contextoValido = Boolean(empresaAtual?.id || groupId || dadosIniciais?.empresa_id || dadosIniciais?.group_id);
  const podeCriar = canCreate('Cadastros', 'ModeloDocumento') || canCreate('Logistica', 'ModeloDocumento') || canCreate('Cadastros', null);
  const podeEditar = canEdit('Cadastros', 'ModeloDocumento') || canEdit('Logistica', 'ModeloDocumento') || canEdit('Cadastros', null);
  const podeSalvar = dadosIniciais?.id ? podeEditar : podeCriar;
  const [formData, setFormData] = useState(() => ({ ...emptyModelo, ...(dadosIniciais || {}) }));

  const prevIdRef = useRef(dadosIniciais?.id);
  useEffect(() => {
    if (dadosIniciais?.id && dadosIniciais.id !== prevIdRef.current) {
      prevIdRef.current = dadosIniciais.id;
      setFormData({ ...emptyModelo, ...dadosIniciais });
    }
  }, [dadosIniciais?.id]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!contextoValido) {
      alert('Selecione um grupo ou empresa antes de salvar.');
      return;
    }
    if (!podeSalvar) {
      alert(dadosIniciais?.id ? 'Sem permissão para editar modelo.' : 'Sem permissão para criar modelo.');
      return;
    }
    const nome = sanitizeText(formData.nome_modelo || formData.nome || '', 180);
    onSubmit({
      ...formData,
      nome_modelo: nome,
      nome,
      descricao: sanitizeText(formData.descricao, 1000),
      group_id: groupId || formData.group_id,
      empresa_id: contexto === 'empresa' ? empresaAtual?.id : formData.empresa_id,
    });
  };

  const content = (
    <form onSubmit={handleSubmit} className="space-y-4 p-4">
      <CadastroCodigoRegistroField
        idOnly
        hasId={Boolean(dadosIniciais?.id)}
        entityId={dadosIniciais?.id}
        action="id-tecnico-modelo-documento"
      />
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Nome do Modelo *</Label>
          <Input
            value={formData.nome_modelo}
            onChange={(e) => setFormData({ ...formData, nome_modelo: e.target.value })}
            required
          />
        </div>
        <div>
          <Label>Tipo de Documento *</Label>
          <Select value={formData.tipo_documento} onValueChange={(v) => setFormData({ ...formData, tipo_documento: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Romaneio">Romaneio</SelectItem>
              <SelectItem value="Etiqueta Volume">Etiqueta Volume</SelectItem>
              <SelectItem value="Checklist Carga">Checklist Carga</SelectItem>
              <SelectItem value="Ordem Separação">Ordem Separação</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label>Formato</Label>
          <Select value={formData.formato_saida} onValueChange={(v) => setFormData({ ...formData, formato_saida: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PDF">PDF</SelectItem>
              <SelectItem value="HTML">HTML</SelectItem>
              <SelectItem value="Térmico">Térmico</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Tamanho Papel</Label>
          <Select value={formData.tamanho_papel} onValueChange={(v) => setFormData({ ...formData, tamanho_papel: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="A4">A4</SelectItem>
              <SelectItem value="A5">A5</SelectItem>
              <SelectItem value="Térmico 80mm">Térmico 80mm</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between p-3 border rounded">
          <Label className="text-xs">QR Code</Label>
          <Switch
            checked={formData.incluir_qrcode}
            onCheckedChange={(v) => setFormData({ ...formData, incluir_qrcode: v })}
          />
        </div>
      </div>

      <div>
        <Label>Descrição</Label>
        <Textarea
          value={formData.descricao}
          onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
          rows={2}
        />
      </div>

      <div className="flex items-center justify-between p-3 border rounded bg-slate-50">
        <Label className="font-semibold">Modelo Ativo</Label>
        <Switch
          checked={formData.ativo}
          onCheckedChange={(v) => setFormData({ ...formData, ativo: v })}
        />
      </div>

      <Button type="submit" className="w-full bg-slate-600 hover:bg-slate-700">
        {dadosIniciais ? 'Atualizar' : 'Criar Modelo'}
      </Button>
    </form>
  );

  if (windowMode) {
    return (
      <div className="w-full h-full flex flex-col">
        <div className="flex items-center gap-3 p-4 border-b bg-gradient-to-r from-slate-50 to-slate-100">
          <FileText className="w-6 h-6 text-slate-600" />
          <h2 className="text-lg font-bold text-slate-900">
            {dadosIniciais ? 'Editar Modelo' : 'Novo Modelo de Documento'}
          </h2>
        </div>
        <div className="flex-1 overflow-auto">{content}</div>
      </div>
    );
  }

  return content;
}