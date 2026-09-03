import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useUser } from '@/components/lib/UserContext';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import usePermissions from '@/components/lib/usePermissions';
import { createMarketplaceSimulationOrders } from './marketplaceSimulationData';
import MarketplacePendingOrders from './MarketplacePendingOrders';

/**
 * Sincronização ATIVA de Marketplaces
 * Importação automática de pedidos do Mercado Livre, Shopee, Amazon, etc.
 */
export default function SincronizacaoMarketplacesAtiva() {
  const [sincronizando, setSincronizando] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useUser();
  const { empresaAtual, grupoAtual, filterInContext, createInContext, updateInContext } = useContextoVisual();
  const { isAdmin, hasPermission } = usePermissions();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || user?.grupo_atual_id || user?.grupo_padrao_id || null;
  const empresaId = empresaAtual?.id || null;
  const contextoValido = Boolean(groupId && empresaId);
  const admin = isAdmin();
  const podeVisualizar = admin || hasPermission("Sistema", "Integracoes", "visualizar") || hasPermission("Sistema", "Integrações", "visualizar");
  const podeSincronizar = admin || hasPermission("Sistema", "Integracoes", "executar") || hasPermission("Sistema", "Integrações", "executar");
  const podeCriar = admin || hasPermission("Sistema", "Integracoes", "criar") || hasPermission("Sistema", "Integrações", "criar");
  const podeEditar = admin || hasPermission("Sistema", "Integracoes", "editar") || hasPermission("Sistema", "Integrações", "editar");
  const podeImportar = podeCriar && podeEditar;
  const scope = {
    ...(groupId ? { group_id: groupId } : {}),
    ...(empresaId ? { empresa_id: empresaId } : {}),
  };

  const auditarMarketplace = async (acao, descricao, dadosNovos = null, dadosAnteriores = null) => {
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
        sucesso: !/^(Bloqueio|Erro)/.test(acao),
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
    enabled: contextoValido && podeVisualizar,
    refetchInterval: 30000 // Atualiza a cada 30s
  });

  const importarPedidoMutation = useMutation({
    mutationFn: async (pedidoExterno) => {
      if (!contextoValido) {
        await auditarMarketplace('Bloqueio sem contexto', 'Tentativa de importar pedido externo sem grupo ou empresa.', { pedido_externo_id: pedidoExterno?.id });
        throw new Error('Selecione grupo ou empresa antes de importar pedidos.');
      }
      if (!podeImportar) {
        await auditarMarketplace('Bloqueio por permissao', 'Tentativa de importar pedido externo sem permissao.', { pedido_externo_id: pedidoExterno?.id });
        throw new Error('Seu perfil nao permite importar pedidos externos.');
      }
      const pedidoNoEscopo = pedidoExterno?.group_id === groupId && pedidoExterno?.empresa_id === empresaId;
      if (!pedidoNoEscopo || !['A Validar', 'Em Revisão'].includes(pedidoExterno?.status_importacao) || pedidoExterno?.pedido_erp_id) {
        await auditarMarketplace('Bloqueio pedido invalido', 'Pedido externo rejeitado por escopo ou estado invalido.', {
          pedido_externo_id: pedidoExterno?.id || null,
          pertence_ao_escopo: pedidoNoEscopo,
          estado_importavel: ['A Validar', 'Em Revisão'].includes(pedidoExterno?.status_importacao),
        });
        throw new Error('Pedido externo invalido');
      }
      const documento = String(pedidoExterno.cliente_cpf_cnpj || '').replace(/\D/g, '');
      if (![11, 14].includes(documento.length) || !Array.isArray(pedidoExterno.itens) || pedidoExterno.itens.length === 0) {
        await auditarMarketplace('Bloqueio dados invalidos', 'Pedido externo rejeitado por dados obrigatorios invalidos.', {
          pedido_externo_id: pedidoExterno.id,
          documento_valido: [11, 14].includes(documento.length),
          possui_itens: Array.isArray(pedidoExterno.itens) && pedidoExterno.itens.length > 0,
        });
        throw new Error('Dados obrigatorios invalidos');
      }
      const pedidosExistentes = await filterInContext('Pedido', { origem_externa_id: pedidoExterno.id_externo }, '-updated_date', 1);
      if (pedidosExistentes.length > 0) {
        await auditarMarketplace('Bloqueio pedido duplicado', 'Importacao bloqueada para pedido externo ja existente.', { pedido_externo_id: pedidoExterno.id });
        throw new Error('Pedido ja importado');
      }

      // 1. Verificar se cliente existe
      let clienteId = pedidoExterno.cliente_erp_id;
      let clienteCriado = false;

      if (clienteId) {
        const clienteVinculado = await filterInContext('Cliente', { id: clienteId }, '-updated_date', 1);
        if (!clienteVinculado.length) {
          await auditarMarketplace('Bloqueio cliente fora do escopo', 'Cliente vinculado ao pedido externo nao pertence ao contexto.', { pedido_externo_id: pedidoExterno.id });
          throw new Error('Cliente fora do escopo');
        }
      } else {
        const clientesExistentes = await filterInContext('Cliente', {
          [documento.length === 11 ? 'cpf' : 'cnpj']: documento
        }, '-updated_date', 20);

        if (clientesExistentes.length > 0) {
          clienteId = clientesExistentes[0].id;
        } else {
          // Criar cliente novo
          const novoCliente = await createInContext('Cliente', {
            tipo: documento.length === 11 ? 'Pessoa Física' : 'Pessoa Jurídica',
            status: 'Ativo',
            nome: pedidoExterno.cliente_nome,
            razao_social: pedidoExterno.cliente_nome,
            nome_fantasia: pedidoExterno.cliente_nome,
            cpf: documento.length === 11 ? documento : undefined,
            cnpj: documento.length === 14 ? documento : undefined,
            email: pedidoExterno.cliente_email,
            endereco_principal: pedidoExterno.endereco_entrega,
            contatos: [{
              tipo: 'Telefone',
              valor: pedidoExterno.cliente_telefone,
              principal: true
            }],
            origem_pedido: pedidoExterno.origem,
            ...scope
          });
          clienteId = novoCliente.id;
          clienteCriado = true;
        }
      }

      // 2. Criar pedido no ERP
      const pedidoERP = await createInContext('Pedido', {
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
      });

      // 3. Atualizar pedido externo
      await updateInContext('PedidoExterno', pedidoExterno.id, {
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
        origem: pedidoExterno.origem,
        cliente_criado: clienteCriado,
        itens_importados: pedidoExterno.itens.length,
      }, {
        status_importacao: pedidoExterno.status_importacao,
        ja_possuia_cliente: Boolean(pedidoExterno.cliente_erp_id),
      });

      return { pedidoERP, clienteId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos-externos-pendentes'] });
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
    },
    onError: async (error) => {
      console.warn('Falha ao importar pedido marketplace:', error);
      await auditarMarketplace('Erro Importar Pedido Marketplace', 'Falha ao importar pedido externo.', {
        tipo_erro: 'import_error',
      });
      toast({
        title: 'Importacao bloqueada',
        description: 'Nao foi possivel importar o pedido neste contexto.',
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
    if (!podeSincronizar) {
      toast({
        title: 'Permissao negada',
        description: 'Seu perfil nao permite sincronizar marketplaces.',
        variant: 'destructive'
      });
      await auditarMarketplace('Bloqueio por permissao', 'Tentativa de sincronizar marketplaces sem permissao.');
      return;
    }
    setSincronizando(true);

    try {
      // Em producao, este retorno sera substituido pelas APIs dos marketplaces.
      const novosPedidos = createMarketplaceSimulationOrders();

      for (const pedido of novosPedidos) {
        await createInContext('PedidoExterno', {
          ...pedido,
          status_importacao: 'A Validar',
          ...scope
        });
      }
      await auditarMarketplace('Sincronizar Marketplaces', 'Busca simulada de pedidos externos executada com escopo multiempresa.', { quantidade: novosPedidos.length });

      queryClient.invalidateQueries({ queryKey: ['pedidos-externos-pendentes'] });
    } catch (error) {
      console.warn('Falha ao sincronizar marketplaces:', error);
      await auditarMarketplace('Erro Sincronizar Marketplaces', 'Falha na busca de pedidos externos.', { tipo_erro: 'unexpected_error' });
      toast({ title: 'Erro na sincronizacao', description: 'Nao foi possivel buscar novos pedidos.', variant: 'destructive' });
    } finally {
      setSincronizando(false);
    }
  };

  const abrirPedidoExterno = async (pedidoExterno) => {
    const pedidoNoEscopo = pedidoExterno?.group_id === groupId && pedidoExterno?.empresa_id === empresaId;
    if (!contextoValido || !podeVisualizar || !pedidoNoEscopo || !pedidoExterno?.id_externo) {
      await auditarMarketplace('Bloqueio link externo', 'Abertura de pedido marketplace bloqueada.', {
        pedido_externo_id: pedidoExterno?.id || null,
        pertence_ao_escopo: pedidoNoEscopo,
      });
      return;
    }
    await auditarMarketplace('Abrir Pedido Marketplace', 'Link externo de pedido marketplace aberto.', {
      pedido_externo_id: pedidoExterno.id,
      origem: pedidoExterno.origem,
    });
    const novaJanela = window.open(
      `https://marketplace.com/pedido/${encodeURIComponent(String(pedidoExterno.id_externo))}`,
      '_blank',
      'noopener,noreferrer'
    );
    if (novaJanela) novaJanela.opener = null;
  };

  return (
    <div className="w-full h-full space-y-4">
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader className="bg-white/80 border-b">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">
              Sincronização de Marketplaces
            </CardTitle>
            <Button
              onClick={sincronizarTodos}
              disabled={sincronizando || !contextoValido || !podeSincronizar}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
              data-action="Integracoes.Marketplaces.sincronizar"
              data-permission="Sistema.Integracoes.executar"
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

      <MarketplacePendingOrders
        contextValid={contextoValido}
        canImport={podeImportar}
        canView={podeVisualizar}
        importMutation={importarPedidoMutation}
        onOpen={abrirPedidoExterno}
        orders={pedidosExternos}
      />
    </div>
  );
}
