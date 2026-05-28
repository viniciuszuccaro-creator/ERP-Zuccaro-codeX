import React, { useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Truck,
  MapPin,
  Package,
  Clock,
  CheckCircle,
  AlertCircle,
  User,
  Phone
} from "lucide-react";

const cleanText = (value) => String(value || "").replace(/[<>]/g, "").trim();
const formatDateTime = (value) => value ? new Date(value).toLocaleString("pt-BR") : "-";

/**
 * Componente de Rastreamento Publico.
 * Pode ser acessado via link unico sem login.
 * URL: /rastreamento?codigo=QR_CODE_DA_ENTREGA
 */
export default function RastreamentoPublico({ codigoRastreamento }) {
  const codigoSeguro = cleanText(codigoRastreamento);

  const { data: entrega, isLoading } = useQuery({
    queryKey: ["rastreamento-publico", codigoSeguro],
    queryFn: async () => {
      const entregas = await base44.entities.Entrega.filter({ qr_code: codigoSeguro });
      const encontrada = entregas[0] || null;
      if (!encontrada) return null;

      return {
        id: encontrada.id,
        status: encontrada.status,
        cliente_nome: cleanText(encontrada.cliente_nome),
        data_entrega: encontrada.data_entrega,
        data_previsao: encontrada.data_previsao,
        qr_code: cleanText(encontrada.qr_code),
        codigo_rastreamento: cleanText(encontrada.codigo_rastreamento),
        motorista: cleanText(encontrada.motorista),
        motorista_telefone: cleanText(encontrada.motorista_telefone),
        transportadora: cleanText(encontrada.transportadora),
        endereco_entrega_completo: encontrada.endereco_entrega_completo || {},
        historico_status: Array.isArray(encontrada.historico_status) ? encontrada.historico_status : [],
        comprovante_entrega: encontrada.comprovante_entrega || null
      };
    },
    enabled: Boolean(codigoSeguro),
    refetchInterval: 30000
  });

  const statusIcons = useMemo(() => ({
    "Aguardando Separacao": { icon: Clock, color: "text-yellow-600", bg: "bg-yellow-50" },
    "Aguardando Separação": { icon: Clock, color: "text-yellow-600", bg: "bg-yellow-50" },
    "Em Separacao": { icon: Package, color: "text-blue-600", bg: "bg-blue-50" },
    "Em Separação": { icon: Package, color: "text-blue-600", bg: "bg-blue-50" },
    "Pronto para Expedir": { icon: CheckCircle, color: "text-indigo-600", bg: "bg-indigo-50" },
    "Saiu para Entrega": { icon: Truck, color: "text-orange-600", bg: "bg-orange-50" },
    "Em Transito": { icon: Truck, color: "text-cyan-600", bg: "bg-cyan-50" },
    "Em Trânsito": { icon: Truck, color: "text-cyan-600", bg: "bg-cyan-50" },
    "Entregue": { icon: CheckCircle, color: "text-green-600", bg: "bg-green-50" },
    "Entrega Frustrada": { icon: AlertCircle, color: "text-red-600", bg: "bg-red-50" }
  }), []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-50 flex items-center justify-center p-6">
        <div className="text-center">
          <Truck className="w-16 h-16 animate-bounce mx-auto mb-4 text-blue-600" />
          <p className="text-slate-600">Buscando informacoes...</p>
        </div>
      </div>
    );
  }

  if (!entrega) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-6">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-900 mb-2">Codigo nao encontrado</h2>
            <p className="text-slate-600">
              O codigo de rastreamento nao existe ou foi digitado incorretamente.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentStatus = statusIcons[entrega.status] || statusIcons["Aguardando Separacao"];
  const Icon = currentStatus.icon;
  const endereco = entrega.endereco_entrega_completo || {};

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6" data-public-tracking="true">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Truck className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-slate-900">Rastreamento de Entrega</h1>
          </div>
          <p className="text-slate-600">Acompanhe seu pedido em tempo real</p>
        </div>

        <Card className={`border-2 ${entrega.status === "Entregue" ? "border-green-300" : "border-blue-300"}`}>
          <CardContent className="p-8 text-center">
            <div className={`w-24 h-24 rounded-full ${currentStatus.bg} flex items-center justify-center mx-auto mb-4`}>
              <Icon className={`w-12 h-12 ${currentStatus.color}`} />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">{cleanText(entrega.status)}</h2>
            <p className="text-slate-600">
              {entrega.status === "Entregue"
                ? `Entregue em ${formatDateTime(entrega.data_entrega)}`
                : entrega.data_previsao
                  ? `Previsao: ${new Date(entrega.data_previsao).toLocaleDateString("pt-BR")}`
                  : "Aguardando programacao"}
            </p>
            <code className="text-xs bg-slate-100 px-3 py-1 rounded mt-4 inline-block">
              Codigo: {entrega.qr_code}
            </code>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="bg-blue-50 border-b">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="w-5 h-5 text-blue-600" />
                Destino
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <p className="font-semibold text-slate-900">{entrega.cliente_nome}</p>
              <p className="text-sm text-slate-600 mt-2">
                {cleanText(endereco.logradouro)}, {cleanText(endereco.numero)}
                {endereco.complemento && ` - ${cleanText(endereco.complemento)}`}
              </p>
              <p className="text-sm text-slate-600">{cleanText(endereco.bairro)}</p>
              <p className="text-sm text-slate-600">
                {cleanText(endereco.cidade)}/{cleanText(endereco.estado)}
              </p>
              <p className="text-sm text-slate-600">CEP: {cleanText(endereco.cep)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="bg-purple-50 border-b">
              <CardTitle className="text-base flex items-center gap-2">
                <Truck className="w-5 h-5 text-purple-600" />
                Transporte
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {entrega.motorista && (
                <div className="mb-3">
                  <p className="text-xs text-slate-500">Motorista</p>
                  <p className="font-semibold flex items-center gap-2">
                    <User className="w-4 h-4" />
                    {entrega.motorista}
                  </p>
                </div>
              )}
              {entrega.motorista_telefone && (
                <div className="mb-3">
                  <p className="text-xs text-slate-500">Contato</p>
                  <p className="font-semibold flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    {entrega.motorista_telefone}
                  </p>
                </div>
              )}
              {entrega.transportadora && (
                <div>
                  <p className="text-xs text-slate-500">Transportadora</p>
                  <p className="font-semibold">{entrega.transportadora}</p>
                </div>
              )}
              {entrega.codigo_rastreamento && (
                <div className="mt-3">
                  <p className="text-xs text-slate-500">Codigo Transportadora</p>
                  <code className="text-sm bg-slate-100 px-2 py-1 rounded">
                    {entrega.codigo_rastreamento}
                  </code>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="bg-slate-50 border-b">
            <CardTitle className="text-base">Historico de Status</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {entrega.historico_status.length > 0 ? (
              <div className="space-y-4">
                {[...entrega.historico_status]
                  .sort((a, b) => new Date(b.data_hora) - new Date(a.data_hora))
                  .map((h, idx) => {
                    const statusConfig = statusIcons[h.status] || statusIcons["Aguardando Separacao"];
                    const StatusIcon = statusConfig.icon;

                    return (
                      <div key={idx} className="flex gap-4 items-start">
                        <div className={`w-10 h-10 rounded-full ${statusConfig.bg} flex items-center justify-center flex-shrink-0`}>
                          <StatusIcon className={`w-5 h-5 ${statusConfig.color}`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-start gap-3">
                            <p className="font-semibold text-slate-900">{cleanText(h.status)}</p>
                            <span className="text-xs text-slate-500">
                              {formatDateTime(h.data_hora)}
                            </span>
                          </div>
                          {h.observacao && (
                            <p className="text-sm text-slate-600 mt-1">{cleanText(h.observacao)}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <p className="text-center text-slate-500 py-6">Nenhuma atualizacao ainda</p>
            )}
          </CardContent>
        </Card>

        {entrega.status === "Entregue" && entrega.comprovante_entrega && (
          <Card className="border-2 border-green-300 bg-green-50">
            <CardHeader className="bg-green-100 border-b">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Comprovante de Entrega
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-green-700">Recebido por</p>
                  <p className="font-semibold text-green-900">
                    {cleanText(entrega.comprovante_entrega.nome_recebedor)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-green-700">Data/Hora</p>
                  <p className="font-semibold text-green-900">
                    {formatDateTime(entrega.comprovante_entrega.data_hora_recebimento)}
                  </p>
                </div>
              </div>

              {entrega.comprovante_entrega.foto_comprovante && (
                <div>
                  <p className="text-xs text-green-700 mb-2">Foto da Entrega</p>
                  <img
                    src={entrega.comprovante_entrega.foto_comprovante}
                    alt="Comprovante"
                    className="w-full rounded-lg border-2 border-green-300"
                  />
                </div>
              )}

              {entrega.comprovante_entrega.observacoes_recebimento && (
                <div>
                  <p className="text-xs text-green-700">Observacoes</p>
                  <p className="text-sm text-green-900 p-3 bg-white rounded">
                    {cleanText(entrega.comprovante_entrega.observacoes_recebimento)}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="text-center text-xs text-slate-500 pt-6">
          <p>Sistema ERP Integra - Gestao Empresarial Integrada</p>
          <p className="mt-1">Atualizado automaticamente a cada 30 segundos</p>
        </div>
      </div>
    </div>
  );
}
