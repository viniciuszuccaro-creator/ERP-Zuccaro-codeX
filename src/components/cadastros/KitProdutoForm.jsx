import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Box, Plus, Trash2 } from 'lucide-react';
import usePermissions from '@/components/lib/usePermissions';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import CadastroCodigoRegistroField from '@/components/cadastros/CadastroCodigoRegistroField';
import useCadastroReopenOnIdentity from '@/components/cadastros/useCadastroReopenOnIdentity';

const EMPTY_KIT = {
  nome_kit: '',
  codigo: '',
  codigo_kit: '',
  descricao: '',
  itens_kit: [],
  preco_kit: 0,
  aplicar_desconto_kit: false,
  percentual_desconto: 0,
  ativo: true,
  empresa_id: '',
  group_id: '',
};

const mapKitProdutoToForm = (record, defaults = {}) => {
  if (!record) {
    return {
      ...EMPTY_KIT,
      empresa_id: defaults.empresa_id || '',
      group_id: defaults.group_id || '',
      itens_kit: [],
    };
  }
  const itens = Array.isArray(record.itens_kit)
    ? record.itens_kit.map((item) => ({
      produto_id: item?.produto_id == null ? '' : String(item.produto_id),
      quantidade: Number.isFinite(Number(item?.quantidade)) ? Number(item.quantidade) : 1,
    }))
    : [];
  return {
    ...EMPTY_KIT,
    ...record,
    nome_kit: record.nome_kit || record.nome || '',
    descricao: record.descricao == null ? '' : String(record.descricao),
    itens_kit: itens,
    preco_kit: Number.isFinite(Number(record.preco_kit)) ? Number(record.preco_kit) : 0,
    aplicar_desconto_kit: Boolean(record.aplicar_desconto_kit),
    percentual_desconto: Number.isFinite(Number(record.percentual_desconto))
      ? Number(record.percentual_desconto) : 0,
    ativo: record.ativo !== false,
  };
};

/**
 * Reopen canônico (#353): useCadastroReopenOnIdentity — updated_at|updated_date,
 * preservação de itens_kit aninhados, código/ID no boundId.
 */
export default function KitProdutoForm({
  kit, kitProduto, item, data, onSubmit, windowMode = false,
}) {
  const dadosIniciais = item || data || kitProduto || kit;
  const { hasPermission } = usePermissions();
  const { empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || dadosIniciais?.group_id || null;
  const contextoValido = Boolean(empresaAtual?.id || groupId || dadosIniciais?.empresa_id || dadosIniciais?.group_id);
  const emptyForm = mapKitProdutoToForm(null, {
    empresa_id: empresaAtual?.id || '',
    group_id: groupId || '',
  });
  const [formData, setFormData] = useState(() => mapKitProdutoToForm(dadosIniciais, emptyForm));

  const { boundId: kitBoundId } = useCadastroReopenOnIdentity(dadosIniciais, {
    formData,
    setFormData,
    emptyForm,
    mapToForm: (record) => mapKitProdutoToForm(record, emptyForm),
  });

  const podeCriar = hasPermission?.('Cadastros.KitProduto.criar') || hasPermission?.('Cadastros.Produto.criar');
  const podeEditar = hasPermission?.('Cadastros.KitProduto.editar') || hasPermission?.('Cadastros.Produto.editar');
  const podeSalvar = kitBoundId ? podeEditar : podeCriar;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!contextoValido) {
      alert('Selecione um grupo ou empresa antes de salvar.');
      return;
    }
    if (!podeSalvar) {
      alert('Sem permissão para salvar kit de produtos.');
      return;
    }
    onSubmit({
      ...formData,
      ...(kitBoundId ? { id: kitBoundId } : {}),
      group_id: groupId || formData.group_id,
      empresa_id: contexto === 'empresa' ? empresaAtual?.id : formData.empresa_id,
      nome: formData.nome_kit || formData.nome || '',
      itens_kit: Array.isArray(formData.itens_kit) ? formData.itens_kit : [],
    });
  };

  const adicionarItem = () => {
    setFormData({
      ...formData,
      itens_kit: [...(formData.itens_kit || []), { produto_id: '', quantidade: 1 }],
    });
  };

  const removerItem = (index) => {
    setFormData({
      ...formData,
      itens_kit: formData.itens_kit.filter((_, i) => i !== index),
    });
  };

  const content = (
    <form onSubmit={handleSubmit} className="space-y-4 p-4">
      <CadastroCodigoRegistroField
        hasId={Boolean(kitBoundId)}
        entityId={kitBoundId}
        value={formData.codigo}
        action="codigo-registro-kit-produto"
      />

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Nome do Kit *</Label>
          <Input
            value={formData.nome_kit}
            onChange={(e) => setFormData({ ...formData, nome_kit: e.target.value })}
            required
            disabled={!podeSalvar}
            data-action="editar-nome-kit-produto"
            data-permission="Cadastros.KitProduto.editar"
          />
        </div>
        <div>
          <Label>Código</Label>
          <Input
            value={formData.codigo_kit}
            onChange={(e) => setFormData({ ...formData, codigo_kit: e.target.value })}
            disabled={!podeSalvar}
            data-action="editar-codigo-kit-produto"
          />
        </div>
      </div>

      <div>
        <Label>Descrição</Label>
        <Textarea
          value={formData.descricao}
          onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
          rows={2}
          disabled={!podeSalvar}
          data-action="editar-descricao-kit-produto"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Itens do Kit</Label>
          <Button
            type="button"
            size="sm"
            onClick={adicionarItem}
            disabled={!podeSalvar}
            data-permission="Cadastros.KitProduto.editar"
            data-action="adicionar-item-kit-produto"
            data-sensitive="true"
          >
            <Plus className="w-4 h-4 mr-1" />
            Adicionar Item
          </Button>
        </div>
        <div className="space-y-2">
          {(formData.itens_kit || []).map((item, idx) => (
            <div key={idx} className="flex gap-2 items-end">
              <div className="flex-1">
                <Input
                  placeholder="ID do Produto"
                  value={item.produto_id}
                  disabled={!podeSalvar}
                  onChange={(e) => {
                    const novosItens = [...formData.itens_kit];
                    novosItens[idx] = { ...novosItens[idx], produto_id: e.target.value };
                    setFormData({ ...formData, itens_kit: novosItens });
                  }}
                  data-action="editar-produto-item-kit"
                />
              </div>
              <div className="w-24">
                <Input
                  type="number"
                  placeholder="Qtd"
                  value={item.quantidade}
                  disabled={!podeSalvar}
                  onChange={(e) => {
                    const novosItens = [...formData.itens_kit];
                    novosItens[idx] = {
                      ...novosItens[idx],
                      quantidade: parseFloat(e.target.value) || 0,
                    };
                    setFormData({ ...formData, itens_kit: novosItens });
                  }}
                  data-action="editar-quantidade-item-kit"
                />
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => removerItem(idx)}
                disabled={!podeSalvar}
                data-permission="Cadastros.KitProduto.editar"
                data-action="remover-item-kit-produto"
                data-sensitive="true"
              >
                <Trash2 className="w-4 h-4 text-red-600" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Preço do Kit (R$)</Label>
          <Input
            type="number"
            step="0.01"
            value={formData.preco_kit}
            onChange={(e) => setFormData({ ...formData, preco_kit: parseFloat(e.target.value) || 0 })}
            disabled={!podeSalvar}
            data-action="editar-preco-kit-produto"
          />
        </div>
        <div className="flex items-center justify-between p-3 border border-sky-100 rounded bg-sky-50/50">
          <Label>Aplicar Desconto</Label>
          <Switch
            checked={formData.aplicar_desconto_kit}
            disabled={!podeSalvar}
            data-permission="Cadastros.KitProduto.editar"
            data-action="alternar-desconto-kit-produto"
            data-sensitive="true"
            onCheckedChange={(v) => setFormData({ ...formData, aplicar_desconto_kit: v })}
          />
        </div>
      </div>

      {formData.aplicar_desconto_kit && (
        <div>
          <Label>Desconto (%)</Label>
          <Input
            type="number"
            step="0.01"
            value={formData.percentual_desconto}
            onChange={(e) => setFormData({ ...formData, percentual_desconto: parseFloat(e.target.value) || 0 })}
            disabled={!podeSalvar}
            data-action="editar-percentual-desconto-kit"
          />
        </div>
      )}

      <div className="flex items-center justify-between p-3 border border-sky-100 rounded bg-sky-50/50">
        <Label className="font-semibold">Kit Ativo</Label>
        <Switch
          checked={formData.ativo}
          disabled={!podeSalvar}
          data-permission="Cadastros.KitProduto.alterarStatus"
          data-action="alternar-status-kit-produto"
          data-sensitive="true"
          onCheckedChange={(v) => setFormData({ ...formData, ativo: v })}
        />
      </div>

      <Button
        type="submit"
        className="w-full bg-sky-600 hover:bg-sky-700"
        disabled={!contextoValido || !podeSalvar}
        data-permission="Cadastros.KitProduto.salvar"
        data-action="salvar-kit-produto"
        data-sensitive="true"
      >
        {kitBoundId ? 'Atualizar Kit' : 'Criar Kit de Produtos'}
      </Button>
    </form>
  );

  if (windowMode) {
    return (
      <div className="w-full h-full flex flex-col bg-white">
        <div className="flex items-center gap-3 p-4 border-b bg-gradient-to-r from-sky-50 to-sky-100">
          <Box className="w-6 h-6 text-sky-600" />
          <h2 className="text-lg font-bold text-slate-900">
            {kitBoundId ? 'Editar Kit' : 'Novo Kit de Produtos'}
          </h2>
        </div>
        <div className="flex-1 overflow-auto">{content}</div>
      </div>
    );
  }

  return content;
}
