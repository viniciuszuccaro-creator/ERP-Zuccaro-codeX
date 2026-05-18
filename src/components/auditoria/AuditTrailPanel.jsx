import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import AuditDetailsDialog from "./AuditDetailsDialog";

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
  const grupoAtivoId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || (() => {
    try { return localStorage.getItem('group_atual_id'); } catch { return null; }
  })();
  const empresaAtivaId = contexto === 'grupo' ? null : empresaAtual?.id;
  const scopeKey = empresaAtivaId || grupoAtivoId || 'sem-contexto';
  const normalizeEmpresaIds = (values = []) => (Array.isArray(values) ? values : [])
    .map((item) => (typeof item === 'string' ? item : item?.empresa_id || item?.id))
    .filter(Boolean);

  const usuarioNoEscopo = (u) => {
    if (!u) return false;
    const vinculadas = normalizeEmpresaIds(u.empresas_vinculadas);
    const temMarcacaoEscopo = u.group_id || u.grupo_id || u.grupo_atual_id || u.empresa_id || u.empresa_atual_id || vinculadas.length > 0;
    if (!temMarcacaoEscopo) return true;
    if (contexto === 'grupo') {
      const empresasIds = empresasDoGrupo.map((e) => e.id);
      return u.group_id === grupoAtivoId ||
        u.grupo_id === grupoAtivoId ||
        u.grupo_atual_id === grupoAtivoId ||
        vinculadas.some((id) => empresasIds.includes(id));
    }
    return u.empresa_id === empresaAtivaId ||
      u.empresa_atual_id === empresaAtivaId ||
      vinculadas.includes(empresaAtivaId);
  };

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

  const { data: logs = [] } = useQuery({
    queryKey: ["audit-logs", filtro, limit, scopeKey, contexto],
    queryFn: async () => {
      const { group_id, empresa_id, ...criterios } = filtro;
      const rows = await filterInContext('AuditLog', criterios, "-data_hora", limit);
      return rows;
    },
    enabled: canViewAudit && scopeKey !== 'sem-contexto',
    staleTime: 3000,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['admin-users', scopeKey],
    queryFn: async () => {
      const rows = await base44.entities.User.list();
      return rows.filter(usuarioNoEscopo);
    },
    enabled: canViewAudit && isAdmin() && scopeKey !== 'sem-contexto',
    staleTime: 60000,
  });

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
            {logs.length === 0 ? (
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
