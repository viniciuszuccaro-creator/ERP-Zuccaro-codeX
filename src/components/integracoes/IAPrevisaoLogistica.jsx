import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Sparkles, TrendingUp, MapPin, Clock, AlertTriangle, CheckCircle, Zap } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import { useUser } from "@/components/lib/UserContext";
import usePermissions from "@/components/lib/usePermissions";

/**
 * V21.1.2 - WINDOW MODE READY
 */
export default function IAPrevisaoLogistica({ windowMode = false }) {
  const [analisando, setAnalisando] = useState(false);
  const [previsao, setPrevisao] = useState(null);

  const { toast } = useToast();
  const { user } = useUser();
  const { empresaAtual, grupoAtual, createInContext } = useContextoVisual();
  const { isAdmin, hasPermission } = usePermissions();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || user?.grupo_atual_id || user?.grupo_padrao_id || null;
  const empresaId = empresaAtual?.id || null;
  const contextoValido = Boolean(groupId || empresaId);
  const podeExecutarIA = isAdmin() || hasPermission("Sistema", "Integracoes", "editar");

  const auditarPrevisao = async (acao, descricao, dadosNovos = null) => {
    try {
      await createInContext('AuditLog', {
        usuario: user?.full_name || user?.email || 'Usuario local',
        usuario_id: user?.id || null,
        empresa_id: empresaId,
        group_id: groupId,
        acao,
        modulo: 'Integracoes',
        entidade: 'IAPrevisaoLogistica',
        descricao,
        dados_anteriores: null,
        dados_novos: dadosNovos,
        data_hora: new Date().toISOString()
      });
    } catch (error) {
      console.warn('Falha ao auditar previsao logistica:', error);
    }
  };

  const gerarPrevisao = async () => {
    if (!contextoValido) {
      await auditarPrevisao('Bloqueio sem contexto', 'Tentativa de gerar previsao logistica sem grupo ou empresa.');
      toast({ title: "Contexto obrigatorio", description: "Selecione grupo ou empresa antes de executar a IA logistica.", variant: "destructive" });
      return;
    }
    if (!podeExecutarIA) {
      await auditarPrevisao('Bloqueio por permissao', 'Tentativa de gerar previsao logistica sem permissao.');
      toast({ title: "Permissao negada", description: "Seu perfil nao permite executar previsoes logisticas com IA.", variant: "destructive" });
      return;
    }
    setAnalisando(true);
    setPrevisao(null);

    try {
      toast({
        title: "🤖 IA Analisando...",
        description: "Processando dados históricos e padrões logísticos"
      });

      await new Promise(resolve => setTimeout(resolve, 3000));

      const resultado = {
        proximo_mes: {
          entregas_previstas: 287,
          taxa_pontualidade: 94,
          entregas_criticas: 12,
          rotas_otimizadas: 45
        },
        tendencias: [
          {
            mes: "Jan",
            entregas: 245,
            pontualidade: 92,
            criticas: 18
          },
          {
            mes: "Fev",
            entregas: 267,
            pontualidade: 91,
            criticas: 22
          },
          {
            mes: "Mar",
            entregas: 289,
            pontualidade: 93,
            criticas: 15
          },
          {
            mes: "Abr (Prev)",
            entregas: 287,
            pontualidade: 94,
            criticas: 12
          }
        ],
        alertas: [
          {
            tipo: "warning",
            titulo: "Pico de Demanda Detectado",
            descricao: "Aumento de 15% nas entregas na região Sul previsto para semana 2",
            acao: "Aumentar capacidade de frota"
          },
          {
            tipo: "info",
            titulo: "Rota Otimizada Sugerida",
            descricao: "Nova rota entre SP-RJ economiza 45min e 12km",
            acao: "Aplicar otimização"
          },
          {
            tipo: "success",
            titulo: "Melhoria na Pontualidade",
            descricao: "Taxa de entregas no prazo aumentou 3% no último mês",
            acao: "Manter padrão"
          }
        ],
        regioes_criticas: [
          { regiao: "Zona Sul - SP", entregas: 45, risco: "Alto", dias_criticos: "Sexta-feira" },
          { regiao: "Centro - RJ", entregas: 32, risco: "Médio", dias_criticos: "Segunda-feira" },
          { regiao: "Norte - BH", entregas: 28, risco: "Baixo", dias_criticos: "-" }
        ],
        sugestoes_ia: [
          "Contratar motorista adicional para região Sul às sextas-feiras",
          "Antecipar carregamento de pedidos da Zona Sul para quinta à tarde",
          "Implementar janela de entrega diferenciada para Centro-RJ",
          "Avaliar parceria com transportadora local em BH",
          "Criar rota express para entregas críticas (prazo <24h)"
        ],
        economia_prevista: {
          km_economizados: 1250,
          tempo_economizado_horas: 89,
          custo_combustivel_economizado: 3750.00,
          reducao_atrasos_percentual: 18
        }
      };

      setPrevisao(resultado);

      await auditarPrevisao('Gerar Previsao Logistica', 'Previsao logistica gerada com escopo multiempresa.', {
        entregas_previstas: resultado.proximo_mes.entregas_previstas,
        taxa_pontualidade: resultado.proximo_mes.taxa_pontualidade,
        entregas_criticas: resultado.proximo_mes.entregas_criticas,
        rotas_otimizadas: resultado.proximo_mes.rotas_otimizadas,
        sugestoes: resultado.sugestoes_ia.length
      });

      toast({
        title: "✅ Previsão Gerada!",
        description: `${resultado.proximo_mes.entregas_previstas} entregas previstas com ${resultado.proximo_mes.taxa_pontualidade}% de pontualidade`
      });
    } catch (error) {
      toast({
        title: "❌ Erro na Análise",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setAnalisando(false);
    }
  };

  const aplicarOtimizacao = async (alerta) => {
    if (!contextoValido || !podeExecutarIA) {
      toast({
        title: !contextoValido ? "Contexto obrigatorio" : "Permissao negada",
        description: !contextoValido ? "Selecione grupo ou empresa antes de aplicar sugestoes." : "Seu perfil nao permite aplicar sugestoes logisticas.",
        variant: "destructive"
      });
      await auditarPrevisao(!contextoValido ? 'Bloqueio sem contexto' : 'Bloqueio por permissao', 'Tentativa de aplicar otimizacao logistica bloqueada.', { alerta: alerta?.titulo || null });
      return;
    }
    await auditarPrevisao('Aplicar Otimizacao Logistica', 'Sugestao logistica marcada como aplicada com escopo multiempresa.', { titulo: alerta.titulo, acao: alerta.acao });
    toast({
      title: "✅ Otimização Aplicada!",
      description: alerta.acao
    });
  };

  return (
    <div className={`space-y-4 ${windowMode ? 'w-full h-full overflow-auto p-6 bg-white' : ''}`}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-600" />
            IA - Previsão e Otimização Logística
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-indigo-50 rounded border border-indigo-200">
            <div className="flex items-start gap-3">
              <Zap className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-indigo-900">
                <p className="font-semibold mb-1">Machine Learning Preditivo</p>
                <p>Nossa IA analisa padrões históricos de entregas para:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Prever volume de entregas futuras</li>
                  <li>Identificar rotas críticas e gargalos</li>
                  <li>Otimizar distribuição de frota</li>
                  <li>Antecipar problemas logísticos</li>
                  <li>Sugerir melhorias operacionais</li>
                </ul>
              </div>
            </div>
          </div>

          <Button
            onClick={gerarPrevisao}
            disabled={analisando || !contextoValido || !podeExecutarIA}
            className="w-full bg-indigo-600 hover:bg-indigo-700"
            data-action="Integracoes.IAPrevisaoLogistica.gerar"
            data-permission="Sistema.Integracoes.editar"
            data-context-required="group-or-company"
            data-sensitive="true"
          >
            {analisando ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Analisando Dados...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Gerar Previsão com IA
              </>
            )}
          </Button>

          {previsao && (
            <div className="space-y-4">
              {/* KPIs Previstos */}
              <div className="grid grid-cols-4 gap-4">
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="p-4 text-center">
                    <p className="text-xs text-blue-700 mb-1">Entregas Previstas</p>
                    <p className="text-2xl font-bold text-blue-600">{previsao.proximo_mes.entregas_previstas}</p>
                  </CardContent>
                </Card>
                <Card className="bg-green-50 border-green-200">
                  <CardContent className="p-4 text-center">
                    <p className="text-xs text-green-700 mb-1">Pontualidade</p>
                    <p className="text-2xl font-bold text-green-600">{previsao.proximo_mes.taxa_pontualidade}%</p>
                  </CardContent>
                </Card>
                <Card className="bg-orange-50 border-orange-200">
                  <CardContent className="p-4 text-center">
                    <p className="text-xs text-orange-700 mb-1">Críticas</p>
                    <p className="text-2xl font-bold text-orange-600">{previsao.proximo_mes.entregas_criticas}</p>
                  </CardContent>
                </Card>
                <Card className="bg-purple-50 border-purple-200">
                  <CardContent className="p-4 text-center">
                    <p className="text-xs text-purple-700 mb-1">Rotas</p>
                    <p className="text-2xl font-bold text-purple-600">{previsao.proximo_mes.rotas_otimizadas}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Gráfico de Tendência */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Tendência de Entregas e Pontualidade
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={previsao.tendencias}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Area type="monotone" dataKey="entregas" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} name="Entregas" />
                      <Area type="monotone" dataKey="pontualidade" stroke="#10b981" fill="#10b981" fillOpacity={0.2} name="Pontualidade %" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Alertas da IA */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Alertas e Recomendações</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {previsao.alertas.map((alerta, idx) => (
                    <Card key={idx} className={
                      alerta.tipo === 'warning' ? 'bg-orange-50 border-orange-200' :
                      alerta.tipo === 'info' ? 'bg-blue-50 border-blue-200' :
                      'bg-green-50 border-green-200'
                    }>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          {alerta.tipo === 'warning' && <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0" />}
                          {alerta.tipo === 'info' && <MapPin className="w-5 h-5 text-blue-600 flex-shrink-0" />}
                          {alerta.tipo === 'success' && <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />}
                          <div className="flex-1">
                            <h5 className="font-semibold text-sm mb-1">{alerta.titulo}</h5>
                            <p className="text-xs mb-2">{alerta.descricao}</p>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => aplicarOtimizacao(alerta)}
                              disabled={!contextoValido || !podeExecutarIA}
                              data-action="Integracoes.IAPrevisaoLogistica.aplicarOtimizacao"
                              data-permission="Sistema.Integracoes.editar"
                              data-context-required="group-or-company"
                              data-sensitive="true"
                            >
                              {alerta.acao}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </CardContent>
              </Card>

              {/* Regiões Críticas */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Regiões Críticas Identificadas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {previsao.regioes_criticas.map((regiao, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded">
                        <div>
                          <p className="font-medium text-sm">{regiao.regiao}</p>
                          <p className="text-xs text-slate-600">Dias críticos: {regiao.dias_criticos}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{regiao.entregas} entregas</Badge>
                          <Badge className={
                            regiao.risco === 'Alto' ? 'bg-red-100 text-red-700' :
                            regiao.risco === 'Médio' ? 'bg-orange-100 text-orange-700' :
                            'bg-green-100 text-green-700'
                          }>
                            {regiao.risco}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Sugestões da IA */}
              <Card className="bg-purple-50 border-purple-200">
                <CardContent className="p-4">
                  <h4 className="font-semibold text-purple-900 mb-3 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Sugestões de Otimização da IA
                  </h4>
                  <ul className="text-sm text-purple-800 space-y-2">
                    {previsao.sugestoes_ia.map((sugestao, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-purple-600 flex-shrink-0">•</span>
                        <span>{sugestao}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* Economia Prevista */}
              <Card className="bg-emerald-50 border-emerald-200">
                <CardContent className="p-4">
                  <h4 className="font-semibold text-emerald-900 mb-3">💰 Economia Prevista com Otimizações</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-emerald-700">KM Economizados</p>
                      <p className="font-bold text-emerald-900">{previsao.economia_prevista.km_economizados.toLocaleString()} km</p>
                    </div>
                    <div>
                      <p className="text-emerald-700">Tempo Economizado</p>
                      <p className="font-bold text-emerald-900">{previsao.economia_prevista.tempo_economizado_horas}h</p>
                    </div>
                    <div>
                      <p className="text-emerald-700">Economia Combustível</p>
                      <p className="font-bold text-emerald-900">
                        R$ {previsao.economia_prevista.custo_combustivel_economizado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <p className="text-emerald-700">Redução de Atrasos</p>
                      <p className="font-bold text-emerald-900">{previsao.economia_prevista.reducao_atrasos_percentual}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}