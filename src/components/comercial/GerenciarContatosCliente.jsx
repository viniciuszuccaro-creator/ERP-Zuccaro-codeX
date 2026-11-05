/**
 * Pacote E / D — keep both → consolidação no Form canônico (2026-10-30):
 * Capacidade de edição de contatos do Cliente. Consumidor canônico:
 * `cadastros/GerenciarContatosClienteForm.jsx` (RBAC Cadastros.Cliente + assertScope).
 * Este arquivo permanece como adaptador (clienteId → Form), sem 3º módulo e sem apagar
 * o path comercial. Mutação só com canEdit; escopo vinculado imutavelmente ao load.
 * Binding inclui actorId canônico da sessão (sem token em queryKey/cache/log).
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { readErpHttpSession } from "@/api/erpHttpSession";
import { central360SessionKey } from "@/api/httpApiClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";
import usePermissions from "@/components/lib/usePermissions";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import GerenciarContatosClienteForm from "@/components/cadastros/GerenciarContatosClienteForm";
import {
  buildGerenciarContatosClienteQueryKey,
  isGerenciarContatosClienteScopeCurrent,
} from "./gerenciarContatosClienteScope";

/** Identidade de escopo: grupo + empresa + ator + fingerprint de sessão. Nunca inclui token. */
function scopePair(groupId, empresaId, actorId, sessionKey) {
  return {
    groupId: groupId || null,
    empresaId: empresaId || null,
    actorId: actorId || null,
    sessionKey: sessionKey || null,
    key: `${groupId || ""}:${empresaId || ""}:${actorId || ""}:${sessionKey || ""}`,
  };
}

function sameScope(a, b) {
  return String(a?.groupId || "") === String(b?.groupId || "")
    && String(a?.empresaId || "") === String(b?.empresaId || "")
    && String(a?.actorId || "") === String(b?.actorId || "")
    && String(a?.sessionKey || "") === String(b?.sessionKey || "");
}

/** Ator + fingerprint de sessão HTTP; sem token em queryKey/cache/log. */
function readSessionActorAndKey() {
  try {
    const session = readErpHttpSession();
    const actorId = typeof session?.actorId === "string" ? session.actorId.trim() : "";
    return {
      actorId: actorId || null,
      sessionKey: central360SessionKey(session?.token),
    };
  } catch {
    return { actorId: null, sessionKey: null };
  }
}

export default function GerenciarContatosCliente({ clienteId }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canEdit } = usePermissions();
  const { empresaAtual, grupoAtual, getInContext, updateInContext } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const { actorId, sessionKey } = readSessionActorAndKey();
  const liveScope = scopePair(groupId, empresaId, actorId, sessionKey);
  const liveScopeRef = useRef(liveScope);
  liveScopeRef.current = liveScope;

  /** Geração do editor: troca de contexto/cliente/ator invalida callbacks antigos. */
  const [editorGen, setEditorGen] = useState(0);
  /** Binding imutável ao load bem-sucedido (cliente + escopo/ator + geração). */
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
    queryKey: buildGerenciarContatosClienteQueryKey({
      groupId, empresaId, actorId, sessionKey, clienteId,
    }),
    queryFn: async () => {
      if (!clienteId) return null;
      const asked = scopePair(groupId, empresaId, actorId, sessionKey);
      const genAtStart = editorGenRef.current;
      if (!asked.groupId && !asked.empresaId) {
        throw new Error("Contexto multiempresa obrigatório para carregar contatos.");
      }
      // Leitura canônica por id via getInContext — filter({id}) não transmite id na fachada HTTP.
      let row = null;
      try {
        row = await getInContext("Cliente", clienteId);
      } catch (readErr) {
        const status = Number(readErr?.status);
        const msg = String(readErr?.message || "");
        const notFound = status === 404
          || /nao encontrado|não encontrado|not found/i.test(msg);
        if (!notFound) throw readErr;
        row = null;
      }
      // Resposta tardia: escopo/ator/sessão ou geração já mudou — não promover a bind.
      if (
        !isGerenciarContatosClienteScopeCurrent(asked, liveScopeRef.current)
        || !sameScope(asked, liveScopeRef.current)
        || genAtStart !== editorGenRef.current
      ) {
        const err = new Error("READ_STALE_SCOPE");
        err.code = "READ_STALE_SCOPE";
        throw err;
      }
      if (row && String(row.id) !== String(clienteId)) {
        throw new Error("Cliente retornado diverge do id solicitado.");
      }
      if (!row) return null;
      return { row, askedScope: asked, gen: genAtStart };
    },
    enabled: Boolean(clienteId),
    retry: false,
  });

  // Promove bind só com row confirmado + sessão atual; ausência/erro invalidam bind anterior
  // (refetch success/data=null não pode manter Form do load antigo — Codex residual).
  useEffect(() => {
    if (isError) {
      setBound(null);
      return;
    }
    if (!isSuccess) return;
    if (!loaded?.row || !loaded?.askedScope) {
      setBound(null);
      return;
    }
    if (loaded.gen !== editorGenRef.current) return;
    if (!sameScope(loaded.askedScope, liveScopeRef.current)) return;
    if (String(loaded.row.id) !== String(clienteId)) {
      setBound(null);
      return;
    }
    setBound({
      clienteId,
      scope: loaded.askedScope,
      gen: loaded.gen,
      rowId: loaded.row.id,
      contatos: Array.isArray(loaded.row.contatos) ? loaded.row.contatos : [],
    });
  }, [isSuccess, isError, loaded, clienteId]);

  const assertScopeCurrent = useCallback(() => {
    const live = liveScopeRef.current;
    // Releitura canônica: troca de ator/sessão sem remount ainda falha aqui.
    const sessionNow = readSessionActorAndKey();
    if (!bound || bound.clienteId !== clienteId) {
      throw new Error("Contatos ainda não vinculados ao cliente carregado. Reabra antes de salvar.");
    }
    if (bound.gen !== editorGenRef.current || bound.gen !== editorGen) {
      throw new Error("Contexto alterado. Reabra os contatos antes de salvar.");
    }
    if (!sameScope(live, bound.scope)) {
      throw new Error("Contexto alterado. Reabra os contatos antes de salvar.");
    }
    if (!isGerenciarContatosClienteScopeCurrent(bound.scope, sessionNow)
      || !isGerenciarContatosClienteScopeCurrent(live, sessionNow)) {
      throw new Error("Sessão/ator alterado. Reabra os contatos antes de salvar.");
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
      return await updateInContext("Cliente", bound.rowId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: buildGerenciarContatosClienteQueryKey({
          groupId, empresaId, actorId, sessionKey, clienteId,
        }),
      });
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
  // Ausência confirmada (success sem row) ≠ Form editável com bind antigo.
  if (isSuccess && (!loaded || !loaded.row)) {
    return (
      <p className="text-sm text-slate-500 p-3" data-contatos-read-empty="true">
        Cliente não encontrado neste contexto. Reabra o cadastro.
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
