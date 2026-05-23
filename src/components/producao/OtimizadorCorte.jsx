import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import { useUser } from "@/components/lib/UserContext";
import usePermissions from "@/components/lib/usePermissions";
import { 
  Scissors, 
  TrendingDown, 
  Calculator, 
  Save,
  AlertTriangle,
  CheckCircle 
} from "lucide-react";

export default function OtimizadorCorte({ itens = [], onOtimizacaoCalculada }) {
  const { empresaAtual, grupoAtual } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const { user } = useUser();
  const { toast } = useToast();
  const empresaId = empresaAtual?.id || itens?.[0]?.empresa_id || null;
  const groupId = grupoAtual?.id || empresaAtual?.group_id || itens?.[0]?.group_id || itens?.[0]?.grupo_id || null;
  const contextoValido = Boolean(groupId || empresaId);
  const canOptimize = hasPermission("Produção", "Engenharia", "visualizar") || hasPermission("Producao", "Engenharia", "visualizar") || hasPermission("Producao", "Ordens Producao", "visualizar");
  const canSaveEstoque = hasPermission("Estoque", "Movimentacoes", "criar") || hasPermission("Estoque", "Produtos", "editar") || hasPermission("Producao", "Engenharia", "editar");
  const [tamanhoBarraPadrao, setTamanhoBarraPadrao] = useState(1200); // 12 metros em cm
  const [otimizacao, setOtimizacao] = useState(null);
  const [calculando, setCalculando] = useState(false);


  const auditarOtimizador = async ({ acao, descricao, sucesso = true, dadosNovos = {} }) => {
    try {
      await base44.entities.AuditLog.create({
        usuario_id: user?.id,
        usuario: user?.full_name || user?.email || 'Usuário',
        acao,
        modulo: 'Produção',
        tipo_auditoria: sucesso ? 'operacional' : 'seguranca',
        entidade: 'OtimizadorCorte',
        descricao,
        empresa_id: empresaId,
        group_id: groupId,
        grupo_id: groupId,
        sucesso,
        dados_novos: dadosNovos,
        detalhes: {
          itens: itens.length,
          tamanhoBarraPadrao,
          contexto: empresaId ? 'empresa' : 'grupo',
          ...dadosNovos,
        },
        data_hora: new Date().toISOString(),
      });
    } catch (error) {
      console.warn('Falha ao auditar otimizador de corte:', error);
    }
  };
  // ALGORITMO DE OTIMIZAÇÃO DE CORTE (First Fit Decreasing)
  const calcularOtimizacao = async () => {
    if (!contextoValido || !canOptimize) {
      await auditarOtimizador({
        acao: 'OtimizadorCorte.calculo_bloqueado',
        descricao: 'Tentativa de calcular otimizacao sem contexto ou permissao.',
        sucesso: false,
        dadosNovos: { motivo: !contextoValido ? 'contexto_obrigatorio' : 'permissao_negada' },
      });
      toast({ title: 'Acesso negado', description: 'Selecione contexto valido e confirme permissao para otimizar corte.', variant: 'destructive' });
      return;
    }

    setCalculando(true);

    try {
      // 1. Preparar lista de cortes necessários (ordenar do maior para o menor)
      const cortes = [];
      itens.forEach(item => {
        for (let i = 0; i < item.quantidade; i++) {
          cortes.push({
            posicao: item.posicao,
            comprimento: item.comprimento_total,
            bitola: item.bitola,
            elemento: item.elemento_estrutural
          });
        }
      });

      // Ordenar do maior para o menor (FFD - First Fit Decreasing)
      cortes.sort((a, b) => b.comprimento - a.comprimento);

      // 2. Algoritmo de empacotamento (Bin Packing)
      const barras = [];
      const margemCorte = 5; // 5cm de margem para cada corte (lâmina)

      cortes.forEach(corte => {
        let alocado = false;

        // Tentar alocar em uma barra existente
        for (let barra of barras) {
          const espacoUsado = barra.cortes.reduce((sum, c) => sum + c.comprimento, 0) + 
                              (barra.cortes.length * margemCorte);
          const espacoDisponivel = tamanhoBarraPadrao - espacoUsado;

          if (espacoDisponivel >= (corte.comprimento + margemCorte)) {
            barra.cortes.push(corte);
            alocado = true;
            break;
          }
        }

        // Se não coube em nenhuma barra, criar nova
        if (!alocado) {
          barras.push({
            numero: barras.length + 1,
            cortes: [corte],
            tamanho_padrao: tamanhoBarraPadrao
          });
        }
      });

      // 3. Calcular estatísticas
      const totalCortes = cortes.length;
      const barrasUsadas = barras.length;
      const totalRefugo = barras.reduce((sum, barra) => {
        const usado = barra.cortes.reduce((s, c) => s + c.comprimento, 0) + 
                      (barra.cortes.length * margemCorte);
        return sum + (tamanhoBarraPadrao - usado);
      }, 0);

      const totalComprimentoUtil = cortes.reduce((sum, c) => sum + c.comprimento, 0);
      const totalComprimentoTotal = barrasUsadas * tamanhoBarraPadrao;
      const aproveitamento = ((totalComprimentoUtil / totalComprimentoTotal) * 100).toFixed(2);

      // 4. Identificar pontas reaproveitáveis (> 100cm)
      const pontasReutilizaveis = barras
        .map(barra => {
          const usado = barra.cortes.reduce((s, c) => s + c.comprimento, 0) + 
                        (barra.cortes.length * margemCorte);
          const sobra = tamanhoBarraPadrao - usado;
          return {
            barra: barra.numero,
            tamanho: sobra,
            bitola: barra.cortes[0].bitola
          };
        })
        .filter(ponta => ponta.tamanho >= 100);

      const resultado = {
        barras,
        estatisticas: {
          total_cortes: totalCortes,
          barras_usadas: barrasUsadas,
          total_refugo_cm: totalRefugo,
          total_refugo_kg: calcularPesoRefugo(totalRefugo, barras),
          aproveitamento_percentual: parseFloat(aproveitamento),
          pontas_reutilizaveis: pontasReutilizaveis,
          economia_estimada: calcularEconomia(pontasReutilizaveis)
        }
      };

      setOtimizacao(resultado);

      if (onOtimizacaoCalculada) {
        onOtimizacaoCalculada(resultado);
      }

      await auditarOtimizador({
        acao: 'OtimizadorCorte.calcular',
        descricao: 'Otimização de corte calculada.',
        dadosNovos: resultado.estatisticas,
      });

    } catch (error) {
      console.error("Erro na otimização:", error);
    } finally {
      setCalculando(false);
    }
  };

  const calcularPesoRefugo = (totalRefugoCm, barras) => {
    // Pega a bitola mais comum e estima o peso
    const pesosPorMetro = {
      "6.3mm": 0.245,
      "8.0mm": 0.395,
      "10.0mm": 0.617,
      "12.5mm": 0.963,
      "16.0mm": 1.578,
      "20.0mm": 2.466,
      "25.0mm": 3.853
    };

    let pesoTotal = 0;
    barras.forEach(barra => {
      const bitola = barra.cortes[0]?.bitola || "12.5mm";
      const usado = barra.cortes.reduce((s, c) => s + c.comprimento, 0);
      const sobra = barra.tamanho_padrao - usado;
      const pesoSobra = (sobra / 100) * (pesosPorMetro[bitola] || 0.963);
      pesoTotal += pesoSobra;
    });

    return pesoTotal.toFixed(2);
  };

  const calcularEconomia = (pontas) => {
    const custoFerroKg = 6.50; // R$/kg
    const pesoTotal = pontas.reduce((sum, ponta) => {
      const pesosPorMetro = {
        "6.3mm": 0.245,
        "8.0mm": 0.395,
        "10.0mm": 0.617,
        "12.5mm": 0.963,
        "16.0mm": 1.578,
        "20.0mm": 2.466,
        "25.0mm": 3.853
      };
      const peso = (ponta.tamanho / 100) * (pesosPorMetro[ponta.bitola] || 0.963);
      return sum + peso;
    }, 0);

    return (pesoTotal * custoFerroKg).toFixed(2);
  };

  const salvarPontasNoEstoque = async () => {
    if (!otimizacao) return;

    const pontas = otimizacao.estatisticas.pontas_reutilizaveis || [];
    if (!contextoValido || !canSaveEstoque) {
      await auditarOtimizador({
        acao: 'OtimizadorCorte.salvar_pontas_bloqueado',
        descricao: 'Tentativa de salvar pontas no estoque sem contexto ou permissão.',
        sucesso: false,
        dadosNovos: { pontas: pontas.length, motivo: !contextoValido ? 'contexto_obrigatorio' : 'permissao_negada' },
      });
      toast({ title: 'Acesso negado', description: 'Selecione contexto válido e confirme permissão para movimentar estoque.', variant: 'destructive' });
      return;
    }

    if (!window.confirm(`Confirmar inclusão de ${pontas.length} pontas reutilizáveis no Estoque?`)) {
      await auditarOtimizador({
        acao: 'OtimizadorCorte.salvar_pontas_cancelado',
        descricao: 'Usuário cancelou a inclusão de pontas reutilizáveis no estoque.',
        sucesso: false,
        dadosNovos: { pontas: pontas.length, motivo: 'confirmacao_cancelada' },
      });
      return;
    }

    try {
      const movimentacoes = [];
      for (const ponta of pontas) {
        const quantidadeKg = Number(((ponta.tamanho / 100) * 0.963).toFixed(3));
        const movimentacao = await base44.entities.MovimentacaoEstoque.create({
          group_id: groupId,
          grupo_id: groupId,
          empresa_id: empresaId,
          tipo_movimento: 'entrada',
          origem_movimento: 'producao_otimizador_corte',
          produto_descricao: `Ponta reutilizável ${ponta.bitola || ''} - ${ponta.tamanho}cm`,
          quantidade: quantidadeKg,
          unidade_medida: 'kg',
          documento: 'Otimizador de Corte',
          motivo: 'Entrada de ponta reutilizável gerada pelo otimizador de corte',
          data_movimentacao: new Date().toISOString(),
          responsavel: user?.full_name || user?.email || 'Usuário',
          responsavel_id: user?.id,
          observacoes: `Barra #${ponta.barra}; tamanho ${ponta.tamanho}cm; bitola ${ponta.bitola || 'n/i'}`,
        });
        movimentacoes.push(movimentacao);
      }

      await auditarOtimizador({
        acao: 'OtimizadorCorte.salvar_pontas_estoque',
        descricao: 'Pontas reutilizáveis incluídas no estoque.',
        dadosNovos: { pontas: pontas.length, movimentacoes_ids: movimentacoes.map(m => m.id) },
      });
      toast({ title: 'Pontas salvas no estoque', description: `${pontas.length} pontas reutilizáveis registradas.` });
    } catch (error) {
      console.error('Erro ao salvar pontas:', error);
      await auditarOtimizador({
        acao: 'OtimizadorCorte.salvar_pontas_erro',
        descricao: 'Erro ao salvar pontas reutilizáveis no estoque.',
        sucesso: false,
        dadosNovos: { erro: error?.message, pontas: pontas.length },
      });
      toast({ title: 'Erro ao salvar pontas', description: 'Não foi possível registrar as pontas no estoque.', variant: 'destructive' });
    }
  };

  return (
    <Card data-permission="Producao.Engenharia.visualizar" data-context-required="true">
      <CardHeader className="bg-gradient-to-r from-emerald-50 to-green-50">
        <CardTitle className="flex items-center gap-2">
          <Scissors className="w-5 h-5 text-emerald-600" />
          Otimizador de Corte (Nest)
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* Configuração */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Tamanho Barra Padrão (cm)</Label>
              <Input
                type="number"
                disabled={!contextoValido || !canOptimize}
                data-permission="Producao.Engenharia.visualizar"
                data-context-required="true"
                value={tamanhoBarraPadrao}
                onChange={(e) => setTamanhoBarraPadrao(parseInt(e.target.value))}
                placeholder="1200"
              />
              <p className="text-xs text-slate-500 mt-1">
                Padrão: 1200cm (12 metros)
              </p>
            </div>
            <div className="flex items-end">
              <Button 
                onClick={calcularOtimizacao}
                disabled={calculando || !contextoValido || !canOptimize}
                data-permission="Producao.Engenharia.visualizar"
                data-action="OtimizadorCorte.calcular"
                data-context-required="true"
                className="w-full bg-emerald-600 hover:bg-emerald-700"
              >
                {calculando ? (
                  <>
                    <Calculator className="w-4 h-4 mr-2 animate-spin" />
                    Calculando...
                  </>
                ) : (
                  <>
                    <Calculator className="w-4 h-4 mr-2" />
                    Calcular Otimização
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Resultados */}
          {otimizacao && (
            <>
              {/* Estatísticas */}
              <Card className="border-2 border-emerald-200 bg-emerald-50">
                <CardContent className="p-4">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <TrendingDown className="w-5 h-5 text-emerald-600" />
                    Resultado da Otimização
                  </h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <p className="text-xs text-slate-600">Total de Cortes</p>
                      <p className="text-2xl font-bold text-slate-900">
                        {otimizacao.estatisticas.total_cortes}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-slate-600">Barras Necessárias</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {otimizacao.estatisticas.barras_usadas}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-slate-600">Aproveitamento</p>
                      <p className="text-2xl font-bold text-green-600">
                        {otimizacao.estatisticas.aproveitamento_percentual}%
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t">
                    <div>
                      <p className="text-xs text-slate-600">Refugo Total</p>
                      <p className="font-bold text-red-600">
                        {otimizacao.estatisticas.total_refugo_cm} cm 
                        ({otimizacao.estatisticas.total_refugo_kg} kg)
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-600">Pontas Reutilizáveis</p>
                      <p className="font-bold text-emerald-600">
                        {otimizacao.estatisticas.pontas_reutilizaveis.length} unidades
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Economia */}
              {parseFloat(otimizacao.estatisticas.economia_estimada) > 0 && (
                <Alert className="bg-green-100 border-green-300">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <AlertDescription>
                    <strong>💰 Economia Potencial:</strong> R$ {otimizacao.estatisticas.economia_estimada} 
                    em material reaproveitável!
                  </AlertDescription>
                </Alert>
              )}

              {/* Plano de Corte por Barra */}
              <Card className="border-2 border-slate-200">
                <CardHeader className="bg-slate-50 pb-3">
                  <CardTitle className="text-base">Plano de Corte Detalhado</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="space-y-3">
                    {otimizacao.barras.map((barra, index) => {
                      const usado = barra.cortes.reduce((s, c) => s + c.comprimento, 0);
                      const sobra = barra.tamanho_padrao - usado;
                      const aproveitamento = ((usado / barra.tamanho_padrao) * 100).toFixed(1);

                      return (
                        <Card key={index} className="border">
                          <CardContent className="p-3">
                            <div className="flex justify-between items-center mb-2">
                              <h5 className="font-semibold">Barra #{barra.numero}</h5>
                              <div className="flex gap-2">
                                <Badge className="bg-blue-600">{barra.cortes.length} cortes</Badge>
                                <Badge className={aproveitamento > 80 ? 'bg-green-600' : 'bg-amber-600'}>
                                  {aproveitamento}%
                                </Badge>
                              </div>
                            </div>

                            {/* Visualização gráfica */}
                            <div className="relative h-8 bg-slate-200 rounded overflow-hidden mb-2">
                              {barra.cortes.map((corte, idx) => {
                                const percentual = (corte.comprimento / barra.tamanho_padrao) * 100;
                                return (
                                  <div
                                    key={idx}
                                    className="absolute h-full bg-emerald-500 border-r-2 border-white"
                                    style={{
                                      left: `${barra.cortes.slice(0, idx).reduce((sum, c) => 
                                        sum + ((c.comprimento / barra.tamanho_padrao) * 100), 0)}%`,
                                      width: `${percentual}%`
                                    }}
                                    title={`${corte.posicao}: ${corte.comprimento}cm`}
                                  />
                                );
                              })}
                              {sobra > 0 && (
                                <div
                                  className="absolute h-full bg-red-300"
                                  style={{
                                    right: 0,
                                    width: `${(sobra / barra.tamanho_padrao) * 100}%`
                                  }}
                                  title={`Sobra: ${sobra}cm`}
                                />
                              )}
                            </div>

                            {/* Lista de cortes */}
                            <div className="text-xs space-y-1">
                              {barra.cortes.map((corte, idx) => (
                                <div key={idx} className="flex justify-between">
                                  <span>{corte.posicao} - {corte.elemento}</span>
                                  <span className="font-mono">{corte.comprimento} cm</span>
                                </div>
                              ))}
                              <div className="flex justify-between pt-1 border-t font-bold">
                                <span>Sobra:</span>
                                <span className={sobra > 100 ? 'text-green-600' : 'text-red-600'}>
                                  {sobra} cm {sobra > 100 && '✓ Reutilizável'}
                                </span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Pontas Reutilizáveis */}
              {otimizacao.estatisticas.pontas_reutilizaveis.length > 0 && (
                <Card className="border-2 border-green-300 bg-green-50">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Save className="w-5 h-5 text-green-600" />
                        Pontas para Reaproveitamento
                      </CardTitle>
                      <Button 
                        size="sm"
                        onClick={salvarPontasNoEstoque}
                        disabled={!contextoValido || !canSaveEstoque}
                        data-permission="Estoque.Movimentacoes.criar"
                        data-action="OtimizadorCorte.salvar_pontas_estoque"
                        data-context-required="true"
                        data-sensitive
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Save className="w-4 h-4 mr-1" />
                        Salvar no Estoque
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="grid grid-cols-3 gap-2">
                      {otimizacao.estatisticas.pontas_reutilizaveis.map((ponta, idx) => (
                        <Card key={idx} className="border bg-white">
                          <CardContent className="p-2">
                            <p className="text-xs text-slate-600">Barra #{ponta.barra}</p>
                            <p className="font-bold">{ponta.tamanho} cm</p>
                            <Badge variant="outline" className="text-xs">{ponta.bitola}</Badge>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Alerta de Aproveitamento Baixo */}
              {otimizacao.estatisticas.aproveitamento_percentual < 75 && (
                <Alert className="bg-amber-100 border-amber-300">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <AlertDescription>
                    <strong>⚠️ Atenção:</strong> Aproveitamento abaixo de 75%. 
                    Considere revisar as medidas ou agrupar com outros pedidos para reduzir refugo.
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}

          {!otimizacao && (
            <div className="text-center py-8 text-slate-500">
              <Calculator className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Clique em "Calcular Otimização" para ver o plano de corte ideal</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}