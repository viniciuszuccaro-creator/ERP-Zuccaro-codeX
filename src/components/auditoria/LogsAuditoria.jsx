import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, Search, Filter, Eye, Building2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import PaginationControls from "@/components/ui/PaginationControls";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";

const isCriticalAuditLog = (log = {}) => {
  const text = [log.acao, log.entidade, log.modulo, log.tipo_auditoria, log.descricao]
    .map((value) => String(value || "").toLowerCase())
    .join(" ");
  return text.includes("exclus") ||
    text.includes("perfilacesso") ||
    text.includes("configuracaoseguranca") ||
    text.includes("seguranca") ||
    text.includes("rbac") ||
    text.includes("bloqueio") ||
    text.includes("liquida") ||
    text.includes("nota fiscal");
};

/**
 * Logs de auditoria completos do sistema
 * Registra todas as ações dos usuários
 */
export default function LogsAuditoria() {
  const { contexto, empresaAtual, grupoAtual, filterInContext } = useContextoVisual();
  const { isAdmin, hasPermission } = usePermissions();
  const scopeId = empresaAtual?.id || grupoAtual?.id || 'sem-contexto';
  const contextoValido = scopeId !== 'sem-contexto';
  const canViewAudit = isAdmin() || hasPermission('Sistema', 'Auditoria', 'visualizar') || hasPermission('Sistema', 'Logs', 'visualizar');
  const [filtroModulo, setFiltroModulo] = useState("todos");
  const [filtroAcao, setFiltroAcao] = useState("todos");
  const [filtroCritico, setFiltroCritico] = useState(false);
  const [filtroUsuario, setFiltroUsuario] = useState("");
  const [periodoInicio, setPeriodoInicio] = useState("");
  const [periodoFim, setPeriodoFim] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit-logs-full', scopeId, contexto],
    queryFn: () => filterInContext('AuditLog', {}, '-created_date', 500),
    enabled: contextoValido && canViewAudit,
  });

  const { data: empresas = [] } = useQuery({
    queryKey: ['empresas-audit', scopeId, contexto],
    queryFn: () => filterInContext('Empresa', {}, 'nome_fantasia', 500),
    enabled: contextoValido,
  });

  const logsFiltrados = logs.filter(log => {
    if (filtroModulo !== "todos" && log.modulo !== filtroModulo) return false;
    if (filtroAcao !== "todos" && log.acao !== filtroAcao) return false;
    if (filtroCritico && !isCriticalAuditLog(log)) return false;
    if (filtroUsuario && !log.usuario?.toLowerCase().includes(filtroUsuario.toLowerCase())) return false;
    if (periodoInicio && log.data_hora < periodoInicio) return false;
    if (periodoFim && log.data_hora > periodoFim) return false;
    return true;
  });

  const modulos = [...new Set(logs.map(l => l.modulo))].filter(Boolean);
  const acoes = [...new Set(logs.map(l => l.acao))].filter(Boolean);
  const paginatedLogs = logsFiltrados.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const [showDescricao, setShowDescricao] = useState(true);
  const [showIP, setShowIP] = useState(true);

  const obterNomeEmpresa = (empresaId) => {
    const emp = empresas.find(e => e.id === empresaId);
    return emp?.nome_fantasia || emp?.razao_social || '-';
  };

  return (
    <div className="space-y-6 w-full h-full" data-permission="Sistema.Auditoria.visualizar">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Shield className="w-7 h-7 text-blue-600" />
          Logs de Auditoria
        </h2>
        <p className="text-slate-600">Histórico completo de ações no sistema</p>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="bg-blue-50">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-blue-700">Total de Logs</p>
            <p className="text-3xl font-bold text-blue-900">{logs.length}</p>
          </CardContent>
        </Card>

        <Card className="bg-green-50">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-green-700">Sucessos</p>
            <p className="text-3xl font-bold text-green-900">
              {logs.filter(l => l.sucesso !== false).length}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-red-50">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-red-700">Erros</p>
            <p className="text-3xl font-bold text-red-900">
              {logs.filter(l => l.sucesso === false).length}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-purple-50">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-purple-700">Usuários Ativos</p>
            <p className="text-3xl font-bold text-purple-900">
              {new Set(logs.map(l => l.usuario_id)).size}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div>
              <Label>Módulo</Label>
              <Select value={filtroModulo} onValueChange={setFiltroModulo}>
                <SelectTrigger className="mt-2" data-action="LogsAuditoria.filtroModulo" data-permission="Sistema.Auditoria.visualizar">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {modulos.map(mod => (
                    <SelectItem key={mod} value={mod}>{mod}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Ação</Label>
              <Select value={filtroAcao} onValueChange={setFiltroAcao}>
                <SelectTrigger className="mt-2" data-action="LogsAuditoria.filtroAcao" data-permission="Sistema.Auditoria.visualizar">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  {acoes.map(acao => (
                    <SelectItem key={acao} value={acao}>{acao}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Usuário</Label>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder="Buscar..."
                  value={filtroUsuario}
                  onChange={(e) => setFiltroUsuario(e.target.value)}
                  className="pl-9"
                  data-action="LogsAuditoria.filtroUsuario"
                  data-permission="Sistema.Auditoria.visualizar"
                />
              </div>
            </div>

            <div>
              <Label>Período Início</Label>
              <Input
                type="date"
                value={periodoInicio}
                onChange={(e) => setPeriodoInicio(e.target.value)}
                className="mt-2"
                data-action="LogsAuditoria.periodoInicio"
                data-permission="Sistema.Auditoria.visualizar"
              />
            </div>

            <div>
              <Label>Período Fim</Label>
              <Input
                type="date"
                value={periodoFim}
                onChange={(e) => setPeriodoFim(e.target.value)}
                className="mt-2"
                data-action="LogsAuditoria.periodoFim"
                data-permission="Sistema.Auditoria.visualizar"
              />
            </div>

            <div>
              <Label>Eventos sensiveis</Label>
              <div className="flex items-center gap-2 mt-4">
                <Checkbox
                  checked={filtroCritico}
                  onCheckedChange={setFiltroCritico}
                  data-action="LogsAuditoria.filtroCritico"
                  data-permission="Sistema.Auditoria.visualizar"
                />
                <span className="text-sm text-slate-700">Somente criticos</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Logs */}
      <Card>
        <CardHeader className="bg-slate-50 border-b">
          <div className="flex items-center justify-between">
            <CardTitle>Registro de Atividades ({logsFiltrados.length})</CardTitle>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Checkbox checked={showDescricao} onCheckedChange={setShowDescricao} data-action="LogsAuditoria.colunaDescricao" data-permission="Sistema.Auditoria.visualizar" /> Descrição
              </div>
              <div className="flex items-center gap-2">
                <Checkbox checked={showIP} onCheckedChange={setShowIP} data-action="LogsAuditoria.colunaIP" data-permission="Sistema.Auditoria.visualizar" /> IP
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <Table className="min-w-[1100px]">
              <TableHeader className="sticky top-0 bg-slate-50">
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Módulo</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Entidade</TableHead>
                  {showDescricao && <TableHead>Descrição</TableHead>}
                  <TableHead>Status</TableHead>
                  {showIP && <TableHead>IP</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedLogs.map(log => (
                  <TableRow key={log.id} className={!log.sucesso ? 'bg-red-50' : isCriticalAuditLog(log) ? 'bg-orange-50/60' : ''}>
                    <TableCell className="text-sm">
                      {new Date(log.data_hora || log.created_date).toLocaleString('pt-BR')}
                    </TableCell>
                    <TableCell className="font-medium">{log.usuario}</TableCell>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        {obterNomeEmpresa(log.empresa_id)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{log.modulo}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={
                        log.acao === 'Exclusão' ? 'bg-red-600' :
                        log.acao === 'Criação' ? 'bg-green-600' :
                        log.acao === 'Edição' ? 'bg-blue-600' :
                        'bg-slate-600'
                      }>
                        {log.acao}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{log.entidade || '-'}</TableCell>
                    {showDescricao && (
                    <TableCell className="text-sm max-w-xs truncate">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span title={log.descricao} className="inline-block max-w-xs truncate">{log.descricao}</span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-sm">{log.descricao}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                  )}
                    <TableCell>
                      {log.sucesso !== false ? (
                        <Badge className="bg-green-100 text-green-700">✓</Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-700">✗</Badge>
                      )}
                    </TableCell>
                    {showIP && (
                    <TableCell className="text-xs text-slate-500">{log.ip_address || '-'}</TableCell>
                  )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
            <div className="p-4">
              <PaginationControls
                currentPage={currentPage}
                totalItems={logsFiltrados.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={(n) => { setItemsPerPage(n); setCurrentPage(1); }}
              />
            </div>
          {logsFiltrados.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <Shield className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p>Nenhum log encontrado</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
