import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  CheckCircle2,
  Package,
  DollarSign,
  Truck,
  FileText,
  AlertTriangle,
  Loader2,
  ArrowRight,
  Clock,
  ShoppingCart
} from 'lucide-react';
import { toast } from 'sonner';
import { executarFechamentoCompleto } from '@/components/lib/useFluxoPedido';
import { useUser } from '@/components/lib/UserContext';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import usePermissions from '@/components/lib/usePermissions';

/**
 * V21.6 - AUTOMAÃ‡ÃƒO COMPLETA DO FLUXO DE PEDIDO
 * 
 * Fluxo AutomÃ¡tico:
 * 1. AprovaÃ§Ã£o â†’ Baixa de Estoque
 * 2. Gerar Financeiro (Contas a Receber)
 * 3. Criar Entrega/Retirada
 * 4. Status â†’ Pronto para Faturar
 * 5. IntegraÃ§Ã£o com NF-e
 * 
 * Regra-MÃ£e: Sistema inteligente e automÃ¡tico
 */
export default function AutomacaoFluxoPedido({
  pedido, 
  onComplete, 
  autoExecute = false,
  windowMode = false,
  empresaId = null
}) {
  // V21.6: Multi-empresa
  const empresaProcessamento = empresaId || pedido?.empresa_id;
  const { user } = useUser();
  const { filterInContext, createInContext, updateInContext, empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const [executando, setExecutando] = useState(false);
  const [etapaConcluida, setEtapaConcluida] = useState({
    estoque: false,
    financeiro: false,
    logistica: false,
    status: false
  });
  const [progresso, setProgresso] = useState(0);
  const [logs, setLogs] = useState([]);

  const groupId = pedido?.group_id || grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const contextoValido = Boolean(groupId || empresaProcessamento);
  const podeExecutarFechamento =
    user?.role === 'admin' ||
    user?.role === 'gerente' ||
    hasPermission('Comercial.Pedido.marcarProntoFaturar') ||
    hasPermission('Comercial.Pedido.aprovar') ||
    hasPermission('Comercial.Pedido.editar');
  const permitido = Boolean(contextoValido && podeExecutarFechamento);

  const adicionarLog = (mensagem, tipo = 'info') => {
    setLogs(prev => [...prev, { mensagem, tipo, timestamp: new Date() }]);
  };

  // Validar permissao granular e contexto antes do fechamento
  useEffect(() => {
    if (user && !permitido) {
      adicionarLog('Fechamento automatico exige contexto de grupo/empresa e permissao comercial.', 'warning');
    }
  }, [user, permitido]);

  // V21.6: Auto-executar se solicitado
  useEffect(() => {
    if (autoExecute && !executando && progresso === 0 && permitido) {
      executarFluxoCompleto();
    }
  }, [autoExecute, permitido]);

  // ETAPA 1: Baixar Estoque (DEPRECATED - usar hook centralizado)
  const baixarEstoque = async () => {
    adicionarLog('ðŸ”„ Iniciando baixa de estoque...', 'info');
    
    try {
      const itensParaBaixar = [
        ...(pedido.itens_revenda || []),
        ...(pedido.itens_armado_padrao || []),
        ...(pedido.itens_corte_dobra || [])
      ];

      let totalBaixado = 0;

      for (const item of itensParaBaixar) {
        if (item.produto_id) {
          const produtos = await filterInContext('Produto', {
            id: item.produto_id,
            empresa_id: pedido.empresa_id 
          }, undefined, 1);
          
          const produto = produtos[0];
          if (produto) {
            const estoqueAtual = produto.estoque_atual || 0;
            const quantidade = item.quantidade || 0;

            if (estoqueAtual >= quantidade) {
              const novoEstoque = estoqueAtual - quantidade;
              
              // Criar movimentaÃ§Ã£o
              await createInContext('MovimentacaoEstoque', {
                group_id: groupId,
                empresa_id: pedido.empresa_id,
                tipo_movimento: "saida",
                origem_movimento: "pedido",
                origem_documento_id: pedido.id,
                produto_id: item.produto_id,
                produto_descricao: item.descricao || item.produto_descricao,
                codigo_produto: item.codigo_sku,
                quantidade: quantidade,
                unidade_medida: item.unidade,
                estoque_anterior: estoqueAtual,
                estoque_atual: novoEstoque,
                disponivel_anterior: estoqueAtual,
                disponivel_atual: novoEstoque,
                data_movimentacao: new Date().toISOString(),
                documento: pedido.numero_pedido,
                motivo: `Baixa automÃ¡tica - Fechamento de pedido`,
                responsavel: "Sistema AutomÃ¡tico",
                aprovado: true
              });
              
              // Atualizar estoque
              await updateInContext('Produto', item.produto_id, {
                estoque_atual: novoEstoque
              });

              totalBaixado++;
              adicionarLog(`âœ… ${item.descricao}: ${quantidade} ${item.unidade} baixado(s)`, 'success');
            } else {
              adicionarLog(`âš ï¸ ${item.descricao}: Estoque insuficiente (${estoqueAtual}/${quantidade})`, 'warning');
            }
          }
        }
      }

      setEtapaConcluida(prev => ({ ...prev, estoque: true }));
      setProgresso(25);
      adicionarLog(`âœ… Estoque baixado: ${totalBaixado} itens processados`, 'success');
      return true;
    } catch (error) {
      adicionarLog(`âŒ Erro ao baixar estoque: ${error.message}`, 'error');
      throw error;
    }
  };

  // ETAPA 2: Gerar Financeiro (Contas a Receber)
  const gerarFinanceiro = async () => {
    adicionarLog('ðŸ’° Gerando contas a receber...', 'info');
    
    try {
      const valorTotal = pedido.valor_total || 0;
      const numeroParcelas = pedido.numero_parcelas || 1;
      const valorParcela = valorTotal / numeroParcelas;
      const dataEmissao = new Date();

      for (let i = 1; i <= numeroParcelas; i++) {
        const dataVencimento = new Date(dataEmissao);
        
        // Calcular vencimento baseado no intervalo de parcelas
        if (pedido.intervalo_parcelas) {
          dataVencimento.setDate(dataVencimento.getDate() + (i * pedido.intervalo_parcelas));
        } else {
          dataVencimento.setDate(dataVencimento.getDate() + (i * 30)); // PadrÃ£o 30 dias
        }

        await createInContext('ContaReceber', {
          group_id: groupId,
          empresa_id: pedido.empresa_id,
          origem_tipo: 'pedido',
          descricao: `Venda - Pedido ${pedido.numero_pedido} - Parcela ${i}/${numeroParcelas}`,
          cliente: pedido.cliente_nome,
          cliente_id: pedido.cliente_id,
          pedido_id: pedido.id,
          valor: valorParcela,
          data_emissao: dataEmissao.toISOString().split('T')[0],
          data_vencimento: dataVencimento.toISOString().split('T')[0],
          status: 'Pendente',
          forma_recebimento: pedido.forma_pagamento || 'Ã€ Vista',
          numero_documento: pedido.numero_pedido,
          numero_parcela: `${i}/${numeroParcelas}`,
          visivel_no_portal: true
        });

        adicionarLog(`âœ… Parcela ${i}/${numeroParcelas}: R$ ${valorParcela.toFixed(2)} - Venc: ${dataVencimento.toLocaleDateString('pt-BR')}`, 'success');
      }

      setEtapaConcluida(prev => ({ ...prev, financeiro: true }));
      setProgresso(50);
      adicionarLog(`âœ… Financeiro gerado: ${numeroParcelas} parcela(s)`, 'success');
      return true;
    } catch (error) {
      adicionarLog(`âŒ Erro ao gerar financeiro: ${error.message}`, 'error');
      throw error;
    }
  };

  // ETAPA 3: Criar Entrega ou Retirada
  const criarLogistica = async () => {
    adicionarLog('ðŸšš Criando registro de logÃ­stica...', 'info');
    
    try {
      const tipoFrete = pedido.tipo_frete || 'CIF';
      
      if (tipoFrete === 'Retirada') {
        // Marcar como retirada no pedido
        await updateInContext('Pedido', pedido.id, {
          tipo_frete: 'Retirada',
          observacoes_internas: (pedido.observacoes_internas || '') + '\n[AUTOMAÃ‡ÃƒO] Cliente irÃ¡ retirar na loja.'
        });
        
        adicionarLog(`âœ… Pedido marcado para RETIRADA`, 'success');
      } else {
        // Criar registro de entrega
        await createInContext('Entrega', {
          group_id: groupId,
          empresa_id: pedido.empresa_id,
          pedido_id: pedido.id,
          numero_pedido: pedido.numero_pedido,
          cliente_id: pedido.cliente_id,
          cliente_nome: pedido.cliente_nome,
          endereco_entrega_completo: pedido.endereco_entrega_principal || {},
          contato_entrega: {
            nome: pedido.cliente_nome,
            telefone: pedido.contatos_cliente?.[0]?.valor || ''
          },
          data_previsao: pedido.data_prevista_entrega || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          tipo_frete: tipoFrete,
          valor_mercadoria: pedido.valor_total,
          valor_frete: pedido.valor_frete || 0,
          peso_total_kg: pedido.peso_total_kg || 0,
          volumes: 1,
          status: 'Aguardando SeparaÃ§Ã£o',
          prioridade: pedido.prioridade || 'Normal'
        });

        adicionarLog(`âœ… Entrega criada - PrevisÃ£o: ${pedido.data_prevista_entrega || 'A definir'}`, 'success');
      }

      setEtapaConcluida(prev => ({ ...prev, logistica: true }));
      setProgresso(75);
      return true;
    } catch (error) {
      adicionarLog(`âŒ Erro ao criar logÃ­stica: ${error.message}`, 'error');
      throw error;
    }
  };

  // ETAPA 4: Atualizar Status do Pedido
  const atualizarStatus = async () => {
    adicionarLog('ðŸ“ Atualizando status do pedido...', 'info');
    
    try {
      await updateInContext('Pedido', pedido.id, {
        status: 'Pronto para Faturar',
        observacoes_internas: (pedido.observacoes_internas || '') + 
          `\n[AUTOMAÃ‡ÃƒO ${new Date().toLocaleString('pt-BR')}] Fluxo automÃ¡tico concluÃ­do com sucesso.`
      });

      setEtapaConcluida(prev => ({ ...prev, status: true }));
      setProgresso(100);
      adicionarLog(`âœ… Pedido atualizado para: PRONTO PARA FATURAR`, 'success');
      return true;
    } catch (error) {
      adicionarLog(`âŒ Erro ao atualizar status: ${error.message}`, 'error');
      throw error;
    }
  };

  // V21.6: EXECUTAR FLUXO COMPLETO COM HOOK CENTRALIZADO
  const executarFluxoCompleto = async () => {
    if (executando || !permitido) {
      if (!permitido) {
        toast.error('âŒ Sem permissÃ£o para executar fechamento automÃ¡tico');
      }
      return;
    }
    
    setExecutando(true);
    setProgresso(0);
    setLogs([]);
    
    try {
      await executarFechamentoCompleto(
        pedido,
        empresaProcessamento,
        {
          onProgresso: (valor) => setProgresso(valor),
          onLog: (mensagem, tipo) => adicionarLog(mensagem, tipo),
          onEtapaConcluida: (etapa, sucesso) => {
            setEtapaConcluida(prev => ({ ...prev, [etapa]: sucesso }));
          },
          onComplete: (resultados) => {
            toast.success('âœ… Fluxo de pedido concluÃ­do com sucesso!');
            adicionarLog('ðŸŽ‰ AUTOMAÃ‡ÃƒO CONCLUÃDA! Fechando em 2s...', 'success');
            
            // Aguardar 2s e fechar janela/modal
            setTimeout(() => {
              if (onComplete) {
                onComplete(resultados);
              }
            }, 2000);
          },
          onError: (error) => {
            toast.error(`âŒ Erro na automaÃ§Ã£o: ${error.message}`);
          }
        }
      );
    } catch (error) {
      toast.error(`âŒ Erro crÃ­tico: ${error.message}`);
      adicionarLog(`âŒ FALHA CRÃTICA: ${error.message}`, 'error');
    } finally {
      setExecutando(false);
    }
  };

  const etapas = [
    { id: 'estoque', label: 'Baixa de Estoque', icon: Package, concluida: etapaConcluida.estoque },
    { id: 'financeiro', label: 'Gerar Financeiro', icon: DollarSign, concluida: etapaConcluida.financeiro },
    { id: 'logistica', label: 'Criar LogÃ­stica', icon: Truck, concluida: etapaConcluida.logistica },
    { id: 'status', label: 'Atualizar Status', icon: FileText, concluida: etapaConcluida.status }
  ];

  // V21.6 FINAL: w-full h-full responsivo
  const containerClass = windowMode 
    ? 'w-full h-full flex flex-col overflow-hidden' 
    : 'w-full h-full space-y-6';

  const contentClass = windowMode 
    ? 'flex-1 overflow-y-auto p-6 space-y-6' 
    : 'space-y-6';

  const Wrapper = ({ children }) => windowMode ? (
    <div className={containerClass} data-context-required="true" data-permission="Comercial.Pedido.marcarProntoFaturar">
      <div className={contentClass}>{children}</div>
    </div>
  ) : (
    <div className={containerClass} data-context-required="true" data-permission="Comercial.Pedido.marcarProntoFaturar">{children}</div>
  );

  return (
    <Wrapper>
      {/* Header */}
      <Card className="border-2 border-blue-400 bg-gradient-to-r from-blue-50 to-purple-50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="w-6 h-6 text-blue-600" />
              AutomaÃ§Ã£o do Fluxo de Pedido
            </CardTitle>
            <Badge className="bg-blue-600 text-white px-3 py-1">
              Pedido {pedido.numero_pedido}
            </Badge>
          </div>
          <p className="text-sm text-slate-600 mt-2">
            Sistema inteligente de fechamento automÃ¡tico - Regra-MÃ£e V21.6
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Progresso do Fluxo</span>
              <span className="font-bold text-blue-600">{progresso}%</span>
            </div>
            <Progress value={progresso} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Etapas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {etapas.map((etapa, index) => {
          const Icon = etapa.icon;
          return (
            <Card key={etapa.id} className={`${
              etapa.concluida 
                ? 'border-green-400 bg-green-50' 
                : executando && index === Object.values(etapaConcluida).filter(Boolean).length
                ? 'border-blue-400 bg-blue-50 animate-pulse'
                : 'border-slate-200'
            }`}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                  etapa.concluida ? 'bg-green-600' : 'bg-slate-200'
                }`}>
                  {etapa.concluida ? (
                    <CheckCircle2 className="w-6 h-6 text-white" />
                  ) : (
                    <Icon className="w-6 h-6 text-slate-500" />
                  )}
                </div>
                <div>
                  <p className="font-semibold text-sm">{etapa.label}</p>
                  <p className="text-xs text-slate-500">
                    {etapa.concluida ? 'ConcluÃ­do' : 'Pendente'}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Logs de ExecuÃ§Ã£o</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">
                Nenhuma aÃ§Ã£o executada ainda
              </p>
            ) : (
              logs.map((log, index) => (
                <div key={index} className={`flex items-start gap-2 p-2 rounded ${
                  log.tipo === 'error' ? 'bg-red-50' :
                  log.tipo === 'success' ? 'bg-green-50' :
                  log.tipo === 'warning' ? 'bg-orange-50' :
                  'bg-slate-50'
                }`}>
                  <Clock className="w-4 h-4 text-slate-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm">{log.mensagem}</p>
                    <p className="text-xs text-slate-500">
                      {log.timestamp.toLocaleTimeString('pt-BR')}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* ValidaÃ§Ã£o de Acesso */}
      {!permitido && (
        <Alert className="border-red-300 bg-red-50">
          <AlertTriangle className="w-4 h-4 text-red-600" />
          <AlertDescription>
            <p className="font-semibold text-red-900">ðŸ”’ Acesso Negado</p>
            <p className="text-sm text-red-700 mt-1">
              Apenas <strong>Administradores</strong> e <strong>Gerentes</strong> podem executar o fechamento automÃ¡tico de pedidos.
            </p>
          </AlertDescription>
        </Alert>
      )}

      {/* AÃ§Ãµes */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-slate-900">Pronto para executar?</p>
              <p className="text-sm text-slate-600">
                Este processo irÃ¡: baixar estoque, gerar financeiro, criar logÃ­stica e atualizar status
              </p>
              {!permitido && (
                <p className="text-xs text-red-600 mt-1">
                  âš ï¸ VocÃª nÃ£o tem permissÃ£o para executar esta aÃ§Ã£o
                </p>
              )}
            </div>
            
            <Button
              onClick={executarFluxoCompleto}
              disabled={executando || progresso === 100 || !permitido}
              className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 px-8 shadow-lg"
              size="lg"
              data-permission="Comercial.Pedido.marcarProntoFaturar"
              data-action="executar-fechamento-automatico-pedido"
              data-context-required="true"
              data-sensitive="true"
            >
              {executando ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Executando...
                </>
              ) : progresso === 100 ? (
                <>
                  <CheckCircle2 className="w-5 h-5 mr-2" />
                  ConcluÃ­do
                </>
              ) : (
                <>
                  <ArrowRight className="w-5 h-5 mr-2" />
                  ðŸš€ Executar Fluxo Completo
                </>
              )}
            </Button>
          </div>

          {progresso === 100 && (
            <Alert className="mt-4 border-green-300 bg-green-50">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <AlertDescription>
                <p className="font-semibold text-green-900">âœ… Fluxo concluÃ­do com sucesso!</p>
                <p className="text-sm text-green-700 mt-1">
                  Pedido pronto para faturamento. PrÃ³ximo passo: Gerar NF-e
                </p>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </Wrapper>
  );
}
