import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  Plus, 
  Copy, 
  Edit2, 
  Trash2,
  Search,
  MessageSquare,
  Check,
  Tag
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import usePermissions from '@/components/lib/usePermissions';

/**
 * V21.6 - TEMPLATES DE MENSAGENS AVANÇADO
 * 
 * ✅ Criar/editar/deletar templates
 * ✅ Variáveis dinâmicas
 * ✅ Categorização
 * ✅ Preview em tempo real
 * ✅ Copiar para clipboard
 * ✅ Busca e filtros
 */
export default function TemplatesMensagens({ onSelecionarTemplate }) {
  const [busca, setBusca] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('Todas');
  const [editando, setEditando] = useState(null);
  const [novoTemplate, setNovoTemplate] = useState({ nome: '', categoria: 'Geral', conteudo: '' });
  const [exibirForm, setExibirForm] = useState(false);
  
  const queryClient = useQueryClient();
  const { empresaAtual, grupoAtual, filterInContext, createInContext, updateInContext } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const empresaId = empresaAtual?.id;
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id;
  const contextKey = empresaId || groupId || 'sem-contexto';
  const contextoValido = contextKey !== 'sem-contexto';
  const canViewTemplates = hasPermission('CRM', 'Atendimento', 'visualizar') ||
    hasPermission('Sistema', 'Integracoes', 'visualizar');
  const canEditTemplates = hasPermission('CRM', 'Atendimento', 'editar') ||
    hasPermission('Sistema', 'Integracoes', 'editar');

  const categorias = ['Saudação', 'Despedida', 'Orçamento', 'Pedido', 'Entrega', 'Financeiro', 'Suporte', 'Geral'];

  const variaveisDisponiveis = [
    { nome: '{{cliente}}', descricao: 'Nome do cliente' },
    { nome: '{{pedido}}', descricao: 'Número do pedido' },
    { nome: '{{valor}}', descricao: 'Valor monetário' },
    { nome: '{{data}}', descricao: 'Data atual' },
    { nome: '{{empresa}}', descricao: 'Nome da empresa' },
    { nome: '{{atendente}}', descricao: 'Nome do atendente' },
    { nome: '{{link}}', descricao: 'Link relevante' }
  ];

  // Buscar templates
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['templates-mensagens-lista', contextKey],
    queryFn: async () => {
      const configs = await filterInContext('ConfiguracaoCanal', {}, 'canal', 100);
      
      const allTemplates = [];
      configs.forEach(config => {
        if (config.templates_mensagem) {
          config.templates_mensagem.forEach(t => {
            allTemplates.push({
              ...t,
              config_id: config.id,
              canal: config.canal
            });
          });
        }
      });
      
      return allTemplates;
    },
    enabled: contextoValido && canViewTemplates
  });

  const salvarTemplateMutation = useMutation({
    mutationFn: async (template) => {
      if (!contextoValido || !canEditTemplates) {
        throw new Error('Contexto ou permissao insuficiente para salvar template');
      }

      const configs = await filterInContext('ConfiguracaoCanal', { ativo: true }, 'canal', 100);

      let config = configs[0];
      if (!config) {
        config = await createInContext('ConfiguracaoCanal', {
          canal: 'Portal',
          ativo: true,
          templates_mensagem: []
        });
      }

      const templatesAtuais = config.templates_mensagem || [];
      const novoTpl = {
        id: editando?.id || `tpl-${Date.now()}`,
        nome: template.nome,
        categoria: template.categoria,
        conteudo: template.conteudo,
        variaveis: template.conteudo.match(/\{\{[^}]+\}\}/g) || [],
        ativo: true,
        criado_em: editando?.criado_em || new Date().toISOString()
      };

      const templatesAtualizados = editando
        ? templatesAtuais.map(t => t.id === editando.id ? novoTpl : t)
        : [...templatesAtuais, novoTpl];

      await updateInContext('ConfiguracaoCanal', config.id, {
        templates_mensagem: templatesAtualizados
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates-mensagens-lista'] });
      toast.success(editando ? 'Template atualizado!' : 'Template criado!');
      resetForm();
    }
  });

  const excluirTemplateMutation = useMutation({
    mutationFn: async (template) => {
      if (!contextoValido || !canEditTemplates) {
        throw new Error('Contexto ou permissao insuficiente para excluir template');
      }

      const configs = await filterInContext('ConfiguracaoCanal', { id: template.config_id }, 'canal', 1);
      const config = configs[0];
      if (!config) throw new Error('Configuracao de canal nao encontrada no contexto atual');
      const templatesAtualizados = (config.templates_mensagem || []).filter(t => t.id !== template.id);
      
      await updateInContext('ConfiguracaoCanal', config.id, {
        templates_mensagem: templatesAtualizados
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates-mensagens-lista'] });
      toast.success('Template excluído!');
    }
  });

  const resetForm = () => {
    setNovoTemplate({ nome: '', categoria: 'Geral', conteudo: '' });
    setEditando(null);
    setExibirForm(false);
  };

  const handleEditar = (template) => {
    setEditando(template);
    setNovoTemplate({
      nome: template.nome,
      categoria: template.categoria,
      conteudo: template.conteudo
    });
    setExibirForm(true);
  };

  const handleCopiar = async (conteudo) => {
    await navigator.clipboard.writeText(conteudo);
    toast.success('Copiado!');
  };

  const templatesFiltrados = templates.filter(t => {
    const matchBusca = !busca || 
      t.nome?.toLowerCase().includes(busca.toLowerCase()) ||
      t.conteudo?.toLowerCase().includes(busca.toLowerCase());
    const matchCategoria = categoriaFiltro === 'Todas' || t.categoria === categoriaFiltro;
    return matchBusca && matchCategoria;
  });

  const substituirVariaveis = (texto) => {
    return texto
      .replace(/\{\{cliente\}\}/g, 'João Silva')
      .replace(/\{\{pedido\}\}/g, 'PED-001234')
      .replace(/\{\{valor\}\}/g, 'R$ 5.000,00')
      .replace(/\{\{data\}\}/g, new Date().toLocaleDateString('pt-BR'))
      .replace(/\{\{empresa\}\}/g, empresaAtual?.nome_fantasia || 'Empresa')
      .replace(/\{\{atendente\}\}/g, 'Maria')
      .replace(/\{\{link\}\}/g, 'https://exemplo.com');
  };

  return (
    <div className="w-full h-full overflow-auto" data-permission="CRM.Atendimento.editar" data-context-required="group-or-company">
      <div className="space-y-4">
        {(!contextoValido || !canViewTemplates) && (
          <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-3">
            Selecione grupo/empresa e confirme permissao para visualizar templates de atendimento.
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex-1 w-full sm:w-auto">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar templates..."
                className="pl-9"
              />
            </div>
          </div>
          
          <div className="flex gap-2 w-full sm:w-auto">
            <select
              value={categoriaFiltro}
              onChange={(e) => setCategoriaFiltro(e.target.value)}
              className="px-3 py-2 border rounded-md text-sm bg-white flex-1 sm:flex-none"
            >
              <option value="Todas">Todas Categorias</option>
              {categorias.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            
            <Button onClick={() => setExibirForm(true)} disabled={!contextoValido || !canEditTemplates} className="bg-blue-600 hover:bg-blue-700" data-action="TemplatesMensagens.novo" data-permission="CRM.Atendimento.editar" data-context-required="group-or-company">
              <Plus className="w-4 h-4 mr-2" />
              Novo
            </Button>
          </div>
        </div>

        {/* Formulário de Criação/Edição */}
        <AnimatePresence>
          {exibirForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <Card className="border-blue-200 bg-blue-50/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600" />
                    {editando ? 'Editar Template' : 'Novo Template'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-slate-600">Nome</label>
                      <Input
                        value={novoTemplate.nome}
                        onChange={(e) => setNovoTemplate({ ...novoTemplate, nome: e.target.value })}
                        placeholder="Ex: Saudação Padrão"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600">Categoria</label>
                      <select
                        value={novoTemplate.categoria}
                        onChange={(e) => setNovoTemplate({ ...novoTemplate, categoria: e.target.value })}
                        className="mt-1 w-full px-3 py-2 border rounded-md text-sm"
                      >
                        {categorias.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-600">Conteúdo</label>
                    <Textarea
                      value={novoTemplate.conteudo}
                      onChange={(e) => setNovoTemplate({ ...novoTemplate, conteudo: e.target.value })}
                      placeholder="Digite o template... Use {{variavel}} para campos dinâmicos"
                      className="mt-1 h-24"
                    />
                    
                    {/* Variáveis disponíveis */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {variaveisDisponiveis.map(v => (
                        <button
                          key={v.nome}
                          onClick={() => setNovoTemplate({ 
                            ...novoTemplate, 
                            conteudo: novoTemplate.conteudo + v.nome 
                          })}
                          className="px-2 py-1 bg-slate-200 text-slate-700 rounded text-xs hover:bg-slate-300 transition-colors"
                          title={v.descricao}
                        >
                          {v.nome}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Preview */}
                  {novoTemplate.conteudo && (
                    <div>
                      <label className="text-xs font-medium text-slate-600">Preview</label>
                      <div className="mt-1 p-3 bg-white border rounded-lg text-sm">
                        {substituirVariaveis(novoTemplate.conteudo)}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={resetForm}>
                      Cancelar
                    </Button>
                    <Button
                      onClick={() => salvarTemplateMutation.mutate(novoTemplate)}
                      disabled={!novoTemplate.nome || !novoTemplate.conteudo || salvarTemplateMutation.isPending || !contextoValido || !canEditTemplates}
                      className="bg-blue-600 hover:bg-blue-700"
                      data-action="TemplatesMensagens.salvar"
                      data-permission="CRM.Atendimento.editar"
                      data-context-required="group-or-company"
                      data-sensitive="true"
                    >
                      <Check className="w-4 h-4 mr-2" />
                      {editando ? 'Atualizar' : 'Criar'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Lista de Templates */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            <div className="col-span-full text-center py-8 text-slate-500">
              Carregando templates...
            </div>
          ) : templatesFiltrados.length === 0 ? (
            <div className="col-span-full text-center py-8 text-slate-400">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Nenhum template encontrado</p>
            </div>
          ) : (
            templatesFiltrados.map(template => (
              <motion.div
                key={template.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <Card className="h-full hover:shadow-lg transition-shadow group">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-sm">{template.nome}</CardTitle>
                        <Badge className="mt-1 text-xs">{template.categoria}</Badge>
                      </div>
                      
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleCopiar(template.conteudo)}
                          data-action="TemplatesMensagens.copiar"
                          data-permission="CRM.Atendimento.visualizar"
                          data-context-required="group-or-company"
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleEditar(template)}
                          disabled={!contextoValido || !canEditTemplates}
                          data-action="TemplatesMensagens.editar"
                          data-permission="CRM.Atendimento.editar"
                          data-context-required="group-or-company"
                        >
                          <Edit2 className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-600"
                          disabled={!contextoValido || !canEditTemplates || excluirTemplateMutation.isPending}
                          data-action="TemplatesMensagens.excluir"
                          data-permission="CRM.Atendimento.editar"
                          data-context-required="group-or-company"
                          data-sensitive="true"
                          onClick={() => {
                            if (confirm('Excluir template?')) {
                              excluirTemplateMutation.mutate(template);
                            }
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <p className="text-xs text-slate-600 line-clamp-3 mb-3">
                      {template.conteudo}
                    </p>
                    
                    {template.variaveis?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {template.variaveis.slice(0, 3).map((v, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            <Tag className="w-2 h-2 mr-1" />
                            {v}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {onSelecionarTemplate && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-3"
                        data-action="TemplatesMensagens.usar"
                        data-permission="CRM.Atendimento.visualizar"
                        data-context-required="group-or-company"
                        onClick={() => onSelecionarTemplate(template.conteudo)}
                      >
                        <MessageSquare className="w-3 h-3 mr-1" />
                        Usar Template
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
