import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { FileText } from 'lucide-react';
import usePermissions from '@/components/lib/usePermissions';
import { useContextoVisual } from '@/components/lib/useContextoVisual';

export default function PlanoContasForm({ conta, item, data, onSubmit, onSave, onClose, windowMode = false }) {
  const dadosIniciais = item || data || conta;
  const { canCreate, canEdit } = usePermissions();
  const { empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || dadosIniciais?.group_id || null;
  const contextoValido = Boolean(empresaAtual?.id || groupId || dadosIniciais?.empresa_id || dadosIniciais?.group_id);
  const podeCriar = canCreate("Cadastros", "PlanoDeContas") || canCreate("Financeiro", "PlanoDeContas") || canCreate("Cadastros", null);
  const podeEditar = canEdit("Cadastros", "PlanoDeContas") || canEdit("Financeiro", "PlanoDeContas") || canEdit("Cadastros", null);
  const podeSalvar = dadosIniciais?.id ? podeEditar : podeCriar;
  const [formData, setFormData] = useState(dadosIniciais || {
    codigo_conta: '',
    nome_conta: '',
    tipo_conta: 'Despesa',
    natureza: 'Devedora',
    eh_analitica: true,
    eh_sintetica: false,
    nivel_hierarquico: 1,
    aceita_lancamento_manual: true,
    usa_em_sped: false,
    usa_apenas_gerencial: false,
    ativo: true
  });

  const prevIdRef = React.useRef(dadosIniciais?.id);
  useEffect(() => {
    if (dadosIniciais?.id && dadosIniciais.id !== prevIdRef.current) {
      prevIdRef.current = dadosIniciais.id;
      setFormData({ ...dadosIniciais });
    }
  }, [dadosIniciais?.id]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (dadosIniciais?.id && !podeEditar) {
      alert("Sem permissao para editar plano de contas.");
      return;
    }
    if (!dadosIniciais?.id && !podeCriar) {
      alert("Sem permissao para criar plano de contas.");
      return;
    }
    if (!contextoValido) {
      alert("Selecione um grupo ou empresa antes de salvar.");
      return;
    }
    // Injeta 'nome'/'codigo'/'descricao' para o Visualizador Universal
    const payload = {
      ...formData,
      nome: formData.nome_conta || formData.nome || '',
      codigo: formData.codigo_conta || formData.codigo || '',
      descricao: formData.descricao || formData.nome_conta || '',
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
    <form onSubmit={handleSubmit} className="space-y-4 p-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Código da Conta *</Label>
          <Input
            value={formData.codigo_conta}
            onChange={(e) => setFormData({ ...formData, codigo_conta: e.target.value })}
            placeholder="1.1.1.01"
            required
            disabled={!podeSalvar}
            data-permission="Financeiro.PlanoDeContas.editar"
            data-action="editar-codigo-plano-contas"
            data-sensitive
          />
        </div>
        <div>
          <Label>Nome da Conta *</Label>
          <Input
            value={formData.nome_conta}
            onChange={(e) => setFormData({ ...formData, nome_conta: e.target.value })}
            placeholder="Caixa Geral"
            required
            disabled={!podeSalvar}
            data-permission="Financeiro.PlanoDeContas.editar"
            data-action="editar-nome-plano-contas"
            data-sensitive
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label>Tipo de Conta *</Label>
          <Select value={formData.tipo_conta} onValueChange={(v) => setFormData({ ...formData, tipo_conta: v })}>
            <SelectTrigger disabled={!podeSalvar} data-permission="Financeiro.PlanoDeContas.editar" data-action="selecionar-tipo-plano-contas" data-sensitive><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Receita">Receita</SelectItem>
              <SelectItem value="Despesa">Despesa</SelectItem>
              <SelectItem value="Ativo">Ativo</SelectItem>
              <SelectItem value="Passivo">Passivo</SelectItem>
              <SelectItem value="Patrimônio Líquido">Patrimônio Líquido</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Natureza</Label>
          <Select value={formData.natureza} onValueChange={(v) => setFormData({ ...formData, natureza: v })}>
            <SelectTrigger disabled={!podeSalvar} data-permission="Financeiro.PlanoDeContas.editar" data-action="selecionar-natureza-plano-contas" data-sensitive><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Devedora">Devedora</SelectItem>
              <SelectItem value="Credora">Credora</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Nível Hierárquico</Label>
          <Input type="number" value={formData.nivel_hierarquico}
            onChange={(e) => setFormData({ ...formData, nivel_hierarquico: parseInt(e.target.value) || 1 })} min="1" disabled={!podeSalvar} data-permission="Financeiro.PlanoDeContas.editar" data-action="editar-nivel-plano-contas" data-sensitive />
        </div>
      </div>

      <div>
        <Label>Descrição</Label>
        <Textarea value={formData.descricao || ''} onChange={(e) => setFormData({ ...formData, descricao: e.target.value })} rows={2} disabled={!podeSalvar} data-permission="Financeiro.PlanoDeContas.editar" data-action="editar-descricao-plano-contas" data-sensitive />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center justify-between p-3 border rounded">
          <Label>Conta Analítica</Label>
          <Switch checked={!!formData.eh_analitica} onCheckedChange={(v) => setFormData({ ...formData, eh_analitica: v })} disabled={!podeSalvar} data-permission="Financeiro.PlanoDeContas.editar" data-action="alternar-conta-analitica" data-sensitive />
        </div>
        <div className="flex items-center justify-between p-3 border rounded">
          <Label>Conta Sintética</Label>
          <Switch checked={!!formData.eh_sintetica} onCheckedChange={(v) => setFormData({ ...formData, eh_sintetica: v })} disabled={!podeSalvar} data-permission="Financeiro.PlanoDeContas.editar" data-action="alternar-conta-sintetica" data-sensitive />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="flex items-center justify-between p-3 border rounded">
          <Label>Lançamento Manual</Label>
          <Switch checked={!!formData.aceita_lancamento_manual} onCheckedChange={(v) => setFormData({ ...formData, aceita_lancamento_manual: v })} disabled={!podeSalvar} data-permission="Financeiro.PlanoDeContas.editar" data-action="alternar-lancamento-manual-plano-contas" data-sensitive />
        </div>
        <div className="flex items-center justify-between p-3 border rounded">
          <Label>Usa em SPED</Label>
          <Switch checked={!!formData.usa_em_sped} onCheckedChange={(v) => setFormData({ ...formData, usa_em_sped: v })} disabled={!podeSalvar} data-permission="Financeiro.PlanoDeContas.editar" data-action="alternar-sped-plano-contas" data-sensitive />
        </div>
        <div className="flex items-center justify-between p-3 border rounded">
          <Label>Apenas Gerencial</Label>
          <Switch checked={!!formData.usa_apenas_gerencial} onCheckedChange={(v) => setFormData({ ...formData, usa_apenas_gerencial: v })} disabled={!podeSalvar} data-permission="Financeiro.PlanoDeContas.editar" data-action="alternar-gerencial-plano-contas" data-sensitive />
        </div>
      </div>

      <div className="flex items-center justify-between p-3 border rounded bg-slate-50">
        <Label className="font-semibold">Conta Ativa</Label>
        <Switch checked={!!formData.ativo} onCheckedChange={(v) => setFormData({ ...formData, ativo: v })} disabled={!podeSalvar} data-permission="Financeiro.PlanoDeContas.alterarStatus" data-action="alternar-status-plano-contas" data-sensitive />
      </div>

      <Button
        type="submit"
        className="w-full bg-green-600 hover:bg-green-700"
        disabled={!contextoValido || !podeSalvar}
        data-permission="Cadastros.PlanoDeContas.salvar"
        data-action="salvar-plano-contas"
        data-sensitive
      >
        {dadosIniciais ? 'Atualizar Conta' : 'Criar Conta'}
      </Button>
    </form>
  );

  if (windowMode) {
    return (
      <div className="w-full h-full flex flex-col">
        <div className="flex items-center gap-3 p-4 border-b bg-gradient-to-r from-green-50 to-green-100">
          <FileText className="w-6 h-6 text-green-600" />
          <h2 className="text-lg font-bold text-slate-900">{dadosIniciais ? 'Editar Conta Contábil' : 'Nova Conta Contábil'}</h2>
        </div>
        <div className="flex-1 overflow-auto">{content}</div>
      </div>
    );
  }
  return content;
}
