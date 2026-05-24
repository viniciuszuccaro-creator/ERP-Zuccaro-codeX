import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, Package, Truck, Navigation, MapPin } from "lucide-react";

const sanitizeText = (value) => String(value || "")
  .replace(/[<>]/g, "")
  .replace(/javascript:/gi, "")
  .trim();

const safeMapUrl = (value) => {
  const url = sanitizeText(value);
  if (!url) return "";
  try {
    const parsed = new URL(url);
    const allowedHosts = ["google.com", "www.google.com", "maps.google.com", "openstreetmap.org", "www.openstreetmap.org"];
    return ["http:", "https:"].includes(parsed.protocol) && allowedHosts.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`)) ? url : "";
  } catch {
    return "";
  }
};

const statusAtivos = {
  Aprovado: ["Aprovado", "Pronto para Faturar", "Faturado", "Em Expedicao", "Em Transito", "Entregue"],
  "Pronto para Faturar": ["Pronto para Faturar", "Faturado", "Em Expedicao", "Em Transito", "Entregue"],
  Faturado: ["Faturado", "Em Expedicao", "Em Transito", "Entregue"],
  "Em Expedicao": ["Em Expedicao", "Em Transito", "Entregue"],
  "Em Transito": ["Em Transito", "Entregue"],
  Entregue: ["Entregue"]
};

export default function TimelineEntregaVisual({ pedido, entrega, windowMode = false, contextoValido = true, canView = true, onAudit }) {
  const pedidoStatus = sanitizeText(pedido?.status);
  const etapas = [
    { status: "Aprovado", titulo: "Pedido Aprovado", descricao: "Estoque reservado automaticamente", icon: CheckCircle2, cor: "green" },
    { status: "Pronto para Faturar", titulo: "Fechado para Entrega", descricao: "Enviado para logistica", icon: Package, cor: "indigo" },
    { status: "Faturado", titulo: "NF-e Emitida", descricao: "Nota fiscal gerada", icon: CheckCircle2, cor: "blue" },
    { status: "Em Expedicao", titulo: "Em Separacao", descricao: "Produtos sendo preparados", icon: Package, cor: "orange" },
    { status: "Em Transito", titulo: "Saiu para Entrega", descricao: "Veiculo em rota", icon: Truck, cor: "purple" },
    { status: "Entregue", titulo: "Entrega Concluida", descricao: "Pedido finalizado com sucesso", icon: CheckCircle2, cor: "green" }
  ].map((etapa) => ({
    ...etapa,
    ativo: (statusAtivos[etapa.status] || []).includes(pedidoStatus)
  }));

  const corPorNome = {
    green: "bg-green-600",
    indigo: "bg-indigo-600",
    blue: "bg-blue-600",
    orange: "bg-orange-600",
    purple: "bg-purple-600"
  };

  const canRender = Boolean(pedido?.id || pedido?.numero_pedido) && contextoValido && canView;
  const endereco = pedido?.endereco_entrega_principal || null;
  const mapaUrl = safeMapUrl(endereco?.mapa_url);

  const handleAbrirMapa = async () => {
    await onAudit?.({ acao: "TimelineEntrega.mapa.abrir", detalhes: { pedido_id: pedido?.id || null, entrega_id: entrega?.id || null } });
  };

  return (
    <Card className="w-full h-full border-0 shadow-lg" data-permission="Expedicao.Entregas.visualizar" data-context-required="true">
      <CardHeader className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
        <CardTitle className="flex items-center gap-2">
          <Navigation className="w-5 h-5" />
          Timeline da Entrega
        </CardTitle>
        <p className="text-sm opacity-90">Pedido #{sanitizeText(pedido?.numero_pedido) || "-"}</p>
      </CardHeader>
      <CardContent className="p-6">
        {!canRender && (
          <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {!contextoValido ? "Selecione grupo/empresa para visualizar a timeline." : !canView ? "Seu perfil nao tem permissao para visualizar a timeline." : "Selecione um pedido para visualizar a timeline."}
          </div>
        )}

        {canRender && (
          <>
            <div className="relative">
              <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-200" />
              <div className="space-y-6">
                {etapas.map((etapa, index) => {
                  const Icon = etapa.icon;
                  const ativoClass = etapa.ativo ? corPorNome[etapa.cor] : "bg-slate-300";

                  return (
                    <div key={etapa.status} className="relative flex gap-4 items-start">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${ativoClass} text-white shadow-lg z-10`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <div className="flex-1 pt-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className={`font-bold ${etapa.ativo ? "text-slate-900" : "text-slate-400"}`}>{etapa.titulo}</p>
                          {etapa.status === pedidoStatus && <Badge className="bg-blue-600 text-white animate-pulse">Atual</Badge>}
                        </div>
                        <p className={`text-sm ${etapa.ativo ? "text-slate-600" : "text-slate-400"}`}>{etapa.descricao}</p>
                        {etapa.ativo && Array.isArray(entrega?.historico_status) && (
                          <div className="mt-2">
                            {entrega.historico_status
                              .filter((hist) => sanitizeText(hist.status) === etapa.status)
                              .map((hist, idx) => (
                                <div key={`${etapa.status}-${idx}`} className="flex items-center gap-2 text-xs text-slate-500">
                                  <Clock className="w-3 h-3" />
                                  {new Date(hist.data_hora).toLocaleString("pt-BR")}
                                  {hist.usuario && ` - ${sanitizeText(hist.usuario)}`}
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {endereco && (
              <Card className="mt-6 bg-slate-50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-semibold text-slate-900 mb-1">Endereco de Entrega</p>
                      <p className="text-sm text-slate-700">
                        {sanitizeText(endereco.logradouro)}, {sanitizeText(endereco.numero)}
                        {endereco.complemento && ` - ${sanitizeText(endereco.complemento)}`}
                      </p>
                      <p className="text-sm text-slate-600">
                        {sanitizeText(endereco.bairro)} - {sanitizeText(endereco.cidade)}/{sanitizeText(endereco.estado)}
                      </p>
                      <p className="text-sm text-slate-500">CEP: {sanitizeText(endereco.cep)}</p>
                      {mapaUrl && (
                        <a
                          href={mapaUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mt-2"
                          data-action="TimelineEntrega.mapa.abrir"
                          data-context-required="true"
                          onClick={handleAbrirMapa}
                        >
                          <Navigation className="w-4 h-4" />
                          Abrir no Google Maps
                        </a>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
