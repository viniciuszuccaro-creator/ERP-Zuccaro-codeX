import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Globe } from 'lucide-react';
import usePermissions from "@/components/lib/usePermissions";
import { useContextoVisual } from "@/components/lib/useContextoVisual";

export default function CatalogoWebForm({ catalogo, catalogoWeb, onSubmit, windowMode = false }) {
  const dadosIniciais = catalogoWeb || catalogo;
  const { hasPermission } = usePermissions();
  const { empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || dadosIniciais?.group_id || null;
  const contextoValido = Boolean(empresaAtual?.id || groupId || dadosIniciais?.empresa_id || dadosIniciais?.group_id);
  const podeCriar = hasPermission?.("Cadastros.CatalogoWeb.criar") || hasPermission?.("Cadastros.Produto.criar");
  const podeEditar = hasPermission?.("Cadastros.CatalogoWeb.editar") || hasPermission?.("Cadastros.Produto.editar");
  const podeSalvar = dadosIniciais?.id ? podeEditar : podeCriar;
  const [formData, setFormData] = useState(dadosIniciais || {
    nome_catalogo: '',
    descricao: '',
    produto_id: '',
    exibir_site: true,
    exibir_marketplace: false,
    ordem_exibicao: 1,
    ativo: true
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!contextoValido) {
      alert('Selecione um grupo ou empresa antes de salvar.');
      return;
    }
    if (!podeSalvar) {
      alert('Sem permissão para salvar catálogo web.');
      return;
    }
    onSubmit({
      ...formData,
      group_id: groupId || formData.group_id,
      empresa_id: contexto === "empresa" ? empresaAtual?.id : formData.empresa_id,
      nome: formData.nome_catalogo || formData.nome || ''
    });
  };

  const content = (
    <form onSubmit={handleSubmit} className="space-y-4 p-4">
      <div>
        <Label>Nome do Catálogo *</Label>
        <Input
          value={formData.nome_catalogo}
          onChange={(e) => setFormData({ ...formData, nome_catalogo: e.target.value })}
          required
          data-action="editar-nome-catalogo-web"
        />
      </div>

      <div>
        <Label>Descrição</Label>
        <Textarea
          value={formData.descricao}
          onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
          rows={3}
          data-action="editar-descricao-catalogo-web"
        />
      </div>

      <div>
        <Label>ID do Produto</Label>
        <Input
          value={formData.produto_id}
          onChange={(e) => setFormData({ ...formData, produto_id: e.target.value })}
          placeholder="ID do produto associado"
          data-action="editar-produto-catalogo-web"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center justify-between p-3 border rounded">
          <Label>Exibir no Site</Label>
          <Switch
            checked={formData.exibir_site}
            disabled={!podeSalvar}
            data-permission="Cadastros.CatalogoWeb.editar"
            data-action="alternar-exibir-site-catalogo-web"
            data-sensitive="true"
            onCheckedChange={(v) => setFormData({ ...formData, exibir_site: v })}
          />
        </div>
        <div className="flex items-center justify-between p-3 border rounded">
          <Label>Exibir no Marketplace</Label>
          <Switch
            checked={formData.exibir_marketplace}
            disabled={!podeSalvar}
            data-permission="Cadastros.CatalogoWeb.editar"
            data-action="alternar-exibir-marketplace-catalogo-web"
            data-sensitive="true"
            onCheckedChange={(v) => setFormData({ ...formData, exibir_marketplace: v })}
          />
        </div>
      </div>

      <div>
        <Label>Ordem de Exibição</Label>
        <Input
          type="number"
          value={formData.ordem_exibicao}
          onChange={(e) => setFormData({ ...formData, ordem_exibicao: parseInt(e.target.value) })}
          data-action="editar-ordem-catalogo-web"
        />
      </div>

      <div className="flex items-center justify-between p-3 border rounded bg-slate-50">
        <Label className="font-semibold">Catálogo Ativo</Label>
        <Switch
          checked={formData.ativo}
          disabled={!podeSalvar}
          data-permission="Cadastros.CatalogoWeb.alterarStatus"
          data-action="alternar-status-catalogo-web"
          data-sensitive="true"
          onCheckedChange={(v) => setFormData({ ...formData, ativo: v })}
        />
      </div>

      <Button
        type="submit"
        className="w-full bg-blue-600 hover:bg-blue-700"
        disabled={!contextoValido || !podeSalvar}
        data-permission="Cadastros.CatalogoWeb.salvar"
        data-action="salvar-catalogo-web"
        data-sensitive="true"
      >
        {dadosIniciais ? 'Atualizar' : 'Criar Catálogo Web'}
      </Button>
    </form>
  );

  if (windowMode) {
    return (
      <div className="w-full h-full flex flex-col">
        <div className="flex items-center gap-3 p-4 border-b bg-gradient-to-r from-blue-50 to-blue-100">
          <Globe className="w-6 h-6 text-blue-600" />
          <h2 className="text-lg font-bold text-slate-900">
            {dadosIniciais ? 'Editar Catálogo' : 'Novo Catálogo Web'}
          </h2>
        </div>
        <div className="flex-1 overflow-auto">{content}</div>
      </div>
    );
  }

  return content;
}
