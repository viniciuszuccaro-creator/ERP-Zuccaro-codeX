import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Building2,
  CheckCircle2,
  AlertCircle,
  ArrowDownCircle,
  ArrowUpCircle,
  Link2,
  X,
  FileText,
  Sparkles,
  Upload
} from "lucide-react";
import { useUser } from "@/components/lib/UserContext";
import { toast } from "sonner";
import ConciliacaoAutomaticaIA from "./ConciliacaoAutomaticaIA";
import HeaderConciliacaoCompacto from "./conciliacao/HeaderConciliacaoCompacto";
import KPIsConciliacao from "./conciliacao/KPIsConciliacao";
import useContextoVisual from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import ExtratoBancarioImportDialog from "./ExtratoBancarioImportDialog";

export default function ConciliacaoBancaria({ windowMode = false }) {
  const { user } = useUser();
  const { empresaAtual, grupoAtual } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const [sourceOpen, setSourceOpen] = useState(false);
  const [filtros, setFiltros] = useState({
    banco_id: "",
    data_inicio: "",
    data_fim: ""
  });
  const [empresaSelecionada, setEmpresaSelecionada] = useState("");
  const [tabAtiva, setTabAtiva] = useState("pendentes");
  const [lancamentoSelecionado, setLancamentoSelecionado] = useState(null);
  const [movimentoParaConciliar, setMovimentoParaConciliar] = useState(null);

  const { data: empresas = [] } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => base44.entities.Empresa.list(),
  });

  const { data: extratos = [] } = useQuery({
    queryKey: ['extratos-bancarios', empresaSelecionada],
    queryFn: () => empresaSelecionada 
      ? base44.entities.ExtratoBancario.filter({ empresa_id: empresaSelecionada })
      : base44.entities.ExtratoBancario.list('-data_movimento'),
  });

  const { data: conciliacoes = [] } = useQuery({
    queryKey: ['conciliacoes-bancarias', empresaSelecionada],
    queryFn: () => empresaSelecionada
      ? base44.entities.ConciliacaoBancaria.filter({ empresa_id: empresaSelecionada })
      : base44.entities.ConciliacaoBancaria.list('-created_date'),
  });

  const { data: movimentos = [] } = useQuery({
    queryKey: ['caixa-movimentos', empresaSelecionada],
    queryFn: () => empresaSelecionada
      ? base44.entities.CaixaMovimento.filter({ empresa_id: empresaSelecionada })
      : base44.entities.CaixaMovimento.list('-data_movimento'),
  });

  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id;
  const sourceScope = typeof groupId === 'string' && typeof empresaAtual?.id === 'string' && typeof user?.id === 'string'
    && (!empresaSelecionada || empresaSelecionada === empresaAtual.id)
    ? {groupId, empresaId:empresaAtual.id, actorId:user.id} : null;
  const canReadSource = hasPermission('Financeiro','ContaBancariaEmpresa','visualizar')
    && hasPermission('Financeiro','ContaBancariaEmpresa','dados-sensiveis.visualizar')
    && hasPermission('Financeiro','conciliacao','visualizar')
    && hasPermission('Financeiro','conciliacao','dados-sensiveis.visualizar');
  const canReadMovements = canReadSource && hasPermission('Financeiro','Caixa','visualizar')
    && hasPermission('Financeiro','Caixa','dados-sensiveis.visualizar');

  const extratosPendentes = extratos.filter(e => !e.conciliado);
  const extratosConciliados = extratos.filter(e => e.conciliado);
  const extratosComDivergencia = conciliacoes.filter(c => c.tem_divergencia && c.status !== 'resolvido');

  const content = (
    <div className="space-y-1.5">
      <HeaderConciliacaoCompacto />
      {sourceOpen && sourceScope && canReadSource && <ExtratoBancarioImportDialog
        key={`${sourceScope.actorId}:${sourceScope.groupId}:${sourceScope.empresaId}`}
        scope={sourceScope} canImport={hasPermission('Financeiro','conciliacao','importar')}
        canReadMovements={canReadMovements}
        canReconcile={canReadMovements && hasPermission('Financeiro','conciliacao','conciliar')}
        canReverseLink={canReadMovements && hasPermission('Financeiro','conciliacao','estornar')}
        canAnalyze={canReadMovements && hasPermission('IA','financeiro_conciliacao','visualizar')}
        onClose={()=>setSourceOpen(false)} />}
      <KPIsConciliacao 
        extratosPendentes={extratosPendentes.length}
        extratosConciliados={extratosConciliados.length}
        divergencias={extratosComDivergencia.length}
      />

      <Card className="border-0 shadow-sm min-h-[80px] max-h-[80px]">
        <CardContent className="p-3">
          <div className="flex gap-3">
            <div className="flex-1">
              <Label className="text-xs">Empresa</Label>
              <Select value={empresaSelecionada} onValueChange={setEmpresaSelecionada}>
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Todas</SelectItem>
                  {empresas.map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.nome_fantasia || emp.razao_social}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">&nbsp;</Label>
              <Button variant="outline" size="sm" className="h-8" onClick={()=>setSourceOpen(true)} disabled={!sourceScope || !canReadSource}>
                <Upload className="w-3 h-3 mr-1" /> Importar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={tabAtiva} onValueChange={setTabAtiva} className="flex-1 flex flex-col min-h-0">
        <TabsList className="grid grid-cols-4 w-full bg-white border shadow-sm">
          <TabsTrigger value="pendentes" className="text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            Pendentes ({extratosPendentes.length})
          </TabsTrigger>
          <TabsTrigger value="conciliados" className="text-xs data-[state=active]:bg-green-600 data-[state=active]:text-white">
            Conciliados ({extratosConciliados.length})
          </TabsTrigger>
          <TabsTrigger value="divergencias" className="text-xs data-[state=active]:bg-orange-600 data-[state=active]:text-white">
            Divergências ({extratosComDivergencia.length})
          </TabsTrigger>
          <TabsTrigger value="ia" className="text-xs data-[state=active]:bg-purple-600 data-[state=active]:text-white">
            <Sparkles className="w-3 h-3 mr-1" />
            IA
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pendentes" className="mt-2 flex-1">
          <Card className="border-0 shadow-sm h-full flex flex-col">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {extratosPendentes.map(extrato => (
                    <TableRow key={extrato.id}>
                      <TableCell className="text-sm">
                        {new Date(extrato.data_movimento || Date.now()).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell className="font-medium">{extrato.descricao || 'Sem descrição'}</TableCell>
                      <TableCell className={extrato.tipo === 'entrada' ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                        {extrato.tipo === 'entrada' ? '+' : '-'} R$ {Math.abs(extrato.valor || 0).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{extrato.tipo || 'N/A'}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={()=>setSourceOpen(true)}
                          disabled={!sourceScope || !canReadMovements || !hasPermission('Financeiro','conciliacao','conciliar')}>
                          <CheckCircle2 className="w-4 h-4 mr-1" />
                          Conciliar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {extratosPendentes.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                        <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-green-500" />
                        <p>Nenhum extrato pendente</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conciliados" className="mt-2 flex-1">
          <Card className="border-0 shadow-sm h-full flex flex-col">
            <CardContent className="p-0 flex-1 overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-slate-50 z-10">
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {extratosConciliados.map(extrato => (
                    <TableRow key={extrato.id}>
                      <TableCell className="text-sm">
                        {new Date(extrato.data_movimento || Date.now()).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell className="font-medium">{extrato.descricao || 'Sem descrição'}</TableCell>
                      <TableCell className="font-semibold">
                        R$ {Math.abs(extrato.valor || 0).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-green-100 text-green-700">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Conciliado
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {extratosConciliados.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                        Nenhum extrato conciliado ainda
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="divergencias" className="mt-2 flex-1">
          <Card className="border-0 shadow-sm h-full flex flex-col">
            <CardContent className="p-0 flex-1 overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-slate-50 z-10">
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Diferença</TableHead>
                    <TableHead>Tipo Divergência</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {extratosComDivergencia.map(conc => (
                    <TableRow key={conc.id}>
                      <TableCell className="text-sm">
                        {new Date(conc.data_conciliacao || Date.now()).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell className="font-medium">{conc.descricao || 'N/A'}</TableCell>
                      <TableCell className="text-red-600 font-bold">
                        R$ {Math.abs(conc.valor_diferenca || 0).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-orange-100 text-orange-700">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          {conc.tipo_divergencia || 'Não identificado'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline">
                          Resolver
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {extratosComDivergencia.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                        <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-green-500" />
                        <p>Nenhuma divergência encontrada</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ia" className="mt-2 flex-1 overflow-auto">
          <ConciliacaoAutomaticaIA empresaId={empresaSelecionada} />
        </TabsContent>
      </Tabs>

      {/* Modal de Conciliação Manual */}
      {movimentoParaConciliar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-3xl">
            <CardHeader className="bg-blue-50">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="w-5 h-5 text-blue-600" />
                  Conciliação Manual
                </CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setMovimentoParaConciliar(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-600 mb-2">Movimento ERP:</p>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">{movimentoParaConciliar.cliente_nome}</p>
                    <p className="text-xs text-slate-500">
                      {movimentoParaConciliar.origem_pagamento} • {movimentoParaConciliar.forma_pagamento}
                    </p>
                  </div>
                  <p className="text-xl font-bold text-green-600">
                    R$ {movimentoParaConciliar.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium text-slate-700">Informar Dados do Extrato Bancário:</p>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Input type="date" placeholder="Data do Crédito" />
                  </div>
                  <div>
                    <Input type="number" step="0.01" placeholder="Valor no Extrato" />
                  </div>
                </div>

                <Input placeholder="Descrição no Extrato (opcional)" />
              </div>

              <div className="flex gap-3">
                <Button 
                  onClick={() => setMovimentoParaConciliar(null)}
                  variant="outline"
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={() => {
                    setMovimentoParaConciliar(null);
                    setSourceOpen(true);
                  }}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  disabled={!sourceScope || !canReadMovements || !hasPermission('Financeiro','conciliacao','conciliar')}
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Confirmar Conciliação
                </Button>
              </div>

              <div className="p-3 bg-blue-50 rounded text-sm text-blue-700">
                💡 Em produção, o sistema fará pareamento automático por valor, data e ID de transação
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );

  if (windowMode) {
    return <div className="w-full h-full flex flex-col bg-gradient-to-br from-slate-50 to-teal-50 overflow-auto p-1.5">{content}</div>;
  }

  return content;
}
