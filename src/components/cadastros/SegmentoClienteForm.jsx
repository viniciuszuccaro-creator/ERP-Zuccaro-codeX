import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Users } from 'lucide-react';
import usePermissions from '@/components/lib/usePermissions';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import CadastroCodigoRegistroField from '@/components/cadastros/CadastroCodigoRegistroField';
import useCadastroReopenOnIdentity from '@/components/cadastros/useCadastroReopenOnIdentity';

const sanitizeText = (value, max = 500) => String(value ?? '').replace(/[<>]/g, '').slice(0, max).trim();

const EMPTY_SEGMENTO = {
  nome_segmento: '',
  codigo: '',
  tipo_segmento: 'Comercial',
  descricao: '',
  ativo: true,
  empresa_id: '',
  group_id: '',
};

const mapSegmentoClienteToForm = (record, defaults = {}) => {
  if (!record) {
    return {
      ...EMPTY_SEGMENTO,
      empresa_id: defaults.empresa_id || '',
      group_id: defaults.group_id || '',
    };
  }
  return {
    ...EMPTY_SEGMENTO,
    ...record,
    nome_segmento: record.nome_segmento || record.nome || '',
    descricao: record.descricao == null ? '' : String(record.descricao),
    ativo: record.ativo !== false,
  };
};

/**
 * Reopen canônico (#353): useCadastroReopenOnIdentity — updated_at|updated_date,
 * preservação de nome/tipo/descrição, código/ID no boundId.
 */
export default function SegmentoClienteForm({
  segmento, segmentoCliente, item, data, initialData, defaultValues,
  onSubmit, onSave, onClose, windowMode = false,
}) {
  const dadosIniciais = item || data || initialData || defaultValues || segmentoCliente || segmento;
  const { canCreate, canEdit } = usePermissions();
  const { empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || dadosIniciais?.group_id || null;
  const contextoValido = Boolean(empresaAtual?.id || groupId || dadosIniciais?.empresa_id || dadosIniciais?.group_id);
  const emptyForm = mapSegmentoClienteToForm(null, {
    empresa_id: empresaAtual?.id || '',
    group_id: groupId || '',
  });
  const [formData, setFormData] = useState(() => mapSegmentoClienteToForm(dadosIniciais, emptyForm));

  const { boundId: segmentoBoundId } = useCadastroReopenOnIdentity(dadosIniciais, {
    formData,
    setFormData,
    emptyForm,
    mapToForm: (record) => mapSegmentoClienteToForm(record, emptyForm),
  });

  const podeCriar = canCreate('Cadastros', 'SegmentoCliente') || canCreate('Comercial', 'SegmentoCliente') || canCreate('Cadastros', null);
  const podeEditar = canEdit('Cadastros', 'SegmentoCliente') || canEdit('Comercial', 'SegmentoCliente') || canEdit('Cadastros', null);
  const podeSalvar = segmentoBoundId ? podeEditar : podeCriar;

  const buildPayload = () => ({
    ...formData,
    ...(segmentoBoundId ? { id: segmentoBoundId } : {}),
    nome_segmento: sanitizeText(formData.nome_segmento, 180),
    nome: sanitizeText(formData.nome_segmento, 180),
    tipo_segmento: sanitizeText(formData.tipo_segmento, 80),
    descricao: sanitizeText(formData.descricao, 1000),
    group_id: groupId || formData.group_id,
    empresa_id: contexto === 'empresa' ? empresaAtual?.id : formData.empresa_id,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!podeSalvar) {
      alert(segmentoBoundId ? 'Sem permissao para editar segmento de cliente.' : 'Sem permissao para criar segmento de cliente.');
      return;
    }
    if (!contextoValido) {
      alert('Selecione um grupo ou empresa antes de salvar.');
      return;
    }

    const payload = buildPayload();
    if (!payload.nome_segmento) {
      alert('Nome do segmento e obrigatorio.');
      return;
    }

    if (onSubmit) {
      onSubmit(payload);
    } else {
      if (onSave) onSave(payload);
      if (onClose) onClose();
    }
  };

  const content = (
    <form onSubmit={handleSubmit} className="space-y-4 p-4">
      <CadastroCodigoRegistroField
        hasId={Boolean(segmentoBoundId)}
        entityId={segmentoBoundId}
        value={formData.codigo}
        action="codigo-registro-segmento-cliente"
      />

      <div>
        <Label>Nome do Segmento *</Label>
        <Input
          value={formData.nome_segmento}
          onChange={(e) => setFormData({ ...formData, nome_segmento: e.target.value })}
          placeholder="Metalurgicas, Construtoras, Varejo..."
          required
          disabled={!podeSalvar}
          data-permission="Cadastros.SegmentoCliente.editar"
          data-action="Cadastros.SegmentoCliente.nome_segmento"
          data-sensitive
        />
      </div>

      <div>
        <Label>Tipo de Segmento</Label>
        <Select value={formData.tipo_segmento} onValueChange={(v) => setFormData({ ...formData, tipo_segmento: v })} disabled={!podeSalvar}>
          <SelectTrigger data-permission="Cadastros.SegmentoCliente.editar" data-action="Cadastros.SegmentoCliente.tipo_segmento" data-sensitive>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Industrial">Industrial</SelectItem>
            <SelectItem value="Comercial">Comercial</SelectItem>
            <SelectItem value="Construcao Civil">Construcao Civil</SelectItem>
            <SelectItem value="Consumidor Final">Consumidor Final</SelectItem>
            <SelectItem value="Governo">Governo</SelectItem>
            <SelectItem value="Outro">Outro</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Descricao</Label>
        <Textarea
          value={formData.descricao || ''}
          onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
          rows={3}
          disabled={!podeSalvar}
          data-permission="Cadastros.SegmentoCliente.editar"
          data-action="Cadastros.SegmentoCliente.descricao"
          data-sensitive
        />
      </div>

      <div className="flex items-center justify-between p-3 border border-sky-100 rounded bg-sky-50/50">
        <Label className="font-semibold">Segmento Ativo</Label>
        <Switch
          checked={formData.ativo}
          onCheckedChange={(v) => setFormData({ ...formData, ativo: v })}
          disabled={!podeSalvar}
          data-permission="Cadastros.SegmentoCliente.alterarStatus"
          data-action="Cadastros.SegmentoCliente.ativo"
          data-sensitive
        />
      </div>

      <Button
        type="submit"
        className="w-full bg-sky-600 hover:bg-sky-700"
        disabled={!podeSalvar || !contextoValido}
        data-permission="Cadastros.SegmentoCliente.salvar"
        data-action="Cadastros.SegmentoCliente.salvar"
        data-sensitive
      >
        {segmentoBoundId ? 'Atualizar Segmento' : 'Criar Segmento'}
      </Button>
    </form>
  );

  if (windowMode) {
    return (
      <div className="w-full h-full flex flex-col bg-sky-50/40">
        <div className="flex items-center gap-3 p-4 border-b border-sky-200 bg-sky-100/80">
          <Users className="w-6 h-6 text-sky-600" />
          <h2 className="text-lg font-bold text-sky-950">
            {segmentoBoundId ? 'Editar Segmento' : 'Novo Segmento de Cliente'}
          </h2>
        </div>
        <div className="flex-1 overflow-auto">{content}</div>
      </div>
    );
  }

  return content;
}
