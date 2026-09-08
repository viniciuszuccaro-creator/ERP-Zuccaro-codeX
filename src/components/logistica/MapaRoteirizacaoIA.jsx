import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  MapPin, 
  Navigation, 
  Truck, 
  Clock,
  Route,
  Zap,
  Download,
  Eye
} from "lucide-react";
import { toast } from "sonner";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { useUser } from "@/components/lib/UserContext";
import { otimizarRotaAvancada, resolveCoordenadas } from "@/components/lib/roteirizacaoPolicy";

/**
 * 🗺️ MAPA DE ROTEIRIZAÇÃO COM IA V21.5
 * Otimização inteligente de rotas de entrega
 */
export default function MapaRoteirizacaoIA({ pedidosSelecionados = [], windowMode = false }) {
  const [rotaOtimizada, setRotaOtimizada] = useState(null);
  const [otimizando, setOtimizando] = useState(false);
  const { empresaAtual, grupoAtual, filterInContext } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const { user } = useUser();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || null;
  const empresaId = empresaAtual?.id || null;
  const contextoValido = Boolean(groupId && empresaId);
  const canView = hasPermission("Expedicao", "Roteirizacao", "visualizar")
    || hasPermission("Expedicao", "Rotas", "visualizar")
    || hasPermission("Expedicao", "Rotas", "ver")
    || hasPermission("Logistica", "Roteirizacao", "visualizar");

  const auditMapa = async ({ acao, sucesso = true, motivo = null, detalhes = {} }) => {
    await base44.entities.AuditLog.create({
      acao,
      modulo: "Expedicao",
      entidade: "MapaRoteirizacaoIA",
      tipo_auditoria: sucesso ? "operacional" : "seguranca",
      usuario_id: user?.id || user?.email || null,
      usuario_nome: user?.full_name || user?.email || "Sistema",
      group_id: groupId,
      grupo_id: groupId,
      empresa_id: empresaId,
      resultado: sucesso ? "sucesso" : "bloqueado",
      motivo,
      detalhes,
      data_hora: new Date().toISOString(),
    });
  };

  const { data: pedidos = [] } = useQuery({
    queryKey: ['pedidos-roteirizacao-ia', groupId, empresaId],
    queryFn: () => filterInContext("Pedido", {}, "-created_date", 500),
    enabled: contextoValido && canView,
  });

  // Pedidos elegíveis para roteirização
  const pedidosRoteirizaveis = useMemo(() => {
    const base = pedidosSelecionados.length
      ? pedidos.filter((p) => pedidosSelecionados.includes(p.id) || pedidosSelecionados.some((s) => s?.id === p.id))
      : pedidos;
    return base.filter((p) =>
      (p.tipo_frete === 'CIF' || p.tipo_frete === 'FOB') &&
      ['Faturado', 'Em Expedição'].includes(p.status) &&
      p.endereco_entrega_principal?.latitude &&
      p.endereco_entrega_principal?.longitude
    );
  }, [pedidos, pedidosSelecionados]);

  const otimizarRotaComIA = async () => {
    if (!contextoValido || !canView) {
      toast.error("Contexto (grupo+empresa) ou permissao obrigatoria");
      try {
        await auditMapa({ acao: "MapaRoteirizacaoIA.otimizar.bloqueado", sucesso: false, motivo: !contextoValido ? "contexto_obrigatorio" : "permissao_negada" });
      } catch (e) {
        console.error(e);
      }
      return;
    }
    if (!pedidosRoteirizaveis.length) {
      toast.error("Nenhum pedido elegivel para roteirizacao");
      return;
    }

    setOtimizando(true);
    
    try {
      // 🤖 IA: Otimização de rota usando LLM
      const pontosEntrega = pedidosRoteirizaveis.map(p => ({
        pedido_id: p.id,
        numero_pedido: p.numero_pedido,
        cliente: p.cliente_nome,
        endereco: `${p.endereco_entrega_principal.logradouro}, ${p.endereco_entrega_principal.numero} - ${p.endereco_entrega_principal.cidade}`,
        latitude: p.endereco_entrega_principal.latitude,
        longitude: p.endereco_entrega_principal.longitude,
        prioridade: p.prioridade || 'Normal',
        peso_kg: p.peso_total_kg || 0,
        valor: p.valor_total || 0
      }));

      let resultado = null;
      try {
        resultado = await base44.integrations.Core.InvokeLLM({
          prompt: `Você é um sistema de otimização de rotas logísticas.

Analise os seguintes pontos de entrega e sugira a melhor sequência para minimizar:
1. Distância total percorrida
2. Tempo de viagem
3. Custos operacionais

Considere prioridades (Urgente > Alta > Normal > Baixa) e peso total dos pedidos.

Pontos de entrega:
${JSON.stringify(pontosEntrega, null, 2)}

Retorne a rota otimizada com:
- sequencia_pedidos: array de pedido_ids na ordem ideal
- distancia_total_estimada_km: número
- tempo_total_estimado_min: número
- motivo_otimizacao: string explicando a lógica
- alertas: array de strings com avisos (ex: sobrepeso, área de risco)`,
          response_json_schema: {
            type: "object",
            properties: {
              sequencia_pedidos: { type: "array", items: { type: "string" } },
              distancia_total_estimada_km: { type: "number" },
              tempo_total_estimado_min: { type: "number" },
              motivo_otimizacao: { type: "string" },
              alertas: { type: "array", items: { type: "string" } }
            }
          }
        });
      } catch (llmError) {
        await auditMapa({
          acao: "MapaRoteirizacaoIA.llm.fallback",
          sucesso: false,
          motivo: llmError?.message || "llm_indisponivel",
          detalhes: { pedidos: pedidosRoteirizaveis.length },
        });
        const fallback = otimizarRotaAvancada({
          origem: resolveCoordenadas(empresaAtual?.endereco || empresaAtual) || { latitude: -23.55052, longitude: -46.633308 },
          entregas: pedidosRoteirizaveis.map((p) => ({
            id: p.id,
            prioridade: p.prioridade,
            peso_total_kg: p.peso_total_kg,
            endereco_entrega_completo: p.endereco_entrega_principal,
          })),
          parametros: { priorizar_urgencia: true },
        });
        resultado = {
          sequencia_pedidos: fallback.pontos.map((p) => p.id),
          distancia_total_estimada_km: fallback.distancia_total_km,
          tempo_total_estimado_min: fallback.tempo_estimado_minutos,
          motivo_otimizacao: `Fallback local (${fallback.algoritmo}) — LLM indisponivel`,
          alertas: fallback.alertas || [],
        };
      }

      setRotaOtimizada(resultado);
      await auditMapa({ acao: "MapaRoteirizacaoIA.otimizar", detalhes: { pedidos: pedidosRoteirizaveis.length } });
      toast.success("🤖 Rota otimizada com IA!");
      
    } catch (error) {
      try {
        await auditMapa({ acao: "MapaRoteirizacaoIA.otimizar.erro", sucesso: false, motivo: error?.message || "erro" });
      } catch (auditError) {
        console.error(auditError);
      }
      toast.error("Erro ao otimizar rota: " + error.message);
    } finally {
      setOtimizando(false);
    }
  };

  const gerarLinkGoogleMaps = () => {
    if (!rotaOtimizada?.sequencia_pedidos) return;
    
    const pedidosOrdenados = rotaOtimizada.sequencia_pedidos
      .map(id => pedidosRoteirizaveis.find(p => p.id === id))
      .filter(Boolean);

    const waypoints = pedidosOrdenados
      .map(p => `${p.endereco_entrega_principal.latitude},${p.endereco_entrega_principal.longitude}`)
      .join('|');

    const url = `https://www.google.com/maps/dir/?api=1&waypoints=${waypoints}&travelmode=driving`;
    window.open(url, '_blank');
  };

  const containerClass = windowMode ? "w-full h-full flex flex-col overflow-auto" : "space-y-6";

  return (
    <div className={containerClass} data-permission="Expedicao.Rotas.visualizar" data-context-required="true">
      <div className={windowMode ? "p-6 space-y-6 flex-1" : "space-y-6"}>
      {!contextoValido || !canView ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 text-sm text-amber-900">
            Selecione grupo e empresa e garanta permissao de roteirizacao para otimizar rotas.
          </CardContent>
        </Card>
      ) : null}
      <Card className="border-0 shadow-xl">
        <CardHeader className="bg-gradient-to-r from-purple-500 to-blue-600 text-white">
          <CardTitle className="flex items-center gap-2">
            <Route className="w-5 h-5" />
            🤖 Roteirização Inteligente com IA
          </CardTitle>
          <p className="text-sm opacity-90">
            {pedidosRoteirizaveis.length} pedido(s) elegível(is) para roteirização
          </p>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          {/* Botão de Otimização */}
          <Button
            onClick={otimizarRotaComIA}
            disabled={otimizando || pedidosRoteirizaveis.length === 0 || !contextoValido || !canView}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            size="lg"
            data-action="MapaRoteirizacaoIA.otimizar"
            data-permission="Expedicao.Rotas.visualizar"
            data-context-required="true"
          >
            <Zap className="w-5 h-5 mr-2" />
            {otimizando ? '🤖 Otimizando com IA...' : '🚀 Otimizar Rota com IA'}
          </Button>

          {/* Resultado da Otimização */}
          {rotaOtimizada && (
            <div className="space-y-4">
              {/* Métricas */}
              <div className="grid grid-cols-2 gap-4">
                <Card className="bg-blue-50">
                  <CardContent className="p-4">
                    <p className="text-sm text-blue-700">Distância Total</p>
                    <p className="text-2xl font-bold text-blue-900">
                      {rotaOtimizada.distancia_total_estimada_km} km
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-purple-50">
                  <CardContent className="p-4">
                    <p className="text-sm text-purple-700">Tempo Estimado</p>
                    <p className="text-2xl font-bold text-purple-900">
                      {Math.floor(rotaOtimizada.tempo_total_estimado_min / 60)}h {rotaOtimizada.tempo_total_estimado_min % 60}m
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Motivo da Otimização */}
              <Card className="bg-green-50 border-green-300">
                <CardContent className="p-4">
                  <p className="text-sm font-semibold text-green-900 mb-2">🤖 Lógica da IA:</p>
                  <p className="text-sm text-green-800">{rotaOtimizada.motivo_otimizacao}</p>
                </CardContent>
              </Card>

              {/* Alertas */}
              {rotaOtimizada.alertas?.length > 0 && (
                <Card className="bg-yellow-50 border-yellow-300">
                  <CardContent className="p-4">
                    <p className="text-sm font-semibold text-yellow-900 mb-2">⚠️ Alertas:</p>
                    <ul className="space-y-1">
                      {rotaOtimizada.alertas.map((alerta, idx) => (
                        <li key={idx} className="text-sm text-yellow-800 flex items-start gap-2">
                          <span>•</span>
                          <span>{alerta}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Sequência de Entregas */}
              <Card>
                <CardHeader className="bg-slate-50 border-b">
                  <CardTitle className="text-base">📍 Sequência Otimizada de Entregas</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="space-y-3">
                    {rotaOtimizada.sequencia_pedidos.map((pedidoId, index) => {
                      const pedido = pedidosRoteirizaveis.find(p => p.id === pedidoId);
                      if (!pedido) return null;
                      
                      return (
                        <div key={pedidoId} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                          <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                            {index + 1}
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-slate-900">
                              Pedido #{pedido.numero_pedido} - {pedido.cliente_nome}
                            </p>
                            <p className="text-sm text-slate-600">
                              📍 {pedido.endereco_entrega_principal.logradouro}, {pedido.endereco_entrega_principal.numero} - {pedido.endereco_entrega_principal.cidade}
                            </p>
                            <div className="flex gap-2 mt-2">
                              {pedido.prioridade && pedido.prioridade !== 'Normal' && (
                                <Badge className="bg-red-100 text-red-700 text-xs">
                                  {pedido.prioridade}
                                </Badge>
                              )}
                              <Badge variant="outline" className="text-xs">
                                {(pedido.peso_total_kg || 0)} kg
                              </Badge>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Ações */}
              <div className="flex gap-3">
                <Button
                  onClick={gerarLinkGoogleMaps}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  <Navigation className="w-4 h-4 mr-2" />
                  Abrir no Google Maps
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const texto = rotaOtimizada.sequencia_pedidos
                      .map((id, idx) => {
                        const p = pedidosRoteirizaveis.find(p => p.id === id);
                        return `${idx + 1}. ${p?.numero_pedido} - ${p?.cliente_nome} - ${p?.endereco_entrega_principal?.logradouro}`;
                      })
                      .join('\n');
                    navigator.clipboard.writeText(texto);
                    toast.success("📋 Rota copiada!");
                  }}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Copiar Rota
                </Button>
              </div>
            </div>
          )}

          {pedidosRoteirizaveis.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <MapPin className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p>Nenhum pedido com coordenadas disponível</p>
              <p className="text-sm mt-2">Adicione endereços com geolocalização aos pedidos</p>
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}