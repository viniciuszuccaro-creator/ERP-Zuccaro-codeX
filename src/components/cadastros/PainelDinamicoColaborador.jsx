import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  UserCircle, 
  Briefcase, 
  DollarSign,
  Calendar,
  FileText,
  TrendingUp,
  ExternalLink,
  Edit,
  Clock,
  Award
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import usePermissions from "@/components/lib/usePermissions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/**
 * V21.1.2 - WINDOW MODE READY
 */
export default function PainelDinamicoColaborador({ colaborador, isOpen, onClose, windowMode = false }) {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();

  const { data: pontos = [] } = useQuery({
    queryKey: ['pontos-colaborador', colaborador?.id],
    queryFn: () => base44.entities.Ponto.filter({ colaborador_id: colaborador.id }, '-data'),
    enabled: !!colaborador?.id,
  });

  const { data: ferias = [] } = useQuery({
    queryKey: ['ferias-colaborador', colaborador?.id],
    queryFn: () => base44.entities.Ferias.filter({ colaborador_id: colaborador.id }, '-data_solicitacao'),
    enabled: !!colaborador?.id,
  });

  const { data: ordensProducao = [] } = useQuery({
    queryKey: ['ops-colaborador', colaborador?.id],
    queryFn: () => base44.entities.OrdemProducao.filter({ operador_responsavel_id: colaborador.id }, '-data_emissao'),
    enabled: !!colaborador?.id,
  });

  const podeEditar = hasPermission('cadastros', 'editar');
  const podeVerSalario = hasPermission('rh', 'ver_salarios');

  const handleEditarCadastro = () => {
    navigate(createPageUrl('Cadastros') + '?tab=colaboradores&colaborador=' + colaborador.id);
    onClose();
  };

  if (!colaborador) return null;

  const diasSemFerias = colaborador.dias_ferias_vencimento 
    ? Math.floor((new Date(colaborador.dias_ferias_vencimento) - new Date()) / (1000 * 60 * 60 * 24))
    : 0;

  const content = (
    <>
      <div className="border-b pb-4 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-sky-100 rounded-xl flex items-center justify-center">
              <UserCircle className="w-6 h-6 text-sky-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">
                {colaborador.nome_completo}
              </h2>
                <div className="flex items-center gap-3 mt-2">
                  <Badge className={
                    colaborador.status === 'Ativo' ? 'bg-green-100 text-green-700' :
                    colaborador.status === 'Férias' ? 'bg-blue-100 text-blue-700' :
                    colaborador.status === 'Afastado' ? 'bg-orange-100 text-orange-700' :
                    'bg-gray-100 text-gray-700'
                  }>
                    {colaborador.status}
                  </Badge>
                  <span className="text-sm text-slate-600">
                    {colaborador.cargo}
                  </span>
                  {colaborador.departamento && (
                    <Badge variant="outline">{colaborador.departamento}</Badge>
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
              <Briefcase className="w-4 h-4" />
              Dados do Colaborador
            </h3>

            <div className="space-y-2 text-sm">
              <div>
                <p className="text-slate-600">CPF</p>
                <p className="font-medium text-slate-900">{colaborador.cpf || '-'}</p>
              </div>

              {colaborador.email && (
                <div>
                  <p className="text-slate-600">E-mail</p>
                  <p className="font-medium text-slate-900">{colaborador.email}</p>
                </div>
              )}

              {colaborador.telefone && (
                <div>
                  <p className="text-slate-600">Telefone</p>
                  <p className="font-medium text-slate-900">{colaborador.telefone}</p>
                </div>
              )}

              {colaborador.data_admissao && (
                <div>
                  <p className="text-slate-600">Data de Admissão</p>
                  <p className="font-medium text-slate-900">
                    {new Date(colaborador.data_admissao).toLocaleDateString('pt-BR')}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {Math.floor((new Date() - new Date(colaborador.data_admissao)) / (1000 * 60 * 60 * 24 * 365))} anos de casa
                  </p>
                </div>
              )}

              {colaborador.tipo_contrato && (
                <div>
                  <p className="text-slate-600">Tipo de Contrato</p>
                  <Badge variant="outline">{colaborador.tipo_contrato}</Badge>
                </div>
              )}
            </div>

            {podeVerSalario && colaborador.salario && (
              <div className="pt-4 border-t">
                <p className="text-slate-600 text-sm">Salário Atual</p>
                <p className="text-2xl font-bold text-green-600">
                  R$ {colaborador.salario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            )}

            {!podeVerSalario && (
              <div className="pt-4 border-t">
                <Badge variant="outline" className="text-xs">
                  <DollarSign className="w-3 h-3 mr-1" />
                  Salário Protegido
                </Badge>
              </div>
            )}

            <div className="pt-4 border-t">
              <p className="font-medium text-slate-900 flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-slate-400" />
                Férias
              </p>
              <div className="space-y-1 pl-6 text-sm mt-2">
                <p className="text-slate-600">
                  <span className="font-medium">Disponível:</span> {colaborador.dias_ferias_disponiveis || 0} dias
                </p>
                {diasSemFerias > 0 && (
                  <p className={`text-xs ${diasSemFerias < 30 ? 'text-orange-600 font-semibold' : 'text-slate-500'}`}>
                    Vence em {diasSemFerias} dias
                  </p>
                )}
              </div>
            </div>

            {colaborador.centro_custo_nome && (
              <div className="pt-4 border-t">
                <p className="text-slate-600 text-sm">Centro de Custo</p>
                <Badge variant="outline" className="mt-1">{colaborador.centro_custo_nome}</Badge>
              </div>
            )}
            </div>

            {/* Coluna 2: Histórico Profissional */}
            <div className="space-y-4">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Histórico Profissional
            </h3>

            <Tabs defaultValue="ops" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="ops">Produção</TabsTrigger>
                <TabsTrigger value="cargos">Cargos</TabsTrigger>
              </TabsList>

              <TabsContent value="ops" className="max-h-[380px] overflow-y-auto">
                {ordensProducao.length > 0 ? (
                  <div className="space-y-2">
                    {ordensProducao.slice(0, 10).map((op) => (
                      <div key={op.id} className="p-3 bg-slate-50 rounded-lg text-sm">
                        <div className="flex items-start justify-between mb-1">
                          <p className="font-medium text-slate-900">OP #{op.numero_op}</p>
                          <Badge className={
                            op.status === 'Finalizada' ? 'bg-green-100 text-green-700' :
                            op.status === 'Em Andamento' ? 'bg-blue-100 text-blue-700' :
                            'bg-slate-100 text-slate-700'
                          }>
                            {op.status}
                          </Badge>
                        </div>
                        <p className="text-slate-600 text-xs">
                          Cliente: {op.cliente_nome}
                        </p>
                        <p className="text-slate-600 text-xs">
                          {new Date(op.data_emissao).toLocaleDateString('pt-BR')}
                        </p>
                        {op.peso_teorico_total_kg && (
                          <p className="text-slate-900 font-semibold text-xs mt-1">
                            {op.peso_teorico_total_kg.toFixed(2)} kg
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <Briefcase className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Nenhuma OP registrada</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="cargos" className="max-h-[380px] overflow-y-auto">
                {colaborador.historico_cargos && colaborador.historico_cargos.length > 0 ? (
                  <div className="space-y-3">
                    {colaborador.historico_cargos.map((hist, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 rounded-lg text-sm">
                        <div className="flex items-center gap-2 mb-2">
                          <Award className="w-4 h-4 text-sky-600" />
                          <p className="font-semibold text-slate-900">{hist.cargo_novo}</p>
                        </div>
                        {hist.cargo_anterior && (
                          <p className="text-slate-600 text-xs">
                            Anterior: {hist.cargo_anterior}
                          </p>
                        )}
                        <p className="text-slate-500 text-xs mt-1">
                          {new Date(hist.data).toLocaleDateString('pt-BR')}
                        </p>
                        {hist.motivo && (
                          <p className="text-slate-600 text-xs mt-2 italic">
                            {hist.motivo}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <Award className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Nenhuma mudança de cargo</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>

        {/* Coluna 3: Ponto e Férias */}
        <div className="space-y-4">
            <Tabs defaultValue="ponto" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="ponto">Ponto</TabsTrigger>
                <TabsTrigger value="ferias">Férias</TabsTrigger>
              </TabsList>

              <TabsContent value="ponto" className="max-h-[440px] overflow-y-auto">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-4">
                  <Clock className="w-4 h-4" />
                  Registros de Ponto
                </h3>

                {pontos.length > 0 ? (
                  <div className="space-y-2">
                    {pontos.slice(0, 15).map((ponto) => (
                      <div key={ponto.id} className="p-2 bg-slate-50 rounded-lg text-xs">
                        <div className="flex justify-between items-start mb-1">
                          <p className="font-medium text-slate-900">
                            {new Date(ponto.data).toLocaleDateString('pt-BR')}
                          </p>
                          <Badge className={
                            ponto.status === 'Aprovado' ? 'bg-green-100 text-green-700 text-xs' :
                            ponto.status === 'Pendente' ? 'bg-yellow-100 text-yellow-700 text-xs' :
                            'bg-red-100 text-red-700 text-xs'
                          }>
                            {ponto.status}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-1 text-xs text-slate-600">
                          <span>Entrada: {ponto.entrada_manha || '-'}</span>
                          <span>Almoço: {ponto.saida_almoco || '-'}</span>
                          <span>Retorno: {ponto.retorno_almoco || '-'}</span>
                          <span>Saída: {ponto.saida_tarde || '-'}</span>
                        </div>
                        {ponto.horas_trabalhadas && (
                          <p className="text-xs text-slate-900 font-semibold mt-1">
                            {ponto.horas_trabalhadas}h trabalhadas
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <Clock className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Nenhum ponto registrado</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="ferias" className="max-h-[440px] overflow-y-auto">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-4">
                  <Calendar className="w-4 h-4" />
                  Histórico de Férias
                </h3>

                {ferias.length > 0 ? (
                  <div className="space-y-3">
                    {ferias.slice(0, 10).map((feria) => (
                      <div key={feria.id} className="p-3 bg-slate-50 rounded-lg text-sm">
                        <div className="flex justify-between items-start mb-2">
                          <p className="font-medium text-slate-900">{feria.tipo}</p>
                          <Badge className={
                            feria.status === 'Aprovado' ? 'bg-green-100 text-green-700' :
                            feria.status === 'Solicitado' ? 'bg-yellow-100 text-yellow-700' :
                            feria.status === 'Concluído' ? 'bg-blue-100 text-blue-700' :
                            'bg-red-100 text-red-700'
                          }>
                            {feria.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-600">
                          {new Date(feria.data_inicio).toLocaleDateString('pt-BR')} até {new Date(feria.data_fim).toLocaleDateString('pt-BR')}
                        </p>
                        <p className="text-xs text-slate-900 font-semibold mt-1">
                          {feria.dias_solicitados} dias
                        </p>
                        {feria.observacoes && (
                          <p className="text-xs text-slate-600 mt-2 italic">
                            {feria.observacoes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <Calendar className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Nenhum período de férias</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
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
