/**
 * Pacote E / D — keep both → consolidação no Form canônico (2026-10-30):
 * Capacidade de edição de contatos do Cliente. Consumidor canônico:
 * `cadastros/GerenciarContatosClienteForm.jsx` (RBAC Cadastros.Cliente + assertScope).
 * Este arquivo permanece como adaptador (clienteId → Form), sem 3º módulo e sem apagar
 * o path comercial. Mutação só com canEdit; escopo conferido no contexto visual.
 */
import React, { useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";
import usePermissions from "@/components/lib/usePermissions";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import GerenciarContatosClienteForm from "@/components/cadastros/GerenciarContatosClienteForm";

export default function GerenciarContatosCliente({ clienteId }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canEdit } = usePermissions();
  const { empresaAtual, grupoAtual } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const scopeKey = `${groupId || ""}:${empresaId || ""}`;
  const liveScopeRef = React.useRef({ groupId, empresaId });
  liveScopeRef.current = { groupId, empresaId };
  const loadedScopeRef = React.useRef({ groupId, empresaId });
  React.useEffect(() => {
    loadedScopeRef.current = { groupId, empresaId };
  }, [groupId, empresaId]);

  const { data: cliente, isLoading } = useQuery({
    queryKey: ["cliente", clienteId, scopeKey],
    queryFn: async () => {
      if (!clienteId) return null;
      if (!groupId && !empresaId) {
        throw new Error("Contexto multiempresa obrigatório para carregar contatos.");
      }
      const clientes = await base44.entities.Cliente.filter({ id: clienteId });
      const row = clientes[0] || null;
      if (!row) return null;
      const rowGroup = row.group_id || row.grupo_id || null;
      if (groupId && rowGroup && String(rowGroup) !== String(groupId)) {
        throw new Error("Cliente fora do grupo selecionado.");
      }
      return row;
    },
    enabled: Boolean(clienteId),
    retry: false,
  });

  const assertScopeCurrent = useCallback(() => {
    const live = liveScopeRef.current;
    const loaded = loadedScopeRef.current;
    if (
      String(live.groupId || "") !== String(loaded.groupId || "")
      || String(live.empresaId || "") !== String(loaded.empresaId || "")
    ) {
      throw new Error("Contexto alterado. Reabra os contatos antes de salvar.");
    }
  }, []);

  const updateClienteMutation = useMutation({
    mutationFn: async (data) => {
      if (!(canEdit("Cadastros", "Cliente") || canEdit("Cadastros", null))) {
        throw new Error("Sem permissão para editar contatos do cliente.");
      }
      assertScopeCurrent();
      return await base44.entities.Cliente.update(clienteId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cliente", clienteId] });
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      toast({ title: "Contatos atualizados" });
    },
    onError: (error) => {
      toast({
        title: "Falha ao salvar contatos",
        description: error?.message || String(error),
        variant: "destructive",
      });
    },
  });

  const handleChange = useCallback(
    async (contatosAtualizados) => {
      await updateClienteMutation.mutateAsync({ contatos: contatosAtualizados });
    },
    [updateClienteMutation],
  );

  if (!clienteId) return null;
  if (isLoading) {
    return <p className="text-sm text-slate-500 p-3">Carregando contatos…</p>;
  }

  return (
    <GerenciarContatosClienteForm
      contatos={cliente?.contatos || []}
      onChange={handleChange}
      assertScopeCurrent={assertScopeCurrent}
      persistBusy={updateClienteMutation.isPending}
    />
  );
}
