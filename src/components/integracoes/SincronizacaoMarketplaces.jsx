import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { ShoppingCart, RefreshCw, CheckCircle, AlertCircle, Package } from 'lucide-react';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import { useUser } from '@/components/lib/UserContext';
import usePermissions from '@/components/lib/usePermissions';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

/**
 * Sincronização com Marketplaces
 * Mercado Livre, Shopee, Amazon
 */
export default function SincronizacaoMarketplaces({ empresaId: empresaIdProp }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useUser();
  const { empresaAtual, grupoAtual, filterInContext, createInContext, updateInContext } = useContextoVisual();
  const { isAdmin, hasPermission } = usePermissions();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || user?.grupo_atual_id || user?.grupo_padrao_id || null;
  const empresaId = empresaAtual?.id || empresaIdProp || null;
  const contextoValido = Boolean(groupId && empresaId);
  const admin = isAdmin();
  const podeVisualizar = admin || hasPermission('Sistema', 'Integracoes', 'visualizar') || hasPermission('Sistema', 'Integrações', 'visualizar');
  const podeCriar = admin || hasPermission('Sistema', 'Integracoes', 'criar') || hasPermission('Sistema', 'Integrações', 'criar');
  const podeEditar = admin || hasPermission('Sistema', 'Integracoes', 'editar') || hasPermission('Sistema', 'Integrações', 'editar');
  const podeExecutar = admin || hasPermission('Sistema', 'Integracoes', 'executar') || hasPermission('Sistema', 'Integrações', 'executar');
  const scope = { group_id: groupId, empresa_id: empresaId };
  const [salvandoMarketplace, setSalvandoMarketplace] = useState(null);

  const auditarMarketplace = async (
    acao,
    descricao,
    dadosNovos = null,
    dadosAnteriores = null,
    entidade = 'PedidoExterno',
    registroId = null
  ) => {
    try {
      await createInContext('AuditLog', {
        usuario: user?.full_name || user?.email || 'Usuario local',
        usuario_id: user?.id || null,
        empresa_id: empresaId,
        group_id: groupId,
        acao,
        modulo: 'Integracoes',
        entidade,
        registro_id: registroId,
        descricao,
        sucesso: !/^(Bloqueio|Erro)/.test(acao),
        dados_anteriores: dadosAnteriores,
        dados_novos: dadosNovos,
        data_hora: new Date().toISOString()
      });
    } catch (error) {
      console.warn('Falha ao auditar marketplace:', error);
    }
  };
  const [config, setConfig] = useState({
    mercado_livre: { ativo: false, token: '' },
    shopee: { ativo: false, token: '' },
    amazon: { ativo: false, token: '' }
  });

  const { data: configuracoesSalvas = [] } = useQuery({
    queryKey: ['marketplace-configuracoes', groupId || 'sem-grupo', empresaId || 'sem-empresa'],
    queryFn: () => filterInContext('ConfiguracaoIntegracaoMarketplace', {}, '-updated_date', 100),
    enabled: contextoValido && podeVisualizar,
  });

  const encontrarConfiguracao = (marketplaceId) => configuracoesSalvas.find((item) =>
    [item.marketplace_id, item.marketplace, item.chave].includes(marketplaceId)
  );

  useEffect(() => {
    const proximo = {
      mercado_livre: { ativo: false, token: '' },
      shopee: { ativo: false, token: '' },
      amazon: { ativo: false, token: '' }
    };
    for (const marketplaceId of Object.keys(proximo)) {
      const salva = encontrarConfiguracao(marketplaceId);
      if (salva) proximo[marketplaceId].ativo = Boolean(salva.ativo);
    }
    setConfig(proximo);
  }, [groupId, empresaId, configuracoesSalvas]);

  const { data: pedidosExternos = [] } = useQuery({
    queryKey: ['pedidos-externos-config', groupId || 'sem-grupo', empresaId || 'sem-empresa'],
    queryFn: () => filterInContext('PedidoExterno', {}, '-created_date', 100),
    enabled: contextoValido && podeVisualizar,
  });

  const sincronizarMutation = useMutation({
    mutationFn: async (marketplace) => {
      if (!contextoValido) {
        await auditarMarketplace('Bloqueio sem contexto', 'Tentativa de sincronizar marketplace sem grupo ou empresa.', { marketplace });
        throw new Error('Selecione grupo ou empresa antes de sincronizar marketplaces.');
      }
      if (!podeExecutar) {
        await auditarMarketplace('Bloqueio por permissao', 'Tentativa de sincronizar marketplace sem permissao.', { marketplace });
        throw new Error('Seu perfil nao permite sincronizar marketplaces.');
      }
      // Simulacao de sincronizacao
      await new Promise(resolve => setTimeout(resolve, 2000));

      const resultado = {
        marketplace,
        novos_pedidos: 0,
        atualizados: 0
      };
      await auditarMarketplace('Sincronizar Marketplace', 'Sincronizacao manual de marketplace executada com escopo multiempresa.', resultado);
      return resultado;
    },
    onSuccess: (resultado) => {
      queryClient.invalidateQueries({ queryKey: ['pedidos-externos-config'] });
      toast({
        title: `✅ ${resultado.marketplace} sincronizado!`,
        description: `${resultado.novos_pedidos} pedidos novos`
      });
    },
    onError: async (error) => {
      console.warn('Falha ao sincronizar marketplace:', error);
      await auditarMarketplace('Erro Sincronizar Marketplace', 'Falha ao sincronizar marketplace.', { tipo_erro: error?.name || 'Error' });
      toast({
        title: 'Sincronizacao bloqueada',
        description: 'Nao foi possivel concluir a sincronizacao.',
        variant: 'destructive'
      });
    }
  });

  const alterarStatusMarketplace = async (mp, ativo) => {
    const existente = encontrarConfiguracao(mp.id);
    const operacao = existente ? 'editar' : 'criar';
    const permitido = operacao === 'editar' ? podeEditar : podeCriar;
    if (!contextoValido || !permitido) {
      toast({
        title: !contextoValido ? 'Contexto obrigatorio' : 'Permissao negada',
        description: !contextoValido ? 'Selecione grupo e empresa antes de alterar marketplaces.' : `Seu perfil nao permite ${operacao} esta configuracao.`,
        variant: 'destructive'
      });
      await auditarMarketplace(
        !contextoValido ? 'Bloqueio sem contexto' : 'Bloqueio por permissao',
        'Tentativa de alterar status de marketplace bloqueada.',
        { marketplace: mp.nome, ativo, operacao },
        null,
        'ConfiguracaoIntegracaoMarketplace',
        existente?.id || null
      );
      return;
    }

    setSalvandoMarketplace(mp.id);
    try {
      const payload = { marketplace_id: mp.id, nome: mp.nome, ativo: Boolean(ativo), ...scope };
      if (existente) {
        await updateInContext('ConfiguracaoIntegracaoMarketplace', existente.id, payload);
      } else {
        await createInContext('ConfiguracaoIntegracaoMarketplace', payload);
      }
      setConfig((atual) => ({ ...atual, [mp.id]: { ...atual[mp.id], ativo: Boolean(ativo) } }));
      await queryClient.invalidateQueries({ queryKey: ['marketplace-configuracoes'] });
      await auditarMarketplace(
        'Alterar Status Marketplace',
        'Status de marketplace persistido com escopo multiempresa.',
        { marketplace: mp.nome, ativo: Boolean(ativo), operacao },
        { ativo: Boolean(existente?.ativo) },
        'ConfiguracaoIntegracaoMarketplace',
        existente?.id || null
      );
    } catch (error) {
      console.warn('Falha ao salvar marketplace:', error);
      await auditarMarketplace(
        'Erro Alterar Status Marketplace',
        'Falha ao persistir status de marketplace.',
        { marketplace: mp.nome, ativo: Boolean(ativo), operacao, tipo_erro: error?.name || 'Error' },
        { ativo: Boolean(existente?.ativo) },
        'ConfiguracaoIntegracaoMarketplace',
        existente?.id || null
      );
      toast({ title: 'Erro ao salvar marketplace', description: 'Nao foi possivel alterar o status.', variant: 'destructive' });
    } finally {
      setSalvandoMarketplace(null);
    }
  };

  const marketplaces = [
    {
      id: 'mercado_livre',
      nome: 'Mercado Livre',
      icone: ShoppingCart,
      containerClass: 'bg-yellow-100',
      iconClass: 'text-yellow-700',
      descricao: 'Maior marketplace da América Latina'
    },
    {
      id: 'shopee',
      nome: 'Shopee',
      icone: Package,
      containerClass: 'bg-orange-100',
      iconClass: 'text-orange-700',
      descricao: 'Marketplace asiático em crescimento'
    },
    {
      id: 'amazon',
      nome: 'Amazon',
      icone: ShoppingCart,
      containerClass: 'bg-blue-100',
      iconClass: 'text-blue-700',
      descricao: 'Marketplace global'
    }
  ];

  const pedidosPorOrigem = (origem) => {
    return pedidosExternos.filter(p => p.origem === origem).length;
  };

  return (
    <div className="w-full h-full space-y-6">
      <Card>
        <CardHeader className="bg-blue-50 border-b">
          <CardTitle>Integração com Marketplaces</CardTitle>
          <p className="text-sm text-slate-600 mt-1">
            Sincronize pedidos automaticamente de Mercado Livre, Shopee e Amazon
          </p>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {marketplaces.map((mp) => {
            const Icon = mp.icone;
            const ativo = config[mp.id]?.ativo || false;
            const existente = encontrarConfiguracao(mp.id);
            const operacao = existente ? 'editar' : 'criar';
            const podeAlterar = operacao === 'editar' ? podeEditar : podeCriar;

            return (
              <div key={mp.id} className="flex flex-col sm:flex-row items-start gap-4 p-4 border rounded-lg">
                <div className={`w-12 h-12 ${mp.containerClass} rounded-lg flex items-center justify-center`}>
                  <Icon className={`w-6 h-6 ${mp.iconClass}`} />
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold">{mp.nome}</h4>
                    <Badge variant="outline">
                      {pedidosPorOrigem(mp.nome)} pedido(s)
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-600 mb-3">{mp.descricao}</p>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={ativo}
                        onCheckedChange={(v) => alterarStatusMarketplace(mp, v)}
                        disabled={salvandoMarketplace === mp.id || !contextoValido || !podeAlterar}
                        data-action="Integracoes.Marketplaces.alterarStatus"
                        data-permission={`Sistema.Integracoes.${operacao}`}
                        data-context-required="company"
                      />
                      <Label className="text-sm">
                        {ativo ? 'Ativo' : 'Inativo'}
                      </Label>
                    </div>

                    {ativo && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => sincronizarMutation.mutate(mp.nome)}
                        disabled={sincronizarMutation.isPending || !contextoValido || !podeExecutar}
                        data-action="Integracoes.Marketplaces.sincronizar"
                        data-permission="Sistema.Integracoes.executar"
                        data-context-required="company"
                      >
                        <RefreshCw className={`w-4 h-4 mr-1 ${sincronizarMutation.isPending ? 'animate-spin' : ''}`} />
                        Sincronizar Agora
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Últimos Pedidos Sincronizados */}
      <Card>
        <CardHeader className="bg-slate-50 border-b">
          <CardTitle className="text-base">Últimos Pedidos Externos</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Origem</TableHead>
                <TableHead>ID Externo</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pedidosExternos.slice(0, 10).map((pe) => (
                <TableRow key={pe.id}>
                  <TableCell>
                    <Badge variant="outline">{pe.origem}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    {pe.numero_pedido_externo}
                  </TableCell>
                  <TableCell>{pe.cliente_nome}</TableCell>
                  <TableCell className="font-semibold text-green-600">
                    R$ {(pe.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell>
                    <Badge className={
                      pe.status_importacao === 'Importado' ? 'bg-green-100 text-green-700' :
                      pe.status_importacao === 'A Validar' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-slate-100 text-slate-700'
                    }>
                      {pe.status_importacao}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {pedidosExternos.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <ShoppingCart className="w-16 h-16 mx-auto mb-3 opacity-30" />
              <p>Nenhum pedido externo sincronizado</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}