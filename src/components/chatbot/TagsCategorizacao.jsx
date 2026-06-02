import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Tag, 
  Plus, 
  X,
  Check
} from 'lucide-react';
import { toast } from 'sonner';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import usePermissions from '@/components/lib/usePermissions';

/**
 * V21.6 - TAGS E CATEGORIZAÇÃO DE CONVERSAS
 * 
 * Sistema de tags para:
 * ✅ Categorização manual e automática
 * ✅ Tags personalizadas
 * ✅ Tags sugeridas pela IA
 * ✅ Filtros por tag
 */
export default function TagsCategorizacao({ conversa }) {
  const { empresaAtual, grupoAtual, updateInContext } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const [novaTag, setNovaTag] = useState('');
  const [editando, setEditando] = useState(false);
  const queryClient = useQueryClient();
  const empresaId = conversa?.empresa_id || empresaAtual?.id;
  const groupId = conversa?.group_id || conversa?.grupo_id || grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id;
  const contextoValido = Boolean(empresaId || groupId);
  const canEditTags = hasPermission('CRM', 'Atendimento', 'editar') ||
    hasPermission('Sistema', 'Integracoes', 'editar');

  const tagsSugeridas = [
    'Urgente', 'VIP', 'Reclamação', 'Orçamento', 'Dúvida', 
    'Financeiro', 'Entrega', 'Técnico', 'Cancelamento', 'Elogio'
  ];

  const coresTag = {
    'Urgente': 'bg-red-600',
    'VIP': 'bg-purple-600',
    'Reclamação': 'bg-orange-600',
    'Orçamento': 'bg-blue-600',
    'Dúvida': 'bg-slate-600',
    'Financeiro': 'bg-green-600',
    'Entrega': 'bg-cyan-600',
    'Técnico': 'bg-indigo-600',
    'Cancelamento': 'bg-red-500',
    'Elogio': 'bg-emerald-600'
  };

  const salvarTagsMutation = useMutation({
    mutationFn: async (tags) => {
      if (!contextoValido || !canEditTags) {
        throw new Error('Contexto ou permissao insuficiente para atualizar tags');
      }
      await updateInContext('ConversaOmnicanal', conversa.id, { tags });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversas-omnicanal'] });
      toast.success('Tags atualizadas!');
    }
  });

  const adicionarTag = (tag) => {
    if (!tag.trim()) return;
    
    const tagsAtuais = conversa.tags || [];
    if (tagsAtuais.includes(tag)) {
      toast.error('Tag já existe');
      return;
    }
    
    salvarTagsMutation.mutate([...tagsAtuais, tag]);
    setNovaTag('');
  };

  const removerTag = (tagRemover) => {
    const tagsAtuais = conversa.tags || [];
    salvarTagsMutation.mutate(tagsAtuais.filter(t => t !== tagRemover));
  };

  if (!conversa) return null;

  const tagsAtuais = conversa.tags || [];

  return (
    <div className="w-full h-full space-y-3" data-permission="CRM.Atendimento.editar" data-context-required="group-or-company">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <Tag className="w-4 h-4 text-blue-600" />
          Tags
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setEditando(!editando)}
          disabled={!contextoValido || !canEditTags}
          className="text-xs"
          data-action="TagsCategorizacao.editar"
          data-permission="CRM.Atendimento.editar"
          data-context-required="group-or-company"
        >
          {editando ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
        </Button>
      </div>

      {/* Tags Atuais */}
      <div className="flex flex-wrap gap-1">
        {tagsAtuais.length === 0 ? (
          <span className="text-xs text-slate-400">Nenhuma tag</span>
        ) : (
          tagsAtuais.map((tag, idx) => (
            <Badge 
              key={idx} 
              className={`${coresTag[tag] || 'bg-slate-600'} text-xs cursor-pointer group`}
            >
              {tag}
              {editando && (
                <button
                  onClick={() => removerTag(tag)}
                  className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  disabled={!contextoValido || !canEditTags || salvarTagsMutation.isPending}
                  data-action="TagsCategorizacao.remover"
                  data-permission="CRM.Atendimento.editar"
                  data-context-required="group-or-company"
                  data-sensitive="true"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </Badge>
          ))
        )}
      </div>

      {/* Adicionar Tag */}
      {editando && (
        <div className="space-y-2">
          <div className="flex gap-1">
            <Input
              value={novaTag}
              onChange={(e) => setNovaTag(e.target.value)}
              placeholder="Nova tag..."
              className="text-xs h-7"
              onKeyPress={(e) => e.key === 'Enter' && adicionarTag(novaTag)}
            />
            <Button
              size="sm"
              onClick={() => adicionarTag(novaTag)}
              disabled={!novaTag.trim() || !contextoValido || !canEditTags || salvarTagsMutation.isPending}
              className="h-7 px-2"
              data-action="TagsCategorizacao.adicionar"
              data-permission="CRM.Atendimento.editar"
              data-context-required="group-or-company"
              data-sensitive="true"
            >
              <Plus className="w-3 h-3" />
            </Button>
          </div>

          {/* Tags Sugeridas */}
          <div>
            <p className="text-xs text-slate-500 mb-1">Sugeridas:</p>
            <div className="flex flex-wrap gap-1">
              {tagsSugeridas
                .filter(tag => !tagsAtuais.includes(tag))
                .slice(0, 6)
                .map((tag, idx) => (
                  <button
                    key={idx}
                    onClick={() => adicionarTag(tag)}
                    disabled={!contextoValido || !canEditTags || salvarTagsMutation.isPending}
                    data-action="TagsCategorizacao.adicionarSugerida"
                    data-permission="CRM.Atendimento.editar"
                    data-context-required="group-or-company"
                    data-sensitive="true"
                    className={`${coresTag[tag] || 'bg-slate-400'} text-white text-xs px-2 py-0.5 rounded-full hover:opacity-80 transition-opacity`}
                  >
                    + {tag}
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
