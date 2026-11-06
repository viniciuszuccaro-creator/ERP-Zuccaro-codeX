import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Building2, 
  MapPin, 
  Phone, 
  Mail, 
  Package,
  FileText,
  TrendingUp,
  ExternalLink,
  Edit,
  Star
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import usePermissions from "@/components/lib/usePermissions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import { readErpHttpSession } from "@/api/erpHttpSession";
import { central360SessionKey } from "@/api/httpApiClient";
import {
  resolvePainelFornecedorKpiState,
  isPainelFornecedorScopeCurrent,
  sumPainelFornecedorTotalCompras,
} from "./painelDinamicoFornecedorScope";

/**
 * V21.1.2 - WINDOW MODE READY
 * OrdemCompra via filterInContext; KPI loading/erro ≠ R$ 0.
 */
export default function PainelDinamicoFornecedor({ fornecedor, isOpen, onClose, windowMode = false }) {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const { filterInContext, empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = contexto === "empresa" ? empresaAtual?.id : null;
  const contextoValido = Boolean(groupId || empresaId);
  const painelAberto = Boolean(isOpen || windowMode);
  const fornecedorId = fornecedor?.id || null;
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

  const ordensQuery = useQuery({
    queryKey: ['ordens-compra-fornecedor', fornecedorId, groupId, empresaId, actorId, sessionKey],
    queryFn: async ({ signal }) => {
      const rows = await filterInContext('OrdemCompra', { fornecedor_id: fornecedorId }, '-data_solicitacao');
      if (signal?.aborted) {
        const err = new Error('PAINEL_FORNECEDOR_ABORTED');
        err.name = 'AbortError';
        throw err;
      }
      if (!isPainelFornecedorScopeCurrent(scopeExpected, readActorAndSession())) {
        throw new Error('PAINEL_FORNECEDOR_ORDENS_STALE_SCOPE');
      }
      return rows;
    },
    enabled: Boolean(fornecedorId) && painelAberto && contextoValido,
  });

  const ordensKpi = resolvePainelFornecedorKpiState({
    painelAberto, contextoValido, fornecedorId,
    isLoading: ordensQuery.isLoading, isError: ordensQuery.isError,
    isFetching: ordensQuery.isFetching, dataDefined: ordensQuery.data !== undefined,
  });
  const ordensCompra = ordensKpi === 'ready' && Array.isArray(ordensQuery.data) ? ordensQuery.data : [];

  const podeEditar = hasPermission('cadastros', 'editar');

  const handleEditarCadastro = () => {
    navigate(createPageUrl('Cadastros') + '?tab=fornecedores&fornecedor=' + fornecedor.id);
    onClose();
  };

  if (!fornecedor) return null;

  const totalCompras = ordensKpi === 'ready' ? sumPainelFornecedorTotalCompras(ordensCompra) : null;

  const notaMedia = fornecedor.nota_media || 0;
  const content = (
    <>
      <div className="border-b pb-4 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-cyan-100 rounded-xl flex items-center justify-center">
              <Package className="w-6 h-6 text-cyan-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">
                {fornecedor.nome}
              </h2>
                <div className="flex items-center gap-3 mt-2">
                  <Badge className={
                    fornecedor.status === 'Ativo' ? 'bg-green-100 text-green-700' :
                    'bg-gray-100 text-gray-700'
                  }>
                    {fornecedor.status}
                  </Badge>
                  {fornecedor.cnpj && (
                    <span className="text-sm text-slate-600">
                      CNPJ: {fornecedor.cnpj}
                    </span>
                  )}
                  {fornecedor.categoria && (
                    <Badge variant="outline">{fornecedor.categoria}</Badge>
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
              <Building2 className="w-4 h-4" />
              Dados Principais
            </h3>

            <div className="space-y-2">
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
                <div>
                  <p className="font-medium text-slate-900">Endereço</p>
                  {fornecedor.endereco && (
                    <p className="text-slate-600">{fornecedor.endereco}</p>
                  )}
                  {fornecedor.cidade && (
                    <p className="text-slate-600">
                      {fornecedor.cidade}{fornecedor.estado && `/${fornecedor.estado}`}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="font-medium text-slate-900 flex items-center gap-2 text-sm">
                <Phone className="w-4 h-4 text-slate-400" />
                Contatos
              </p>
              <div className="space-y-1 pl-6 text-sm">
                {fornecedor.telefone && (
                  <p className="text-slate-600">
                    <span className="font-medium">Telefone:</span> {fornecedor.telefone}
                  </p>
                )}
                {fornecedor.email && (
                  <p className="text-slate-600 flex items-center gap-2">
                    <Mail className="w-3 h-3" />
                    {fornecedor.email}
                  </p>
                )}
                {fornecedor.contato_responsavel && (
                  <p className="text-slate-600">
                    <span className="font-medium">Responsável:</span> {fornecedor.contato_responsavel}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2 pt-4 border-t">
              <p className="font-medium text-slate-900 flex items-center gap-2 text-sm">
                <Star className="w-4 h-4 text-slate-400" />
                Avaliação
              </p>
              <div className="space-y-1 pl-6 text-sm">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-4 h-4 ${
                          star <= notaMedia
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-slate-300'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="font-semibold">{notaMedia.toFixed(1)}</span>
                </div>
                {fornecedor.prazo_entrega_padrao && (
                  <p className="text-slate-600">
                    <span className="font-medium">Prazo:</span> {fornecedor.prazo_entrega_padrao} dias
                  </p>
                )}
                {fornecedor.lead_time_medio > 0 && (
                  <p className="text-slate-600">
                    <span className="font-medium">Lead Time Médio:</span> {fornecedor.lead_time_medio} dias
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2 pt-4 border-t">
              <p className="font-medium text-slate-900 flex items-center gap-2 text-sm">
                <TrendingUp className="w-4 h-4 text-slate-400" />
                Estatísticas
              </p>
              <div className="space-y-1 pl-6 text-sm">
                {ordensKpi === 'loading' && (
                  <p className="text-slate-500 animate-pulse">Carregando estatísticas…</p>
                )}
                {ordensKpi === 'error' && (
                  <p className="text-red-600">Erro ≠ R$ 0 / 0 ordens</p>
                )}
                {ordensKpi === 'unavailable' && (
                  <p className="text-amber-700">Contexto necessário</p>
                )}
                {ordensKpi === 'ready' && (
                  <>
                <p className="text-slate-600">
                  <span className="font-medium">Ordens de Compra:</span> {ordensCompra.length}
                </p>
                <p className="text-slate-600">
                  <span className="font-medium">Total Compras:</span> R$ {(totalCompras || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                  </>
                )}
                {fornecedor.quantidade_compras > 0 && (
                  <p className="text-slate-600">
                    <span className="font-medium">Histórico Total:</span> {fornecedor.quantidade_compras} compras
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Coluna 2: Histórico de Compras */}
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Histórico de Compras
            </h3>
            <div className="max-h-[440px] overflow-y-auto pr-2">
              {ordensKpi === 'loading' && (
                <p className="text-sm text-slate-500 animate-pulse py-6 text-center">Carregando ordens…</p>
              )}
              {ordensKpi === 'error' && (
                <p className="text-sm text-red-600 py-6 text-center">Erro ≠ histórico vazio</p>
              )}
              {ordensKpi === 'unavailable' && (
                <p className="text-sm text-amber-700 py-6 text-center">Contexto necessário</p>
              )}
              {ordensKpi === 'ready' && ordensCompra.length > 0 && (
                <div className="space-y-2">
                  {ordensCompra.slice(0, 10).map((ordem) => (
                    <div key={ordem.id} className="p-3 bg-slate-50 rounded-lg text-sm">
                      <div className="flex items-start justify-between mb-1">
                        <p className="font-medium text-slate-900">OC #{ordem.numero_oc}</p>
                        <Badge className={
                          ordem.status === 'Recebida' ? 'bg-green-100 text-green-700' :
                          ordem.status === 'Em Processo' ? 'bg-blue-100 text-blue-700' :
                          ordem.status === 'Cancelada' ? 'bg-red-100 text-red-700' :
                          'bg-slate-100 text-slate-700'
                        }>
                          {ordem.status}
                        </Badge>
                      </div>
                      <p className="text-slate-600 text-xs">
                        {new Date(ordem.data_solicitacao).toLocaleDateString('pt-BR')}
                      </p>
                      <p className="text-slate-900 font-semibold text-xs mt-1">
                        R$ {(ordem.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      {ordem.observacoes && (
                        <p className="text-slate-500 text-xs mt-1 line-clamp-2">
                          {ordem.observacoes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {ordensKpi === 'ready' && ordensCompra.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  <Package className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Nenhuma ordem de compra registrada</p>
                </div>
              )}
            </div>
          </div>

          {/* Coluna 3: Avaliações */}
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <Star className="w-4 h-4" />
              Avaliações Recentes
            </h3>
            <div className="max-h-[440px] overflow-y-auto pr-2">
              {fornecedor.avaliacoes && fornecedor.avaliacoes.length > 0 ? (
                <div className="space-y-3">
                  {fornecedor.avaliacoes.slice(0, 5).map((avaliacao, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 rounded-lg text-sm">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`w-3 h-3 ${
                                star <= avaliacao.nota
                                  ? 'fill-yellow-400 text-yellow-400'
                                  : 'text-slate-300'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-xs text-slate-600">
                          {new Date(avaliacao.data).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      
                      {avaliacao.criterios && (
                        <div className="grid grid-cols-2 gap-2 mb-2 text-xs">
                          <div>
                            <span className="text-slate-600">Qualidade:</span>
                            <span className="ml-1 font-medium">{avaliacao.criterios.qualidade}/5</span>
                          </div>
                          <div>
                            <span className="text-slate-600">Prazo:</span>
                            <span className="ml-1 font-medium">{avaliacao.criterios.prazo}/5</span>
                          </div>
                          <div>
                            <span className="text-slate-600">Preço:</span>
                            <span className="ml-1 font-medium">{avaliacao.criterios.preco}/5</span>
                          </div>
                          <div>
                            <span className="text-slate-600">Atendimento:</span>
                            <span className="ml-1 font-medium">{avaliacao.criterios.atendimento}/5</span>
                          </div>
                        </div>
                      )}
                      
                      {avaliacao.comentario && (
                        <p className="text-slate-600 text-xs italic">
                          "{avaliacao.comentario}"
                        </p>
                      )}
                      
                      {avaliacao.avaliador && (
                        <p className="text-slate-500 text-xs mt-2">
                          Por: {avaliacao.avaliador}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <Star className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Nenhuma avaliação registrada</p>
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