import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Globe } from 'lucide-react';
import usePermissions from '@/components/lib/usePermissions';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import CadastroCodigoRegistroField from '@/components/cadastros/CadastroCodigoRegistroField';
import useCadastroReopenOnIdentity from '@/components/cadastros/useCadastroReopenOnIdentity';
import { syncFlagsCatalogoProduto } from '@/components/lib/siteOrigemPolicy';

const EMPTY_CATALOGO = {
  nome_catalogo: '',
  codigo: '',
  descricao: '',
  produto_id: '',
  exibir_site: true,
  exibir_marketplace: false,
  ordem_exibicao: 1,
  ativo: true,
  empresa_id: '',
  group_id: '',
};

const mapCatalogoWebToForm = (record, defaults = {}) => {
  if (!record) {
    return {
      ...EMPTY_CATALOGO,
      empresa_id: defaults.empresa_id || '',
      group_id: defaults.group_id || '',
    };
  }
  const flagged = syncFlagsCatalogoProduto(record);
  return {
    ...EMPTY_CATALOGO,
    ...flagged,
    nome_catalogo: record.nome_catalogo || record.nome || '',
    codigo: record.codigo == null ? '' : String(record.codigo),
    descricao: record.descricao == null ? '' : String(record.descricao),
    produto_id: record.produto_id == null ? '' : String(record.produto_id),
    ordem_exibicao: Number.isFinite(Number(record.ordem_exibicao)) ? Number(record.ordem_exibicao) : 1,
    ativo: record.ativo !== false,
    exibir_site: Boolean(flagged.exibir_site),
    exibir_marketplace: Boolean(flagged.exibir_marketplace),
  };
};

/**
 * Reopen canônico (#353): useCadastroReopenOnIdentity — updated_at|updated_date,
 * preservação flags site/marketplace via syncFlagsCatalogoProduto; boundId.
 */
export default function CatalogoWebForm({
  catalogo, catalogoWeb, item, data, initialData, defaultValues, onSubmit, windowMode = false,
}) {
  const dadosIniciais = item || data || initialData || defaultValues || catalogoWeb || catalogo;
  const { hasPermission } = usePermissions();
  const { empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || dadosIniciais?.group_id || null;
  const contextoValido = Boolean(empresaAtual?.id || groupId || dadosIniciais?.empresa_id || dadosIniciais?.group_id);
  const emptyForm = mapCatalogoWebToForm(null, {
    empresa_id: empresaAtual?.id || '',
    group_id: groupId || '',
  });
  const [formData, setFormData] = useState(() => mapCatalogoWebToForm(dadosIniciais, emptyForm));

  const { boundId: catalogoBoundId } = useCadastroReopenOnIdentity(dadosIniciais, {
    formData,
    setFormData,
    emptyForm,
    mapToForm: (record) => mapCatalogoWebToForm(record, emptyForm),
  });

  const podeCriar = hasPermission?.('Cadastros.CatalogoWeb.criar') || hasPermission?.('Cadastros.Produto.criar');
  const podeEditar = hasPermission?.('Cadastros.CatalogoWeb.editar') || hasPermission?.('Cadastros.Produto.editar');
  const podeSalvar = catalogoBoundId ? podeEditar : podeCriar;

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
    const empresaId = empresaAtual?.id || formData.empresa_id || dadosIniciais?.empresa_id;
    if (!empresaId) {
      alert('Empresa obrigatoria para catalogo do site.');
      return;
    }
    onSubmit({
      ...syncFlagsCatalogoProduto(formData),
      ...(catalogoBoundId ? { id: catalogoBoundId } : {}),
      group_id: groupId || formData.group_id,
      empresa_id: empresaId,
      nome: formData.nome_catalogo || formData.nome || '',
    });
  };

  const content = (
    <form onSubmit={handleSubmit} className="space-y-4 p-4">
      <CadastroCodigoRegistroField
        hasId={Boolean(catalogoBoundId)}
        entityId={catalogoBoundId}
        value={formData.codigo}
        action="codigo-registro-catalogo-web"
      />

      <div>
        <Label>Nome do Catálogo *</Label>
        <Input
          value={formData.nome_catalogo}
          onChange={(e) => setFormData({ ...formData, nome_catalogo: e.target.value })}
          required
          disabled={!podeSalvar}
          data-permission="Cadastros.CatalogoWeb.editar"
          data-action="editar-nome-catalogo-web"
        />
      </div>

      <div>
        <Label>Descrição</Label>
        <Textarea
          value={formData.descricao}
          onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
          rows={3}
          disabled={!podeSalvar}
          data-permission="Cadastros.CatalogoWeb.editar"
          data-action="editar-descricao-catalogo-web"
        />
      </div>

      <div>
        <Label>ID do Produto</Label>
        <Input
          value={formData.produto_id}
          onChange={(e) => setFormData({ ...formData, produto_id: e.target.value })}
          placeholder="ID do produto associado"
          disabled={!podeSalvar}
          data-permission="Cadastros.CatalogoWeb.editar"
          data-action="editar-produto-catalogo-web"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center justify-between p-3 border border-sky-100 rounded bg-sky-50/50">
          <Label>Exibir no Site</Label>
          <Switch
            checked={formData.exibir_site}
            disabled={!podeSalvar}
            data-permission="Cadastros.CatalogoWeb.editar"
            data-action="alternar-exibir-site-catalogo-web"
            data-sensitive="true"
            onCheckedChange={(v) => setFormData(syncFlagsCatalogoProduto({ ...formData, exibir_site: v, exibir_no_site: v }))}
          />
        </div>
        <div className="flex items-center justify-between p-3 border border-sky-100 rounded bg-sky-50/50">
          <Label>Exibir no Marketplace</Label>
          <Switch
            checked={formData.exibir_marketplace}
            disabled={!podeSalvar}
            data-permission="Cadastros.CatalogoWeb.editar"
            data-action="alternar-exibir-marketplace-catalogo-web"
            data-sensitive="true"
            onCheckedChange={(v) => setFormData(syncFlagsCatalogoProduto({ ...formData, exibir_marketplace: v, exibir_no_marketplace: v }))}
          />
        </div>
      </div>

      <div>
        <Label>Ordem de Exibição</Label>
        <Input
          type="number"
          value={formData.ordem_exibicao}
          onChange={(e) => setFormData({ ...formData, ordem_exibicao: parseInt(e.target.value, 10) || 0 })}
          disabled={!podeSalvar}
          data-permission="Cadastros.CatalogoWeb.editar"
          data-action="editar-ordem-catalogo-web"
        />
      </div>

      <div className="flex items-center justify-between p-3 border border-sky-100 rounded bg-sky-50/50">
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
        className="w-full bg-sky-600 hover:bg-sky-700"
        disabled={!contextoValido || !podeSalvar}
        data-permission="Cadastros.CatalogoWeb.salvar"
        data-action="salvar-catalogo-web"
        data-sensitive="true"
      >
        {catalogoBoundId ? 'Atualizar' : 'Criar Catálogo Web'}
      </Button>
    </form>
  );

  if (windowMode) {
    return (
      <div className="w-full h-full flex flex-col">
        <div className="flex items-center gap-3 p-4 border-b bg-gradient-to-r from-sky-50 to-sky-100">
          <Globe className="w-6 h-6 text-sky-600" />
          <h2 className="text-lg font-bold text-slate-900">
            {catalogoBoundId ? 'Editar Catálogo' : 'Novo Catálogo Web'}
          </h2>
        </div>
        <div className="flex-1 overflow-auto">{content}</div>
      </div>
    );
  }

  return content;
}
