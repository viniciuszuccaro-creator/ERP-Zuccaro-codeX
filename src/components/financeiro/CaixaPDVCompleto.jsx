import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Wallet, ShoppingCart, CheckCircle2, Trash2, Plus, Truck, Store } from "lucide-react";
import { useFormasPagamento } from "@/components/lib/useFormasPagamento";
import useContextoVisual from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";

export default function CaixaPDVCompleto({ empresaAtual: empresaProp, windowMode = false }) {
  const [abaAtiva, setAbaAtiva] = useState("venda");
  const [carrinho, setCarrinho] = useState([]);
  const [clienteSelecionado, setClienteSelecionado] = useState(null);
  const [formasPagamentoVenda, setFormasPagamentoVenda] = useState([{ forma_id: null, forma_descricao: "Selecione", valor: 0, parcelas: 1 }]);
  const [desconto, setDesconto] = useState(0);
  const [tipoDesconto, setTipoDesconto] = useState("valor");
  const [acrescimo, setAcrescimo] = useState(0);
  const [tipoAcrescimo, setTipoAcrescimo] = useState("valor");
  const [emitirNFe, setEmitirNFe] = useState(false);
  const [emitirRecibo, setEmitirRecibo] = useState(true);
  const [emitirBoleto, setEmitirBoleto] = useState(false);
  const [tipoEntrega, setTipoEntrega] = useState("Retirada"); // "Retirada" ou "Entrega"
  const [enderecoEntrega, setEnderecoEntrega] = useState("");
  const [buscaProduto, setBuscaProduto] = useState("");
  const [buscaCliente, setBuscaCliente] = useState("");
  const [caixaAberto, setCaixaAberto] = useState(false);
  const [saldoInicial, setSaldoInicial] = useState(0);
  
  const queryClient = useQueryClient();
  const {
    empresaAtual: empresaContexto,
    grupoAtual,
    filterInContext,
    createInContext,
    updateInContext
  } = useContextoVisual();
  const { canCreate, canEdit, hasPermission } = usePermissions();
  const empresaAtual = empresaProp || empresaContexto;
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const contextKey = empresaAtual?.id || groupId || "sem-contexto";
  const contextoValido = contextKey !== "sem-contexto";
  const podeOperarCaixa = canCreate('Financeiro', 'Caixa') ||
    canEdit('Financeiro', 'Caixa') ||
    hasPermission('Financeiro', 'PDV', 'criar') ||
    hasPermission('Financeiro', 'Caixa Central', 'editar');
  const podeLiquidarTitulos = canEdit('Financeiro', 'Contas a Receber') ||
    canEdit('Financeiro', 'Contas a Pagar') ||
    hasPermission('Financeiro', null, 'baixar');
  const controlesDesabilitados = !contextoValido || !podeOperarCaixa;
  const empresaId = empresaAtual?.id || null;
  const podeCriarEntregaPDV = hasPermission('Expedicao', 'Entrega', 'criar') || hasPermission('Expedicao', 'Entregas', 'criar') || hasPermission('Expedição', 'Entregas', 'criar');
  const podeEmitirNFePDV = hasPermission('Fiscal', 'Notas Fiscais', 'emitir') || hasPermission('Fiscal', 'Notas Fiscais', 'criar') || hasPermission('Fiscal', null, 'emitir');
  const podeCriarReceberPDV = canCreate('Financeiro', 'Contas a Receber') || hasPermission('Financeiro', 'Contas a Receber', 'criar') || hasPermission('Financeiro', null, 'criar');
  const nfeBloqueada = emitirNFe && (!empresaId || !podeEmitirNFePDV || !clienteSelecionado);
  const entregaBloqueada = tipoEntrega === 'Entrega' && (!empresaId || !clienteSelecionado || !podeCriarEntregaPDV);
  const financeiroBloqueado = (emitirBoleto || formasPagamentoVenda.some(f => f.forma_descricao !== 'Dinheiro')) && !podeCriarReceberPDV;
  
  // Hook centralizado de formas de pagamento
  const { formasPagamento, obterFormasPorContexto, obterConfiguracao, isLoading: loadingFormas } = useFormasPagamento({ empresa_id: empresaAtual?.id });
  const formasPDV = obterFormasPorContexto('pdv');

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me(),
  });

  const { data: produtos = [] } = useQuery({
    queryKey: ['produtos', contextKey],
    queryFn: () => filterInContext('Produto', {}, 'descricao', 200),
    enabled: contextoValido,
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes', contextKey],
    queryFn: () => filterInContext('Cliente', {}, 'nome', 200),
    enabled: contextoValido,
  });

  const { data: contasReceber = [] } = useQuery({
    queryKey: ['contasReceber', contextKey],
    queryFn: () => filterInContext('ContaReceber', {}, 'data_vencimento', 200),
    enabled: contextoValido,
  });

  const { data: contasPagar = [] } = useQuery({
    queryKey: ['contasPagar', contextKey],
    queryFn: () => filterInContext('ContaPagar', {}, 'data_vencimento', 200),
    enabled: contextoValido,
  });

  const { data: pedidos = [] } = useQuery({
    queryKey: ['pedidos', contextKey],
    queryFn: () => filterInContext('Pedido', {}, '-data_pedido', 200),
    enabled: contextoValido,
  });

  const { data: movimentos = [] } = useQuery({
    queryKey: ['movimentos-caixa', contextKey],
    queryFn: () => filterInContext('CaixaMovimento', {}, '-data_movimento', 200),
    enabled: caixaAberto && contextoValido,
    refetchInterval: 10000
  });

  const hoje = new Date().toISOString().split('T')[0];
  const movimentosHoje = movimentos.filter(m => {
    const data = new Date(m.data_movimento).toISOString().split('T')[0];
    return data === hoje && !m.cancelado;
  });

  const totalEntradasDinheiro = movimentosHoje
    .filter(m => m.tipo_movimento === 'Entrada' && m.forma_pagamento === 'Dinheiro')
    .reduce((s, m) => s + (m.valor || 0), 0);
  const totalSaidasDinheiro = movimentosHoje
    .filter(m => m.tipo_movimento === 'Saída' && m.forma_pagamento === 'Dinheiro')
    .reduce((s, m) => s + (m.valor || 0), 0);
  const saldoAtual = saldoInicial + totalEntradasDinheiro - totalSaidasDinheiro;

  const somatoriaFormasPagamento = movimentosHoje.reduce((acc, m) => {
    const forma = m.forma_pagamento || 'Outros';
    if (!acc[forma]) acc[forma] = { entradas: 0, saidas: 0, total: 0 };
    if (m.tipo_movimento === 'Entrada') {
      acc[forma].entradas += m.valor || 0;
      acc[forma].total += m.valor || 0;
    } else if (m.tipo_movimento === 'Saída') {
      acc[forma].saidas += m.valor || 0;
      acc[forma].total -= m.valor || 0;
    }
    return acc;
  }, {});

  const totalPago = formasPagamentoVenda.reduce((s, f) => s + (f.valor || 0), 0);

  const produtosFiltrados = produtos.filter(p =>
    p.descricao?.toLowerCase().includes(buscaProduto.toLowerCase())
  ).slice(0, 30);

  const clientesFiltrados = clientes.filter(c =>
    c.nome?.toLowerCase().includes(buscaCliente.toLowerCase())
  ).slice(0, 5);

  const contasReceberPendentes = contasReceber.filter(c => c.status === 'Pendente');
  const contasPagarPendentes = contasPagar.filter(c => c.status === 'Pendente');
  const pedidosReceber = pedidos.filter(p => p.status === 'Aprovado' || p.status === 'Pronto para Faturar');

  const subtotal = carrinho.reduce((s, i) => s + (i.preco_venda * i.quantidade), 0);
  const valorDesconto = tipoDesconto === 'percentual' ? (subtotal * desconto / 100) : desconto;
  const valorAcrescimo = tipoAcrescimo === 'percentual' ? (subtotal * acrescimo / 100) : acrescimo;
  const totalVenda = subtotal - valorDesconto + valorAcrescimo;
  const troco = totalPago - totalVenda;

  const sanitizePDVText = (value) => String(value || '').replace(/[<>]/g, '').replace(/javascript:/gi, '').trim();
  const auditCaixaAction = async (acao, detalhes = {}, sucesso = true) => {
    try {
      await base44.entities.AuditLog.create({
        usuario_id: user?.id || null,
        usuario: user?.full_name || user?.email || 'Usuario',
        acao,
        modulo: 'Financeiro',
        tipo_auditoria: sucesso ? 'operacional' : 'seguranca',
        entidade: detalhes.entidade || 'CaixaMovimento',
        descricao: detalhes.descricao || acao,
        empresa_id: empresaId,
        group_id: groupId,
        grupo_id: groupId,
        sucesso,
        detalhes: { origem: 'CaixaPDVCompleto', contexto: empresaId ? 'empresa' : 'grupo', ...detalhes },
        data_hora: new Date().toISOString(),
      });
    } catch (error) {
      console.warn('Falha ao auditar Caixa PDV:', error);
    }
  };

  const abrirCaixa = useMutation({
    mutationFn: async (saldo) => {
      if (controlesDesabilitados) throw new Error("Sem contexto ou permissÃ£o para abrir caixa.");
      await createInContext('CaixaMovimento', {
        ...(empresaAtual?.id ? { empresa_id: empresaAtual.id } : {}),
        ...(groupId ? { group_id: groupId, grupo_id: groupId } : {}),
        data_movimento: new Date().toISOString(),
        tipo_movimento: 'Abertura',
        origem: 'Abertura Caixa',
        forma_pagamento: 'Dinheiro',
        valor: saldo,
        descricao: 'Abertura de Caixa',
        usuario_operador_nome: user?.full_name,
        caixa_aberto: true
      });
    },
    onSuccess: () => {
      setCaixaAberto(true);
      queryClient.invalidateQueries({ queryKey: ['movimentos-caixa'] });
      toast.success("✅ Caixa aberto com sucesso!");
    }
  });

  const finalizarVenda = useMutation({
    mutationFn: async () => {
      if (controlesDesabilitados) {
        await auditCaixaAction('pdv_venda_bloqueada', { motivo: 'contexto_ou_permissao', entidade: 'Pedido' }, false);
        throw new Error("Sem contexto ou permissao para finalizar venda.");
      }
      if (!window.confirm(`Confirmar finalizacao da venda no valor de R$ ${totalVenda.toFixed(2)}?`)) {
        await auditCaixaAction('pdv_venda_cancelada', { motivo: 'confirmacao_cancelada', entidade: 'Pedido', valor_total: totalVenda }, false);
        throw new Error("Venda cancelada pelo usuario.");
      }
      if (entregaBloqueada) {
        await auditCaixaAction('pdv_entrega_bloqueada', { motivo: 'empresa_cliente_ou_permissao', entidade: 'Entrega', cliente_id: clienteSelecionado?.id || null }, false);
        throw new Error("Entrega pelo PDV exige empresa, cliente e permissao de expedicao.");
      }
      if (nfeBloqueada) {
        await auditCaixaAction('pdv_nfe_bloqueada', { motivo: 'empresa_cliente_ou_permissao', entidade: 'NotaFiscal', cliente_id: clienteSelecionado?.id || null }, false);
        throw new Error("NF-e pelo PDV exige empresa faturadora, cliente e permissao fiscal.");
      }
      if (financeiroBloqueado) {
        await auditCaixaAction('pdv_financeiro_bloqueado', { motivo: 'permissao_contas_receber', entidade: 'ContaReceber' }, false);
        throw new Error("Sem permissao para gerar conta a receber pelo PDV.");
      }
      const pedido = await createInContext('Pedido', {
        ...(empresaAtual?.id ? { empresa_id: empresaAtual.id } : {}),
        ...(groupId ? { group_id: groupId, grupo_id: groupId } : {}),
        numero_pedido: `PDV-${Date.now()}`,
        forma_pagamento: formasPagamentoVenda.map(f => f.forma_descricao).join(', '),
        tipo: 'Pedido',
        tipo_frete: tipoEntrega === "Retirada" ? "Retirada" : "CIF",
        origem_pedido: 'PDV Presencial',
        data_pedido: hoje,
        cliente_nome: sanitizePDVText(clienteSelecionado?.nome || 'Cliente Avulso'),
        cliente_id: clienteSelecionado?.id,
        vendedor: user?.full_name,
        itens_revenda: carrinho.map(item => ({
          produto_id: item.id,
          produto_descricao: item.descricao,
          quantidade: item.quantidade,
          valor_unitario: item.preco_venda,
          valor_total: item.preco_venda * item.quantidade
        })),
        valor_produtos: subtotal,
        desconto_geral_pedido_valor: valorDesconto,
        valor_total: totalVenda,
        status: 'Faturado',
        observacoes_publicas: `${tipoEntrega === "Retirada" ? "🏪 RETIRADA NO LOCAL" : "🚚 ENTREGA"}${valorAcrescimo > 0 ? ` | Acréscimo: R$ ${valorAcrescimo.toFixed(2)}` : ''}`
      });

      // Se for entrega, criar registro na entidade Entrega
      if (tipoEntrega === "Entrega" && clienteSelecionado) {
        const enderecoCliente = clienteSelecionado.endereco_principal || {};
        await createInContext('Entrega', {
          ...(empresaAtual?.id ? { empresa_id: empresaAtual.id } : {}),
          ...(groupId ? { group_id: groupId, grupo_id: groupId } : {}),
          pedido_id: pedido.id,
          numero_pedido: pedido.numero_pedido,
          cliente_id: clienteSelecionado.id,
          cliente_nome: sanitizePDVText(clienteSelecionado.nome),
          endereco_entrega_completo: {
            logradouro: sanitizePDVText(enderecoCliente.logradouro || enderecoEntrega),
            numero: sanitizePDVText(enderecoCliente.numero || ""),
            complemento: sanitizePDVText(enderecoCliente.complemento || ""),
            bairro: sanitizePDVText(enderecoCliente.bairro || ""),
            cidade: sanitizePDVText(enderecoCliente.cidade || ""),
            estado: sanitizePDVText(enderecoCliente.estado || ""),
            cep: sanitizePDVText(enderecoCliente.cep || "")
          },
          data_previsao: hoje,
          status: "Aguardando Separação",
          tipo_frete: "CIF",
          valor_mercadoria: totalVenda,
          observacoes: `Criado pelo PDV - Venda: ${pedido.numero_pedido}`
        });
      }

      let contaReceber = null;
      if (emitirBoleto || formasPagamentoVenda.some(f => f.forma_descricao !== 'Dinheiro')) {
        contaReceber = await createInContext('ContaReceber', {
          ...(empresaAtual?.id ? { empresa_id: empresaAtual.id } : {}),
          ...(groupId ? { group_id: groupId, grupo_id: groupId } : {}),
          descricao: `Venda PDV ${pedido.numero_pedido}`,
          cliente: sanitizePDVText(clienteSelecionado?.nome || 'Cliente Avulso'),
          cliente_id: clienteSelecionado?.id,
          pedido_id: pedido.id,
          valor: totalVenda,
          data_emissao: hoje,
          data_vencimento: hoje,
          status: emitirBoleto ? 'Pendente' : 'Recebido',
          forma_recebimento: formasPagamentoVenda.map(f => f.forma_descricao).join(', '),
          origem_tipo: 'pedido'
        });
      }

      if (emitirNFe && clienteSelecionado) {
        await createInContext('NotaFiscal', {
          ...(groupId ? { group_id: groupId, grupo_id: groupId } : {}),
          empresa_faturamento_id: empresaId,
          numero: `${Date.now()}`,
          serie: '1',
          tipo: 'NF-e (Saída)',
          cliente_fornecedor: sanitizePDVText(clienteSelecionado.nome),
          cliente_fornecedor_id: clienteSelecionado.id,
          pedido_id: pedido.id,
          data_emissao: hoje,
          valor_produtos: subtotal,
          valor_total: totalVenda,
          status: 'Rascunho'
        });
      }

      for (const fp of formasPagamentoVenda) {
        if (fp.valor > 0 && fp.forma_id) {
          await createInContext('CaixaMovimento', {
            ...(empresaAtual?.id ? { empresa_id: empresaAtual.id } : {}),
            ...(groupId ? { group_id: groupId, grupo_id: groupId } : {}),
            data_movimento: new Date().toISOString(),
            tipo_movimento: 'Entrada',
            origem: 'Venda PDV',
            forma_pagamento: fp.forma_descricao,
            valor: fp.valor,
            descricao: `Venda ${pedido.numero_pedido} - Cliente: ${clienteSelecionado?.nome || 'Avulso'} - Pagto: ${fp.forma_descricao}${fp.parcelas > 1 ? ` (${fp.parcelas}x)` : ''}`,
            pedido_id: pedido.id,
            conta_receber_id: contaReceber?.id,
            usuario_operador_nome: user?.full_name,
            caixa_aberto: true
          });
        }
      }

      await auditCaixaAction('pdv_venda_finalizada', { entidade: 'Pedido', pedido_id: pedido.id, numero_pedido: pedido.numero_pedido, valor_total: totalVenda, entrega: tipoEntrega, emitir_nfe: emitirNFe }, true);
      return { pedido, contaReceber };
    },
    onError: (error) => {
      toast.error(error.message || 'Falha ao finalizar venda.');
    },
    onSuccess: ({ pedido }) => {
      setCarrinho([]);
      setFormasPagamentoVenda([{ forma_id: null, forma_descricao: "Selecione", valor: 0, parcelas: 1 }]);
      setClienteSelecionado(null);
      setDesconto(0);
      setAcrescimo(0);
      setEmitirNFe(false);
      setEmitirBoleto(false);
      setTipoEntrega("Retirada");
      setEnderecoEntrega("");
      queryClient.invalidateQueries();
      
      const mensagemTipo = tipoEntrega === "Retirada" ? "🏪 RETIRADA NO LOCAL" : "🚚 ENTREGA CRIADA";
      
      if (troco > 0) {
        toast.success(`✅ Venda ${pedido.numero_pedido} finalizada!\n${mensagemTipo}\n🟢 TROCO: R$ ${troco.toFixed(2)}`);
      } else {
        toast.success(`✅ Venda ${pedido.numero_pedido} finalizada!\n${mensagemTipo}`);
      }
    }
  });

  const liquidarTitulo = useMutation({
    mutationFn: async ({ titulo, tipo, forma }) => {
      if (!contextoValido || !podeLiquidarTitulos) {
        await auditCaixaAction('pdv_liquidacao_bloqueada', { motivo: 'contexto_ou_permissao', entidade: tipo === 'receber' ? 'ContaReceber' : 'ContaPagar', titulo_id: titulo?.id }, false);
        throw new Error("Sem contexto ou permissao para liquidar titulo.");
      }
      if (!window.confirm(`Confirmar liquidacao de ${tipo === 'receber' ? 'recebimento' : 'pagamento'} no valor de R$ ${(titulo.valor || 0).toFixed(2)} via ${forma}?`)) {
        await auditCaixaAction('pdv_liquidacao_cancelada', { motivo: 'confirmacao_cancelada', entidade: tipo === 'receber' ? 'ContaReceber' : 'ContaPagar', titulo_id: titulo?.id, valor: titulo?.valor, forma }, false);
        throw new Error("Liquidacao cancelada pelo usuario.");
      }
      if (tipo === 'receber') {
        await updateInContext('ContaReceber', titulo.id, {
          status: 'Recebido',
          data_recebimento: hoje,
          valor_recebido: titulo.valor,
          forma_recebimento: forma
        });

        await createInContext('CaixaMovimento', {
          ...(empresaAtual?.id ? { empresa_id: empresaAtual.id } : {}),
          ...(groupId ? { group_id: groupId, grupo_id: groupId } : {}),
          data_movimento: new Date().toISOString(),
          tipo_movimento: 'Entrada',
          origem: 'Liquidação Receber',
          forma_pagamento: forma,
          valor: titulo.valor,
          descricao: `Recebimento: ${titulo.cliente}`,
          conta_receber_id: titulo.id,
          usuario_operador_nome: user?.full_name,
          caixa_aberto: true
        });
      } else {
        await updateInContext('ContaPagar', titulo.id, {
          status: 'Pago',
          data_pagamento: hoje,
          valor_pago: titulo.valor,
          forma_pagamento: forma
        });

        await createInContext('CaixaMovimento', {
          ...(empresaAtual?.id ? { empresa_id: empresaAtual.id } : {}),
          ...(groupId ? { group_id: groupId, grupo_id: groupId } : {}),
          data_movimento: new Date().toISOString(),
          tipo_movimento: 'Saída',
          origem: 'Liquidação Pagar',
          forma_pagamento: forma,
          valor: titulo.valor,
          descricao: `Pagamento: ${titulo.fornecedor}`,
          conta_pagar_id: titulo.id,
          usuario_operador_nome: user?.full_name,
          caixa_aberto: true
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success("✅ Liquidado!");
    }
  });

  const fecharCaixa = useMutation({
    mutationFn: async () => {
      if (controlesDesabilitados) throw new Error("Sem contexto ou permissÃ£o para fechar caixa.");
      await createInContext('CaixaMovimento', {
        ...(empresaAtual?.id ? { empresa_id: empresaAtual.id } : {}),
        ...(groupId ? { group_id: groupId, grupo_id: groupId } : {}),
        data_movimento: new Date().toISOString(),
        tipo_movimento: 'Fechamento',
        origem: 'Fechamento Caixa',
        forma_pagamento: 'Dinheiro',
        valor: saldoAtual,
        descricao: `Fechamento - Saldo: R$ ${saldoAtual.toFixed(2)}`,
        usuario_operador_nome: user?.full_name,
        caixa_aberto: false
      });
    },
    onSuccess: () => {
      setCaixaAberto(false);
      queryClient.invalidateQueries();
      toast.success("✅ Caixa fechado!");
    }
  });

  if (!caixaAberto) {
    return (
      <div className="p-6">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-emerald-600" />
              Abrir Caixa PDV
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-3">
                <p className="text-sm"><strong>Operador:</strong> {user?.full_name}</p>
                <p className="text-sm"><strong>Empresa:</strong> {empresaAtual?.nome_fantasia || empresaAtual?.razao_social}</p>
              </CardContent>
            </Card>
            <div>
              <Label>Saldo Inicial em Dinheiro (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={saldoInicial}
                onChange={(e) => setSaldoInicial(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="text-lg"
                disabled={controlesDesabilitados}
              />
            </div>
            <Button
              onClick={() => abrirCaixa.mutate(saldoInicial)}
              className="w-full bg-emerald-600 h-10"
              disabled={controlesDesabilitados || abrirCaixa.isPending}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Abrir Caixa
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* HEADER */}
      <div className="mb-4 p-3 bg-white rounded border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Wallet className="w-5 h-5 text-emerald-600" />
          <div>
            <p className="text-sm font-bold">Caixa PDV</p>
            <p className="text-xs text-slate-500">{user?.full_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-slate-500">Saldo em Dinheiro</p>
            <p className="text-lg font-bold text-emerald-600">R$ {saldoAtual.toFixed(2)}</p>
          </div>
          <Button onClick={() => { if (confirm(`Fechar caixa?\nSaldo: R$ ${saldoAtual.toFixed(2)}`)) fecharCaixa.mutate(); }} variant="outline" size="sm" disabled={controlesDesabilitados || fecharCaixa.isPending}>
            Fechar Caixa
          </Button>
        </div>
      </div>

      {/* INDICADORES */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-blue-700 font-semibold">Vendas Hoje</p>
            <p className="text-xl font-bold">{movimentosHoje.filter(m => m.origem === 'Venda PDV').length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-green-700 font-semibold">Entradas 💵</p>
            <p className="text-xl font-bold">R$ {totalEntradasDinheiro.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-red-700 font-semibold">Saídas 💵</p>
            <p className="text-xl font-bold">R$ {totalSaidasDinheiro.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-slate-700 font-semibold">Total Movimentos</p>
            <p className="text-xl font-bold">{movimentosHoje.length}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={abaAtiva} onValueChange={setAbaAtiva}>
        <TabsList className="grid grid-cols-5">
          <TabsTrigger value="venda">💰 Venda</TabsTrigger>
          <TabsTrigger value="pedidos">📦 Pedidos</TabsTrigger>
          <TabsTrigger value="receber">💚 Receber</TabsTrigger>
          <TabsTrigger value="pagar">💔 Pagar</TabsTrigger>
          <TabsTrigger value="movimentos">📊 Movimentos</TabsTrigger>
        </TabsList>

        {/* VENDA */}
        <TabsContent value="venda">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* PRODUTOS */}
            <Card>
              <CardHeader className="pb-3">
                <Input
                  placeholder="🔍 Buscar produto..."
                  value={buscaProduto}
                  onChange={(e) => setBuscaProduto(e.target.value)}
                  disabled={controlesDesabilitados}
                />
              </CardHeader>
              <CardContent className="max-h-[500px] overflow-auto">
                <div className="grid grid-cols-2 gap-2">
                  {produtosFiltrados.map(p => (
                    <button
                      key={p.id}
                      onClick={() => {
                        if (controlesDesabilitados) return;
                        const existe = carrinho.find(i => i.id === p.id);
                        if (existe) {
                          setCarrinho(carrinho.map(i => i.id === p.id ? {...i, quantidade: i.quantidade + 1} : i));
                        } else {
                          setCarrinho([...carrinho, {...p, quantidade: 1}]);
                        }
                      }}
                      disabled={controlesDesabilitados}
                      className="p-3 border-2 rounded-lg hover:border-blue-500 hover:bg-blue-50 bg-white text-left"
                    >
                      <p className="font-semibold text-sm truncate">{p.descricao}</p>
                      <p className="font-bold text-blue-600 text-lg">R$ {(p.preco_venda || 0).toFixed(2)}</p>
                      <p className="text-xs text-slate-500">Estoque: {p.estoque_atual || 0}</p>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* CARRINHO */}
            <Card>
              <CardHeader className="pb-3">
                <p className="font-bold">🛒 Carrinho ({carrinho.length})</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="max-h-[280px] overflow-auto space-y-2">
                  {carrinho.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                      <ShoppingCart className="w-12 h-12 mx-auto mb-2" />
                      <p className="text-sm">Carrinho vazio</p>
                    </div>
                  ) : (
                    carrinho.map(item => (
                      <div key={item.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border">
                        <div className="flex-1 mr-2">
                          <p className="text-sm font-medium truncate">{item.descricao}</p>
                          <div className="flex gap-2 mt-1">
                            <Button size="sm" variant="outline" disabled={controlesDesabilitados} onClick={() => setCarrinho(carrinho.map(i => i.id === item.id ? {...i, quantidade: i.quantidade - 1} : i).filter(i => i.quantidade > 0))} className="h-7 w-7 p-0">-</Button>
                            <span className="font-bold w-8 text-center">{item.quantidade}</span>
                            <Button size="sm" variant="outline" disabled={controlesDesabilitados} onClick={() => setCarrinho(carrinho.map(i => i.id === item.id ? {...i, quantidade: i.quantidade + 1} : i))} className="h-7 w-7 p-0">+</Button>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-500">R$ {item.preco_venda.toFixed(2)}</p>
                          <p className="font-bold text-blue-600">R$ {(item.preco_venda * item.quantidade).toFixed(2)}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="border-t pt-3 space-y-3">
                  <div>
                    <Label className="text-xs">Cliente</Label>
                    <Input
                      placeholder="Buscar cliente..."
                      value={buscaCliente}
                      onChange={(e) => setBuscaCliente(e.target.value)}
                      className="h-8"
                      disabled={controlesDesabilitados}
                    />
                    {buscaCliente && clientesFiltrados.length > 0 && (
                      <div className="max-h-24 overflow-auto border rounded mt-1 bg-white">
                        {clientesFiltrados.map(c => (
                          <button key={c.id} onClick={() => { setClienteSelecionado(c); setBuscaCliente(''); }} className="w-full p-2 hover:bg-blue-50 text-left text-sm">
                            {c.nome}
                          </button>
                        ))}
                      </div>
                    )}
                    {clienteSelecionado && <Badge className="mt-1">{clienteSelecionado.nome}</Badge>}
                  </div>

                  <div className="flex justify-between border-b pb-2">
                    <span className="text-sm">Subtotal:</span>
                    <span className="font-bold">R$ {subtotal.toFixed(2)}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Desconto</Label>
                      <div className="flex gap-1">
                        <Input type="number" step="0.01" value={desconto} onChange={(e) => setDesconto(parseFloat(e.target.value) || 0)} className="h-8" />
                        <Select value={tipoDesconto} onValueChange={setTipoDesconto}>
                          <SelectTrigger className="h-8 w-14"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="valor">R$</SelectItem>
                            <SelectItem value="percentual">%</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Acréscimo</Label>
                      <div className="flex gap-1">
                        <Input type="number" step="0.01" value={acrescimo} onChange={(e) => setAcrescimo(parseFloat(e.target.value) || 0)} className="h-8" />
                        <Select value={tipoAcrescimo} onValueChange={setTipoAcrescimo}>
                          <SelectTrigger className="h-8 w-14"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="valor">R$</SelectItem>
                            <SelectItem value="percentual">%</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between border-t pt-2">
                    <span className="font-semibold">TOTAL:</span>
                    <span className="text-2xl font-bold text-blue-600">R$ {totalVenda.toFixed(2)}</span>
                  </div>

                  {/* TIPO DE ENTREGA - RETIRADA OU ENTREGA */}
                  <Card className="bg-gradient-to-r from-blue-50 to-cyan-50 border-2 border-blue-300">
                    <CardContent className="p-3 space-y-2">
                      <Label className="text-sm font-semibold text-blue-900 flex items-center gap-2">
                        <Truck className="w-4 h-4" />
                        Tipo de Entrega
                      </Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          variant={tipoEntrega === "Retirada" ? "default" : "outline"}
                          onClick={() => setTipoEntrega("Retirada")}
                          className={`h-16 flex-col gap-1 ${tipoEntrega === "Retirada" ? "bg-blue-600 hover:bg-blue-700" : ""}`}
                        >
                          <Store className="w-6 h-6" />
                          <span className="text-xs font-semibold">RETIRADA</span>
                        </Button>
                        <Button
                          type="button"
                          variant={tipoEntrega === "Entrega" ? "default" : "outline"}
                          onClick={() => setTipoEntrega("Entrega")}
                          className={`h-16 flex-col gap-1 ${tipoEntrega === "Entrega" ? "bg-blue-600 hover:bg-blue-700" : ""}`}
                        >
                          <Truck className="w-6 h-6" />
                          <span className="text-xs font-semibold">ENTREGA</span>
                        </Button>
                      </div>
                      {tipoEntrega === "Entrega" && !clienteSelecionado && (
                        <div className="bg-yellow-100 border border-yellow-300 rounded p-2 text-xs text-yellow-900">
                          ⚠️ Selecione um cliente para criar a entrega automaticamente
                        </div>
                      )}
                      {tipoEntrega === "Entrega" && clienteSelecionado && (
                        <div className="bg-green-100 border border-green-300 rounded p-2 text-xs text-green-900">
                          ✅ Entrega será criada automaticamente com endereço do cliente
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <div className="space-y-1 p-2 bg-slate-50 rounded">
                    <div className="flex items-center gap-2">
                      <Checkbox checked={emitirRecibo} onCheckedChange={setEmitirRecibo} id="recibo" />
                      <Label htmlFor="recibo" className="text-sm">Emitir Recibo</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox checked={emitirNFe} onCheckedChange={setEmitirNFe} id="nfe" disabled={!empresaId || !podeEmitirNFePDV || !clienteSelecionado} data-action="PDV.nfe.marcar" data-permission="Fiscal.Notas Fiscais.emitir" data-context-required="true" data-sensitive="true" />
                      <Label htmlFor="nfe" className="text-sm">Emitir NF-e</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox checked={emitirBoleto} onCheckedChange={setEmitirBoleto} id="boleto" disabled={!podeCriarReceberPDV} data-action="PDV.boleto.marcar" data-permission="Financeiro.Contas a Receber.criar" data-context-required="true" data-sensitive="true" />
                      <Label htmlFor="boleto" className="text-sm">Gerar Boleto</Label>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {formasPagamentoVenda.map((fp, idx) => {
                      const configForma = fp.forma_id ? obterConfiguracao(fp.forma_id) : null;
                      const permiteParcelar = configForma?.permite_parcelar;

                      return (
                        <div key={idx} className="flex gap-1">
                          <Select 
                            value={fp.forma_id || ""} 
                            onValueChange={(formaId) => {
                              const forma = formasPDV.find(f => f.id === formaId);
                              const novas = [...formasPagamentoVenda];
                              novas[idx].forma_id = formaId;
                              novas[idx].forma_descricao = forma?.descricao || "";
                              novas[idx].parcelas = 1;
                              setFormasPagamentoVenda(novas);
                            }}
                          >
                            <SelectTrigger className="h-8 flex-1"><SelectValue placeholder="Forma" /></SelectTrigger>
                            <SelectContent>
                              {formasPDV.map(forma => (
                                <SelectItem key={forma.id} value={forma.id}>
                                  {forma.icone && `${forma.icone} `}{forma.descricao}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input 
                            type="number" 
                            step="0.01" 
                            value={fp.valor} 
                            onChange={(e) => {
                              const novas = [...formasPagamentoVenda];
                              novas[idx].valor = parseFloat(e.target.value) || 0;
                              setFormasPagamentoVenda(novas);
                            }} 
                            placeholder="Valor" 
                            className="h-8 w-24" 
                          />
                          {permiteParcelar && (
                            <Input 
                              type="number" 
                              min="1" 
                              max={configForma?.max_parcelas || 12}
                              value={fp.parcelas || 1} 
                              onChange={(e) => {
                                const novas = [...formasPagamentoVenda];
                                novas[idx].parcelas = parseInt(e.target.value) || 1;
                                setFormasPagamentoVenda(novas);
                              }} 
                              placeholder="Parc" 
                              className="h-8 w-16" 
                            />
                          )}
                          {formasPagamentoVenda.length > 1 && (
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={() => setFormasPagamentoVenda(formasPagamentoVenda.filter((_, i) => i !== idx))} 
                              className="h-8 w-8 p-0"
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          )}
                        </div>
                      );
                    })}
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => setFormasPagamentoVenda([...formasPagamentoVenda, { forma_id: null, forma_descricao: "Selecione", valor: 0, parcelas: 1 }])} 
                      className="w-full"
                    >
                      <Plus className="w-4 h-4 mr-1" /> Adicionar Forma
                    </Button>
                  </div>

                  {totalPago !== totalVenda && (
                    <div className="bg-slate-100 rounded p-2">
                      {totalPago > totalVenda ? (
                        <p className="text-green-600 font-bold text-lg">🟢 TROCO: R$ {troco.toFixed(2)}</p>
                      ) : (
                        <p className="text-red-600 font-bold text-lg">🔴 FALTA: R$ {(totalVenda - totalPago).toFixed(2)}</p>
                      )}
                    </div>
                  )}

                  {(nfeBloqueada || entregaBloqueada || financeiroBloqueado) && (
                    <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">Revise empresa, cliente e permissoes antes de finalizar venda com entrega, boleto ou NF-e.</div>
                  )}
                  <Button onClick={() => finalizarVenda.mutate()} disabled={controlesDesabilitados || finalizarVenda.isPending || carrinho.length === 0 || totalPago < totalVenda || nfeBloqueada || entregaBloqueada || financeiroBloqueado} className="w-full bg-emerald-600 h-10" data-action="PDV.venda.finalizar" data-permission="Financeiro.PDV.criar" data-context-required="true" data-sensitive="true">
                    <CheckCircle2 className="w-4 h-4 mr-2" /> Finalizar Venda
                  </Button>
                  <Button onClick={() => {
                    setCarrinho([]);
                    setClienteSelecionado(null);
                    setFormasPagamentoVenda([{ forma_id: null, forma_descricao: "Selecione", valor: 0, parcelas: 1 }]);
                    setDesconto(0);
                    setAcrescimo(0);
                  }} variant="outline" className="w-full">
                    <Trash2 className="w-4 h-4 mr-2" /> Limpar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* PEDIDOS */}
        <TabsContent value="pedidos">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pedidosReceber.map(p => (
                    <TableRow key={p.id}>
                      <TableCell>{p.numero_pedido}</TableCell>
                      <TableCell>{p.cliente_nome}</TableCell>
                      <TableCell className="font-bold">R$ {(p.valor_total || 0).toFixed(2)}</TableCell>
                      <TableCell>
                        <Button size="sm" disabled={!contextoValido || !podeLiquidarTitulos || liquidarTitulo.isPending} onClick={() => liquidarTitulo.mutate({ titulo: { id: p.id, cliente: p.cliente_nome, valor: p.valor_total }, tipo: 'receber', forma: 'Dinheiro' })} data-action="PDV.pedido.receber" data-permission="Financeiro.Contas a Receber.baixar" data-context-required="true" data-sensitive="true">
                          Receber
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* RECEBER */}
        <TabsContent value="receber">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contasReceberPendentes.map(c => (
                    <TableRow key={c.id}>
                      <TableCell>{c.cliente}</TableCell>
                      <TableCell>{c.descricao}</TableCell>
                      <TableCell className="font-bold text-green-600">R$ {(c.valor || 0).toFixed(2)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" className="bg-green-600" disabled={!contextoValido || !podeLiquidarTitulos || liquidarTitulo.isPending} onClick={() => liquidarTitulo.mutate({ titulo: c, tipo: 'receber', forma: 'Dinheiro' })} data-action="PDV.receber.dinheiro" data-permission="Financeiro.Contas a Receber.baixar" data-context-required="true" data-sensitive="true">💵</Button>
                          <Button size="sm" className="bg-green-600" disabled={!contextoValido || !podeLiquidarTitulos || liquidarTitulo.isPending} onClick={() => liquidarTitulo.mutate({ titulo: c, tipo: 'receber', forma: 'PIX' })} data-action="PDV.receber.pix" data-permission="Financeiro.Contas a Receber.baixar" data-context-required="true" data-sensitive="true">PIX</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PAGAR */}
        <TabsContent value="pagar">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contasPagarPendentes.map(c => (
                    <TableRow key={c.id}>
                      <TableCell>{c.fornecedor}</TableCell>
                      <TableCell>{c.descricao}</TableCell>
                      <TableCell className="font-bold text-red-600">R$ {(c.valor || 0).toFixed(2)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" className="bg-red-600" disabled={!contextoValido || !podeLiquidarTitulos || liquidarTitulo.isPending} onClick={() => liquidarTitulo.mutate({ titulo: c, tipo: 'pagar', forma: 'Dinheiro' })} data-action="PDV.pagar.dinheiro" data-permission="Financeiro.Contas a Pagar.baixar" data-context-required="true" data-sensitive="true">💵</Button>
                          <Button size="sm" className="bg-red-600" disabled={!contextoValido || !podeLiquidarTitulos || liquidarTitulo.isPending} onClick={() => liquidarTitulo.mutate({ titulo: c, tipo: 'pagar', forma: 'PIX' })} data-action="PDV.pagar.pix" data-permission="Financeiro.Contas a Pagar.baixar" data-context-required="true" data-sensitive="true">PIX</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* MOVIMENTOS */}
        <TabsContent value="movimentos">
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-base">📊 Somatória por Forma de Pagamento</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                {Object.entries(somatoriaFormasPagamento).map(([forma, valores]) => (
                  <Card key={forma} className="border-2">
                    <CardContent className="p-3">
                      <p className="font-semibold text-sm mb-2">{forma}</p>
                      <div className="flex justify-between text-sm">
                        <span className="text-green-600">+R$ {valores.entradas.toFixed(2)}</span>
                        <span className="text-red-600">-R$ {valores.saidas.toFixed(2)}</span>
                      </div>
                      <p className={`font-bold mt-1 ${valores.total >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        Total: R$ {valores.total.toFixed(2)}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hora</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movimentosHoje.map(m => {
                    const pedidoVinculado = pedidos.find(p => p.id === m.pedido_id);
                    const descricaoCompleta = m.descricao || '';
                    
                    return (
                      <TableRow key={m.id}>
                        <TableCell>
                          {new Date(m.data_movimento).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </TableCell>
                        <TableCell>
                          <Badge className={m.tipo_movimento === 'Entrada' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                            {m.tipo_movimento}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{descricaoCompleta}</p>
                            {pedidoVinculado && (
                              <div className="text-xs text-slate-600 mt-1 space-y-0.5">
                                <p>📋 Pedido: <strong>{pedidoVinculado.numero_pedido}</strong></p>
                                <p>👤 Cliente: <strong>{pedidoVinculado.cliente_nome}</strong></p>
                                <p>💳 Pagto: <strong>{m.forma_pagamento}</strong></p>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className={`text-right font-bold ${m.tipo_movimento === 'Entrada' ? 'text-green-600' : 'text-red-600'}`}>
                          {m.tipo_movimento === 'Entrada' ? '+' : '-'}R$ {(m.valor || 0).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
