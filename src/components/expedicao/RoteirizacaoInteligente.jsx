import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, Map, Truck, Navigation, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import TesteGoogleMaps from "@/components/integracoes/TesteGoogleMaps";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { useUser } from "@/components/lib/UserContext";

export default function RoteirizacaoInteligente({ windowMode = false }) {
  const queryClient = useQueryClient();
  const [dataRota, setDataRota] = useState(new Date().toISOString().split('T')[0]);
  const { empresaAtual, grupoAtual, filterInContext, createInContext } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const { user } = useUser();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || null;
  const empresaId = empresaAtual?.id || null;
  const contextoValido = Boolean(groupId || empresaId);
  const canViewRoteirizacao = hasPermission("Expedicao", "Roteirizacao", "visualizar") || hasPermission("Expedicao", "Rotas", "visualizar") || hasPermission("Expedicao", "Rotas", "ver");
  const canGenerateRoteirizacao = hasPermission("Expedicao", "Roteirizacao", "criar") || hasPermission("Expedicao", "Rotas", "criar") || hasPermission("Expedicao", "Rotas", "editar");

  const auditIA = async ({ acao, sucesso = true, motivo = null, detalhes = {} }) => {
    try {
      await base44.entities.AuditLog.create({
        acao, modulo: "Expedicao", entidade: "RoteirizacaoInteligente",
        tipo_auditoria: sucesso ? "operacional" : "seguranca",
        usuario_id: user?.id || user?.email || null,
        usuario_nome: user?.full_name || user?.email || "Sistema",
        group_id: groupId, grupo_id: groupId, empresa_id: empresaId,
        resultado: sucesso ? "sucesso" : "bloqueado", motivo, detalhes, data_hora: new Date().toISOString()
      });
    } catch (error) {
      console.warn("Falha ao auditar roteirizacao IA", error);
    }
  };
  const { data: entregas = [] } = useQuery({
    queryKey: ["entregas", groupId, empresaId],
    queryFn: () => filterInContext("Entrega", {}, "-created_date", 500),
    enabled: contextoValido && canViewRoteirizacao,
  });

  const { data: motoristas = [] } = useQuery({
    queryKey: ["motoristas", groupId, empresaId],
    queryFn: () => filterInContext("Motorista", {}, "nome", 200),
    enabled: contextoValido && canViewRoteirizacao,
  });

  const { data: veiculos = [] } = useQuery({
    queryKey: ["veiculos", groupId, empresaId],
    queryFn: () => filterInContext("Veiculo", {}, "placa", 200),
    enabled: contextoValido && canViewRoteirizacao,
  });

  const { data: rotas = [] } = useQuery({
    queryKey: ["roteirizacao-inteligente", groupId, empresaId],
    queryFn: () => filterInContext("RoteirizacaoInteligente", {}, "-created_date", 200),
    enabled: contextoValido && canViewRoteirizacao,
  });

  const gerarRotaIAMutation = useMutation({
    mutationFn: async ({ entregasIds, motoristaId, veiculoId }) => {
      if (!contextoValido || !canGenerateRoteirizacao) {
        await auditIA({ acao: "RoteirizacaoIA.gerar.bloqueado", sucesso: false, motivo: !contextoValido ? "contexto_obrigatorio" : "permissao_negada" });
        throw new Error("Contexto ou permissao obrigatoria para gerar rota com IA.");
      }

      toast.info("🤖 IA otimizando rota...");

      const entregasSelecionadas = entregas.filter(e => entregasIds.includes(e.id));
      
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Otimize a rota de entrega considerando:

Entregas: ${JSON.stringify(entregasSelecionadas.map(e => ({
  cliente: e.cliente_nome,
  endereco: e.endereco_entrega_completo,
  janela: e.janela_entrega_inicio + ' - ' + e.janela_entrega_fim,
  peso: e.peso_total_kg,
  prioridade: e.prioridade
})))}

Retorne a melhor sequência de entregas, distância total, tempo estimado e custo.`,
        response_json_schema: {
          type: "object",
          properties: {
            sequencia_otimizada: { type: "array", items: { type: "string" } },
            distancia_total_km: { type: "number" },
            tempo_total_minutos: { type: "number" },
            custo_estimado: { type: "number" },
            economia_vs_manual: { type: "object" }
          }
        }
      });

      const motorista = motoristas.find(m => m.id === motoristaId);
      const veiculo = veiculos.find(v => v.id === veiculoId);

      const rotaCriada = await createInContext("RoteirizacaoInteligente", {
        group_id: groupId,
        grupo_id: groupId,
        empresa_id: empresaId,
        data_rota: dataRota,
        motorista_id: motoristaId,
        motorista_nome: motorista?.nome || "",
        veiculo_id: veiculoId,
        veiculo_placa: veiculo?.placa || "",
        entregas_vinculadas: entregasSelecionadas.map((e, idx) => ({
          entrega_id: e.id,
          pedido_id: e.pedido_id,
          cliente_nome: e.cliente_nome,
          endereco_completo: `${e.endereco_entrega_completo?.logradouro}, ${e.endereco_entrega_completo?.numero}`,
          latitude: e.endereco_entrega_completo?.latitude,
          longitude: e.endereco_entrega_completo?.longitude,
          ordem_sequencia: idx + 1,
          peso_kg: e.peso_total_kg,
          prioridade: e.prioridade
        })),
        otimizacao_ia: {
          distancia_total_km: result.distancia_total_km,
          tempo_total_estimado_minutos: result.tempo_total_minutos,
          custo_estimado_frete: result.custo_estimado,
          algoritmo_usado: "IA Base44 LLM",
          fatores_considerados: ["Distância", "Janela de Entrega", "Trânsito", "Prioridade", "Peso"],
          economia_vs_rota_manual: result.economia_vs_manual
        },
        status: "Planejada",
        criado_por: user?.full_name || user?.email || "Sistema"
      });

      await auditIA({ acao: "RoteirizacaoIA.gerar", detalhes: { rota_id: rotaCriada.id, entregas: entregasSelecionadas.length, motoristaId, veiculoId } });
      return rotaCriada;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roteirizacao-inteligente"] });
      toast.success("✅ Rota otimizada gerada com IA!");
    },
    onError: async (error) => {
      await auditIA({ acao: "RoteirizacaoIA.gerar.erro", sucesso: false, motivo: error?.message || "erro_ia" });
      toast.error(error?.message || "Erro ao gerar rota com IA");
    },
  });

  const entregasPendentes = entregas.filter(e => 
    e.status === "Aguardando Separação" || e.status === "Pronto para Expedir"
  );

  const containerClass = windowMode ? "w-full h-full flex flex-col overflow-auto" : "space-y-6";

  return (
    <div className={containerClass} data-permission="Expedicao.Rotas.visualizar" data-context-required="true">
      <div className={windowMode ? "p-6 space-y-6 flex-1" : "space-y-6"}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Roteirização Inteligente</h2>
          <p className="text-sm text-slate-600 mt-1">Otimização de rotas com IA</p>
        </div>

        <Button
          onClick={() => {
            if (!contextoValido || !canGenerateRoteirizacao) {
              auditIA({ acao: "RoteirizacaoIA.gerar.bloqueado", sucesso: false, motivo: !contextoValido ? "contexto_obrigatorio" : "permissao_negada" });
              toast.error("Contexto ou permissao obrigatoria para gerar rota com IA");
              return;
            }
            if (!window.confirm("Confirmar geracao de rota com IA para as entregas pendentes?")) {
              auditIA({ acao: "RoteirizacaoIA.gerar.cancelado", sucesso: false, motivo: "confirmacao_cancelada" });
              return;
            }
            if (entregasPendentes.length > 0 && motoristas.length > 0 && veiculos.length > 0) {
              gerarRotaIAMutation.mutate({
                entregasIds: entregasPendentes.slice(0, 5).map(e => e.id),
                motoristaId: motoristas[0].id,
                veiculoId: veiculos[0].id
              });
            } else {
              toast.error("Cadastre entregas, motoristas e veículos primeiro");
            }
          }}
          disabled={gerarRotaIAMutation.isPending || !contextoValido || !canGenerateRoteirizacao}
          data-action="RoteirizacaoIA.gerar"
          data-permission="Expedicao.Rotas.criar"
          data-context-required="true"
          data-sensitive="true"
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Zap className="w-4 h-4 mr-2" />
          Gerar Rota com IA
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Rotas Ativas</p>
                <p className="text-2xl font-bold">{rotas.filter(r => r.status === "Em Execução").length}</p>
              </div>
              <Truck className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Entregas Pendentes</p>
                <p className="text-2xl font-bold">{entregasPendentes.length}</p>
              </div>
              <Navigation className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Economia IA (KM)</p>
                <p className="text-2xl font-bold text-green-600">
                  {rotas.reduce((acc, r) => acc + (r.otimizacao_ia?.economia_vs_rota_manual?.km_economizados || 0), 0).toFixed(0)}
                </p>
              </div>
              <TrendingDown className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <details className="bg-white rounded-lg border">
       <summary className="p-4 cursor-pointer font-medium text-sm">🗺️ Simular Geocodificação e Rota (Google Maps - Teste)</summary>
       <div className="p-4">
         <TesteGoogleMaps windowMode />
       </div>
      </details>

      <Card>
       <CardHeader>
         <CardTitle>Rotas Geradas</CardTitle>
       </CardHeader>
       <CardContent>
         <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left p-3 text-sm font-semibold">Data</th>
                  <th className="text-left p-3 text-sm font-semibold">Motorista</th>
                  <th className="text-left p-3 text-sm font-semibold">Veículo</th>
                  <th className="text-right p-3 text-sm font-semibold">Entregas</th>
                  <th className="text-right p-3 text-sm font-semibold">Distância (KM)</th>
                  <th className="text-right p-3 text-sm font-semibold">Tempo (h)</th>
                  <th className="text-right p-3 text-sm font-semibold">Custo Est.</th>
                  <th className="text-left p-3 text-sm font-semibold">Status</th>
                  <th className="text-center p-3 text-sm font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rotas.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="text-center p-6 text-slate-500">
                      Nenhuma rota gerada ainda
                    </td>
                  </tr>
                ) : (
                  rotas.map((rota) => (
                    <tr key={rota.id} className="border-b hover:bg-slate-50">
                      <td className="p-3 text-sm">
                        {new Date(rota.data_rota).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="p-3 text-sm">{rota.motorista_nome}</td>
                      <td className="p-3 text-sm">{rota.veiculo_placa}</td>
                      <td className="p-3 text-sm text-right">{rota.entregas_vinculadas?.length || 0}</td>
                      <td className="p-3 text-sm text-right">
                        {rota.otimizacao_ia?.distancia_total_km?.toFixed(1) || '-'}
                      </td>
                      <td className="p-3 text-sm text-right">
                        {rota.otimizacao_ia?.tempo_total_estimado_minutos 
                          ? (rota.otimizacao_ia.tempo_total_estimado_minutos / 60).toFixed(1) 
                          : '-'}
                      </td>
                      <td className="p-3 text-sm text-right">
                        R$ {(rota.otimizacao_ia?.custo_estimado_frete || 0).toFixed(2)}
                      </td>
                      <td className="p-3">
                        <Badge 
                          className={
                            rota.status === "Concluída" ? "bg-green-100 text-green-800" :
                            rota.status === "Em Execução" ? "bg-blue-100 text-blue-800" :
                            "bg-slate-100 text-slate-800"
                          }
                        >
                          {rota.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-center">
                        <Button size="sm" variant="outline" data-permission="Expedicao.Rotas.visualizar" data-action="RoteirizacaoIA.mapa" data-context-required="true">
                          <Map className="w-3 h-3 mr-1" />
                          Mapa
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}