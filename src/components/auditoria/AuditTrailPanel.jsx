import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { readErpHttpSession } from "@/api/erpHttpSession";
import { central360SessionKey } from "@/api/httpApiClient";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import AuditDetailsDialog from "./AuditDetailsDialog";
import {
  resolveAuditTrailKpiState,
  isAuditTrailScopeCurrent,
  buildAuditTrailLogsQueryKey,
  buildAuditTrailUsersQueryKey,
  usuarioNoEscopoAuditTrail,
} from "./auditTrailPanelScope";

function readAuditTrailActorAndSession() {
  const session = readErpHttpSession();
  const actorId = typeof session?.actorId === "string" && session.actorId.trim()
    ? session.actorId.trim()
    : null;
  return { actorId, sessionKey: central360SessionKey(session?.token) };
}

/**
 * AuditLog/User via filterInContext; lista vazia ≠ ready em loading/erro.
 */
export default function AuditTrailPanel({ modulo = null, limit = 50, entidade = null }) {
  const { getFiltroContexto, contexto, empresaAtual, grupoAtual, empresasDoGrupo = [], filterInContext } = useContextoVisual();
  const { isAdmin, user, hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [escopo, setEscopo] = useState("meus"); // meus | todos
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [usuarioId, setUsuarioId] = useState('todos');
  const canViewAudit =
    isAdmin() ||
    hasPermission('Sistema', 'Auditoria', 'visualizar') ||
    hasPermission('Sistema', 'Logs', 'visualizar');

  const filtroBase = getFiltroContexto("empresa_id", true) || {};
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = contexto === 'grupo' ? null : (empresaAtual?.id || null);
  const contextoValido = Boolean(groupId || empresaId);
  const { actorId, sessionKey } = readAuditTrailActorAndSession();
  const scopeExpected = { actorId, sessionKey };

  const filtro = useMemo(() => {
    const f = { ...filtroBase };
    if (modulo) f.modulo = modulo;
    if (entidade) f.entidade = entidade;
    if (!isAdmin() || escopo === "meus") {
      if (user?.id) f.usuario_id = user.id;
    } else {
      if (usuarioId && usuarioId !== 'todos') f.usuario_id = usuarioId;
    }
    return f;
  }, [filtroBase, modulo, entidade, escopo, user, isAdmin, usuarioId]);

  const logsQuery = useQuery({
    queryKey: buildAuditTrailLogsQueryKey({
      groupId, empresaId, actorId, sessionKey, filtro, limit,
    }),
    queryFn: async ({ signal }) => {
      const { group_id, empresa_id, ...criterios } = filtro;
      const rows = await filterInContext('AuditLog', criterios, "-data_hora", limit);
      if (signal?.aborted) {
        const err = new Error('AUDIT_TRAIL_ABORTED');
        err.name = 'AbortError';
        throw err;
      }
      if (!isAuditTrailScopeCurrent(scopeExpected, readAuditTrailActorAndSession())) {
        throw new Error('AUDIT_TRAIL_STALE_SCOPE');
      }
      return rows;
    },
    enabled: canViewAudit && contextoValido,
    staleTime: 3000,
  });

  const usersQuery = useQuery({
    queryKey: buildAuditTrailUsersQueryKey({ groupId, empresaId, actorId, sessionKey }),
    queryFn: async ({ signal }) => {
      const rows = await filterInContext('User', {}, 'full_name', 500);
      if (signal?.aborted) {
        const err = new Error('AUDIT_TRAIL_USERS_ABORTED');
        err.name = 'AbortError';
        throw err;
      }
      if (!isAuditTrailScopeCurrent(scopeExpected, readAuditTrailActorAndSession())) {
        throw new Error('AUDIT_TRAIL_STALE_SCOPE');
      }
      return (Array.isArray(rows) ? rows : []).filter((u) => usuarioNoEscopoAuditTrail(u, {
        contexto,
        grupoAtivoId: groupId,
        empresaAtivaId: empresaId,
        empresasDoGrupo,
      }));
    },
    enabled: canViewAudit && isAdmin() && contextoValido,
    staleTime: 60000,
  });

  const kpiState = resolveAuditTrailKpiState({
    canView: canViewAudit,
    contextoValido,
    isLoading: logsQuery.isLoading,
    isError: logsQuery.isError,
    isFetching: logsQuery.isFetching,
    dataDefined: logsQuery.data !== undefined,
  });
  const logs = kpiState === 'ready' && Array.isArray(logsQuery.data) ? logsQuery.data : [];
  const users = Array.isArray(usersQuery.data) ? usersQuery.data : [];
  const listaIndisponivel = kpiState !== 'ready';

  useEffect(() => {
    const unsubscribe = base44.entities.AuditLog.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
    });
    return unsubscribe;
  }, [queryClient]);

  return (
    <div className="w-full h-full p-3" data-permission="Sistema.Auditoria.visualizar">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 text-slate-600 text-sm">
          <Clock className="w-4 h-4" />
          <span>Eventos recentes</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={escopo} onValueChange={setEscopo} disabled={!isAdmin()}>
            <SelectTrigger className="w-40" data-action="AuditTrail.filtroEscopo" data-permission="Sistema.Auditoria.visualizar">
              <SelectValue placeholder="Escopo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="meus">Meus eventos</SelectItem>
              <SelectItem value="todos">Todos (admin)</SelectItem>
            </SelectContent>
          </Select>

          {isAdmin() && escopo === 'todos' && (
            <Select value={usuarioId} onValueChange={setUsuarioId}>
              <SelectTrigger className="w-56" data-action="AuditTrail.filtroUsuario" data-permission="Sistema.Auditoria.visualizar">
                <SelectValue placeholder="Usuário" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os usuários</SelectItem>
                {users?.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <div className="w-full overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>Quando</TableHead>
              <TableHead>Módulo</TableHead>
              <TableHead>Entidade</TableHead>
              <TableHead>Ação</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>Detalhes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listaIndisponivel ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-slate-500 py-6">
                  {kpiState === 'loading' ? 'Carregando eventos…' : kpiState === 'error' ? 'Erro ao carregar eventos.' : 'Contexto indisponível.'}
                </TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-slate-500 py-6">
                  Nenhum evento encontrado.
                </TableCell>
              </TableRow>
            ) : (
              logs.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="whitespace-nowrap">{new Date(l.data_hora || l.created_date).toLocaleString("pt-BR")}</TableCell>
                  <TableCell><Badge variant="outline">{l.modulo}</Badge></TableCell>
                  <TableCell>{l.entidade || l.entity_name}</TableCell>
                  <TableCell>{l.acao || l.action}</TableCell>
                  <TableCell className="max-w-[600px] truncate" title={l.descricao}>{l.descricao}</TableCell>
                  <TableCell className="whitespace-nowrap">{l.usuario}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {isAdmin() ? (
                      <Button variant="outline" size="sm" onClick={() => { setSelected(l); setOpen(true); }} data-action="AuditTrail.verDetalhes" data-permission="Sistema.Auditoria.visualizar">
                        Ver {l?.dados_novos?.__sensitive ? <span className="ml-2 inline-flex items-center text-red-600">• sensível</span> : null}
                      </Button>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AuditDetailsDialog open={open} onOpenChange={setOpen} selected={selected} isAdmin={isAdmin()} />
    </div>
  );
}
