import React, { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2, Package, Trash2, Power, PowerOff } from "lucide-react";
import usePermissions from "@/components/lib/usePermissions";
import { useContextoVisual } from "@/components/lib/useContextoVisual";

/**
 * V21.1.2 - WINDOW MODE READY
 */
export default function GrupoProdutoForm({ grupo, grupoProduto, item, data, initialData, defaultValues, onSubmit, isSubmitting, windowMode = false, closeSelf }) {
  const dadosIniciais = item || data || initialData || defaultValues || grupoProduto || grupo;
  const { hasPermission } = usePermissions();
  const { empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || dadosIniciais?.group_id || null;
  const contextoValido = Boolean(empresaAtual?.id || groupId || dadosIniciais?.empresa_id || dadosIniciais?.group_id);
  const podeCriar = hasPermission?.("Cadastros.GrupoProduto.criar") || hasPermission?.("Cadastros.Produto.criar");
  const podeEditar = hasPermission?.("Cadastros.GrupoProduto.editar") || hasPermission?.("Cadastros.Produto.editar");
  const podeExcluir = hasPermission?.("Cadastros.GrupoProduto.excluir") || hasPermission?.("Cadastros.Produto.excluir");
  const podeSalvar = dadosIniciais?.id ? podeEditar : podeCriar;
  const [formData, setFormData] = useState(dadosIniciais || {
    nome_grupo: '',
    codigo: '',
    natureza: 'Revenda',
    ncm_padrao: '',
    margem_sugerida: 0,
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
    if (!formData.nome_grupo || !formData.natureza) {
      alert('Preencha os campos obrigatórios');
      return;
    }
    if (!contextoValido) {
      alert('Selecione um grupo ou empresa antes de salvar.');
      return;
    }
    if (!podeSalvar) {
      alert('Sem permissão para salvar grupo de produto.');
      return;
    }
    onSubmit({
      ...formData,
      group_id: groupId || formData.group_id,
      empresa_id: contexto === "empresa" ? empresaAtual?.id : formData.empresa_id,
      nome: formData.nome_grupo
    });
    if (typeof closeSelf === 'function') closeSelf();
  };

  const handleExcluir = () => {
    if (!podeExcluir) {
      alert('Sem permissão para excluir grupo de produto.');
      return;
    }
    if (!window.confirm(`Tem certeza que deseja excluir o grupo "${formData.nome_grupo}"? Esta ação não pode ser desfeita.`)) {
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Nome do Grupo *</Label>
        <Input
          value={formData.nome_grupo}
          onChange={(e) => setFormData({...formData, nome_grupo: e.target.value})}
          placeholder="Ex: Ferragens, Bitolas, Materiais Elétricos"
          data-action="editar-nome-grupo-produto"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Código</Label>
          <Input
            value={formData.codigo}
            onChange={(e) => setFormData({...formData, codigo: e.target.value})}
            placeholder="Ex: FERR001"
            data-action="editar-codigo-grupo-produto"
          />
        </div>
        <div>
          <Label>Natureza *</Label>
          <Select value={formData.natureza} onValueChange={(v) => setFormData({...formData, natureza: v})}>
            <SelectTrigger data-action="selecionar-natureza-grupo-produto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Revenda">Revenda</SelectItem>
              <SelectItem value="Produção">Produção</SelectItem>
              <SelectItem value="Consumo">Consumo</SelectItem>
              <SelectItem value="Serviço">Serviço</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>NCM Padrão</Label>
          <Input
            value={formData.ncm_padrao}
            onChange={(e) => setFormData({...formData, ncm_padrao: e.target.value})}
            placeholder="Ex: 7213.10.00"
            data-action="editar-ncm-padrao-grupo-produto"
          />
        </div>
        <div>
          <Label>Margem Sugerida (%)</Label>
          <Input
            type="number"
            step="0.01"
            value={formData.margem_sugerida}
            onChange={(e) => setFormData({...formData, margem_sugerida: parseFloat(e.target.value)})}
            data-action="editar-margem-grupo-produto"
          />
        </div>
      </div>

      <div className="flex items-center justify-between p-3 bg-slate-50 rounded">
        <Label>Grupo Ativo</Label>
        <Switch
          checked={formData.ativo}
          onCheckedChange={(v) => setFormData({...formData, ativo: v})}
          disabled={!podeSalvar}
          data-permission="Cadastros.GrupoProduto.alterarStatus"
          data-action="alternar-status-grupo-produto"
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
              data-permission="Cadastros.GrupoProduto.alterarStatus"
              data-action={formData.ativo ? "inativar-grupo-produto" : "ativar-grupo-produto"}
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
              data-permission="Cadastros.GrupoProduto.excluir"
              data-action="excluir-grupo-produto"
              data-sensitive="true"
            >
              <Trash2 className="w-4 h-4 mr-2" />Excluir
            </Button>
          </>
        )}
        <Button
          type="submit"
          disabled={isSubmitting || !contextoValido || !podeSalvar}
          data-permission="Cadastros.GrupoProduto.salvar"
          data-action="salvar-grupo-produto"
          data-sensitive="true"
        >
          {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {dadosIniciais ? 'Atualizar' : 'Criar Grupo'}
        </Button>
      </div>
    </form>
  );

  if (windowMode) {
    return (
      <div className="w-full h-full overflow-auto bg-white p-6">
        <div className="mb-4 pb-4 border-b">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" />
            {dadosIniciais ? 'Editar Grupo de Produto' : 'Novo Grupo de Produto'}
          </h2>
        </div>
        {formContent}
      </div>
    );
  }

  return formContent;
}
