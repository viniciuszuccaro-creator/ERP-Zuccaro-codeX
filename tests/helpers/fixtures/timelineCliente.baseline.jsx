import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ShoppingBag,
  Factory,
  Truck,
  DollarSign,
  FileText,
  MessageSquare,
  User,
  Settings,
  AlertCircle,
  CheckCircle,
  Clock,
  Download,
  Send,
  Eye,
  Filter,
  Building2,
  MapPin,
  TrendingUp,
  Package
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const moduloConfig = {
  "Cadastro": { icon: User, color: "text-slate-600", bg: "bg-slate-100" },
  "Comercial": { icon: ShoppingBag, color: "text-blue-600", bg: "bg-blue-100" },
  "Pedido": { icon: ShoppingBag, color: "text-blue-600", bg: "bg-blue-100" },
  "Producao": { icon: Factory, color: "text-orange-600", bg: "bg-orange-100" },
  "Expedicao": { icon: Truck, color: "text-green-600", bg: "bg-green-100" },
  "Financeiro": { icon: DollarSign, color: "text-purple-600", bg: "bg-purple-100" },
  "Fiscal": { icon: FileText, color: "text-yellow-600", bg: "bg-yellow-100" },
  "CRM": { icon: MessageSquare, color: "text-pink-600", bg: "bg-pink-100" },
  "Comunicacao": { icon: MessageSquare, color: "text-cyan-600", bg: "bg-cyan-100" },
  "Manual": { icon: User, color: "text-slate-600", bg: "bg-slate-100" },
  "Sistema": { icon: Settings, color: "text-indigo-600", bg: "bg-indigo-100" }
};

const tipoEventoConfig = {
  "Criacao": { icon: Package, color: "text-blue-600" },
  "Alteracao": { icon: Settings, color: "text-orange-600" },
  "Aprovacao": { icon: CheckCircle, color: "text-green-600" },
  "Cancelamento": { icon: AlertCircle, color: "text-red-600" },
  "Finalizacao": { icon: CheckCircle, color: "text-emerald-600" },
  "Envio": { icon: Send, color: "text-blue-600" },
  "Recebimento": { icon: TrendingUp, color: "text-green-600" },
  "Pagamento": { icon: DollarSign, color: "text-purple-600" },
  "Atraso": { icon: Clock, color: "text-orange-600" },
  "Entrega": { icon: Truck, color: "text-green-600" },
  "Devolucao": { icon: AlertCircle, color: "text-red-600" },
  "Comunicacao": { icon: MessageSquare, color: "text-cyan-600" },
  "Observacao": { icon: FileText, color: "text-slate-600" },
  "Alerta": { icon: AlertCircle, color: "text-amber-600" }
};

export default function TimelineCliente({ clienteId, limitarModulo = null, limitarReferencia = null, showFilters = true }) {
  const [filtroModulo, setFiltroModulo] = useState("todos");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [busca, setBusca] = useState("");
  const [limite, setLimite] = useState(20);

  const { data: eventos = [], isLoading } = useQuery({
    queryKey: ['historico-cliente', clienteId, limite],
    queryFn: async () => {
      let query = { cliente_id: clienteId };
      if (limitarModulo) query.modulo_origem = limitarModulo;
      if (limitarReferencia) query.referencia_id = limitarReferencia;
      
      const result = await base44.entities.HistoricoCliente.filter(query, '-data_evento', limite);
      return result;
    },
    enabled: !!clienteId
  });

  const eventosFiltrados = eventos.filter(evento => {
    const matchModulo = filtroModulo === "todos" || evento.modulo_origem === filtroModulo;
    const matchTipo = filtroTipo === "todos" || evento.tipo_evento === filtroTipo;
    const matchBusca = busca === "" || 
      evento.titulo_evento?.toLowerCase().includes(busca.toLowerCase()) ||
      evento.descricao_detalhada?.toLowerCase().includes(busca.toLowerCase()) ||
      evento.referencia_numero?.toLowerCase().includes(busca.toLowerCase());
    
    return matchModulo && matchTipo && matchBusca;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showFilters && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <Input
                  placeholder="Buscar na timeline..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="w-full"
                />
              </div>
              <Select value={filtroModulo} onValueChange={setFiltroModulo}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos Módulos</SelectItem>
                  <SelectItem value="Comercial">Comercial</SelectItem>
                  <SelectItem value="Producao">Produção</SelectItem>
                  <SelectItem value="Expedicao">Expedição</SelectItem>
                  <SelectItem value="Financeiro">Financeiro</SelectItem>
                  <SelectItem value="Fiscal">Fiscal</SelectItem>
                  <SelectItem value="CRM">CRM</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos Tipos</SelectItem>
                  <SelectItem value="Criacao">Criação</SelectItem>
                  <SelectItem value="Aprovacao">Aprovação</SelectItem>
                  <SelectItem value="Envio">Envio</SelectItem>
                  <SelectItem value="Pagamento">Pagamento</SelectItem>
                  <SelectItem value="Entrega">Entrega</SelectItem>
                  <SelectItem value="Comunicacao">Comunicação</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {eventosFiltrados.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <Clock className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p>Nenhum evento encontrado</p>
          </div>
        )}

        {eventosFiltrados.map((evento, index) => {
          const moduloInfo = moduloConfig[evento.modulo_origem] || moduloConfig["Sistema"];
          const tipoInfo = tipoEventoConfig[evento.tipo_evento] || tipoEventoConfig["Observacao"];
          const ModuloIcon = moduloInfo.icon;
          const TipoIcon = tipoInfo.icon;

          return (
            <div key={evento.id || index} className="relative">
              {/* Linha conectora */}
              {index < eventosFiltrados.length - 1 && (
                <div className="absolute left-[21px] top-12 w-0.5 h-full bg-slate-200 z-0"></div>
              )}

              {/* Card do Evento */}
              <div className="relative z-10 flex gap-4">
                {/* Ícone do Módulo */}
                <div className={`flex-shrink-0 w-11 h-11 rounded-full ${moduloInfo.bg} flex items-center justify-center shadow-sm`}>
                  <ModuloIcon className={`w-6 h-6 ${moduloInfo.color}`} />
                </div>

                {/* Conteúdo */}
                <Card className="flex-1 border-0 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1">
                        {/* Cabeçalho */}
                        <div className="flex items-start gap-2 mb-2">
                          <TipoIcon className={`w-4 h-4 mt-0.5 ${tipoInfo.color}`} />
                          <div className="flex-1">
                            <h4 className="font-semibold text-slate-900">{evento.titulo_evento}</h4>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {evento.modulo_origem}
                              </Badge>
                              {evento.referencia_numero && (
                                <Badge variant="outline" className="text-xs">
                                  {evento.referencia_tipo}: {evento.referencia_numero}
                                </Badge>
                              )}
                              {evento.empresa_id && (
                                <Badge variant="outline" className="text-xs flex items-center gap-1">
                                  <Building2 className="w-3 h-3" />
                                  {evento._empresa_label || 'Empresa'}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Descrição */}
                        {evento.descricao_detalhada && (
                          <p className="text-sm text-slate-600 mt-2">
                            {evento.descricao_detalhada}
                          </p>
                        )}

                        {/* Status relacionado */}
                        {evento.status_relacionado && (
                          <div className="mt-2">
                            <Badge className="text-xs">
                              Status: {evento.status_relacionado}
                            </Badge>
                          </div>
                        )}

                        {/* Comunicações */}
                        {(evento.whatsapp_envio || evento.email_envio) && (
                          <div className="flex gap-2 mt-3">
                            {evento.whatsapp_envio && (
                              <div className="flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-1 rounded">
                                <MessageSquare className="w-3 h-3" />
                                WhatsApp: {evento.whatsapp_status}
                              </div>
                            )}
                            {evento.email_envio && (
                              <div className="flex items-center gap-1 text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded">
                                <Send className="w-3 h-3" />
                                E-mail: {evento.email_status}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Localização */}
                        {evento.latitude && evento.longitude && (
                          <div className="flex items-center gap-1 text-xs text-slate-500 mt-2">
                            <MapPin className="w-3 h-3" />
                            Lat: {evento.latitude.toFixed(6)}, Long: {evento.longitude.toFixed(6)}
                          </div>
                        )}

                        {/* Ações */}
                        {evento.anexo_url && (
                          <div className="mt-3">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(evento.anexo_url, '_blank')}
                            >
                              <Download className="w-3 h-3 mr-2" />
                              Baixar {evento.anexo_tipo || 'Anexo'}
                            </Button>
                          </div>
                        )}

                        {/* Footer */}
                        <div className="flex items-center gap-3 mt-3 pt-3 border-t text-xs text-slate-500">
                          <span>
                            {new Date(evento.data_evento).toLocaleString('pt-BR')}
                          </span>
                          {evento.usuario_responsavel && (
                            <>
                              <span>•</span>
                              <span>Por: {evento.usuario_responsavel}</span>
                            </>
                          )}
                          {evento.valor_relacionado && (
                            <>
                              <span>•</span>
                              <span className="font-semibold text-green-600">
                                R$ {evento.valor_relacionado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Ação necessária */}
                      {evento.acao_necessaria && !evento.resolvido && (
                        <div className="flex-shrink-0">
                          <Badge variant="destructive" className="flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Ação Necessária
                          </Badge>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          );
        })}
      </div>

      {/* Carregar mais */}
      {eventosFiltrados.length >= limite && (
        <div className="text-center pt-4">
          <Button
            variant="outline"
            onClick={() => setLimite(limite + 20)}
          >
            Carregar mais eventos
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Hook para registrar evento no histórico do cliente
 */
export function useRegistrarEvento() {
  return async (evento) => {
    try {
      await base44.entities.HistoricoCliente.create({
        ...evento,
        data_evento: evento.data_evento || new Date().toISOString()
      });
    } catch (error) {
      console.error("Erro ao registrar evento no histórico:", error);
    }
  };
}

/**
 * Componente para resumo rápido do histórico
 */
export function ResumoHistorico({ clienteId }) {
  const { data: eventos = [] } = useQuery({
    queryKey: ['historico-resumo', clienteId],
    queryFn: () => base44.entities.HistoricoCliente.filter({ cliente_id: clienteId }, '-data_evento', 50),
    enabled: !!clienteId
  });

  const totalPedidos = eventos.filter(e => e.modulo_origem === "Comercial" && e.tipo_evento === "Criacao").length;
  const totalEntregas = eventos.filter(e => e.modulo_origem === "Expedicao" && e.tipo_evento === "Entrega").length;
  const totalPagamentos = eventos.filter(e => e.modulo_origem === "Financeiro" && e.tipo_evento === "Pagamento").length;
  const totalComunicacoes = eventos.filter(e => e.whatsapp_envio || e.email_envio).length;

  const ultimoEvento = eventos[0];
  const diasDesdeUltimo = ultimoEvento 
    ? Math.floor((new Date().getTime() - new Date(ultimoEvento.data_evento).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-600">Pedidos</p>
              <p className="text-2xl font-bold text-blue-600">{totalPedidos}</p>
            </div>
            <ShoppingBag className="w-8 h-8 text-blue-300" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-600">Entregas</p>
              <p className="text-2xl font-bold text-green-600">{totalEntregas}</p>
            </div>
            <Truck className="w-8 h-8 text-green-300" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-600">Pagamentos</p>
              <p className="text-2xl font-bold text-purple-600">{totalPagamentos}</p>
            </div>
            <DollarSign className="w-8 h-8 text-purple-300" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-600">Comunicações</p>
              <p className="text-2xl font-bold text-cyan-600">{totalComunicacoes}</p>
            </div>
            <MessageSquare className="w-8 h-8 text-cyan-300" />
          </div>
        </CardContent>
      </Card>

      {diasDesdeUltimo !== null && (
        <Card className="col-span-2 md:col-span-4 border-0 bg-slate-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-slate-500" />
              <div>
                <p className="text-sm font-medium text-slate-700">
                  Última interação há <strong>{diasDesdeUltimo}</strong> dia(s)
                </p>
                <p className="text-xs text-slate-500">{ultimoEvento.titulo_evento}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
