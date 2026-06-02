import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Plus, Search, Edit2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import usePermissions from '@/components/lib/usePermissions';

/**
 * V21.5 - BASE DE CONHECIMENTO IA
 * Base de conhecimento para treinar o chatbot
 */
export default function BaseConhecimento() {
  const [dialogAberto, setDialogAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState(null);
  const queryClient = useQueryClient();
  const { empresaAtual, grupoAtual, filterInContext, createInContext, updateInContext } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const empresaId = empresaAtual?.id;
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id;
  const contextKey = empresaId || groupId || 'sem-contexto';
  const contextoValido = contextKey !== 'sem-contexto';
  const canViewBase = hasPermission('CRM', 'Atendimento', 'visualizar') ||
    hasPermission('Sistema', 'Integracoes', 'visualizar');
  const canEditBase = hasPermission('CRM', 'Atendimento', 'editar') ||
    hasPermission('Sistema', 'Integracoes', 'editar');

  const [form, setForm] = useState({
    pergunta: '',
    resposta: '',
    categoria: 'Geral',
    tags: []
  });

  const { data: conhecimentos = [] } = useQuery({
    queryKey: ['base-conhecimento', contextKey],
    queryFn: async () => {
      const configs = await filterInContext('ConfiguracaoCanal', {}, 'canal', 100);
      return configs.flatMap(c => c.base_conhecimento || []);
    },
    enabled: contextoValido && canViewBase
  });

  const salvarMutation = useMutation({
    mutationFn: async (dados) => {
      if (!contextoValido || !canEditBase) {
        throw new Error('Contexto ou permissao insuficiente para salvar conhecimento');
      }

      const configs = await filterInContext('ConfiguracaoCanal', { canal: 'Portal' }, 'canal', 10);
      let config = configs[0];
      
      if (!config) {
        config = await createInContext('ConfiguracaoCanal', {
          canal: 'Portal',
          ativo: true,
          base_conhecimento: []
        });
      }

      const baseAtual = config.base_conhecimento || [];
      const novo = {
        id: editando?.id || `kb-${Date.now()}`,
        ...dados,
        criado_em: new Date().toISOString()
      };

      const baseAtualizada = editando
        ? baseAtual.map(k => k.id === editando.id ? novo : k)
        : [...baseAtual, novo];

      await updateInContext('ConfiguracaoCanal', config.id, {
        base_conhecimento: baseAtualizada
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['base-conhecimento'] });
      toast.success('Conhecimento salvo!');
      resetForm();
    }
  });

  const resetForm = () => {
    setForm({ pergunta: '', resposta: '', categoria: 'Geral', tags: [] });
    setEditando(null);
    setDialogAberto(false);
  };

  const conhecimentosFiltrados = conhecimentos.filter(k =>
    !busca || 
    k.pergunta?.toLowerCase().includes(busca.toLowerCase()) ||
    k.resposta?.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="w-full h-full space-y-6" data-permission="CRM.Atendimento.editar" data-context-required="group-or-company">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-blue-600" />
            Base de Conhecimento
          </h2>
          <p className="text-sm text-slate-600 mt-1">Treine o chatbot com perguntas frequentes</p>
        </div>
        <Button onClick={() => setDialogAberto(true)} disabled={!contextoValido || !canEditBase} className="bg-blue-600" data-action="BaseConhecimento.adicionar" data-permission="CRM.Atendimento.editar" data-context-required="group-or-company">
          <Plus className="w-4 h-4 mr-2" />
          Adicionar
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          {(!contextoValido || !canViewBase) && (
            <div className="text-sm text-amber-800 mb-3">
              Selecione grupo/empresa e confirme permissao para visualizar a base de conhecimento.
            </div>
          )}
          <Input
            placeholder="Buscar na base de conhecimento..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        {conhecimentosFiltrados.map((item) => (
          <Card key={item.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-semibold text-sm">{item.pergunta}</p>
                  <Badge className="mt-2 text-xs">{item.categoria}</Badge>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" disabled={!contextoValido || !canEditBase} data-action="BaseConhecimento.editar" data-permission="CRM.Atendimento.editar" data-context-required="group-or-company" onClick={() => {
                    setEditando(item);
                    setForm(item);
                    setDialogAberto(true);
                  }}>
                    <Edit2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-700">{item.resposta}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar' : 'Novo'} Conhecimento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Input
                placeholder="Pergunta"
                value={form.pergunta}
                onChange={(e) => setForm({ ...form, pergunta: e.target.value })}
              />
            </div>
            <div>
              <Textarea
                placeholder="Resposta"
                value={form.resposta}
                onChange={(e) => setForm({ ...form, resposta: e.target.value })}
                className="h-24"
              />
            </div>
            <div>
              <select
                value={form.categoria}
                onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option>Geral</option>
                <option>Produtos</option>
                <option>Pedidos</option>
                <option>Financeiro</option>
                <option>Logística</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>Cancelar</Button>
            <Button onClick={() => salvarMutation.mutate(form)} disabled={!contextoValido || !canEditBase || salvarMutation.isPending} className="bg-blue-600" data-action="BaseConhecimento.salvar" data-permission="CRM.Atendimento.editar" data-context-required="group-or-company" data-sensitive="true">
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
