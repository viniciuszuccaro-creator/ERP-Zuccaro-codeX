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
import { Plus, Building2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useQuery } from '@tanstack/react-query';
import { isHttpBackendMode } from '@/api/base44Client';
import { readErpHttpSession } from '@/api/erpHttpSession';
import { central360SessionKey } from '@/api/httpApiClient';
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
import OportunidadeForm from '@/components/crm/OportunidadeForm';
import EventoForm from '@/components/agenda/EventoForm';
import { toast } from 'sonner';
import {
  resolveAcoesRapidasClientesKpiState,
  isAcoesRapidasScopeCurrent,
  buildAcoesRapidasClientesQueryKey,
  resolveClientesParaNovoPedido,
} from './acoesRapidasScope';

/**
 * Identidade de cache: HTTP usa sessão ERP; legado/remoto usa user.id (sem limpar token Base44).
 */
export function readAcoesRapidasActorAndSession(user) {
  if (isHttpBackendMode) {
    const session = readErpHttpSession();
    const actorId = (typeof session?.actorId === 'string' && session.actorId.trim())
      || (typeof user?.id === 'string' && user.id.trim())
      || null;
    return {
      actorId,
      sessionKey: central360SessionKey(session?.token),
    };
  }
  const actorId = typeof user?.id === 'string' && user.id.trim() ? user.id.trim() : null;
  return {
    actorId,
    sessionKey: actorId ? `legacy-actor:${actorId}` : null,
  };
}

/**
 * Ações Rápidas Globais — Cliente via filterInContext; cache multi-ator; novoPedido fail-closed.
 */
export default function AcoesRapidasGlobal() {
  const navigate = useNavigate();
  const { openWindow } = useWindow();
  const { empresaAtual, grupoAtual, estaNoGrupo, createInContext, filterInContext } = useContextoVisual();
  const { hasPermission, isLoading: loadingPerms, user } = usePermissions();

  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const contextoValido = Boolean(groupId || empresaId);
  const { actorId, sessionKey } = readAcoesRapidasActorAndSession(user);
  const scopeExpected = { actorId, sessionKey, groupId, empresaId };

  const clientesQuery = useQuery({
    queryKey: buildAcoesRapidasClientesQueryKey({ groupId, empresaId, actorId, sessionKey }),
    queryFn: async ({ signal }) => {
      const rows = await filterInContext('Cliente', {}, '-created_date', 500);
      if (signal?.aborted) {
        const err = new Error('ACOES_RAPIDAS_ABORTED');
        err.name = 'AbortError';
        throw err;
      }
      const live = {
        ...readAcoesRapidasActorAndSession(user),
        groupId: grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null,
        empresaId: empresaAtual?.id || null,
      };
      if (!isAcoesRapidasScopeCurrent(scopeExpected, live)) {
        throw new Error('ACOES_RAPIDAS_STALE_SCOPE');
      }
      return Array.isArray(rows) ? rows : [];
    },
    enabled: contextoValido && Boolean(actorId),
  });

  const kpiState = resolveAcoesRapidasClientesKpiState({
    contextoValido: contextoValido && Boolean(actorId),
    isLoading: clientesQuery.isLoading,
    isError: clientesQuery.isError,
    isFetching: clientesQuery.isFetching,
    dataDefined: clientesQuery.data !== undefined,
  });
  const clientesReady = kpiState === 'ready' && Array.isArray(clientesQuery.data)
    ? clientesQuery.data
    : null;

  const requireContexto = (label, fn) => () => {
    if (!contextoValido) {
      toast.error(`Selecione grupo ou empresa para ${label}.`);
      return;
    }
    fn();
  };

  const actionHandlers = {
    novoPedido: requireContexto('criar pedido', () => {
      const live = {
        ...readAcoesRapidasActorAndSession(user),
        groupId: grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null,
        empresaId: empresaAtual?.id || null,
      };
      const clientes = resolveClientesParaNovoPedido({
        kpiState,
        clientes: clientesReady,
        scopeExpected,
        scopeLive: live,
      });
      if (!clientes) {
        toast.error(
          kpiState === 'loading'
            ? 'Aguarde o carregamento dos clientes antes de criar pedido.'
            : kpiState === 'error'
              ? 'Clientes indisponíveis (erro de carga ≠ zero).'
              : 'Contexto ou sessão inválidos para criar pedido.',
        );
        return;
      }
      openWindow(
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
      );
    }),
    novoCliente: requireContexto('criar cliente', () => openWindow(
      CadastroClienteCompleto,
      { windowMode: true },
      { title: '🧑 Novo Cliente', width: 1100, height: 650 },
    )),
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
          await createInContext('Evento', {
            ...data,
            data_inicio: dataInicio,
            data_fim: dataFim,
            responsavel: user?.full_name || 'Usuário',
            responsavel_id: user?.id
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
      // Fail-closed: sem usuário/perms carregados não libera criação.
      if (loadingPerms || !user) return false;
      try {
        return hasPermission(qa.module || qa.modulo || '', null, qa.perm || 'criar');
      } catch {
        return false;
      }
    })
    .map((qa) => ({
      key: qa.key,
      label: qa.label,
      icon: qa.icon,
      action: actionHandlers[qa.key],
      cor: colorMap[qa.key] || 'text-slate-600',
    }))
    .filter((acao) => typeof acao.action === 'function');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className="bg-blue-600 hover:bg-blue-700 shadow-md"
          data-action="acoes-rapidas-novo"
          data-context-required="group-or-company"
        >
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
        {(kpiState === 'error' || kpiState === 'loading') && (
          <p className="px-2 py-1 text-xs text-slate-500">
            {kpiState === 'loading'
              ? 'Carregando clientes…'
              : 'Clientes indisponíveis (erro de carga ≠ zero).'}
          </p>
        )}
        <DropdownMenuSeparator />
        {acoes.map((acao) => {
          const Icon = acao.icon;
          return (
            <DropdownMenuItem
              key={acao.key}
              onClick={acao.action}
              className="cursor-pointer"
              data-action={acao.key}
              data-context-required="group-or-company"
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
