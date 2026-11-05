import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Truck, 
  MapPin, 
  Phone, 
  Mail, 
  Package,
  TrendingUp,
  ExternalLink,
  Edit,
  Calendar,
  AlertCircle
} from "lucide-react";
import { useQuery } from "@tanstack/react-query"; // Changed from @tantml:react-query
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import usePermissions from "@/components/lib/usePermissions";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import { readErpHttpSession } from "@/api/erpHttpSession";
import { central360SessionKey } from "@/api/httpApiClient";
import {
  resolvePainelTransportadoraKpiState,
  isPainelTransportadoraScopeCurrent,
  countPainelTransportadoraEntregasRealizadas,
  countPainelTransportadoraEntregasFrustradas,
  computePainelTransportadoraTaxaSucesso,
} from "./painelDinamicoTransportadoraScope";

/**
 * V21.1.2 - WINDOW MODE READY
 * Entrega/Romaneio via filterInContext; KPI loading/erro ≠ 0%.
 */
export default function PainelDinamicoTransportadora({ transportadora, isOpen, onClose, windowMode = false }) {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const { filterInContext, empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = contexto === "empresa" ? empresaAtual?.id : null;
  const contextoValido = Boolean(groupId || empresaId);
  const painelAberto = Boolean(isOpen || windowMode);
  const transportadoraId = transportadora?.id || null;
  const sessionSnapshot = readErpHttpSession();
  const actorId = typeof sessionSnapshot?.actorId === "string" && sessionSnapshot.actorId.trim()
    ? sessionSnapshot.actorId.trim()
    : null;
  const sessionKey = central360SessionKey(sessionSnapshot?.token);
  const scopeExpected = { actorId, sessionKey };
  const readActorAndSession = () => {
    const session = readErpHttpSession();
    const nextActor = typeof session?.actorId === "string" && session.actorId.trim()
      ? session.actorId.trim()
      : null;
    return { actorId: nextActor, sessionKey: central360SessionKey(session?.token) };
  };
  const queriesEnabled = Boolean(transportadoraId) && painelAberto && contextoValido;

  const entregasQuery = useQuery({
    queryKey: ['entregas-transportadora', transportadoraId, groupId, empresaId, actorId, sessionKey],
    queryFn: async ({ signal }) => {
      const rows = await filterInContext('Entrega', { transportadora_id: transportadoraId }, '-data_saida');
      if (signal?.aborted) {
        const err = new Error('PAINEL_TRANSPORTADORA_ABORTED');
        err.name = 'AbortError';
        throw err;
      }
      if (!isPainelTransportadoraScopeCurrent(scopeExpected, readActorAndSession())) {
        throw new Error('PAINEL_TRANSPORTADORA_ENTREGAS_STALE_SCOPE');
      }
      return rows;
    },
    enabled: queriesEnabled,
  });

  const romaneiosQuery = useQuery({
    queryKey: ['romaneios-transportadora', transportadoraId, transportadora?.nome, groupId, empresaId, actorId, sessionKey],
    queryFn: async ({ signal }) => {
      const rows = await filterInContext('Romaneio', { motorista: transportadora.nome }, '-data_romaneio');
      if (signal?.aborted) {
        const err = new Error('PAINEL_TRANSPORTADORA_ABORTED');
        err.name = 'AbortError';
        throw err;
      }
      if (!isPainelTransportadoraScopeCurrent(scopeExpected, readActorAndSession())) {
        throw new Error('PAINEL_TRANSPORTADORA_ROMANEIOS_STALE_SCOPE');
      }
      return rows;
    },
    enabled: queriesEnabled,
  });

  const entregasKpi = resolvePainelTransportadoraKpiState({
    painelAberto, contextoValido, transportadoraId,
    isLoading: entregasQuery.isLoading, isError: entregasQuery.isError,
    isFetching: entregasQuery.isFetching, dataDefined: entregasQuery.data !== undefined,
  });
  const romaneiosKpi = resolvePainelTransportadoraKpiState({
    painelAberto, contextoValido, transportadoraId,
    isLoading: romaneiosQuery.isLoading, isError: romaneiosQuery.isError,
    isFetching: romaneiosQuery.isFetching, dataDefined: romaneiosQuery.data !== undefined,
  });

  const entregas = entregasKpi === 'ready' && Array.isArray(entregasQuery.data) ? entregasQuery.data : [];
  const romaneios = romaneiosKpi === 'ready' && Array.isArray(romaneiosQuery.data) ? romaneiosQuery.data : [];

  const podeEditar = hasPermission('cadastros', 'editar');

  const handleEditarCadastro = () => {
    navigate(createPageUrl('Cadastros') + '?tab=transportadoras&transportadora=' + transportadora.id);
    onClose();
  };

  if (!transportadora) return null;

  const entregasRealizadas = entregasKpi === 'ready' ? countPainelTransportadoraEntregasRealizadas(entregas) : null;
  const entregasFrustradas = entregasKpi === 'ready' ? countPainelTransportadoraEntregasFrustradas(entregas) : null;
  const taxaSucesso = entregasKpi === 'ready' ? computePainelTransportadoraTaxaSucesso(entregas) : null;
  const content = (
    <>
      <div className="border-b pb-4 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
              <Truck className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">
                {transportadora.razao_social || transportadora.nome_fantasia}
              </h2>
                <div className="flex items-center gap-3 mt-2">
                  <Badge className={
                    transportadora.status === 'Ativo' ? 'bg-green-100 text-green-700' :
                    'bg-gray-100 text-gray-700'
                  }>
                    {transportadora.status}
                  </Badge>
                  {transportadora.cnpj && (
                    <span className="text-sm text-slate-600">
                      CNPJ: {transportadora.cnpj}
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            {podeEditar && (
              <Button onClick={handleEditarCadastro} className="gap-2">
                <Edit className="w-4 h-4" />
                Editar no Cadastro Gerais
              <ExternalLink className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
          {/* Coluna 1: Dados Principais */}
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <Truck className="w-4 h-4" />
              Dados da Transportadora
            </h3>

            <div className="space-y-2 text-sm">
              {transportadora.inscricao_estadual && (
                <div>
                  <p className="text-slate-600">Inscrição Estadual</p>
                  <p className="font-medium text-slate-900">{transportadora.inscricao_estadual}</p>
                </div>
              )}

              {transportadora.endereco && (
                <div>
                  <p className="text-slate-600 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    Endereço
                  </p>
                  <p className="font-medium text-slate-900">{transportadora.endereco}</p>
                  {transportadora.cidade && (
                    <p className="text-slate-600">
                      {transportadora.cidade}{transportadora.estado && `/${transportadora.estado}`}
                    </p>
                  )}
                  {transportadora.cep && (
                    <p className="text-slate-600 text-xs">CEP: {transportadora.cep}</p>
                  )}
                </div>
              )}

              <div className="pt-4 border-t">
                <p className="font-medium text-slate-900 flex items-center gap-2 text-sm mb-2">
                  <Phone className="w-4 h-4 text-slate-400" />
                  Contatos
                </p>
                <div className="space-y-1 pl-6 text-sm">
                  {transportadora.telefone && (
                    <p className="text-slate-600">
                      <span className="font-medium">Telefone:</span> {transportadora.telefone}
                    </p>
                  )}
                  {transportadora.whatsapp && (
                    <p className="text-slate-600">
                      <span className="font-medium">WhatsApp:</span> {transportadora.whatsapp}
                    </p>
                  )}
                  {transportadora.email && (
                    <p className="text-slate-600 flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      {transportadora.email}
                    </p>
                  )}
                  {transportadora.contato_responsavel && (
                    <p className="text-slate-600">
                      <span className="font-medium">Responsável:</span> {transportadora.contato_responsavel}
                    </p>
                  )}
                </div>
              </div>

              {transportadora.tipos_veiculo && transportadora.tipos_veiculo.length > 0 && (
                <div className="pt-4 border-t">
                  <p className="text-slate-600 text-sm mb-2">Tipos de Veículo</p>
                  <div className="flex flex-wrap gap-1">
                    {transportadora.tipos_veiculo.map((tipo, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {tipo}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {transportadora.areas_atendimento && (
                <div className="pt-4 border-t">
                  <p className="text-slate-600 text-sm">Áreas de Atendimento</p>
                  <p className="text-slate-900 text-xs mt-1">{transportadora.areas_atendimento}</p>
                </div>
              )}

              {transportadora.prazo_entrega_padrao && (
                <div className="pt-4 border-t">
                  <p className="text-slate-600 text-sm">Prazo Padrão</p>
                  <p className="text-slate-900 font-semibold">{transportadora.prazo_entrega_padrao} dias</p>
                </div>
              )}

              {transportadora.valor_frete_minimo && (
                <div className="pt-4 border-t">
                  <p className="text-slate-600 text-sm">Frete Mínimo</p>
                  <p className="text-green-600 font-bold">
                    R$ {transportadora.valor_frete_minimo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Coluna 2: Desempenho e Estatísticas */}
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Desempenho
            </h3>

            <div className="grid grid-cols-2 gap-3">
              {entregasKpi === 'loading' && (
                <p className="col-span-2 text-sm text-slate-500 animate-pulse">Carregando desempenho…</p>
              )}
              {entregasKpi === 'error' && (
                <p className="col-span-2 text-sm text-red-600">Erro ≠ 0 entregas / 0%</p>
              )}
              {entregasKpi === 'unavailable' && (
                <p className="col-span-2 text-sm text-amber-700">Contexto necessário</p>
              )}
              {entregasKpi === 'ready' && (
                <>
              <div className="p-3 bg-green-50 rounded-lg">
                <p className="text-xs text-green-700">Entregas Realizadas</p>
                <p className="text-2xl font-bold text-green-900">{entregasRealizadas}</p>
              </div>
              <div className="p-3 bg-red-50 rounded-lg">
                <p className="text-xs text-red-700">Entregas Frustradas</p>
                <p className="text-2xl font-bold text-red-900">{entregasFrustradas}</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg col-span-2">
                <p className="text-xs text-blue-700">Taxa de Sucesso</p>
                <p className="text-3xl font-bold text-blue-900">{taxaSucesso}%</p>
              </div>
                </>
              )}
            </div>

            <div className="pt-4 border-t">
              <p className="font-medium text-slate-900 text-sm mb-3">Romaneios Recentes</p>
              {romaneiosKpi === 'loading' && (
                <p className="text-xs text-slate-500 animate-pulse">Carregando romaneios…</p>
              )}
              {romaneiosKpi === 'error' && (
                <p className="text-xs text-red-600">Erro ≠ lista vazia</p>
              )}
              {romaneiosKpi === 'unavailable' && (
                <p className="text-xs text-amber-700">Contexto necessário</p>
              )}
              {romaneiosKpi === 'ready' && romaneios.length > 0 && (
                <div className="space-y-2 max-h-[280px] overflow-y-auto">
                  {romaneios.slice(0, 8).map((romaneio) => (
                    <div key={romaneio.id} className="p-2 bg-slate-50 rounded-lg text-xs">
                      <div className="flex justify-between items-start mb-1">
                        <p className="font-medium text-slate-900">#{romaneio.numero_romaneio}</p>
                        <Badge className={
                          romaneio.status === 'Concluído' ? 'bg-green-100 text-green-700 text-xs' :
                          romaneio.status === 'Em Rota' ? 'bg-blue-100 text-blue-700 text-xs' :
                          'bg-slate-100 text-slate-700 text-xs'
                        }>
                          {romaneio.status}
                        </Badge>
                      </div>
                      <p className="text-slate-600">
                        {new Date(romaneio.data_romaneio).toLocaleDateString('pt-BR')}
                      </p>
                      {romaneio.quantidade_entregas && (
                        <p className="text-slate-900 font-semibold mt-1">
                          {romaneio.quantidade_entregas} entregas
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {romaneiosKpi === 'ready' && romaneios.length === 0 && (
                <div className="text-center py-6 text-slate-500">
                  <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">Nenhum romaneio registrado</p>
                </div>
              )}
            </div>
          </div>

          {/* Coluna 3: Histórico de Entregas */}
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <Package className="w-4 h-4" />
              Histórico de Entregas
            </h3>

            <div className="max-h-[440px] overflow-y-auto">
              {entregasKpi === 'loading' && (
                <p className="text-sm text-slate-500 animate-pulse py-6 text-center">Carregando entregas…</p>
              )}
              {entregasKpi === 'error' && (
                <p className="text-sm text-red-600 py-6 text-center">Erro ≠ histórico vazio</p>
              )}
              {entregasKpi === 'unavailable' && (
                <p className="text-sm text-amber-700 py-6 text-center">Contexto necessário</p>
              )}
              {entregasKpi === 'ready' && entregas.length > 0 && (
                <div className="space-y-2">
                  {entregas.slice(0, 15).map((entrega) => (
                    <div key={entrega.id} className="p-3 bg-slate-50 rounded-lg text-sm">
                      <div className="flex justify-between items-start mb-1">
                        <p className="font-medium text-slate-900">
                          {entrega.cliente_nome}
                        </p>
                        <Badge className={
                          entrega.status === 'Entregue' ? 'bg-green-100 text-green-700 text-xs' :
                          entrega.status === 'Em Trânsito' ? 'bg-blue-100 text-blue-700 text-xs' :
                          entrega.status === 'Entrega Frustrada' ? 'bg-red-100 text-red-700 text-xs' :
                          'bg-slate-100 text-slate-700 text-xs'
                        }>
                          {entrega.status}
                        </Badge>
                      </div>
                      
                      {entrega.endereco_entrega_completo && (
                        <p className="text-xs text-slate-600 flex items-start gap-1">
                          <MapPin className="w-3 h-3 mt-0.5" />
                          {entrega.endereco_entrega_completo.cidade}/{entrega.endereco_entrega_completo.estado}
                        </p>
                      )}
                      
                      {entrega.data_previsao && (
                        <p className="text-xs text-slate-600 flex items-center gap-1 mt-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(entrega.data_previsao).toLocaleDateString('pt-BR')}
                        </p>
                      )}

                      {entrega.volumes && (
                        <p className="text-xs text-slate-900 mt-1">
                          {entrega.volumes} volume(s) • {entrega.peso_total_kg?.toFixed(2) || 0} kg
                        </p>
                      )}

                      {entrega.status === 'Entrega Frustrada' && entrega.entrega_frustrada && (
                        <div className="mt-2 p-2 bg-red-50 rounded border border-red-100">
                          <p className="text-xs text-red-700 flex items-start gap-1">
                            <AlertCircle className="w-3 h-3 mt-0.5" />
                            {entrega.entrega_frustrada.motivo}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {entregasKpi === 'ready' && entregas.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  <Truck className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-sm">Nenhuma entrega registrada</p>
                </div>
              )}
          </div>
        </div>
      </div>
    </>
  );

  if (windowMode) {
    return <div className="w-full h-full overflow-auto bg-white p-6">{content}</div>;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[1180px] max-h-[620px] overflow-y-auto">
        {content}
      </DialogContent>
    </Dialog>
  );
}