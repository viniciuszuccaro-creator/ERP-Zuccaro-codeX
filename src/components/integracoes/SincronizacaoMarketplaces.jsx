import React, { useState } from 'react';
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
  const { empresaAtual, grupoAtual, filterInContext, createInContext } = useContextoVisual();
  const { isAdmin, hasPermission } = usePermissions();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || user?.grupo_atual_id || user?.grupo_padrao_id || null;
  const empresaId = empresaAtual?.id || empresaIdProp || null;
  const contextoValido = Boolean(groupId || empresaId);
  const podeVisualizar = isAdmin() || hasPermission('Sistema', 'Integracoes', 'visualizar');
  const podeEditar = isAdmin() || hasPermission('Sistema', 'Integracoes', 'editar');

  const auditarMarketplace = async (acao, descricao, dadosNovos = null) => {
    try {
      await createInContext('AuditLog', {
        usuario: user?.full_name || user?.email || 'Usuario local',
        usuario_id: user?.id || null,
        empresa_id: empresaId,
        group_id: groupId,
        acao,
        modulo: 'Integracoes',
        entidade: 'PedidoExterno',
        descricao,
        dados_anteriores: null,
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
      if (!podeEditar) {
        await auditarMarketplace('Bloqueio por permissao', 'Tentativa de sincronizar marketplace sem permissao.', { marketplace });
        throw new Error('Seu perfil nao permite sincronizar marketplaces.');
      }
      // Simulacao de sincronizacao
      await new Promise(resolve => setTimeout(resolve, 2000));

      const resultado = {
        marketplace,
        novos_pedidos: 0,
        atualizados: 0,
        group_id: groupId,
        empresa_id: empresaId
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
    onError: (error) => {
      toast({
        title: 'Sincronizacao bloqueada',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const alterarStatusMarketplace = async (mp, ativo) => {
    if (!contextoValido || !podeEditar) {
      toast({
        title: !contextoValido ? 'Contexto obrigatorio' : 'Permissao negada',
        description: !contextoValido ? 'Selecione grupo ou empresa antes de alterar marketplaces.' : 'Seu perfil nao permite alterar marketplaces.',
        variant: 'destructive'
      });
      await auditarMarketplace(!contextoValido ? 'Bloqueio sem contexto' : 'Bloqueio por permissao', 'Tentativa de alterar status de marketplace bloqueada.', { marketplace: mp.nome, ativo });
      return;
    }
    setConfig((atual) => ({
      ...atual,
      [mp.id]: { ...atual[mp.id], ativo }
    }));
    await auditarMarketplace('Alterar Status Marketplace', 'Status visual de marketplace alterado com escopo multiempresa.', { marketplace: mp.nome, ativo });
  };

  const marketplaces = [
    {
      id: 'mercado_livre',
      nome: 'Mercado Livre',
      icone: ShoppingCart,
      cor: 'yellow',
      descricao: 'Maior marketplace da América Latina'
    },
    {
      id: 'shopee',
      nome: 'Shopee',
      icone: Package,
      cor: 'orange',
      descricao: 'Marketplace asiático em crescimento'
    },
    {
      id: 'amazon',
      nome: 'Amazon',
      icone: ShoppingCart,
      cor: 'blue',
      descricao: 'Marketplace global'
    }
  ];

  const pedidosPorOrigem = (origem) => {
    return pedidosExternos.filter(p => p.origem === origem).length;
  };

  return (
    <div className="space-y-6">
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

            return (
              <div key={mp.id} className="flex items-start gap-4 p-4 border rounded-lg">
                <div className={`w-12 h-12 bg-${mp.cor}-100 rounded-lg flex items-center justify-center`}>
                  <Icon className={`w-6 h-6 text-${mp.cor}-600`} />
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold">{mp.nome}</h4>
                    <Badge variant="outline">
                      {pedidosPorOrigem(mp.nome)} pedido(s)
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-600 mb-3">{mp.descricao}</p>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={ativo}
                        onCheckedChange={(v) => alterarStatusMarketplace(mp, v)}
                        disabled={!contextoValido || !podeEditar}
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
                        disabled={sincronizarMutation.isPending || !contextoValido || !podeEditar}
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
        <CardContent className="p-0">
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