import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import { Map, Route, Zap, MapPin, Clock, TrendingUp, AlertCircle, Package, FileText } from "lucide-react";
import useContextoVisual from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { useUser } from "@/components/lib/UserContext";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


/**
 * Algoritmo de Otimização de Rotas - Nearest Neighbor
 * Encontra a rota mais curta visitando todos os pontos
 */
function otimizarRotaNN(pontos, origem) {
  if (!pontos || pontos.length === 0) return [];
  if (pontos.length === 1) return pontos;

  const calcularDistancia = (p1, p2) => {
    const R = 6371; // Raio da Terra em km
    const dLat = (p2.latitude - p1.latitude) * Math.PI / 180;
    const dLon = (p2.longitude - p1.longitude) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(p1.latitude * Math.PI / 180) * Math.cos(p2.latitude * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const pontosRestantes = [...pontos];
  const rotaOtimizada = [];
  let pontoAtual = origem;

  while (pontosRestantes.length > 0) {
    let menorDistancia = Infinity;
    let indiceMaisProximo = -1; // Initialize with -1 to indicate no point found yet

    pontosRestantes.forEach((ponto, idx) => {
      const distancia = calcularDistancia(pontoAtual, ponto);
      if (distancia < menorDistancia) {
        menorDistancia = distancia;
        indiceMaisProximo = idx;
      }
    });

    // If no point was found (shouldn't happen if pontosRestantes is not empty), break to prevent infinite loop
    if (indiceMaisProximo === -1) break;

    const pontoMaisProximo = pontosRestantes.splice(indiceMaisProximo, 1)[0];
    rotaOtimizada.push({
      ...pontoMaisProximo,
      sequencia: rotaOtimizada.length + 1,
      distancia_anterior_km: menorDistancia
    });
    pontoAtual = pontoMaisProximo;
  }

  return rotaOtimizada;
}

export default function RoteirizacaoMapa({ entregas = [], motoristas = [], veiculos = [], windowMode = false }) {
  const [entregasSelecionadas, setEntregasSelecionadas] = useState([]);
  const [rotaOtimizada, setRotaOtimizada] = useState(null);
  const [motoristaSelecionado, setMotoristaSelecionado] = useState("");
  const [veiculoSelecionado, setVeiculoSelecionado] = useState("");
  const [isOptimizing, setIsOptimizing] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { empresaAtual, grupoAtual, createInContext, updateInContext } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const { user } = useUser();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const contextoValido = Boolean(groupId || empresaId);
  const canOptimizeRoute = hasPermission("Expedicao", "Rotas", "editar") || hasPermission("Expedicao", "Roteirizacao", "editar") || hasPermission("Expedicao", "Rotas", "criar");
  const canCreateRomaneio = hasPermission("Expedicao", "Romaneios", "criar") || hasPermission("Expedicao", "Romaneio", "criar");

  const auditRota = async ({ acao, sucesso = true, motivo = null, detalhes = {} }) => {
    try {
      await base44.entities.AuditLog.create({
        acao,
        modulo: "Expedicao",
        entidade: "Roteirizacao",
        tipo_auditoria: sucesso ? "operacional" : "seguranca",
        usuario_id: user?.id || user?.email || null,
        usuario_nome: user?.full_name || user?.email || "Sistema",
        group_id: groupId,
        grupo_id: groupId,
        empresa_id: empresaId,
        resultado: sucesso ? "sucesso" : "bloqueado",
        motivo,
        detalhes,
        data_hora: new Date().toISOString()
      });
    } catch (error) {
      console.warn("Falha ao auditar roteirizacao", error);
    }
  };

  const entregasContextuais = entregas.filter(e => {
    if (empresaId && e.empresa_id && e.empresa_id !== empresaId && e.empresa_responsavel_id !== empresaId) return false;
    if (groupId && e.group_id && e.group_id !== groupId) return false;
    return true;
  });

  const handleSelecionarEntrega = (entrega) => {
    if (entregasSelecionadas.find(e => e.id === entrega.id)) {
      setEntregasSelecionadas(entregasSelecionadas.filter(e => e.id !== entrega.id));
    } else {
      setEntregasSelecionadas([...entregasSelecionadas, entrega]);
    }
  };

  const handleOtimizarRota = async () => {
    if (!contextoValido || !canOptimizeRoute) {
      await auditRota({ acao: "Rota.otimizar.bloqueado", sucesso: false, motivo: !contextoValido ? "contexto_obrigatorio" : "permissao_negada" });
      toast({ title: "Acesso bloqueado", description: "Selecione um contexto e verifique sua permissao para otimizar rotas.", variant: "destructive" });
      return;
    }

    if (entregasSelecionadas.length === 0) {
      toast({
        title: "⚠️ Nenhuma entrega selecionada",
        description: "Selecione pelo menos uma entrega para otimizar",
        variant: "destructive"
      });
      return;
    }

    setIsOptimizing(true);

    // Simular delay de processamento
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Origem: empresa atual
    const origem = {
      latitude: empresaAtual?.endereco?.latitude || -23.550520, // Default to SP if not found
      longitude: empresaAtual?.endereco?.longitude || -46.633308 // Default to SP if not found
    };

    // Preparar pontos com coordenadas
    const pontosComCoordenadas = entregasSelecionadas
      .filter(e => e.endereco_entrega_completo?.latitude && e.endereco_entrega_completo?.longitude)
      .map(e => ({
        ...e,
        latitude: e.endereco_entrega_completo.latitude,
        longitude: e.endereco_entrega_completo.longitude
      }));

    if (pontosComCoordenadas.length === 0) {
      toast({
        title: "⚠️ Entregas sem coordenadas GPS",
        description: "Cadastre latitude/longitude nos endereços das entregas selecionadas para otimização.",
        variant: "destructive"
      });
      await auditRota({ acao: "Rota.otimizar.bloqueado", sucesso: false, motivo: "entregas_sem_coordenadas", detalhes: { selecionadas: entregasSelecionadas.length } });
      setIsOptimizing(false);
      return;
    }

    // OTIMIZAR com algoritmo Nearest Neighbor
    const rotaCalculada = otimizarRotaNN(pontosComCoordenadas, origem);

    // Calcular totais
    // The first point in rotaCalculada already includes the distance from the origin.
    // Summing `distancia_anterior_km` will give the total distance from origin to all points in sequence.
    const distanciaTotal = rotaCalculada.reduce((sum, p) => sum + (p.distancia_anterior_km || 0), 0);
    // Tempo estimado: 40km/h de velocidade média + 15min por parada
    const velocidadeMediaKmH = 40;
    const tempoPorParadaMinutos = 15;
    const tempoViagemMinutos = (distanciaTotal / velocidadeMediaKmH) * 60;
    const tempoTotalParadasMinutos = rotaCalculada.length * tempoPorParadaMinutos;
    const tempoEstimado = tempoViagemMinutos + tempoTotalParadasMinutos;

    const resultadoOtimizado = {
      pontos: rotaCalculada,
      distancia_total_km: distanciaTotal,
      tempo_estimado_minutos: Math.round(tempoEstimado),
      algoritmo: 'Nearest Neighbor',
      data_calculo: new Date().toISOString()
    };

    setRotaOtimizada(resultadoOtimizado);
    await auditRota({ acao: "Rota.otimizar", detalhes: { entregas: rotaCalculada.length, distancia_total_km: distanciaTotal, tempo_estimado_minutos: Math.round(tempoEstimado) } });

    setIsOptimizing(false);

    toast({
      title: "✅ Rota otimizada!",
      description: `${rotaCalculada.length} entregas • ${distanciaTotal.toFixed(1)} km • ${Math.round(tempoEstimado)} min`
    });
  };

  const handleGerarRomaneio = async () => {
    if (!contextoValido || !canCreateRomaneio) {
      await auditRota({ acao: "Rota.gerar_romaneio.bloqueado", sucesso: false, motivo: !contextoValido ? "contexto_obrigatorio" : "permissao_negada" });
      toast({ title: "Acesso bloqueado", description: "Selecione um contexto e verifique sua permissao para gerar romaneio.", variant: "destructive" });
      return;
    }

    if (!rotaOtimizada || !motoristaSelecionado || !veiculoSelecionado) {
      toast({
        title: "⚠️ Dados incompletos",
        description: "Selecione motorista, veículo e otimize a rota antes de gerar o romaneio.",
        variant: "destructive"
      });
      return;
    }

    if (!window.confirm("Confirmar criacao da rota e do romaneio para as entregas selecionadas?")) {
      await auditRota({ acao: "Rota.gerar_romaneio.cancelado", sucesso: false, motivo: "confirmacao_cancelada", detalhes: { entregas: rotaOtimizada.pontos.length } });
      return;
    }

    try {
      // Criar Rota
      const rota = await createInContext("Rota", {
        empresa_id: empresaId,
        group_id: groupId,
        grupo_id: groupId,
        nome_rota: `Rota ${new Date().toLocaleDateString('pt-BR')} - ${motoristas.find(m => m.id === motoristaSelecionado)?.nome_completo || 'Motorista Desconhecido'}`,
        data_rota: new Date().toISOString().split('T')[0],
        motorista_id: motoristaSelecionado,
        veiculo_id: veiculoSelecionado,
        pontos_entrega: rotaOtimizada.pontos.map(p => ({
          sequencia: p.sequencia,
          entrega_id: p.id,
          cliente_nome: p.cliente_nome,
          endereco_completo: `${p.endereco_entrega_completo?.logradouro || ''}, ${p.endereco_entrega_completo?.numero || ''} - ${p.endereco_entrega_completo?.cidade || ''}`,
          latitude: p.latitude,
          longitude: p.longitude,
          status: 'Pendente',
          tempo_estimado_parada_minutos: 15, // Default stop time
          horario_previsto: null // This would be calculated by a real routing service
        })),
        distancia_total_km: rotaOtimizada.distancia_total_km,
        tempo_total_previsto_minutos: rotaOtimizada.tempo_estimado_minutos,
        otimizada: true,
        algoritmo_usado: 'Nearest Neighbor',
        google_maps_route_url: null, // This would be generated by a real routing service
        status: 'Planejada',
        progresso_percentual: 0,
        entregas_concluidas: 0,
        entregas_frustradas: 0,
        criado_por: user?.full_name || user?.email || "Sistema"
      });

      // Criar Romaneio
      const romaneio = await createInContext("Romaneio", {
        empresa_id: empresaId,
        group_id: groupId,
        grupo_id: groupId,
        numero_romaneio: `ROM-${Date.now()}`,
        data_romaneio: new Date().toISOString().split('T')[0],
        motorista_id: motoristaSelecionado,
        veiculo_id: veiculoSelecionado,
        rota_id: rota.id,
        entregas_ids: rotaOtimizada.pontos.map(p => p.id),
        quantidade_entregas: rotaOtimizada.pontos.length,
        distancia_total_km: rotaOtimizada.distancia_total_km,
        tempo_previsto_minutos: rotaOtimizada.tempo_estimado_minutos,
        status: 'Aberto',
        criado_por: user?.full_name || user?.email || "Sistema"
      });

      // Atualizar entregas com o romaneio e rota
      for (const ponto of rotaOtimizada.pontos) {
        await updateInContext("Entrega", ponto.id, {
          group_id: groupId,
          grupo_id: groupId,
          empresa_id: empresaId || ponto.empresa_id,
          rota_id: rota.id,
          romaneio_id: romaneio.id,
          status: 'Pronto para Expedir'
        });
      }

      queryClient.invalidateQueries({ queryKey: ['entregas'] });
      queryClient.invalidateQueries({ queryKey: ['rotas'] });
      queryClient.invalidateQueries({ queryKey: ['romaneios'] });

      await auditRota({ acao: "Rota.gerar_romaneio", detalhes: { rota_id: rota.id, romaneio_id: romaneio.id, entregas: rotaOtimizada.pontos.length } });

      toast({
        title: "✅ Romaneio gerado!",
        description: `Rota "${rota.nome_rota}" com ${rotaOtimizada.pontos.length} entregas criada.`
      });

      // Resetar estados
      setEntregasSelecionadas([]);
      setRotaOtimizada(null);
      setMotoristaSelecionado("");
      setVeiculoSelecionado("");

    } catch (error) {
      await auditRota({ acao: "Rota.gerar_romaneio.erro", sucesso: false, motivo: error?.message || "erro_salvar" });
      console.error("Erro ao gerar romaneio:", error);
      toast({
        title: "❌ Erro ao gerar romaneio",
        description: "Ocorreu um erro ao salvar a rota e o romaneio. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const entregasPendentes = entregasContextuais.filter(e =>
    e.status === 'Aguardando Separação' ||
    e.status === 'Pronto para Expedir'
  );

  const containerClass = windowMode ? "w-full h-full flex flex-col overflow-auto" : "space-y-6";

  return (
    <div className={containerClass} data-permission="Expedicao.Rotas.visualizar" data-context-required="true">
      <div className={windowMode ? "p-6 space-y-6 flex-1" : "space-y-6"}>
      <Card className="border-2 border-blue-200">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 border-b">
          <CardTitle className="flex items-center gap-2">
            <Map className="w-6 h-6 text-blue-600" />
            Planejamento de Rotas
          </CardTitle>
          <p className="text-sm text-slate-600 mt-1">
            Selecione entregas, otimize a sequência e gere um romaneio
          </p>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-700">
                <Package className="w-4 h-4 inline mr-1" />
                <strong>{entregasPendentes.length}</strong> entrega(s) pendente(s)
              </p>
              {entregasPendentes.length > 0 && (
                <p className="text-xs text-slate-500 mt-1">
                  Peso total aproximado: {entregasPendentes.reduce((sum, e) => sum + (e.peso_total_kg || 0), 0).toFixed(2)} kg
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* ENTREGAS DISPONÍVEIS */}
        <Card className="border-0 shadow-md lg:col-span-1">
          <CardHeader className="bg-slate-50 border-b">
            <CardTitle className="text-base">
              Entregas Disponíveis ({entregasPendentes.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-2 max-h-[600px] overflow-y-auto">
            {entregasPendentes.length === 0 ? (
              <p className="text-sm text-slate-500 text-center">Nenhuma entrega disponível para roteirização.</p>
            ) : (
              entregasPendentes.map(entrega => {
                const selecionada = entregasSelecionadas.find(e => e.id === entrega.id);
                return (
                  <Card
                    key={entrega.id}
                    className={`cursor-pointer transition-all ${
                      selecionada
                        ? 'border-2 border-blue-500 bg-blue-50'
                        : 'border hover:border-blue-300'
                    }`}
                    onClick={() => contextoValido && canOptimizeRoute && handleSelecionarEntrega(entrega)}
                    data-permission="Expedicao.Rotas.editar"
                    data-context-required="true"
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-semibold text-sm">{entrega.cliente_nome}</p>
                          <p className="text-xs text-slate-600 mt-1">
                            {entrega.endereco_entrega_completo?.logradouro}, {entrega.endereco_entrega_completo?.numero} - {entrega.endereco_entrega_completo?.cidade || 'Endereço incompleto'}
                          </p>
                          {selecionada && (
                            <Badge className="mt-2 text-xs bg-blue-600">
                              #{rotaOtimizada?.pontos.find(p => p.id === entrega.id)?.sequencia || (entregasSelecionadas.findIndex(e => e.id === entrega.id) + 1)}
                            </Badge>
                          )}
                        </div>
                        {selecionada && (
                          <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center">
                            <span className="text-white text-xs">✓</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* CONFIGURAÇÃO E OTIMIZAÇÃO */}
        <Card className="border-0 shadow-md lg:col-span-2">
          <CardHeader className="bg-slate-50 border-b">
            <CardTitle className="text-base">Configuração da Rota</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="motorista-select">Motorista *</Label>
                <Select value={motoristaSelecionado} onValueChange={setMotoristaSelecionado} id="motorista-select">
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {motoristas?.map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.nome_completo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="veiculo-select">Veículo *</Label>
                <Select value={veiculoSelecionado} onValueChange={setVeiculoSelecionado} id="veiculo-select">
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {veiculos?.map(v => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.modelo} - {v.placa}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* ENTREGAS SELECIONADAS */}
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="p-4">
                <p className="font-semibold text-blue-900 mb-2">
                  {entregasSelecionadas.length} entrega(s) selecionada(s)
                </p>
                {entregasSelecionadas.length > 0 && (
                  <div className="flex gap-2 flex-wrap max-h-40 overflow-y-auto">
                    {entregasSelecionadas.map((e) => (
                      <Badge key={e.id} variant="outline" className="text-xs px-2 py-1 flex items-center">
                        #{rotaOtimizada?.pontos.find(p => p.id === e.id)?.sequencia || (entregasSelecionadas.findIndex(sel => sel.id === e.id) + 1)} - {e.cliente_nome}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* BOTÃO OTIMIZAR */}
            <Button
              onClick={handleOtimizarRota}
              disabled={!contextoValido || !canOptimizeRoute || entregasSelecionadas.length === 0 || isOptimizing}
              data-action="Rota.otimizar"
              data-permission="Expedicao.Rotas.editar"
              data-context-required="true"
              data-sensitive="true"
              className="w-full bg-purple-600 hover:bg-purple-700"
              size="lg"
            >
              {isOptimizing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Otimizando...
                </>
              ) : (
                <>
                  <MapPin className="w-5 h-5 mr-2" />
                  🚀 Otimizar Rota
                </>
              )}
            </Button>

            {/* RESULTADO DA OTIMIZAÇÃO */}
            {rotaOtimizada && (
              <Card className="border-green-300 bg-green-50">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-green-600 rounded-lg">
                      <Zap className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-green-900">Rota Otimizada!</p>
                      <p className="text-sm text-green-700">
                        Algoritmo: {rotaOtimizada.algoritmo}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-green-700">Entregas:</p>
                      <p className="text-xl font-bold text-green-900">
                        {rotaOtimizada.pontos.length}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-green-700">Distância:</p>
                      <p className="text-xl font-bold text-green-900">
                        {rotaOtimizada.distancia_total_km.toFixed(1)} km
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-green-700">Tempo Estimado:</p>
                      <p className="text-xl font-bold text-green-900">
                        {Math.floor(rotaOtimizada.tempo_estimado_minutos / 60)}h {rotaOtimizada.tempo_estimado_minutos % 60}min
                      </p>
                    </div>
                  </div>

                  {/* SEQUÊNCIA OTIMIZADA */}
                  <div className="mt-4 pt-4 border-t border-green-300">
                    <p className="font-semibold text-green-900 mb-3">Sequência Otimizada:</p>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {rotaOtimizada.pontos.map((ponto) => (
                        <div key={ponto.id} className="flex items-center gap-3 p-2 bg-white rounded">
                          <Badge className="bg-green-600">#{ponto.sequencia}</Badge>
                          <div className="flex-1">
                            <p className="font-medium text-sm">{ponto.cliente_nome}</p>
                            <p className="text-xs text-slate-600">
                              {ponto.endereco_entrega_completo?.cidade || 'Cidade não informada'}
                            </p>
                          </div>
                          <div className="text-right text-xs text-slate-600">
                            {ponto.distancia_anterior_km > 0 && (
                              <span>+{ponto.distancia_anterior_km.toFixed(1)} km</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* BOTÃO GERAR ROMANEIO */}
                  <Button
                    onClick={handleGerarRomaneio}
                    disabled={!contextoValido || !canCreateRomaneio || !motoristaSelecionado || !veiculoSelecionado}
                    data-action="Rota.gerar_romaneio"
                    data-permission="Expedicao.Romaneios.criar"
                    data-context-required="true"
                    data-sensitive="true"
                    className="w-full mt-4 bg-blue-600 hover:bg-blue-700"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Gerar Romaneio e Criar Rota
                  </Button>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  );
}