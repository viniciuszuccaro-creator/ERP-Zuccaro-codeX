import React, { useRef } from 'react';
import useCadastroRecordState from './useCadastroRecordState';
import useCadastroFormScopeGuard from './hooks/useCadastroFormScopeGuard';
import usePermissions from '@/components/lib/usePermissions';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import { assertCadastroRecordInTenant, hasCadastroEntityPermission } from './cadastroEditLoadPolicy';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { FileText } from 'lucide-react';

export default function ModeloDocumentoForm({ modelo, modeloDocumento, onSubmit, windowMode = false }) {
  const dadosIniciais = modeloDocumento || modelo;
  const permissions = usePermissions();
  const { grupoAtual, empresaAtual, contexto } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const scope = useCadastroFormScopeGuard(groupId, empresaAtual?.id || null);
  const podeSalvar = !permissions.isLoading && hasCadastroEntityPermission('ModeloDocumento', dadosIniciais?.id ? 'editar' : 'criar', permissions);
  const identity = JSON.stringify([dadosIniciais?.id ?? null, dadosIniciais?.updated_at ?? dadosIniciais?.updated_date ?? null, groupId, empresaAtual?.id ?? null, contexto]);
  const current = useRef(null);
  current.current = { identity, podeSalvar };
  const [formData, setFormData] = useCadastroRecordState(dadosIniciais || {
    nome_modelo: '',
    tipo_documento: 'Romaneio',
    descricao: '',
    formato_saida: 'PDF',
    tamanho_papel: 'A4',
    incluir_logo_empresa: true,
    incluir_qrcode: true,
    ativo: true
  }, identity);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!current.current.podeSalvar || current.current.identity !== identity || !scope.isCurrent()) {
      toast.error('Contexto ou permissao indisponiveis. Reabra o modelo antes de salvar.');
      return;
    }
    try {
      assertCadastroRecordInTenant('ModeloDocumento', dadosIniciais, { groupId, empresaId: empresaAtual?.id || null, scopeType: empresaAtual?.id ? 'empresa' : 'grupo' });
    } catch {
      toast.error('Modelo fora do contexto ativo.');
      return;
    }
    onSubmit({ ...formData, nome: formData.nome_modelo || formData.nome || '' });
  };

  const content = (
    <form onSubmit={handleSubmit} className="space-y-4 p-4">
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
