import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import VisualizadorUniversalEntidadeV24 from './VisualizadorUniversalEntidadeV24';
import ProdutoFormV22_Completo from './ProdutoFormV22_Completo';
import { Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import usePermissions from '@/components/lib/usePermissions';
import { useContextoVisual } from '@/components/lib/useContextoVisual';

export default function VisualizadorProdutos(props) {
  const queryClient = useQueryClient();
  const { empresaAtual, grupoAtual, filterInContext, updateInContext, createInContext } = useContextoVisual();
  const { canEdit } = usePermissions();
  const [selectedProdutos, setSelectedProdutos] = useState(new Set());
  const [isSetorModalOpen, setIsSetorModalOpen] = useState(false);
  const [targetSetorId, setTargetSetorId] = useState(null);
  const contextoValido = Boolean(empresaAtual?.id || grupoAtual?.id);
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const podeEditarProduto = canEdit('Cadastros', 'Produto') || canEdit('Cadastros', null) || canEdit('Estoque', 'Produto') || canEdit('Estoque', null);

  const registrarAuditoriaProduto = async (acao, descricao, dados = {}, sucesso = true) => {
    try {
      await createInContext('AuditLog', {
        acao,
        modulo: 'Cadastros',
        entidade: 'Produto',
        tipo_auditoria: sucesso ? 'cadastro' : 'seguranca',
        descricao,
        empresa_id: empresaId,
        group_id: groupId,
        grupo_id: groupId,
        dados_novos: {
          origem: 'VisualizadorProdutos',
          ...dados,
        },
        data_hora: new Date().toISOString(),
        sucesso,
      });
    } catch (_) {}
  };

  const { data: setores = [] } = useQuery({
    queryKey: ['setores-atividade', empresaAtual?.id || null, grupoAtual?.id || null],
    queryFn: () => filterInContext('SetorAtividade', {}, 'nome', 200),
    enabled: contextoValido,
  });

  const updateSetorMutation = useMutation({
    mutationFn: async ({ setorId, setorNome }) => {
      if (!contextoValido) throw new Error('Selecione um grupo ou empresa antes de atualizar produtos.');
      if (!podeEditarProduto) throw new Error('Seu perfil nao permite editar produtos.');
      await registrarAuditoriaProduto('Atualizacao em massa', 'Inicio da atualizacao de setor em massa de produtos', {
        setor_id: setorId,
        setor_nome: setorNome,
        quantidade: selectedProdutos.size,
      });
      const updates = Array.from(selectedProdutos).map(produtoId => 
        updateInContext('Produto', produtoId, {
          setor_atividade_id: setorId,
          setor_atividade_nome: setorNome,
        })
      );
      return Promise.all(updates);
    },
    onSuccess: () => {
      registrarAuditoriaProduto('Atualizacao em massa', 'Atualizacao de setor em massa de produtos concluida', {
        quantidade: selectedProdutos.size,
      });
      toast({ title: '✅ Sucesso!', description: `${selectedProdutos.size} produtos atualizados.` });
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      setSelectedProdutos(new Set());
      setIsSetorModalOpen(false);
    },
    onError: (error) => {
      registrarAuditoriaProduto('Bloqueio', 'Falha na atualizacao de setor em massa de produtos', {
        erro: error?.message || String(error),
        quantidade: selectedProdutos.size,
      }, false);
      toast({ title: '❌ Erro', description: `Não foi possível atualizar os produtos: ${error.message}`, variant: 'destructive' });
    }
  });

  const handleUpdateSetor = () => {
    if (!targetSetorId) {
      toast({ title: 'Atenção', description: 'Por favor, selecione um setor de destino.', variant: 'destructive' });
      return;
    }
    const setorSelecionado = setores.find(s => s.id === targetSetorId);
    if (setorSelecionado) {
      updateSetorMutation.mutate({ setorId: setorSelecionado.id, setorNome: setorSelecionado.nome });
    }
  };

  const visualizadorProps = {
    ...props,
    nomeEntidade: 'Produto',
    tituloDisplay: 'Produtos',
    icone: Package,
    camposPrincipais: ['descricao', 'codigo', 'tipo_item', 'setor_atividade_nome', 'grupo_produto_nome', 'marca_nome', 'status', 'estoque_atual', 'preco_venda'],
    componenteEdicao: ProdutoFormV22_Completo,
    windowMode: false,
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-50" data-context-required="true" data-permission="Cadastros.Produto.visualizar">
      <div className="p-4 border-b bg-white flex items-center gap-4 shrink-0">
      </div>
      <div className="flex-1 min-h-0 p-4 flex flex-col overflow-hidden">
        <VisualizadorUniversalEntidadeV24 {...visualizadorProps} />
      </div>

      <Dialog open={isSetorModalOpen} onOpenChange={setIsSetorModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atualizar Setor em Massa</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="mb-4 text-sm text-slate-600">
              Você está prestes a alterar o setor de <span className="font-bold">{selectedProdutos.size}</span> produtos selecionados.
            </p>
            <Select onValueChange={setTargetSetorId} value={targetSetorId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o novo setor..." />
              </SelectTrigger>
              <SelectContent>
                {setores.map(setor => (
                  <SelectItem key={setor.id} value={setor.id}>
                    {setor.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSetorModalOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleUpdateSetor}
              disabled={!targetSetorId || updateSetorMutation.isPending || !contextoValido || !podeEditarProduto}
              data-permission="Cadastros.Produto.editar"
              data-action="Cadastros.Produto.atualizar-setor-massa"
              data-context-required="group-or-company"
              data-sensitive
            >
              {updateSetorMutation.isPending ? 'Atualizando...' : 'Atualizar Produtos'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
