import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, 
  Truck, 
  DollarSign, 
  MessageSquare,
  Mail,
  Phone,
  AlertCircle,
  CheckCircle,
  Factory,
  User,
  MapPin
} from "lucide-react";
import useContextoVisual from "@/components/lib/useContextoVisual";
import { readErpHttpSession } from "@/api/erpHttpSession";
import { central360SessionKey } from "@/api/httpApiClient";
import {
  buildHistoricoComunicacaoQueryKey,
  isHistoricoComunicacaoScopeCurrent,
  filterHistoricoComunicacaoEventos,
  resolveHistoricoComunicacaoKpiState,
} from "./historicoComunicacaoScope";

function readHistoricoActorAndSession() {
  const session = readErpHttpSession();
  const actorId = typeof session?.actorId === 'string' ? session.actorId.trim() : '';
  return {
    actorId: actorId || null,
    sessionKey: central360SessionKey(session?.token),
  };
}

/**
 * Timeline de Comunicação e Histórico do Pedido/Cliente
 * Integra todos os módulos: Pedido, Produção, Estoque, Expedição, Fiscal, Financeiro
 *
 * Escopo multiempresa: HistoricoCliente via filterInContext (sem list unscoped).
 * Cache: alvo+Grupo+Empresa+ator+sessão. Loading/erro ≠ zero eventos.
 */
export default function HistoricoComunicacao({ clienteId, pedidoId }) {
  const { empresaAtual, grupoAtual, filterInContext } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const { actorId, sessionKey } = readHistoricoActorAndSession();
  const contextoValido = Boolean(groupId || empresaId);
  const hasTarget = Boolean(clienteId || pedidoId);
  const scopeExpected = { actorId, sessionKey };

  const {
    data: historico,
    isLoading,
    isError,
    isFetching,
  } = useQuery({
    queryKey: buildHistoricoComunicacaoQueryKey({
      clienteId, pedidoId, groupId, empresaId, actorId, sessionKey,
    }),
    queryFn: async ({ signal }) => {
      // Preferir filtro server-side; OR legado pedido_id|referencia_id aplicado após o escopo.
      const baseFilter = clienteId ? { cliente_id: clienteId } : {};
      const rows = await filterInContext(
        'HistoricoCliente',
        baseFilter,
        '-data_evento',
        200,
      );
      if (signal?.aborted) {
        const err = new Error('HISTORICO_COMUNICACAO_ABORTED');
        err.name = 'AbortError';
        throw err;
      }
      if (!isHistoricoComunicacaoScopeCurrent(scopeExpected, readHistoricoActorAndSession())) {
        throw new Error('HISTORICO_COMUNICACAO_STALE_SCOPE');
      }
      return filterHistoricoComunicacaoEventos(rows, { clienteId, pedidoId });
    },
    enabled: hasTarget && contextoValido,
  });

  const kpiState = resolveHistoricoComunicacaoKpiState({
    contextoValido,
    clienteId,
    pedidoId,
    isLoading,
    isError,
    isFetching,
    dataDefined: historico !== undefined,
  });
  const lista = Array.isArray(historico) ? historico : [];
  const contagemIndisponivel = kpiState !== 'ready';

  const getIcone = (moduloOrigem, tipoEvento) => {
    if (moduloOrigem === "Pedido" || moduloOrigem === "Comercial") return FileText;
    if (moduloOrigem === "Producao") return Factory;
    if (moduloOrigem === "Expedicao") return Truck;
    if (moduloOrigem === "Fiscal") return FileText;
    if (moduloOrigem === "Financeiro") return DollarSign;
    if (moduloOrigem === "Comunicacao") {
      if (tipoEvento?.includes("WhatsApp")) return MessageSquare;
      if (tipoEvento?.includes("Email")) return Mail;
      if (tipoEvento?.includes("Ligação")) return Phone;
      return MessageSquare;
    }
    if (moduloOrigem === "Cadastro") return User;
    return FileText;
  };

  const getCorModulo = (moduloOrigem) => {
    if (moduloOrigem === "Pedido" || moduloOrigem === "Comercial") return "blue";
    if (moduloOrigem === "Producao") return "purple";
    if (moduloOrigem === "Expedicao") return "green";
    if (moduloOrigem === "Fiscal") return "indigo";
    if (moduloOrigem === "Financeiro") return "orange";
    if (moduloOrigem === "Comunicacao") return "pink";
    if (moduloOrigem === "Cadastro") return "slate";
    return "gray";
  };

  if (!contextoValido) {
    return (
      <Card className="border-amber-300 bg-amber-50">
        <CardContent className="p-4 text-sm text-amber-900">
          Selecione grupo ou empresa para listar o histórico de comunicação.
        </CardContent>
      </Card>
    );
  }

  if (!hasTarget) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-slate-500">
          Informe cliente ou pedido para carregar a linha do tempo.
        </CardContent>
      </Card>
    );
  }

  if (kpiState === 'loading') {
    return (
      <Card>
        <CardContent className="p-12 text-center text-slate-500">
          Carregando histórico...
        </CardContent>
      </Card>
    );
  }

  if (kpiState === 'error') {
    return (
      <Card className="border-red-300 bg-red-50">
        <CardContent className="p-4 text-sm text-red-900">
          Não foi possível carregar o histórico (erro de carga ≠ zero eventos).
        </CardContent>
      </Card>
    );
  }

  const tituloContagem = contagemIndisponivel ? '…' : `${lista.length} eventos`;

  return (
    <Card>
      <CardHeader className="bg-slate-50 border-b">
        <CardTitle className="text-base">
          Linha do Tempo - {pedidoId ? 'Pedido' : 'Cliente'} ({tituloContagem})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-4">
          {lista.map((evento, idx) => {
            const Icone = getIcone(evento.modulo_origem, evento.tipo_evento);
            const cor = getCorModulo(evento.modulo_origem);
            
            return (
              <div key={evento.id || idx} className="flex gap-4">
                {/* Linha vertical */}
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full bg-${cor}-100 flex items-center justify-center flex-shrink-0`}>
                    <Icone className={`w-5 h-5 text-${cor}-600`} />
                  </div>
                  {idx < lista.length - 1 && (
                    <div className="w-0.5 h-full bg-slate-200 flex-1 min-h-[40px]"></div>
                  )}
                </div>

                {/* Conteúdo */}
                <div className="flex-1 pb-6">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold text-slate-900">{evento.titulo_evento}</p>
                      <p className="text-sm text-slate-600">{evento.descricao_detalhada}</p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-4">
                      <Badge className={`bg-${cor}-100 text-${cor}-700`}>
                        {evento.modulo_origem}
                      </Badge>
                      <p className="text-xs text-slate-500 mt-1">
                        {new Date(evento.data_evento).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>

                  {/* Detalhes adicionais */}
                  <div className="flex flex-wrap gap-2 mt-2 text-xs text-slate-600">
                    {evento.usuario_responsavel && (
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {evento.usuario_responsavel}
                      </span>
                    )}
                    {evento.referencia_numero && (
                      <span className="flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        {evento.referencia_numero}
                      </span>
                    )}
                    {evento.valor_relacionado && (
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        R$ {evento.valor_relacionado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    )}
                    {evento.latitude && evento.longitude && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        GPS: {evento.latitude.toFixed(4)}, {evento.longitude.toFixed(4)}
                      </span>
                    )}
                  </div>

                  {/* Status relacionado */}
                  {evento.status_relacionado && (
                    <Badge variant="outline" className="mt-2">
                      {evento.status_relacionado}
                    </Badge>
                  )}

                  {/* Anexo */}
                  {evento.anexo_url && (
                    <a
                      href={evento.anexo_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline mt-2 inline-block"
                    >
                      📎 Ver {evento.anexo_tipo || 'anexo'}
                    </a>
                  )}

                  {/* Ação necessária */}
                  {evento.acao_necessaria && !evento.resolvido && (
                    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-amber-900">Ação Necessária</p>
                        <p className="text-xs text-amber-800">{evento.acao_descricao}</p>
                      </div>
                    </div>
                  )}

                  {evento.resolvido && evento.acao_necessaria && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-green-700">
                      <CheckCircle className="w-4 h-4" />
                      <span>Resolvido por {evento.resolvido_por} em {new Date(evento.resolvido_em).toLocaleString('pt-BR')}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {!contagemIndisponivel && lista.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <FileText className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p>Nenhum evento registrado</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
