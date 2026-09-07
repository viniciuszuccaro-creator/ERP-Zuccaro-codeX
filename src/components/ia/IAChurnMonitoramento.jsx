import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, TrendingDown, Phone, Mail, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import { useUser } from '@/components/lib/UserContext';
import { buildChurnOportunidade, buildChurnSuggestions } from '@/components/lib/iaTransversalPolicy';

export default function IAChurnMonitoramento() {
  const queryClient = useQueryClient();
  const { contexto, empresaAtual, grupoAtual, filterInContext, createInContext, updateInContext } = useContextoVisual();
  const { user } = useUser();
  const [sugestoes, setSugestoes] = React.useState([]);
  const grupoAtivoId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || (() => {
    try { return localStorage.getItem('group_atual_id'); } catch { return null; }
  })();
  const empresaAtivaId = contexto === 'grupo' ? null : empresaAtual?.id;
  const contextoValido = !!(empresaAtivaId || grupoAtivoId);

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes', 'ia-churn', empresaAtivaId || 'sem', grupoAtivoId || 'sem'],
    queryFn: () => filterInContext('Cliente', {}, 'nome', 1000),
    enabled: contextoValido,
  });

  const { data: pedidos = [] } = useQuery({
    queryKey: ['pedidos', 'ia-churn', empresaAtivaId || 'sem', grupoAtivoId || 'sem'],
    queryFn: () => filterInContext('Pedido', {}, '-data_pedido', 1000),
    enabled: contextoValido,
  });

  const calcularChurnMutation = useMutation({
    mutationFn: async () => {
      if (!contextoValido) {
        throw new Error('Selecione um grupo ou empresa antes de executar a analise de churn.');
      }

      const clientesEmRisco = buildChurnSuggestions({ clientes, pedidos });

      await createInContext('AuditLog', {
        usuario: user?.full_name || user?.email || 'Sistema',
        usuario_id: user?.id || null,
        empresa_id: empresaAtivaId || null,
        group_id: grupoAtivoId || null,
        acao: 'Analise',
        modulo: 'IA',
        entidade: 'IA_Churn',
        descricao: 'Analise de churn gerou sugestoes sem autonomia de gravacao',
        dados_novos: { clientes_analisados: clientes.length, clientes_em_risco: clientesEmRisco.length },
        sucesso: true,
        data_hora: new Date().toISOString(),
      });

      return clientesEmRisco;
    },
    onSuccess: (clientesEmRisco) => {
      setSugestoes(clientesEmRisco);
      toast.success(`Análise concluída: ${clientesEmRisco.length} clientes em risco sugeridos. Confirme para gravar.`);
    },
    onError: (error) => {
      toast.error(String(error?.message || error));
    }
  });

  const aplicarSugestaoMutation = useMutation({
    mutationFn: async (cliente) => {
      if (!contextoValido) {
        throw new Error('Selecione um grupo ou empresa antes de gravar a sugestao.');
      }
      const confirmado = window.confirm(`Gravar sugestao de churn para ${cliente.nome}? Isso atualiza o cadastro e cria oportunidade.`);
      if (!confirmado) {
        throw new Error('Gravacao cancelada.');
      }
      await updateInContext('Cliente', cliente.id, {
        dias_sem_comprar: cliente.dias_sem_comprar,
        risco_churn: cliente.risco_churn,
        score_saude_cliente: cliente.score_saude_cliente,
      });
      await createInContext('Oportunidade', buildChurnOportunidade(cliente));
      return cliente.id;
    },
    onSuccess: (clienteId) => {
      setSugestoes((atual) => atual.filter((item) => item.id !== clienteId));
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      queryClient.invalidateQueries({ queryKey: ['oportunidades'] });
      toast.success('Sugestao de churn gravada apos confirmacao.');
    },
    onError: (error) => {
      if (String(error?.message || '').includes('cancelada')) return;
      toast.error(String(error?.message || error));
    }
  });

  const clientesRisco = sugestoes.length
    ? sugestoes
    : clientes.filter(c => c.risco_churn === 'Alto' || c.risco_churn === 'Crítico');

  return (
    <div className="w-full h-full p-6 space-y-6 overflow-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <TrendingDown className="w-7 h-7 text-orange-600" />
            IA de Monitoramento de Churn
          </h2>
          <p className="text-slate-600 mt-1">Sugestão de clientes em risco. A IA não grava sozinha.</p>
        </div>
        <Button
          onClick={() => calcularChurnMutation.mutate()}
          disabled={calcularChurnMutation.isPending || !contextoValido}
          className="bg-orange-600 hover:bg-orange-700"
          data-action="IA.Churn.executar"
        >
          {calcularChurnMutation.isPending ? 'Calculando...' : 'Executar Análise'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Clientes em Risco</p>
                <p className="text-2xl font-bold text-red-600">{clientesRisco.length}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Críticos</p>
                <p className="text-2xl font-bold text-red-700">
                  {clientesRisco.filter(c => c.risco_churn === 'Crítico').length}
                </p>
              </div>
              <TrendingDown className="w-8 h-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Altos</p>
                <p className="text-2xl font-bold text-orange-600">
                  {clientesRisco.filter(c => c.risco_churn === 'Alto').length}
                </p>
              </div>
              <TrendingDown className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Clientes em Risco</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {clientesRisco.map(cliente => (
              <div key={cliente.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900">{cliente.nome}</h3>
                    <p className="text-sm text-slate-600 mt-1">
                      Última compra: {cliente.data_ultima_compra 
                        ? new Date(cliente.data_ultima_compra).toLocaleDateString('pt-BR')
                        : 'Nunca'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {cliente.dias_sem_comprar} dias sem comprar • Score: {cliente.score_saude_cliente}/100
                    </p>
                  </div>
                  <Badge className={`
                    ${cliente.risco_churn === 'Crítico' ? 'bg-red-600' : ''}
                    ${cliente.risco_churn === 'Alto' ? 'bg-orange-600' : ''}
                  `}>
                    {cliente.risco_churn}
                  </Badge>
                </div>
                
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    className="flex-1 bg-orange-600 hover:bg-orange-700"
                    disabled={!contextoValido || aplicarSugestaoMutation.isPending}
                    onClick={() => aplicarSugestaoMutation.mutate(cliente)}
                    data-action="IA.Churn.confirmar"
                  >
                    Confirmar e gravar
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1">
                    <Phone className="w-4 h-4 mr-2" />
                    Ligar
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1">
                    <MessageSquare className="w-4 h-4 mr-2" />
                    WhatsApp
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1">
                    <Mail className="w-4 h-4 mr-2" />
                    E-mail
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
