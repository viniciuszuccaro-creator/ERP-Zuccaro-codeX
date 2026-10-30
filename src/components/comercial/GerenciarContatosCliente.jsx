/**
 * Pacote E / D — keep both → consolidação no Form canônico (2026-10-30):
 * Capacidade de edição de contatos do Cliente. Consumidor canônico:
 * `cadastros/GerenciarContatosClienteForm.jsx` (RBAC Cadastros.Cliente + assertScope).
 * Este arquivo permanece como adaptador (clienteId → Form), sem 3º módulo e sem apagar
 * o path comercial. Mutação só com canEdit; escopo vinculado imutavelmente ao load.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";
import usePermissions from "@/components/lib/usePermissions";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import GerenciarContatosClienteForm from "@/components/cadastros/GerenciarContatosClienteForm";

function scopePair(groupId, empresaId) {
  return {
    groupId: groupId || null,
    empresaId: empresaId || null,
    key: `${groupId || ""}:${empresaId || ""}`,
  };
}

function sameScope(a, b) {
  return String(a?.groupId || "") === String(b?.groupId || "")
    && String(a?.empresaId || "") === String(b?.empresaId || "");
}

export default function GerenciarContatosCliente({ clienteId }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canEdit } = usePermissions();
  const { empresaAtual, grupoAtual } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const liveScope = scopePair(groupId, empresaId);
  const liveScopeRef = useRef(liveScope);
  liveScopeRef.current = liveScope;

  /** Geração do editor: troca de contexto/cliente invalida callbacks antigos. */
  const [editorGen, setEditorGen] = useState(0);
  /** Binding imutável ao load bem-sucedido (cliente + escopo + geração). */
  const [bound, setBound] = useState(null);
  const editorGenRef = useRef(0);

  useEffect(() => {
    editorGenRef.current += 1;
    setEditorGen(editorGenRef.current);
    setBound(null);
  }, [liveScope.key, clienteId]);

  const {
    data: loaded,
    isLoading,
    isError,
    error,
    isFetching,
    isSuccess,
  } = useQuery({
    queryKey: ["cliente", clienteId, liveScope.key],
    queryFn: async () => {
      if (!clienteId) return null;
      const asked = scopePair(groupId, empresaId);
      const genAtStart = editorGenRef.current;
      if (!asked.groupId && !asked.empresaId) {
        throw new Error("Contexto multiempresa obrigatório para carregar contatos.");
      }
      const clientes = await base44.entities.Cliente.filter({ id: clienteId });
      // Resposta tardia: escopo ou geração já mudou — não promover a bind.
      if (!sameScope(asked, liveScopeRef.current) || genAtStart !== editorGenRef.current) {
        const err = new Error("READ_STALE_SCOPE");
        err.code = "READ_STALE_SCOPE";
        throw err;
      }
      const row = clientes[0] || null;
      if (!row) return null;
      const rowGroup = row.group_id || row.grupo_id || null;
      if (asked.groupId && rowGroup && String(rowGroup) !== String(asked.groupId)) {
        throw new Error("Cliente fora do grupo selecionado.");
      }
      return { row, askedScope: asked, gen: genAtStart };
    },
    enabled: Boolean(clienteId),
    retry: false,
  });

  useEffect(() => {
    if (!isSuccess || !loaded?.row || !loaded?.askedScope) return;
    if (loaded.gen !== editorGenRef.current) return;
    if (!sameScope(loaded.askedScope, liveScopeRef.current)) return;
    setBound({
      clienteId,
      scope: loaded.askedScope,
      gen: loaded.gen,
      rowId: loaded.row.id,
      contatos: Array.isArray(loaded.row.contatos) ? loaded.row.contatos : [],
    });
  }, [isSuccess, loaded, clienteId]);

  const assertScopeCurrent = useCallback(() => {
    const live = liveScopeRef.current;
    if (!bound || bound.clienteId !== clienteId) {
      throw new Error("Contatos ainda não vinculados ao cliente carregado. Reabra antes de salvar.");
    }
    if (bound.gen !== editorGenRef.current || bound.gen !== editorGen) {
      throw new Error("Contexto alterado. Reabra os contatos antes de salvar.");
    }
    if (!sameScope(live, bound.scope)) {
      throw new Error("Contexto alterado. Reabra os contatos antes de salvar.");
    }
  }, [bound, clienteId, editorGen]);

  const updateClienteMutation = useMutation({
    mutationFn: async (data) => {
      if (!(canEdit("Cadastros", "Cliente") || canEdit("Cadastros", null))) {
        throw new Error("Sem permissão para editar contatos do cliente.");
      }
      assertScopeCurrent();
      if (!bound?.rowId || String(bound.rowId) !== String(clienteId)) {
        throw new Error("Cliente vinculado inválido para salvar contatos.");
      }
      return await base44.entities.Cliente.update(bound.rowId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cliente", clienteId] });
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      toast({ title: "Contatos atualizados" });
    },
    onError: (err) => {
      toast({
        title: "Falha ao salvar contatos",
        description: err?.message || String(err),
        variant: "destructive",
      });
    },
  });

  const handleChange = useCallback(
    async (contatosAtualizados) => {
      assertScopeCurrent();
      await updateClienteMutation.mutateAsync({ contatos: contatosAtualizados });
    },
    [assertScopeCurrent, updateClienteMutation],
  );

  if (!clienteId) return null;
  if (isLoading || (isFetching && !loaded && !isError)) {
    return <p className="text-sm text-slate-500 p-3">Carregando contatos…</p>;
  }
  // Erro de leitura ≠ formulário vazio editável (evita sobrescrita com []).
  if (isError) {
    return (
      <p className="text-sm text-red-600 p-3" data-contatos-read-error="true" role="alert">
        {error?.message && error.message !== "READ_STALE_SCOPE"
          ? error.message
          : "Falha ao carregar contatos. Reabra o cliente no contexto atual."}
      </p>
    );
  }
  if (!bound || bound.gen !== editorGen || !sameScope(bound.scope, liveScope)) {
    return <p className="text-sm text-slate-500 p-3">Aguardando vínculo do cliente ao contexto…</p>;
  }

  return (
    <GerenciarContatosClienteForm
      contatos={bound.contatos}
      onChange={handleChange}
      assertScopeCurrent={assertScopeCurrent}
      persistBusy={updateClienteMutation.isPending}
    />
  );
}
