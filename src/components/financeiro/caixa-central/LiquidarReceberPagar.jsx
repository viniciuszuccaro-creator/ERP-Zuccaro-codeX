import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import useContextoVisual from '@/components/lib/useContextoVisual';
import usePermissions from '@/components/lib/usePermissions';
import { useToast } from '@/components/ui/use-toast';
import { useUser } from '@/components/lib/UserContext';
import { 
  TrendingUp, 
  TrendingDown, 
  Send, 
  ArrowRight, 
  AlertCircle, 
  Clock, 
  CheckCircle2 
} from 'lucide-react';

export default function LiquidarReceberPagar() {
  const { filterInContext, empresaAtual, grupoAtual, createInContext } = useContextoVisual();
  const { canCreate, hasPermission } = usePermissions();
  const { toast } = useToast();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [abaAtiva, setAbaAtiva] = useState("receber");
  const [titulosSelecionadosReceber, setTitulosSelecionadosReceber] = useState([]);
  const [titulosSelecionadosPagar, setTitulosSelecionadosPagar] = useState([]);
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const contextKey = empresaAtual?.id || groupId || "sem-contexto";
  const contextoValido = contextKey !== "sem-contexto";
  const podeEnviarCaixa = canCreate('Financeiro', 'Caixa') ||
    canCreate('Financeiro', 'Caixa Central') ||
    hasPermission('Financeiro', null, 'baixar');

  const auditarLiquidacao = async ({ acao, descricao, dadosNovos, sucesso = true }) => {
    try {
      await base44.entities.AuditLog.create({
        acao,
        modulo: 'Financeiro',
        entidade: 'CaixaOrdemLiquidacao',
        descricao,
        usuario_id: user?.id || null,
        usuario: user?.full_name || user?.email || 'Usuario local',
        empresa_id: empresaId,
        group_id: groupId,
        grupo_id: groupId,
        tipo_auditoria: sucesso ? 'operacional' : 'seguranca',
        dados_novos: dadosNovos,
        sucesso,
        data_hora: new Date().toISOString()
      });
    } catch (error) {
      console.warn('Falha ao auditar liquidacao:', error);
    }
  };

  const { data: contasReceber = [] } = useQuery({
    queryKey: ['contasReceber-liquidacao', contextKey],
    queryFn: () => filterInContext('ContaReceber', { 
      status: { $in: ['Pendente', 'Atrasado'] }
    }, '-data_vencimento'),
    enabled: contextoValido,
  });

  const { data: contasPagar = [] } = useQuery({
    queryKey: ['contasPagar-liquidacao', contextKey],
    queryFn: () => filterInContext('ContaPagar', { 
      status: { $in: ['Pendente', 'Aprovado'] }
    }, '-data_vencimento'),
    enabled: contextoValido,
  });

  const enviarParaCaixaMutation = useMutation({
    mutationFn: async ({ titulos, tipo }) => {
      if (!contextoValido || !podeEnviarCaixa) throw new Error("Sem contexto ou permissÃ£o para enviar ao caixa.");
      const ordens = await Promise.all(titulos.map(async (titulo) => {
        const ordemData = {
          tipo_operacao: tipo === 'receber' ? 'Recebimento' : 'Pagamento',
          origem: tipo === 'receber' ? 'Contas a Receber' : 'Contas a Pagar',
          valor_total: titulo.valor,
          forma_pagamento_pretendida: tipo === 'receber' ? 'PIX' : 'Transferência',
          status: 'Pendente',
          titulos_vinculados: [{
            titulo_id: titulo.id,
            tipo_titulo: tipo === 'receber' ? 'ContaReceber' : 'ContaPagar',
            numero_titulo: titulo.numero_documento || titulo.descricao,
            cliente_fornecedor_nome: tipo === 'receber' ? titulo.cliente : titulo.fornecedor,
            valor_titulo: titulo.valor
          }],
          data_ordem: new Date().toISOString(),
          ...(empresaAtual?.id ? { empresa_id: empresaAtual.id } : {}),
          ...(groupId ? { group_id: groupId, grupo_id: groupId } : {}),
          criado_por: user?.full_name || user?.email,
          criado_por_id: user?.id
        };
        return await createInContext('CaixaOrdemLiquidacao', ordemData);
      }));
      return ordens;
    },
    onSuccess: async (ordens) => {
      await auditarLiquidacao({
        acao: 'Criacao',
        descricao: `${ordens.length} titulo(s) enviados para ordem de liquidacao no Caixa Central.`,
        dadosNovos: { quantidade: ordens.length }
      });
      queryClient.invalidateQueries({ queryKey: ['caixa-ordens-liquidacao'] });
      toast({ title: `✅ ${ordens.length} título(s) enviado(s) para Caixa!` });
      setTitulosSelecionadosReceber([]);
      setTitulosSelecionadosPagar([]);
    }
  });

  return (
    <div className="space-y-4">
      <Tabs value={abaAtiva} onValueChange={setAbaAtiva}>
        <TabsList className="bg-white border shadow-sm">
          <TabsTrigger value="receber" className="data-[state=active]:bg-green-600 data-[state=active]:text-white">
            <TrendingUp className="w-4 h-4 mr-2" />
            Liquidar Receber
          </TabsTrigger>
          <TabsTrigger value="pagar" className="data-[state=active]:bg-red-600 data-[state=active]:text-white">
            <TrendingDown className="w-4 h-4 mr-2" />
            Liquidar Pagar
          </TabsTrigger>
        </TabsList>

        {/* ABA: LIQUIDAR CONTAS A RECEBER */}
        <TabsContent value="receber" className="space-y-4">
          <Alert className="border-green-300 bg-green-50">
            <AlertDescription className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-green-900">💰 Liquidação de Contas a Receber</p>
                <p className="text-xs text-green-700">Selecione títulos para enviar ao Caixa</p>
              </div>
              {titulosSelecionadosReceber.length > 0 && (
                <Button
                  onClick={() => {
                    const titulos = contasReceber.filter(c => titulosSelecionadosReceber.includes(c.id));
                    if (!window.confirm(`Enviar ${titulos.length} titulo(s) a receber para o Caixa Central?`)) {
                      auditarLiquidacao({ acao: 'Cancelamento', descricao: 'Usuario cancelou envio de contas a receber para liquidacao.', dadosNovos: { quantidade: titulos.length }, sucesso: false });
                      return;
                    }
                    enviarParaCaixaMutation.mutate({ titulos, tipo: 'receber' });
                  }}
                  disabled={!contextoValido || !podeEnviarCaixa || enviarParaCaixaMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                  data-action="LiquidarReceberPagar.enviar_receber_caixa"
                  data-permission="Financeiro.Caixa.criar"
                  data-context-required="true"
                  data-sensitive
                >
                  <Send className="w-4 h-4 mr-2" />
                  Enviar {titulosSelecionadosReceber.length} para Caixa
                </Button>
              )}
            </AlertDescription>
          </Alert>

          <Card className="border-0 shadow-md">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="w-12">
                      <Checkbox
                        checked={titulosSelecionadosReceber.length === contasReceber.length && contasReceber.length > 0}
                        onCheckedChange={(checked) => setTitulosSelecionadosReceber(checked ? contasReceber.map(c => c.id) : [])}
                        disabled={!contextoValido || !podeEnviarCaixa}
                      />
                    </TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contasReceber.map(conta => (
                    <TableRow key={conta.id}>
                      <TableCell>
                        <Checkbox
                          checked={titulosSelecionadosReceber.includes(conta.id)}
                          onCheckedChange={() => {
                            setTitulosSelecionadosReceber(prev =>
                              prev.includes(conta.id) ? prev.filter(id => id !== conta.id) : [...prev, conta.id]
                            );
                          }}
                          disabled={!contextoValido || !podeEnviarCaixa}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{conta.cliente}</TableCell>
                      <TableCell className="max-w-xs truncate">{conta.descricao}</TableCell>
                      <TableCell className="text-sm">{new Date(conta.data_vencimento).toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell className="font-semibold">R$ {(conta.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell>
                        <Badge className={conta.status === 'Atrasado' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}>
                          {conta.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (!window.confirm('Enviar este titulo a receber para o Caixa Central?')) {
                              auditarLiquidacao({ acao: 'Cancelamento', descricao: 'Usuario cancelou envio individual de conta a receber.', dadosNovos: { titulo_id: conta.id }, sucesso: false });
                              return;
                            }
                            enviarParaCaixaMutation.mutate({ titulos: [conta], tipo: 'receber' });
                          }}
                          disabled={!contextoValido || !podeEnviarCaixa || enviarParaCaixaMutation.isPending}
                          data-action="LiquidarReceberPagar.enviar_receber_caixa"
                          data-permission="Financeiro.Caixa.criar"
                          data-context-required="true"
                          data-sensitive
                        >
                          <ArrowRight className="w-4 h-4 mr-1" />
                          Enviar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {contasReceber.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  <CheckCircle2 className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p>Nenhuma conta a receber pendente</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA: LIQUIDAR CONTAS A PAGAR */}
        <TabsContent value="pagar" className="space-y-4">
          <Alert className="border-red-300 bg-red-50">
            <AlertDescription className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-red-900">💸 Liquidação de Contas a Pagar</p>
                <p className="text-xs text-red-700">Selecione títulos para enviar ao Caixa</p>
              </div>
              {titulosSelecionadosPagar.length > 0 && (
                <Button
                  onClick={() => {
                    const titulos = contasPagar.filter(c => titulosSelecionadosPagar.includes(c.id));
                    if (!window.confirm(`Enviar ${titulos.length} titulo(s) a pagar para o Caixa Central?`)) {
                      auditarLiquidacao({ acao: 'Cancelamento', descricao: 'Usuario cancelou envio de contas a pagar para liquidacao.', dadosNovos: { quantidade: titulos.length }, sucesso: false });
                      return;
                    }
                    enviarParaCaixaMutation.mutate({ titulos, tipo: 'pagar' });
                  }}
                  disabled={!contextoValido || !podeEnviarCaixa || enviarParaCaixaMutation.isPending}
                  className="bg-red-600 hover:bg-red-700"
                  data-action="LiquidarReceberPagar.enviar_pagar_caixa"
                  data-permission="Financeiro.Caixa.criar"
                  data-context-required="true"
                  data-sensitive
                >
                  <Send className="w-4 h-4 mr-2" />
                  Enviar {titulosSelecionadosPagar.length} para Caixa
                </Button>
              )}
            </AlertDescription>
          </Alert>

          <Card className="border-0 shadow-md">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="w-12">
                      <Checkbox
                        checked={titulosSelecionadosPagar.length === contasPagar.length && contasPagar.length > 0}
                        onCheckedChange={(checked) => setTitulosSelecionadosPagar(checked ? contasPagar.map(c => c.id) : [])}
                        disabled={!contextoValido || !podeEnviarCaixa}
                      />
                    </TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contasPagar.map(conta => (
                    <TableRow key={conta.id}>
                      <TableCell>
                        <Checkbox
                          checked={titulosSelecionadosPagar.includes(conta.id)}
                          onCheckedChange={() => {
                            setTitulosSelecionadosPagar(prev =>
                              prev.includes(conta.id) ? prev.filter(id => id !== conta.id) : [...prev, conta.id]
                            );
                          }}
                          disabled={!contextoValido || !podeEnviarCaixa}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{conta.fornecedor}</TableCell>
                      <TableCell className="max-w-xs truncate">{conta.descricao}</TableCell>
                      <TableCell className="text-sm">{new Date(conta.data_vencimento).toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell className="font-semibold">R$ {(conta.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell>
                        <Badge className={conta.status === 'Pendente' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}>
                          {conta.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (!window.confirm('Enviar este titulo a pagar para o Caixa Central?')) {
                              auditarLiquidacao({ acao: 'Cancelamento', descricao: 'Usuario cancelou envio individual de conta a pagar.', dadosNovos: { titulo_id: conta.id }, sucesso: false });
                              return;
                            }
                            enviarParaCaixaMutation.mutate({ titulos: [conta], tipo: 'pagar' });
                          }}
                          disabled={!contextoValido || !podeEnviarCaixa || enviarParaCaixaMutation.isPending}
                          data-action="LiquidarReceberPagar.enviar_pagar_caixa"
                          data-permission="Financeiro.Caixa.criar"
                          data-context-required="true"
                          data-sensitive
                        >
                          <ArrowRight className="w-4 h-4 mr-1" />
                          Enviar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {contasPagar.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  <CheckCircle2 className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p>Nenhuma conta a pagar pendente</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
