import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Package, TrendingUp, ShoppingCart } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import usePermissions from '@/components/lib/usePermissions';
import {
  assertForecastUiContext,
  buildReposicaoSuggestions,
  requireIaHumanConfirm,
} from '@/components/lib/iaTransversalPolicy';

/**
 * IA de Reposição de Estoque — prevê consumo e sugere compra (grava só com confirmação).
 */
export default function IAReposicao({ empresaId: empresaIdProp }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { empresaAtual, grupoAtual, estaNoGrupo, filterInContext, createInContext } = useContextoVisual();
  const { canCreate, canEdit, user, isAdmin, hasPermission } = usePermissions();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaIdProp || empresaAtual?.id || null;
  const scopeType = estaNoGrupo && !empresaIdProp ? 'grupo' : 'empresa';
  const contextoValido = Boolean(groupId && (scopeType === 'grupo' || empresaId));
  const podeAnalisar = isAdmin?.()
    || canEdit('Estoque', 'IA Reposição')
    || canEdit('Estoque', 'IA Reposicao')
    || canEdit('Estoque', 'Produtos')
    || hasPermission?.('Estoque', null, 'visualizar')
    || hasPermission?.('Estoque', null, 'ver');
  const podeSolicitar = isAdmin?.()
    || canCreate('Estoque', 'Solicitações Compra')
    || canCreate('Estoque', 'Solicitacoes Compra')
    || canCreate('Compras', 'Solicitações')
    || canCreate('Compras', 'Solicitacoes');
  const [analisando, setAnalisando] = useState(false);
  const [sugestoes, setSugestoes] = useState([]);
  const userId = user?.id || user?.email || 'anon';

  const { data: produtos = [] } = useQuery({
    queryKey: ['produtos-ia-reposicao', userId, groupId, empresaId, scopeType],
    queryFn: () => filterInContext('Produto', {}, '-updated_date', 1000),
    enabled: contextoValido && podeAnalisar,
  });

  const { data: movimentacoes = [] } = useQuery({
    queryKey: ['movimentacoes-estoque-ia-reposicao', userId, groupId, empresaId, scopeType],
    queryFn: () => filterInContext('MovimentacaoEstoque', {}, '-data_movimentacao', 500),
    enabled: contextoValido && podeAnalisar,
  });

  const analisarMutation = useMutation({
    mutationFn: async () => {
      assertForecastUiContext({ groupId, empresaId, scopeType });
      if (!podeAnalisar) throw new Error('Sem permissao para executar analise de reposicao.');
      setAnalisando(true);
      const resultado = buildReposicaoSuggestions({
        produtos,
        movimentacoes,
        empresaId: scopeType === 'empresa' ? empresaId : null,
      });
      await createInContext('AuditLog', {
        usuario: user?.full_name || user?.email || 'Sistema',
        usuario_id: user?.id || null,
        empresa_id: scopeType === 'grupo' ? null : empresaId,
        group_id: groupId,
        acao: 'Analise',
        modulo: 'Estoque',
        entidade: 'IA_Reposicao',
        descricao: 'Previsao de reposicao gerou sugestoes sem gravar solicitacao',
        dados_novos: { total: resultado.total, modo: resultado.modo, fonte: resultado.fonte },
        sucesso: true,
        data_hora: new Date().toISOString(),
      });
      return resultado.sugestoes || [];
    },
    onSuccess: (lista) => {
      setSugestoes(lista);
      setAnalisando(false);
      toast({
        title: 'Analise concluida (sugestao)',
        description: `${lista.length} produto(s) precisam de reposicao`,
      });
    },
    onError: (error) => {
      setAnalisando(false);
      toast({ title: 'Erro na analise', description: String(error?.message || error), variant: 'destructive' });
    },
  });

  const gerarSolicitacaoMutation = useMutation({
    mutationFn: async (sugestao) => {
      assertForecastUiContext({ groupId, empresaId, scopeType });
      if (!podeSolicitar) throw new Error('Sem permissao para gerar solicitacao de compra.');
      if (!requireIaHumanConfirm(
        `Criar solicitacao de compra de ${sugestao.quantidade_sugerida} un. de ${sugestao.produto_descricao}?`,
      )) {
        throw new Error('Criacao cancelada.');
      }
      const criada = await createInContext('SolicitacaoCompra', {
        numero_solicitacao: `SC-${Date.now()}`,
        data_solicitacao: new Date().toISOString().split('T')[0],
        solicitante: user?.full_name || user?.email || 'Usuario',
        setor: 'Estoque',
        produto_id: sugestao.produto_id,
        produto_descricao: sugestao.produto_descricao,
        quantidade_solicitada: sugestao.quantidade_sugerida,
        unidade_medida: 'UN',
        justificativa: `${sugestao.motivo}. Consumo medio: ${sugestao.consumo_medio_diario}/dia. Projecao 30 dias: ${sugestao.consumo_projetado_30d}. (IA sugestao confirmada)`,
        prioridade: sugestao.criticidade === 'alta' ? 'Urgente' : 'Media',
        status: 'Pendente',
        group_id: groupId,
        empresa_id: empresaId || sugestao.empresa_id || null,
      });
      await createInContext('AuditLog', {
        usuario: user?.full_name || user?.email || 'Sistema',
        usuario_id: user?.id || null,
        empresa_id: empresaId,
        group_id: groupId,
        acao: 'Criar',
        modulo: 'Estoque',
        entidade: 'SolicitacaoCompra',
        descricao: 'Solicitacao de compra criada apos confirmacao da previsao de reposicao',
        dados_novos: { produto_id: sugestao.produto_id, quantidade: sugestao.quantidade_sugerida },
        sucesso: true,
        data_hora: new Date().toISOString(),
      });
      return criada;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solicitacoes-compra'] });
      toast({ title: 'Solicitacao de compra gerada.' });
    },
    onError: (error) => {
      toast({ title: 'Nao gerou solicitacao', description: String(error?.message || error), variant: 'destructive' });
    },
  });

  if (!contextoValido) {
    return (
      <div className="p-4 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-sm">
        Selecione grupo e empresa para usar a previsao de reposicao.
      </div>
    );
  }

  if (!podeAnalisar) {
    return (
      <div className="p-4 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-sm">
        Sem permissao para analisar reposicao de estoque.
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      <Card className="border-purple-200 bg-purple-50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            IA de Reposição Inteligente
            <Badge variant="outline" className="text-purple-700 border-purple-300">Sugestão</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={() => analisarMutation.mutate()}
            disabled={analisando || !contextoValido || !podeAnalisar}
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            {analisando ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Analisando Consumo...
              </>
            ) : (
              <>
                <TrendingUp className="w-4 h-4 mr-2" />
                Analisar Necessidade de Reposição
              </>
            )}
          </Button>

          {sugestoes.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-purple-900">
                  {sugestoes.length} produto(s) necessitam reposição
                </p>
                <Badge className="bg-purple-600">
                  {sugestoes.filter((s) => s.criticidade === 'alta').length} crítico(s)
                </Badge>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {sugestoes.map((sug) => (
                  <Card
                    key={sug.produto_id}
                    className={`border ${
                      sug.criticidade === 'alta'
                        ? 'border-red-300 bg-red-50'
                        : 'border-orange-300 bg-orange-50'
                    }`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-sm">{sug.produto_descricao}</p>
                            {sug.criticidade === 'alta' && (
                              <Badge className="bg-red-600 text-xs">Urgente</Badge>
                            )}
                          </div>
                          <p className="text-xs text-slate-600 mt-1">
                            Disponível: {sug.estoque_disponivel} | Mínimo: {sug.estoque_minimo}
                          </p>
                          <p className="text-xs text-slate-600">
                            Consumo médio: {sug.consumo_medio_diario}/dia
                          </p>
                          <p className="text-xs text-blue-600 font-semibold mt-2">
                            Sugestão: Comprar {sug.quantidade_sugerida} unidades
                          </p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => gerarSolicitacaoMutation.mutate(sug)}
                          disabled={gerarSolicitacaoMutation.isPending || !contextoValido || !podeSolicitar}
                        >
                          <ShoppingCart className="w-4 h-4 mr-1" />
                          Confirmar SC
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {sugestoes.length === 0 && !analisando && (
            <div className="text-center py-8 text-purple-600">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Clique em &quot;Analisar&quot; para verificar necessidades</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
