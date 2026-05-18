import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Receipt } from 'lucide-react';
import { useQuery } from "@tanstack/react-query";
import usePermissions from '@/components/lib/usePermissions';
import { useContextoVisual } from '@/components/lib/useContextoVisual';

export default function TipoDespesaForm({ tipo, tipoDespesa, item, data, onSubmit, onSave, onClose, windowMode = false }) {
  const dadosIniciais = item || data || tipoDespesa || tipo;
  const { canCreate, canEdit } = usePermissions();
  const { empresaAtual, grupoAtual, contexto, filterInContext } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || dadosIniciais?.group_id || null;
  const contextoValido = Boolean(empresaAtual?.id || groupId || dadosIniciais?.empresa_id || dadosIniciais?.group_id);
  const contextKey = empresaAtual?.id ? `empresa-${empresaAtual.id}` : groupId ? `grupo-${groupId}` : "sem-contexto";
  const podeCriar = canCreate("Cadastros", "TipoDespesa") || canCreate("Financeiro", "TipoDespesa") || canCreate("Cadastros", null);
  const podeEditar = canEdit("Cadastros", "TipoDespesa") || canEdit("Financeiro", "TipoDespesa") || canEdit("Cadastros", null);
  const podeSalvar = dadosIniciais?.id ? podeEditar : podeCriar;
  const [formData, setFormData] = useState(dadosIniciais || {
    codigo: '', nome: '', categoria: 'Operacional',
    conta_contabil_padrao_id: '', conta_contabil_padrao_nome: '',
    centro_resultado_padrao_id: '', centro_resultado_padrao_nome: '',
    exige_aprovacao: false, limite_aprovacao_automatica: 0,
    pode_ser_recorrente: false, ativo: true
  });

  // Garante sincronização quando o mesmo componente é reutilizado (ex: abrir outro registro sem desmontar)
  const prevIdRef = React.useRef(dadosIniciais?.id);
  useEffect(() => {
    if (dadosIniciais?.id && dadosIniciais.id !== prevIdRef.current) {
      prevIdRef.current = dadosIniciais.id;
      setFormData({ ...dadosIniciais });
    }
  }, [dadosIniciais?.id]);

  const { data: contasContabeis = [] } = useQuery({
    queryKey: ['tipo-despesa-plano-contas', contextKey],
    queryFn: () => filterInContext('PlanoDeContas', {}, '-codigo_conta', 500),
    enabled: contextoValido,
    staleTime: 300000, refetchOnWindowFocus: false,
  });

  const { data: centrosResultado = [] } = useQuery({
    queryKey: ['tipo-despesa-centros-resultado', contextKey],
    queryFn: () => filterInContext('CentroResultado', {}, '-nome', 500),
    enabled: contextoValido,
    staleTime: 300000, refetchOnWindowFocus: false,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (dadosIniciais?.id && !podeEditar) {
      alert("Sem permissao para editar tipos de despesa.");
      return;
    }
    if (!dadosIniciais?.id && !podeCriar) {
      alert("Sem permissao para criar tipos de despesa.");
      return;
    }
    if (!contextoValido) {
      alert("Selecione um grupo ou empresa antes de salvar.");
      return;
    }
    const payload = {
      ...formData,
      group_id: groupId || formData.group_id,
      empresa_id: contexto === "empresa" ? empresaAtual?.id : formData.empresa_id,
    };
    if (onSubmit) {
      onSubmit(payload);
    } else {
      if (onSave) onSave();
      if (onClose) onClose();
    }
  };

  const content = (
    <form onSubmit={handleSubmit} className={windowMode ? "space-y-4 p-4 h-full overflow-auto" : "space-y-4 p-4"}>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Código</Label>
          <Input value={formData.codigo} onChange={(e) => setFormData({ ...formData, codigo: e.target.value })} placeholder="DESP001" disabled={!podeSalvar} data-permission="Financeiro.TipoDespesa.editar" data-action="editar-codigo-tipo-despesa" data-sensitive />
        </div>
        <div>
          <Label>Nome *</Label>
          <Input value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} placeholder="Energia Elétrica" required disabled={!podeSalvar} data-permission="Financeiro.TipoDespesa.editar" data-action="editar-nome-tipo-despesa" data-sensitive />
        </div>
      </div>

      <div>
        <Label>Categoria</Label>
        <Select value={formData.categoria} onValueChange={(v) => setFormData({ ...formData, categoria: v })}>
          <SelectTrigger disabled={!podeSalvar} data-permission="Financeiro.TipoDespesa.editar" data-action="selecionar-categoria-tipo-despesa" data-sensitive><SelectValue /></SelectTrigger>
          <SelectContent>
            {['Fixa','Variável','Operacional','Administrativa','Comercial','Fiscal','Investimento','Utilidades','Outros'].map(c => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Conta Contábil Padrão</Label>
        <Select value={formData.conta_contabil_padrao_id || ''} onValueChange={(v) => {
          const conta = contasContabeis.find(c => c.id === v);
          setFormData({ ...formData, conta_contabil_padrao_id: v, conta_contabil_padrao_nome: conta?.nome || '' });
        }}>
          <SelectTrigger disabled={!contextoValido || !podeSalvar} data-permission="Financeiro.TipoDespesa.editar" data-action="selecionar-conta-padrao-tipo-despesa" data-sensitive><SelectValue placeholder="Selecione a conta..." /></SelectTrigger>
          <SelectContent>
            {contasContabeis.map(c => <SelectItem key={c.id} value={c.id}>{c.codigo} - {c.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Centro de Resultado Padrão</Label>
        <Select value={formData.centro_resultado_padrao_id || ''} onValueChange={(v) => {
          const centro = centrosResultado.find(c => c.id === v);
          setFormData({ ...formData, centro_resultado_padrao_id: v, centro_resultado_padrao_nome: centro?.nome || '' });
        }}>
          <SelectTrigger disabled={!contextoValido || !podeSalvar} data-permission="Financeiro.TipoDespesa.editar" data-action="selecionar-centro-resultado-tipo-despesa" data-sensitive><SelectValue placeholder="Selecione o centro..." /></SelectTrigger>
          <SelectContent>
            {centrosResultado.map(c => <SelectItem key={c.id} value={c.id}>{c.codigo} - {c.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Observações</Label>
        <Textarea value={formData.observacoes || ''} onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })} rows={2} disabled={!podeSalvar} data-permission="Financeiro.TipoDespesa.editar" data-action="editar-observacoes-tipo-despesa" data-sensitive />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center justify-between p-3 border rounded-sm bg-slate-50">
          <Label>Exige Aprovação</Label>
          <Switch checked={!!formData.exige_aprovacao} onCheckedChange={(v) => setFormData({ ...formData, exige_aprovacao: v })} disabled={!podeSalvar} data-permission="Financeiro.TipoDespesa.aprovacao" data-action="alternar-aprovacao-tipo-despesa" data-sensitive />
        </div>
        {formData.exige_aprovacao && (
          <div>
            <Label>Limite para Aprovação Automática (R$)</Label>
            <Input type="number" step="0.01" value={formData.limite_aprovacao_automatica || 0}
              onChange={(e) => setFormData({ ...formData, limite_aprovacao_automatica: parseFloat(e.target.value) || 0 })} disabled={!podeSalvar} data-permission="Financeiro.TipoDespesa.aprovacao" data-action="editar-limite-aprovacao-tipo-despesa" data-sensitive />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between p-3 border rounded-sm bg-slate-50">
        <Label>Pode ser Recorrente</Label>
        <Switch checked={!!formData.pode_ser_recorrente} onCheckedChange={(v) => setFormData({ ...formData, pode_ser_recorrente: v })} disabled={!podeSalvar} data-permission="Financeiro.TipoDespesa.editar" data-action="alternar-recorrencia-tipo-despesa" data-sensitive />
      </div>

      <div className="flex items-center justify-between p-3 border rounded-sm bg-slate-50">
        <Label className="font-semibold">Tipo Ativo</Label>
        <Switch checked={!!formData.ativo} onCheckedChange={(v) => setFormData({ ...formData, ativo: v })} disabled={!podeSalvar} data-permission="Financeiro.TipoDespesa.alterarStatus" data-action="alternar-status-tipo-despesa" data-sensitive />
      </div>

      <Button
        type="submit"
        className="w-full bg-purple-600 hover:bg-purple-700"
        disabled={!contextoValido || !podeSalvar}
        data-permission="Cadastros.TipoDespesa.salvar"
        data-action="salvar-tipo-despesa"
        data-sensitive
      >
        {dadosIniciais ? 'Atualizar Tipo' : 'Criar Tipo de Despesa'}
      </Button>
    </form>
  );

  if (windowMode) {
    return (
      <div className="w-full h-full flex flex-col">
        <div className="flex items-center gap-3 p-4 border-b bg-gradient-to-r from-purple-50 to-purple-100">
          <Receipt className="w-6 h-6 text-purple-600" />
          <h2 className="text-lg font-bold text-slate-900">{dadosIniciais ? 'Editar Tipo de Despesa' : 'Novo Tipo de Despesa'}</h2>
        </div>
        <div className="flex-1 overflow-auto">{content}</div>
      </div>
    );
  }
  return content;
}
