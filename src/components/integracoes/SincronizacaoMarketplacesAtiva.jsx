import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  ShoppingCart,
  ExternalLink,
  Download,
  Upload
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { useUser } from '@/components/lib/UserContext';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import usePermissions from '@/components/lib/usePermissions';

/**
 * Sincronização ATIVA de Marketplaces
 * Importação automática de pedidos do Mercado Livre, Shopee, Amazon, etc.
 */
export default function SincronizacaoMarketplacesAtiva() {
  const [sincronizando, setSincronizando] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useUser();
  const { empresaAtual, grupoAtual, filterInContext, carimbarContexto } = useContextoVisual();
  const { isAdmin, hasPermission } = usePermissions();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || user?.grupo_atual_id || user?.grupo_padrao_id || null;
  const empresaId = empresaAtual?.id || null;
  const contextoValido = Boolean(groupId || empresaId);
  const podeOperar = isAdmin() || hasPermission("Sistema", "Integracoes", "editar") || hasPermission("Sistema", "Integrações", "editar");
  const scope = {
    ...(groupId ? { group_id: groupId } : {}),
    ...(empresaId ? { empresa_id: empresaId } : {}),
  };

  const auditarMarketplace = async (acao, descricao, dadosNovos = null, dadosAnteriores = null) => {
    try {
      await base44.entities.AuditLog.create({
        usuario: user?.full_name || user?.email || 'Usuario local',
        usuario_id: user?.id || null,
        empresa_id: empresaId,
        group_id: groupId,
        acao,
        modulo: 'Integracoes',
        entidade: 'PedidoExterno',
        descricao,
        dados_anteriores: dadosAnteriores,
        dados_novos: dadosNovos,
        data_hora: new Date().toISOString()
      });
    } catch (error) {
      console.warn('Falha ao auditar marketplace:', error);
    }
  };

  const { data: pedidosExternos = [] } = useQuery({
    queryKey: ['pedidos-externos-pendentes', groupId || 'sem-grupo', empresaId || 'sem-empresa'],
    queryFn: () => filterInContext('PedidoExterno', {
      status_importacao: ['A Validar', 'Em Revisão']
    }, '-created_date', 100),
    enabled: contextoValido,
    refetchInterval: 30000 // Atualiza a cada 30s
  });

  const importarPedidoMutation = useMutation({
    mutationFn: async (pedidoExterno) => {
      if (!contextoValido) {
        await auditarMarketplace('Bloqueio sem contexto', 'Tentativa de importar pedido externo sem grupo ou empresa.', { pedido_externo_id: pedidoExterno?.id });
        throw new Error('Selecione grupo ou empresa antes de importar pedidos.');
      }
      if (!podeOperar) {
        await auditarMarketplace('Bloqueio por permissao', 'Tentativa de importar pedido externo sem permissao.', { pedido_externo_id: pedidoExterno?.id });
        throw new Error('Seu perfil nao permite importar pedidos externos.');
      }
      // 1. Verificar se cliente existe
      let clienteId = pedidoExterno.cliente_erp_id;
      
      if (!clienteId) {
        const clientesExistentes = await filterInContext('Cliente', {
          cnpj: pedidoExterno.cliente_cpf_cnpj
        }, '-updated_date', 20);

        if (clientesExistentes.length > 0) {
          clienteId = clientesExistentes[0].id;
        } else {
          // Criar cliente novo
          const novoCliente = await base44.entities.Cliente.create(carimbarContexto({
            tipo: pedidoExterno.cliente_cpf_cnpj?.length === 14 ? 'Pessoa Física' : 'Pessoa Jurídica',
            status: 'Ativo',
            nome: pedidoExterno.cliente_nome,
            razao_social: pedidoExterno.cliente_nome,
            nome_fantasia: pedidoExterno.cliente_nome,
            cpf: pedidoExterno.cliente_cpf_cnpj?.length === 11 ? pedidoExterno.cliente_cpf_cnpj : undefined,
            cnpj: pedidoExterno.cliente_cpf_cnpj?.length === 14 ? pedidoExterno.cliente_cpf_cnpj : undefined,
            email: pedidoExterno.cliente_email,
            endereco_principal: pedidoExterno.endereco_entrega,
            contatos: [{
              tipo: 'Telefone',
              valor: pedidoExterno.cliente_telefone,
              principal: true
            }],
            origem_pedido: pedidoExterno.origem,
            ...scope
          }));
          clienteId = novoCliente.id;
        }
      }

      // 2. Criar pedido no ERP
      const pedidoERP = await base44.entities.Pedido.create(carimbarContexto({
        numero_pedido: `${pedidoExterno.origem.substring(0, 3).toUpperCase()}-${pedidoExterno.numero_pedido_externo}`,
        cliente_id: clienteId,
        cliente_nome: pedidoExterno.cliente_nome,
        cliente_cpf_cnpj: pedidoExterno.cliente_cpf_cnpj,
        data_pedido: new Date(pedidoExterno.data_pedido_externo).toISOString().split('T')[0],
        tipo: 'Pedido',
        tipo_pedido: 'Revenda',
        origem_pedido: pedidoExterno.origem,
        origem_externa_id: pedidoExterno.id_externo,
        status: 'Aprovado',
        pode_ver_no_portal: true,
        endereco_entrega_principal: pedidoExterno.endereco_entrega,
        itens_revenda: pedidoExterno.itens.map(item => ({
          produto_id: item.produto_id,
          codigo_sku: item.sku_interno || item.sku_externo,
          descricao: item.descricao,
          quantidade: item.quantidade,
          preco_unitario: item.preco_unitario,
          valor_item: item.valor_total,
          unidade: 'UN'
        })),
        valor_produtos: pedidoExterno.valor_produtos,
        valor_frete: pedidoExterno.valor_frete,
        valor_total: pedidoExterno.valor_total,
        forma_pagamento: pedidoExterno.forma_pagamento_externa || 'Marketplace',
        observacoes_publicas: `Importado de ${pedidoExterno.origem} - Pedido #${pedidoExterno.numero_pedido_externo}`,
        ...scope
      }));

      // 3. Atualizar pedido externo
      await base44.entities.PedidoExterno.update(pedidoExterno.id, {
        status_importacao: 'Importado',
        validado: true,
        pedido_erp_id: pedidoERP.id,
        cliente_erp_id: clienteId,
        data_validacao: new Date().toISOString(),
        ...scope
      });
      await auditarMarketplace('Importar Pedido Marketplace', 'Pedido externo importado para o ERP com escopo multiempresa.', {
        pedido_externo_id: pedidoExterno.id,
        pedido_erp_id: pedidoERP.id,
        cliente_id: clienteId,
        origem: pedidoExterno.origem,
        valor_total: pedidoExterno.valor_total,
      }, pedidoExterno);

      return { pedidoERP, clienteId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos-externos-pendentes'] });
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
    },
    onError: (error) => {
      toast({
        title: 'Importacao bloqueada',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const sincronizarTodos = async () => {
    if (!contextoValido) {
      toast({
        title: 'Contexto obrigatorio',
        description: 'Selecione grupo ou empresa antes de buscar pedidos.',
        variant: 'destructive'
      });
      await auditarMarketplace('Bloqueio sem contexto', 'Tentativa de sincronizar marketplaces sem grupo ou empresa.');
      return;
    }
    if (!podeOperar) {
      toast({
        title: 'Permissao negada',
        description: 'Seu perfil nao permite sincronizar marketplaces.',
        variant: 'destructive'
      });
      await auditarMarketplace('Bloqueio por permissao', 'Tentativa de sincronizar marketplaces sem permissao.');
      return;
    }
    setSincronizando(true);

    // Simular busca de novos pedidos
    // Em produção, aqui chamaria as APIs dos marketplaces
    const novosPedidos = [
      {
        origem: 'Mercado Livre',
        id_externo: `ML-${Date.now()}`,
        numero_pedido_externo: `${Math.floor(Math.random() * 100000)}`,
        data_pedido_externo: new Date().toISOString(),
        cliente_nome: 'João Silva Marketplace',
        cliente_cpf_cnpj: '123.456.789-00',
        cliente_email: 'joao@email.com',
        cliente_telefone: '(11) 98765-4321',
        endereco_entrega: {
          cep: '01310-100',
          logradouro: 'Av Paulista',
          numero: '1000',
          bairro: 'Bela Vista',
          cidade: 'São Paulo',
          estado: 'SP'
        },
        itens: [{
          descricao: 'Viga V1 - 300cm',
          sku_externo: 'VIGA-300',
          quantidade: 10,
          preco_unitario: 150,
          valor_total: 1500
        }],
        valor_produtos: 1500,
        valor_frete: 50,
        valor_total: 1550,
        status_externo: 'payment_approved'
      }
    ];

    for (const pedido of novosPedidos) {
      await base44.entities.PedidoExterno.create({
        ...pedido,
        status_importacao: 'A Validar',
        json_completo: pedido,
        ...scope
      });
    }
    await auditarMarketplace('Sincronizar Marketplaces', 'Busca simulada de pedidos externos executada com escopo multiempresa.', { quantidade: novosPedidos.length, ...scope });

    queryClient.invalidateQueries({ queryKey: ['pedidos-externos-pendentes'] });
    setSincronizando(false);
  };

  const getOrigemBadge = (origem) => {
    const config = {
      'Mercado Livre': { cor: 'bg-yellow-100 text-yellow-700', emoji: '🛒' },
      'Shopee': { cor: 'bg-orange-100 text-orange-700', emoji: '🛍️' },
      'Amazon': { cor: 'bg-blue-100 text-blue-700', emoji: '📦' },
      'Site': { cor: 'bg-purple-100 text-purple-700', emoji: '🌐' }
    };
    const cfg = config[origem] || { cor: 'bg-slate-100 text-slate-700', emoji: '🛒' };

    return (
      <Badge className={cfg.cor}>
        {cfg.emoji} {origem}
      </Badge>
    );
  };

  const abrirPedidoExterno = async (pedidoExterno) => {
    await auditarMarketplace('Abrir Pedido Marketplace', 'Link externo de pedido marketplace aberto.', {
      pedido_externo_id: pedidoExterno.id,
      id_externo: pedidoExterno.id_externo,
      origem: pedidoExterno.origem,
    }, pedidoExterno);
    window.open(`https://marketplace.com/pedido/${pedidoExterno.id_externo}`, '_blank');
  };

  return (
    <div className="space-y-4">
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader className="bg-white/80 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              Sincronização de Marketplaces
            </CardTitle>
            <Button
              onClick={sincronizarTodos}
              disabled={sincronizando || !contextoValido || !podeOperar}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
              data-action="Integracoes.Marketplaces.sincronizar"
              data-permission="Sistema.Integracoes.editar"
              data-context-required="group-or-company"
              data-sensitive="true"
            >
              {sincronizando ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Buscar Novos Pedidos
                </>
              )}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {pedidosExternos.length > 0 ? (
        <Card>
          <CardHeader className="bg-slate-50 border-b">
            <CardTitle className="text-base">
              Pedidos Pendentes de Importação ({pedidosExternos.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Origem</TableHead>
                  <TableHead>Nº Pedido</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pedidosExternos.map((pe) => (
                  <TableRow key={pe.id}>
                    <TableCell>
                      {getOrigemBadge(pe.origem)}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {pe.numero_pedido_externo}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-semibold text-sm">{pe.cliente_nome}</p>
                        <p className="text-xs text-slate-500">{pe.cliente_cpf_cnpj}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(pe.data_pedido_externo).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="font-semibold text-green-600">
                      R$ {pe.valor_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <Badge className={
                        pe.status_importacao === 'A Validar' ? 'bg-yellow-100 text-yellow-700' :
                        pe.status_importacao === 'Importado' ? 'bg-green-100 text-green-700' :
                        'bg-blue-100 text-blue-700'
                      }>
                        {pe.status_importacao}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2 justify-center">
                        <Button
                          size="sm"
                          onClick={() => importarPedidoMutation.mutate(pe)}
                          disabled={importarPedidoMutation.isPending || !contextoValido || !podeOperar}
                          className="bg-green-600 hover:bg-green-700"
                          data-action="Integracoes.Marketplaces.importarPedido"
                          data-permission="Sistema.Integracoes.editar"
                          data-context-required="group-or-company"
                          data-sensitive="true"
                        >
                          <Download className="w-4 h-4 mr-1" />
                          Importar
                        </Button>
                        {pe.id_externo && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => abrirPedidoExterno(pe)}
                            data-action="Integracoes.Marketplaces.abrirPedidoExterno"
                            data-permission="Sistema.Integracoes.visualizar"
                            data-context-required="group-or-company"
                            data-sensitive="true"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Alert className="border-green-300 bg-green-50">
          <CheckCircle2 className="w-5 h-5 text-green-600" />
          <AlertDescription>
            <p className="font-semibold text-green-900">
              ✅ Nenhum pedido pendente de importação
            </p>
            <p className="text-sm text-green-700 mt-1">
              Todos os pedidos externos foram processados
            </p>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
