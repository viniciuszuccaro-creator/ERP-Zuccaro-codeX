import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  MessageSquare, 
  Plus, 
  Edit2, 
  Trash2, 
  Copy, 
  Check,
  FileText,
  Tag
} from 'lucide-react';
import { toast } from 'sonner';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import usePermissions from '@/components/lib/usePermissions';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';

/**
 * V21.5 - GERENCIADOR DE TEMPLATES DE MENSAGENS
 * 
 * Recursos:
 * ✅ Criar templates reutilizáveis
 * ✅ Categorização por tipo
 * ✅ Variáveis dinâmicas {{cliente}}, {{pedido}}, etc
 * ✅ Preview em tempo real
 * ✅ Copiar para clipboard
 * ✅ Compartilhamento entre empresas
 */
export default function GerenciadorTemplates() {
  const [dialogAberto, setDialogAberto] = useState(false);
  const [templateEditando, setTemplateEditando] = useState(null);
  const [busca, setBusca] = useState('');
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

  const [formData, setFormData] = useState({
    nome: '',
    categoria: 'Saudação',
    conteudo: '',
    variaveis: [],
    ativo: true
  });

  // Buscar templates
  const { data: templates = [] } = useQuery({
    queryKey: ['templates-mensagens', contextKey],
    queryFn: async () => {
      const configs = await filterInContext('ConfiguracaoCanal', {}, 'canal', 100);
      const allTemplates = [];
      
      configs.forEach(config => {
        if (config.templates_mensagens) {
          config.templates_mensagens.forEach(t => {
            allTemplates.push({
              ...t,
              canal_config_id: config.id,
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

      // Encontrar config do primeiro canal ativo ou criar nova
      const configs = await filterInContext('ConfiguracaoCanal', { ativo: true }, 'canal', 100);
      
      let config = configs[0];
      if (!config) {
        config = await createInContext('ConfiguracaoCanal', {
          canal: 'Portal',
          ativo: true,
          templates_mensagens: []
        });
      }

      const templatesAtuais = config.templates_mensagens || [];
      const novoTemplate = {
        template_id: templateEditando?.template_id || `tpl-${Date.now()}`,
        ...template
      };

      const templatesAtualizados = templateEditando
        ? templatesAtuais.map(t => t.template_id === templateEditando.template_id ? novoTemplate : t)
        : [...templatesAtuais, novoTemplate];

      await updateInContext('ConfiguracaoCanal', config.id, {
        templates_mensagens: templatesAtualizados
      });

      return novoTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates-mensagens'] });
      toast.success('Template salvo!');
      resetForm();
    }
  });

  const excluirTemplateMutation = useMutation({
    mutationFn: async (template) => {
      if (!contextoValido || !canEditTemplates) {
        throw new Error('Contexto ou permissao insuficiente para excluir template');
      }

      const configs = await filterInContext('ConfiguracaoCanal', { id: template.canal_config_id }, 'canal', 1);
      const config = configs[0];
      if (!config) throw new Error('Configuracao de canal nao encontrada no contexto atual');
      const templatesAtualizados = config.templates_mensagens.filter(
        t => t.template_id !== template.template_id
      );
      
      await updateInContext('ConfiguracaoCanal', config.id, {
        templates_mensagens: templatesAtualizados
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates-mensagens'] });
      toast.success('Template excluído!');
    }
  });

  const resetForm = () => {
    setFormData({
      nome: '',
      categoria: 'Saudação',
      conteudo: '',
      variaveis: [],
      ativo: true
    });
    setTemplateEditando(null);
    setDialogAberto(false);
  };

  const handleEditar = (template) => {
    setTemplateEditando(template);
    setFormData({
      nome: template.nome,
      categoria: template.categoria,
      conteudo: template.conteudo,
      variaveis: template.variaveis || [],
      ativo: template.ativo !== false
    });
    setDialogAberto(true);
  };

  const handleCopiar = (conteudo) => {
    navigator.clipboard.writeText(conteudo);
    toast.success('Copiado para a área de transferência!');
  };

  const templatesFiltrados = templates.filter(t => 
    !busca || 
    t.nome?.toLowerCase().includes(busca.toLowerCase()) ||
    t.conteudo?.toLowerCase().includes(busca.toLowerCase()) ||
    t.categoria?.toLowerCase().includes(busca.toLowerCase())
  );

  const categorias = ['Saudação', 'Despedida', 'Orçamento', 'Pedido', 'Entrega', 'Financeiro', 'Suporte', 'Geral'];

  return (
    <div className="w-full h-full space-y-6" data-permission="CRM.Atendimento.editar" data-context-required="group-or-company">
      {/* Header */}
      {(!contextoValido || !canViewTemplates) && (
        <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-3">
          Selecione grupo/empresa e confirme permissao para visualizar templates de atendimento.
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-blue-600" />
            Templates de Mensagens
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Crie respostas rápidas e reutilizáveis com variáveis dinâmicas
          </p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setDialogAberto(true);
          }}
          disabled={!contextoValido || !canEditTemplates}
          className="bg-blue-600 hover:bg-blue-700"
          data-action="GerenciadorTemplates.novo"
          data-permission="CRM.Atendimento.editar"
          data-context-required="group-or-company"
        >
          <Plus className="w-4 h-4 mr-2" />
          Novo Template
        </Button>
      </div>

      {/* Busca */}
      <Card>
        <CardContent className="p-4">
          <Input
            placeholder="Buscar templates por nome, categoria ou conteúdo..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full"
          />
        </CardContent>
      </Card>

      {/* Grid de Templates */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templatesFiltrados.map((template) => (
          <Card key={template.template_id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-base">{template.nome}</CardTitle>
                  <Badge className="mt-2 text-xs">{template.categoria}</Badge>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleCopiar(template.conteudo)}
                    className="h-8 w-8"
                    data-action="GerenciadorTemplates.copiar"
                    data-permission="CRM.Atendimento.visualizar"
                    data-context-required="group-or-company"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEditar(template)}
                    className="h-8 w-8"
                    disabled={!contextoValido || !canEditTemplates}
                    data-action="GerenciadorTemplates.editar"
                    data-permission="CRM.Atendimento.editar"
                    data-context-required="group-or-company"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={!contextoValido || !canEditTemplates || excluirTemplateMutation.isPending}
                    data-action="GerenciadorTemplates.excluir"
                    data-permission="CRM.Atendimento.editar"
                    data-context-required="group-or-company"
                    data-sensitive="true"
                    onClick={() => {
                      if (confirm('Confirma exclusão?')) {
                        excluirTemplateMutation.mutate(template);
                      }
                    }}
                    className="h-8 w-8 text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                <p className="text-sm text-slate-700 whitespace-pre-wrap">
                  {template.conteudo.length > 150
                    ? template.conteudo.substring(0, 150) + '...'
                    : template.conteudo}
                </p>
              </div>
              
              {template.variaveis && template.variaveis.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {template.variaveis.map((v, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      <Tag className="w-3 h-3 mr-1" />
                      {v}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Dialog de Criação/Edição */}
      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {templateEditando ? 'Editar Template' : 'Novo Template'}
            </DialogTitle>
            <DialogDescription>
              Use variáveis como {`{{cliente}}`}, {`{{pedido}}`}, {`{{valor}}`} para personalização automática
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>Nome do Template</Label>
              <Input
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Ex: Saudação Padrão"
                className="mt-1"
              />
            </div>

            <div>
              <Label>Categoria</Label>
              <select
                value={formData.categoria}
                onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-md"
              >
                {categorias.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <Label>Conteúdo da Mensagem</Label>
              <Textarea
                value={formData.conteudo}
                onChange={(e) => setFormData({ ...formData, conteudo: e.target.value })}
                placeholder="Digite o template aqui... Use {{variavel}} para campos dinâmicos"
                className="mt-1 h-32"
              />
              <p className="text-xs text-slate-500 mt-1">
                Variáveis disponíveis: {`{{cliente}}`}, {`{{pedido}}`}, {`{{valor}}`}, {`{{data}}`}, {`{{empresa}}`}
              </p>
            </div>

            {/* Preview */}
            <div>
              <Label>Preview</Label>
              <div className="mt-1 bg-slate-50 border border-slate-200 rounded-lg p-3">
                <p className="text-sm text-slate-700 whitespace-pre-wrap">
                  {formData.conteudo
                    .replace(/\{\{cliente\}\}/g, 'João Silva')
                    .replace(/\{\{pedido\}\}/g, 'PED-001')
                    .replace(/\{\{valor\}\}/g, 'R$ 5.000,00')
                    .replace(/\{\{data\}\}/g, new Date().toLocaleDateString('pt-BR'))
                    .replace(/\{\{empresa\}\}/g, empresaAtual?.nome_fantasia || 'Empresa')
                  }
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>
              Cancelar
            </Button>
            <Button
              onClick={() => salvarTemplateMutation.mutate(formData)}
              disabled={!formData.nome || !formData.conteudo || salvarTemplateMutation.isPending || !contextoValido || !canEditTemplates}
              className="bg-blue-600 hover:bg-blue-700"
              data-action="GerenciadorTemplates.salvar"
              data-permission="CRM.Atendimento.editar"
              data-context-required="group-or-company"
              data-sensitive="true"
            >
              <Check className="w-4 h-4 mr-2" />
              {templateEditando ? 'Atualizar' : 'Criar'} Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
