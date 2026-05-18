import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileEdit, FilePlus, Trash2, Clock, User, Calendar } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";

/**
 * GLOBAL AUDIT LOG V21.0
 * Rastreia TODAS as alterações no sistema
 * Regra-Mãe: Transparência Total + Rastreabilidade Completa
 */
export default function GlobalAuditLog({ limite = 20, mostrarFiltros = true }) {
  const { contexto, empresaAtual, grupoAtual, filterInContext } = useContextoVisual();
  const { isAdmin, hasPermission } = usePermissions();
  const scopeId = empresaAtual?.id || grupoAtual?.id || 'sem-contexto';
  const contextoValido = scopeId !== 'sem-contexto';
  const canViewAudit = isAdmin() || hasPermission('Sistema', 'Auditoria', 'visualizar') || hasPermission('Sistema', 'Logs', 'visualizar');
  const [filtroEntidade, setFiltroEntidade] = useState('todas');
  const [filtroAcao, setFiltroAcao] = useState('todas');

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit-logs-global', limite, scopeId, contexto],
    queryFn: () => filterInContext('AuditLog', {}, '-created_date', limite),
    enabled: contextoValido && canViewAudit,
  });

  const normalizarAcao = (acao) => {
    const valor = String(acao || '').toLowerCase();
    if (['criacao', 'criação', 'create', 'convite', 'seed'].some((v) => valor.includes(v))) return 'create';
    if (['exclusao', 'exclusão', 'delete', 'remocao', 'remoção'].some((v) => valor.includes(v))) return 'delete';
    return 'update';
  };

  const logsProcessados = logs.map(log => {
    let descricao = log.descricao || '';
    let entidade = log.entidade || log.entity_name || 'Desconhecido';
    let acaoOriginal = log.acao || log.action || 'update';
    let acao = normalizarAcao(acaoOriginal);
    let usuario = log.usuario || log.created_by || 'Sistema';
    let data = log.data_hora || log.created_date;

    // Tentar extrair informações dos campos
    if (log.changes) {
      try {
        const changes = typeof log.changes === 'string' ? JSON.parse(log.changes) : log.changes;
        const campos = Object.keys(changes).join(', ');
        descricao = `Campos alterados: ${campos}`;
      } catch (e) {}
    }

    return {
      ...log,
      descricao,
      entidade,
      acao,
      acaoOriginal,
      usuario,
      data
    };
  });

  const logsFiltrados = logsProcessados.filter(log => {
    const entidadeMatch = filtroEntidade === 'todas' || log.entidade === filtroEntidade;
    const acaoMatch = filtroAcao === 'todas' || log.acao === filtroAcao;
    return entidadeMatch && acaoMatch;
  });

  const getIconeAcao = (acao) => {
    switch(acao) {
      case 'create': return <FilePlus className="w-4 h-4 text-green-600" />;
      case 'update': return <FileEdit className="w-4 h-4 text-blue-600" />;
      case 'delete': return <Trash2 className="w-4 h-4 text-red-600" />;
      default: return <FileEdit className="w-4 h-4 text-slate-600" />;
    }
  };

  const getCorAcao = (acao) => {
    switch(acao) {
      case 'create': return 'bg-green-100 text-green-700 border-green-300';
      case 'update': return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'delete': return 'bg-red-100 text-red-700 border-red-300';
      default: return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  return (
    <Card className="border-2 border-slate-300 w-full h-full" data-permission="Sistema.Auditoria.visualizar">
      <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-5 h-5 text-slate-600" />
            Global Audit Log - Últimas {limite} Alterações
          </CardTitle>
          {mostrarFiltros && (
            <div className="flex gap-2 flex-wrap">
              <Select value={filtroEntidade} onValueChange={setFiltroEntidade}>
                <SelectTrigger className="w-32 h-8" data-action="GlobalAuditLog.filtroEntidade" data-permission="Sistema.Auditoria.visualizar">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  <SelectItem value="Cliente">Clientes</SelectItem>
                  <SelectItem value="Produto">Produtos</SelectItem>
                  <SelectItem value="Pedido">Pedidos</SelectItem>
                  <SelectItem value="TabelaPreco">Tabelas</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filtroAcao} onValueChange={setFiltroAcao}>
                <SelectTrigger className="w-32 h-8" data-action="GlobalAuditLog.filtroAcao" data-permission="Sistema.Auditoria.visualizar">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas Ações</SelectItem>
                  <SelectItem value="create">Criações</SelectItem>
                  <SelectItem value="update">Edições</SelectItem>
                  <SelectItem value="delete">Exclusões</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px]">
          <div className="p-4 space-y-3">
            {isLoading ? (
              <p className="text-center text-slate-500 py-8">Carregando logs...</p>
            ) : logsFiltrados.length === 0 ? (
              <p className="text-center text-slate-500 py-8">Nenhum log encontrado</p>
            ) : (
              logsFiltrados.map((log, idx) => (
                <div key={log.id || idx} className="flex items-start gap-3 p-3 border rounded hover:bg-slate-50 transition-colors">
                  <div className="mt-1">
                    {getIconeAcao(log.acao)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={getCorAcao(log.acao)}>
                        {log.acao === 'create' ? 'Criação' : log.acao === 'update' ? 'Edição' : 'Exclusão'}
                      </Badge>
                      {log.acaoOriginal && log.acaoOriginal !== log.acao && (
                        <Badge variant="outline" className="text-xs">{log.acaoOriginal}</Badge>
                      )}
                      <Badge variant="outline" className="text-xs">{log.entidade}</Badge>
                    </div>
                    <p className="text-sm text-slate-700">{log.descricao}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {log.usuario}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {log.data ? new Date(log.data).toLocaleString('pt-BR') : 'Data não disponível'}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
