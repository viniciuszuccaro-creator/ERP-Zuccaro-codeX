import React, { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Factory, Trash2, Power, PowerOff } from "lucide-react";
import usePermissions from "@/components/lib/usePermissions";
import { useContextoVisual } from "@/components/lib/useContextoVisual";

/**
 * V21.1.2 - WINDOW MODE READY
 */
export default function SetorAtividadeForm({ setor, setorAtividade, item, data, initialData, defaultValues, onSubmit, isSubmitting, windowMode = false, closeSelf }) {
  const dadosIniciais = item || data || initialData || defaultValues || setorAtividade || setor;
  const { hasPermission } = usePermissions();
  const { empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || dadosIniciais?.group_id || null;
  const contextoValido = Boolean(empresaAtual?.id || groupId || dadosIniciais?.empresa_id || dadosIniciais?.group_id);
  const podeCriar = hasPermission?.("Cadastros.SetorAtividade.criar") || hasPermission?.("Cadastros.Produto.criar");
  const podeEditar = hasPermission?.("Cadastros.SetorAtividade.editar") || hasPermission?.("Cadastros.Produto.editar");
  const podeExcluir = hasPermission?.("Cadastros.SetorAtividade.excluir") || hasPermission?.("Cadastros.Produto.excluir");
  const podeSalvar = dadosIniciais?.id ? podeEditar : podeCriar;
  const [formData, setFormData] = useState(dadosIniciais || {
    nome: '',
    descricao: '',
    tipo_operacao: 'Revenda',
    icone: '',
    cor: '#3B82F6',
    ativo: true
  });

  const prevIdRef = useRef(dadosIniciais?.id);
  useEffect(() => {
    if (dadosIniciais?.id && dadosIniciais.id !== prevIdRef.current) {
      prevIdRef.current = dadosIniciais.id;
      setFormData({ ...dadosIniciais });
    }
  }, [dadosIniciais?.id]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!contextoValido) {
      alert('Selecione um grupo ou empresa antes de salvar.');
      return;
    }
    if (!podeSalvar) {
      alert('Sem permissão para salvar setor de atividade.');
      return;
    }
    onSubmit({
      ...formData,
      group_id: groupId || formData.group_id,
      empresa_id: contexto === "empresa" ? empresaAtual?.id : formData.empresa_id
    });
    if (typeof closeSelf === 'function') closeSelf();
  };

  const handleExcluir = () => {
    if (!podeExcluir) {
      alert('Sem permissão para excluir setor de atividade.');
      return;
    }
    if (!window.confirm(`Tem certeza que deseja excluir o setor "${formData.nome}"? Esta ação não pode ser desfeita.`)) {
      return;
    }
    if (onSubmit) {
      onSubmit({ ...formData, _action: 'delete' });
    if (typeof closeSelf === 'function') closeSelf();
    }
  };

  const handleAlternarStatus = () => {
    const novoStatus = !formData.ativo;
    setFormData({ ...formData, ativo: novoStatus });
  };

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <Label>Nome do Setor *</Label>
        <Input
          value={formData.nome}
          onChange={(e) => setFormData({...formData, nome: e.target.value})}
          placeholder="Ex: Revenda, Almoxarifado, Fábrica"
          required
          data-action="editar-nome-setor-atividade"
        />
      </div>

      <div>
        <Label>Descrição</Label>
        <Textarea
          value={formData.descricao}
          onChange={(e) => setFormData({...formData, descricao: e.target.value})}
          placeholder="Detalhes sobre este setor de atividade"
          data-action="editar-descricao-setor-atividade"
        />
      </div>

      <div>
        <Label>Tipo de Operação</Label>
        <Select value={formData.tipo_operacao} onValueChange={(v) => setFormData({...formData, tipo_operacao: v})}>
          <SelectTrigger data-action="selecionar-tipo-operacao-setor-atividade">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Revenda">Revenda</SelectItem>
            <SelectItem value="Produção">Produção</SelectItem>
            <SelectItem value="Serviço">Serviço</SelectItem>
            <SelectItem value="Consumo Interno">Consumo Interno</SelectItem>
            <SelectItem value="Logística">Logística</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Ícone (Emoji)</Label>
          <Input
            value={formData.icone}
            onChange={(e) => setFormData({...formData, icone: e.target.value})}
            placeholder="📦"
            data-action="editar-icone-setor-atividade"
          />
        </div>

        <div>
          <Label>Cor</Label>
          <Input
            type="color"
            value={formData.cor}
            onChange={(e) => setFormData({...formData, cor: e.target.value})}
            data-action="editar-cor-setor-atividade"
          />
        </div>
      </div>

      <div className="flex items-center justify-between p-4 bg-slate-50 rounded">
        <Label>Setor Ativo</Label>
        <Switch
          checked={formData.ativo}
          onCheckedChange={(v) => setFormData({...formData, ativo: v})}
          disabled={!podeSalvar}
          data-permission="Cadastros.SetorAtividade.alterarStatus"
          data-action="alternar-status-setor-atividade"
          data-sensitive="true"
        />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        {dadosIniciais && (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={handleAlternarStatus}
              disabled={!podeSalvar}
              data-permission="Cadastros.SetorAtividade.alterarStatus"
              data-action={formData.ativo ? "inativar-setor-atividade" : "ativar-setor-atividade"}
              data-sensitive="true"
              className={formData.ativo ? 'border-orange-300 text-orange-700' : 'border-green-300 text-green-700'}
            >
              {formData.ativo ? (
                <><PowerOff className="w-4 h-4 mr-2" />Inativar</>
              ) : (
                <><Power className="w-4 h-4 mr-2" />Ativar</>
              )}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleExcluir}
              disabled={!podeExcluir}
              data-permission="Cadastros.SetorAtividade.excluir"
              data-action="excluir-setor-atividade"
              data-sensitive="true"
            >
              <Trash2 className="w-4 h-4 mr-2" />Excluir
            </Button>
          </>
        )}
        <Button
          type="submit"
          disabled={isSubmitting || !contextoValido || !podeSalvar}
          data-permission="Cadastros.SetorAtividade.salvar"
          data-action="salvar-setor-atividade"
          data-sensitive="true"
        >
          {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {setor ? 'Atualizar' : 'Criar'} Setor
        </Button>
      </div>
    </form>
  );

  if (windowMode) {
    return (
      <div className="w-full h-full overflow-auto bg-white p-6">
        <div className="mb-4 pb-4 border-b">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Factory className="w-5 h-5 text-blue-600" />
            {setor ? 'Editar Setor de Atividade' : 'Novo Setor de Atividade'}
          </h2>
        </div>
        {formContent}
      </div>
    );
  }

  return formContent;
}
