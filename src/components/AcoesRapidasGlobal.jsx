import React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, ShoppingCart, Users, Package, DollarSign, FileText, Truck, Calendar, Target, Factory, Building2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useWindow } from '@/components/lib/useWindow';
import { Badge } from '@/components/ui/badge';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import usePermissions from '@/components/lib/usePermissions';
import ModuleMap from '@/components/lib/ModuleMap';
import CadastroClienteCompleto from '@/components/cadastros/CadastroClienteCompleto';
import CadastroFornecedorCompleto from '@/components/cadastros/CadastroFornecedorCompleto';
import ProdutoFormV22_Completo from '@/components/cadastros/ProdutoFormV22_Completo';
import TabelaPrecoFormCompleto from '@/components/cadastros/TabelaPrecoFormCompleto';
import PedidoFormCompleto from '@/components/comercial/PedidoFormCompleto';
import ContaReceberForm from '@/components/financeiro/ContaReceberForm';
import ContaPagarForm from '@/components/financeiro/ContaPagarForm';
import FormularioEntrega from '@/components/expedicao/FormularioEntrega';
import OportunidadeForm from '@/components/crm/OportunidadeForm';
import EventoForm from '@/components/agenda/EventoForm';
import { toast } from 'sonner';

/**
 * Ações Rápidas Globais - Botão + Novo
 * Acesso rápido às ações mais comuns do sistema
 * V21.7: Integrado com Sistema de Janelas Multitarefa + Contexto Multiempresa
 */
export default function AcoesRapidasGlobal() {
  const navigate = useNavigate();
  const { openWindow } = useWindow();
  const { empresaAtual, estaNoGrupo, createInContext } = useContextoVisual();

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes'],
    queryFn: () => base44.entities.Cliente.list(),
  });

  const { hasPermission, isLoading: loadingPerms, user } = usePermissions();

  const actionHandlers = {
    novoPedido: () => openWindow(
      PedidoFormCompleto,
      {
        clientes,
        windowMode: true,
        onSubmit: async (formData) => {
          try {
            await createInContext('Pedido', formData);
            toast.success('✅ Pedido criado com sucesso!');
          } catch (error) {
            toast.error('Erro ao salvar pedido');
          }
        },
        onCancel: () => {}
      },
      { title: '🛒 Novo Pedido', width: 1400, height: 800 }
    ),
    novoCliente: () => openWindow(CadastroClienteCompleto, { windowMode: true }, { title: '🧑 Novo Cliente', width: 1100, height: 650 }),
    novoProduto: () => openWindow(ProdutoFormV22_Completo, { windowMode: true }, { title: '📦 Novo Produto', width: 1200, height: 700 }),
    novoFornecedor: () => openWindow(CadastroFornecedorCompleto, { windowMode: true }, { title: '🏢 Novo Fornecedor', width: 1100, height: 650 }),
    novaTabelaPreco: () => openWindow(TabelaPrecoFormCompleto, { windowMode: true }, { title: '💰 Nova Tabela', width: 1200, height: 700 }),
    novaContaReceber: () => openWindow(ContaReceberForm, {
      windowMode: true,
      onSubmit: async (data) => {
        try {
          await createInContext('ContaReceber', data);
          toast.success('✅ Conta criada!');
        } catch (error) {
          toast.error('Erro ao criar conta');
        }
      }
    }, { title: '💰 Nova Conta a Receber', width: 900, height: 600 }),
    novaContaPagar: () => openWindow(ContaPagarForm, {
      windowMode: true,
      onSubmit: async (data) => {
        try {
          await createInContext('ContaPagar', data);
          toast.success('✅ Conta criada!');
        } catch (error) {
          toast.error('Erro ao criar conta');
        }
      }
    }, { title: '💸 Nova Conta a Pagar', width: 900, height: 600 }),
    novaOportunidade: () => openWindow(OportunidadeForm, {
      windowMode: true,
      onSubmit: async (data) => {
        try {
          await createInContext('Oportunidade', { ...data, quantidade_interacoes: 0, dias_sem_contato: 0 });
          toast.success('✅ Oportunidade criada!');
        } catch (error) {
          toast.error('Erro ao criar oportunidade');
        }
      }
    }, { title: '🎯 Nova Oportunidade', width: 1000, height: 650 }),
    novoEvento: () => openWindow(EventoForm, {
      windowMode: true,
      onSubmit: async (data) => {
        try {
          const dataInicio = `${data.data_inicio}T${data.hora_inicio || '00:00'}:00`;
          const dataFim = `${data.data_fim}T${data.hora_fim || '23:59'}:00`;
          const me = await base44.auth.me();
          await createInContext('Evento', {
            ...data,
            data_inicio: dataInicio,
            data_fim: dataFim,
            responsavel: me?.full_name || 'Usuário',
            responsavel_id: me?.id
          });
          toast.success('✅ Evento criado!');
        } catch (error) {
          toast.error('Erro ao criar evento');
        }
      }
    }, { title: '📅 Novo Evento', width: 1000, height: 650 }),
    novaNFe: () => navigate(createPageUrl('Fiscal') + '?action=nova-nfe'),
  };

  const colorMap = {
    novoPedido: 'text-blue-600',
    novoCliente: 'text-green-600',
    novoProduto: 'text-purple-600',
    novoFornecedor: 'text-cyan-600',
    novaTabelaPreco: 'text-emerald-600',
    novaContaReceber: 'text-green-600',
    novaContaPagar: 'text-red-600',
    novaOportunidade: 'text-purple-600',
    novoEvento: 'text-blue-600',
    novaNFe: 'text-indigo-600',
  };

  const acoes = ModuleMap.quickActions
    .filter((qa) => {
      if (loadingPerms || !user) return false;
      try {
        return hasPermission(qa.module || qa.modulo || '', null, qa.perm || 'criar');
      } catch {
        return false;
      }
    })
    .map((qa) => ({
      label: qa.label,
      icon: qa.icon,
      action: actionHandlers[qa.key],
      cor: colorMap[qa.key] || 'text-slate-600',
    }));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="bg-blue-600 hover:bg-blue-700 shadow-md">
          <Plus className="w-4 h-4 mr-2" />
          Novo
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Ações Rápidas</span>
          {empresaAtual && (
            <Badge variant="outline" className="text-xs">
              <Building2 className="w-3 h-3 mr-1" />
              {estaNoGrupo ? 'Grupo' : empresaAtual.nome_fantasia?.substring(0, 10) || 'Empresa'}
            </Badge>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {acoes.map((acao, idx) => {
          const Icon = acao.icon;
          return (
            <DropdownMenuItem
              key={idx}
              onClick={acao.action}
              className="cursor-pointer"
            >
              <Icon className={`w-4 h-4 mr-2 ${acao.cor}`} />
              <span>{acao.label}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}