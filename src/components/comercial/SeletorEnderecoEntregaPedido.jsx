import React, { useEffect, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, ExternalLink } from "lucide-react";
import { createHttpApiClient } from "@/api/httpApiClient";
import { readErpHttpSession, HTTP_CONTEXT_CHANGED } from "@/api/erpHttpSession";
import { isHttpBackendMode } from "@/api/base44Client";
import { mapClienteLocalToUiEndereco, isClienteLocalCanonicalId } from "@/api/clienteHttpPayload";
import usePermissions from "@/components/lib/usePermissions";

/** Só operacional quando incompleto está comprovadamente false (ausente ≠ completo). */
const isEnderecoOperacionalCompleto = (row) => row?.endereco_incompleto === false;

/**
 * Seletor de entrega: só locais operacionais ativos com finalidade ENTREGA e id canônico.
 * Incompleto/inativo/sem id → rejeitados. Resposta tardia descartada ao trocar cliente/empresa.
 * onSelect só grava se binding cliente/grupo/empresa/ator/sessão/permissão ainda vale (sync).
 */
export default function SeletorEnderecoEntregaPedido({
  cliente,
  enderecoSelecionado,
  onSelect,
  groupId = null,
  empresaId = null,
}) {
  const onChange = onSelect;
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();
  const canView = hasPermission("Cadastros", "cliente_local", "visualizar") === true;
  const [loadStatus, setLoadStatus] = useState(
    /** @type {'idle'|'loading'|'loaded'|'partial'|'failed'|'denied'|'unknown'} */ ("idle"),
  );
  const [operacionais, setOperacionais] = useState(/** @type {Array<Record<string, unknown>>} */ ([]));
  const [partialMeta, setPartialMeta] = useState(/** @type {{ total: number|null, hasMore: boolean }|null} */ (null));
  /** Tick de contexto: HTTP_CONTEXT_CHANGED/storage → re-fetch (não ficar preso em unknown). */
  const [contextTick, setContextTick] = useState(0);
  const epoch = useRef(0);
  const clienteId = String(cliente?.id || cliente?.cliente_id || "").trim();
  const session = readErpHttpSession();
  const sessionGroupId = session?.groupId || null;
  const sessionEmpresaId = session?.empresaId || null;
  const sessionToken = session?.token || null;
  const sessionActorId = session?.actorId || null;

  const bindingRef = useRef({
    clienteId: "",
    groupId: null,
    empresaId: null,
    sessionGroupId: null,
    sessionEmpresaId: null,
    sessionToken: null,
    sessionActorId: null,
    canView: false,
  });
  bindingRef.current = {
    clienteId,
    groupId: groupId || null,
    empresaId: empresaId || null,
    sessionGroupId,
    sessionEmpresaId,
    sessionToken,
    sessionActorId,
    canView,
  };
  /** Binding/generation da lista carregada — não o bindingRef “ao vivo” no callback tardio. */
  const listBindingRef = useRef(/** @type {typeof bindingRef.current | null} */ (null));
  const listEpochRef = useRef(0);

  const bindingsEqual = (a, b) => Boolean(a) && Boolean(b)
    && a.clienteId === b.clienteId
    && a.groupId === b.groupId
    && a.empresaId === b.empresaId
    && a.sessionGroupId === b.sessionGroupId
    && a.sessionEmpresaId === b.sessionEmpresaId
    && a.sessionToken === b.sessionToken
    && a.sessionActorId === b.sessionActorId
    && a.canView === b.canView;

  /** Checagem síncrona no callback — não inserir rascunho após troca de contexto/permissão. */
  const bindingAllowsSelect = () => {
    const b = bindingRef.current;
    if (!b.canView || !b.clienteId) return false;
    if (!isHttpBackendMode) return true;
    const live = readErpHttpSession();
    if (!live?.token || !live?.groupId) return false;
    if (live.token !== b.sessionToken) return false;
    if (live.groupId !== b.sessionGroupId) return false;
    if ((live.empresaId || null) !== (b.sessionEmpresaId || null)) return false;
    if (b.sessionActorId && live.actorId && live.actorId !== b.sessionActorId) return false;
    if (b.groupId && live.groupId !== b.groupId) return false;
    if (b.empresaId && (live.empresaId || null) !== (b.empresaId || null)) return false;
    return true;
  };

  /**
   * Commit só se a lista (binding+epoch capturados na carga) ainda for a do binding atual.
   * Handler tardio com operacionais A + bindingRef B não pode onChange (nem null) no consumidor B.
   */
  const commitSelection = (listBinding, listEpoch, value) => {
    if (!listBinding) return;
    if (listEpochRef.current !== listEpoch) return;
    if (epoch.current !== listEpoch) return;
    if (!bindingsEqual(listBinding, bindingRef.current)) return;
    if (value != null && !bindingAllowsSelect()) return;
    onChange?.(value);
  };

  const fromPropFallback = () => {
    const raw = Array.isArray(cliente?.locais_entrega) ? cliente.locais_entrega : [];
    return raw.filter((row) => {
      const id = String(row?.id || "").trim();
      if (!id || (isHttpBackendMode && !isClienteLocalCanonicalId(id))) return false;
      if (!isEnderecoOperacionalCompleto(row)) return false;
      const fins = Array.isArray(row?._finalidades) ? row._finalidades : [];
      const tipo = String(row?.tipo_endereco || "").toLowerCase();
      return fins.includes("ENTREGA") || tipo === "entrega" || tipo === "";
    });
  };

  useEffect(() => {
    const invalidate = () => {
      epoch.current += 1;
      listBindingRef.current = null;
      listEpochRef.current = epoch.current;
      setOperacionais([]);
      setPartialMeta(null);
      setLoadStatus("unknown");
      setContextTick((n) => n + 1);
      onChange?.(null);
    };
    window.addEventListener(HTTP_CONTEXT_CHANGED, invalidate);
    window.addEventListener("storage", invalidate);
    return () => {
      window.removeEventListener(HTTP_CONTEXT_CHANGED, invalidate);
      window.removeEventListener("storage", invalidate);
    };
  }, [onChange]);

  useEffect(() => {
    const generation = ++epoch.current;
    listBindingRef.current = null;
    listEpochRef.current = generation;
    setOperacionais([]);
    setPartialMeta(null);
    if (!clienteId) {
      setLoadStatus("idle");
      return undefined;
    }
    if (permissionsLoading) {
      setLoadStatus("loading");
      return undefined;
    }
    if (!canView) {
      setLoadStatus("denied");
      return undefined;
    }
    if (!isHttpBackendMode) {
      const list = fromPropFallback();
      listBindingRef.current = { ...bindingRef.current };
      listEpochRef.current = generation;
      setOperacionais(list);
      setLoadStatus("loaded");
      return undefined;
    }
    if (!sessionToken || !sessionGroupId) {
      setLoadStatus("unknown");
      return undefined;
    }
    if (groupId && sessionGroupId !== groupId) {
      setLoadStatus("unknown");
      return undefined;
    }
    if (empresaId && (sessionEmpresaId || null) !== (empresaId || null)) {
      setLoadStatus("unknown");
      return undefined;
    }
    setLoadStatus("loading");
    const controller = new AbortController();
    const api = createHttpApiClient({ getScope: () => readErpHttpSession() || {} });
    api.clientes.listLocais(clienteId, { limit: 50, ativo: true, signal: controller.signal })
      .then((page) => {
        if (epoch.current !== generation) return;
        const rows = Array.isArray(page?.data) ? page.data : null;
        if (!rows) {
          listBindingRef.current = null;
          listEpochRef.current = generation;
          setOperacionais([]);
          setPartialMeta(null);
          setLoadStatus("failed");
          return;
        }
        const mapped = rows
          .map((row) => mapClienteLocalToUiEndereco(/** @type {Record<string, unknown>} */ (row)))
          .filter((ui) => {
            if (!isClienteLocalCanonicalId(String(ui.id || ""))) return false;
            if (!isEnderecoOperacionalCompleto(ui)) return false;
            const fins = Array.isArray(ui._finalidades) ? ui._finalidades : [];
            return fins.includes("ENTREGA");
          });
        listBindingRef.current = { ...bindingRef.current };
        listEpochRef.current = generation;
        setOperacionais(mapped);
        const partial = page.partial === true;
        setPartialMeta(partial
          ? { total: Number.isSafeInteger(page.meta?.total) ? page.meta.total : null, hasMore: page.meta?.hasMore === true }
          : null);
        setLoadStatus(partial ? "partial" : "loaded");
      })
      .catch(() => {
        if (epoch.current !== generation) return;
        listBindingRef.current = null;
        listEpochRef.current = generation;
        setOperacionais([]);
        setPartialMeta(null);
        setLoadStatus("failed");
      });
    return () => {
      controller.abort();
      epoch.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fromPropFallback usa cliente atual
  }, [
    clienteId, canView, permissionsLoading, groupId, empresaId, contextTick,
    sessionToken, sessionGroupId, sessionEmpresaId, cliente?.locais_entrega,
  ]);

  // Troca de cliente / perda de binding: limpa seleção.
  useEffect(() => {
    if (!onChange) return;
    const selectedId = String(enderecoSelecionado?.id || "").trim();
    if (!selectedId) return;
    if (loadStatus !== "loaded" && loadStatus !== "partial") {
      if (loadStatus === "denied" || loadStatus === "unknown" || loadStatus === "failed") {
        onChange(null);
      }
      return;
    }
    const still = operacionais.some((row) => String(row.id) === selectedId);
    if (!still) onChange(null);
  }, [clienteId, loadStatus, operacionais, enderecoSelecionado?.id, onChange]);

  if (!cliente) return null;

  const handleSelecionarEndereco = (enderecoId) => {
    // Captura da lista (não só bindingRef ao vivo): handler tardio A ≠ consumidor B.
    const listBinding = listBindingRef.current;
    const listEpoch = listEpochRef.current;
    if (!listBinding || listEpoch !== epoch.current || !bindingsEqual(listBinding, bindingRef.current)) {
      return;
    }
    if (!bindingAllowsSelect()) {
      commitSelection(listBinding, listEpoch, null);
      return;
    }
    const endereco = operacionais.find((e) => String(e.id) === String(enderecoId));
    if (!endereco || !isClienteLocalCanonicalId(String(endereco.id || ""))) {
      commitSelection(listBinding, listEpoch, null);
      return;
    }
    if (!isEnderecoOperacionalCompleto(endereco)) {
      commitSelection(listBinding, listEpoch, null);
      return;
    }
    const mapaUrl = endereco.latitude && endereco.longitude
      ? `https://www.google.com/maps?q=${endereco.latitude},${endereco.longitude}`
      : endereco.cep
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          `${endereco.logradouro}, ${endereco.numero}, ${endereco.cidade}, ${endereco.estado}`,
        )}`
        : "";
    commitSelection(listBinding, listEpoch, {
      ...endereco,
      cliente_local_id: endereco.id,
      mapa_url: mapaUrl || endereco.mapa_url || "",
    });
  };

  let emptyMsg = "Nenhum endereço operacional de entrega disponível para este cliente.";
  if (loadStatus === "loading") emptyMsg = "Carregando locais operacionais de entrega…";
  else if (loadStatus === "denied") emptyMsg = "Leitura negada (Cadastros.cliente_local.visualizar).";
  else if (loadStatus === "failed") emptyMsg = "Falha ao carregar locais. Contagem não confirmada — não trate como zero.";
  else if (loadStatus === "unknown") emptyMsg = "Contexto/sessão insuficiente para listar locais operacionais.";
  else if (loadStatus === "partial") {
    const totalLabel = partialMeta?.total != null ? String(partialMeta.total) : "mais";
    emptyMsg = `Listagem parcial (há ${totalLabel} no servidor; página atual incompleta). Não trate como zero nem como catálogo completo.`;
  }

  const showSelect = (loadStatus === "loaded" || loadStatus === "partial") && operacionais.length > 0;

  return (
    <div className="space-y-4" data-seletor-locais-status={loadStatus}>
      <Label>Endereço de Entrega *</Label>

      {loadStatus === "partial" ? (
        <p className="text-xs text-amber-800" role="status" data-block="seletor-locais-parcial">
          {emptyMsg}
        </p>
      ) : null}

      {showSelect ? (
        <Select
          value={enderecoSelecionado?.id ? String(enderecoSelecionado.id) : ""}
          onValueChange={handleSelecionarEndereco}
        >
          <SelectTrigger data-action="pedido-selecionar-cliente-local">
            <SelectValue placeholder="Selecione um local operacional…" />
          </SelectTrigger>
          <SelectContent className="z-[99999]">
            {operacionais.map((end) => (
              <SelectItem key={String(end.id)} value={String(end.id)}>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  <div>
                    <p className="font-medium">
                      {String(end.apelido || `${end.cidade || ""}, ${end.estado || ""}`)}
                    </p>
                    <p className="text-xs text-slate-600">
                      {String(end.logradouro || "")}, {String(end.numero || "")} - {String(end.bairro || "")}
                    </p>
                  </div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <div className="text-center py-4 border-2 border-dashed border-slate-200 rounded-lg bg-slate-50">
          <MapPin className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p
            className="text-sm text-slate-600 px-3"
            role={loadStatus === "failed" || loadStatus === "denied" ? "alert" : "status"}
          >
            {emptyMsg}
          </p>
        </div>
      )}

      {enderecoSelecionado?.id && (
        <Card className="border-0 shadow-sm bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  <p className="font-semibold text-blue-900">
                    {enderecoSelecionado.apelido || "Local operacional selecionado"}
                  </p>
                  {enderecoSelecionado.tipo_endereco && (
                    <Badge variant="outline" className="text-xs">
                      {enderecoSelecionado.tipo_endereco}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-blue-800">
                  {enderecoSelecionado.logradouro}, {enderecoSelecionado.numero}
                  {enderecoSelecionado.complemento && ` - ${enderecoSelecionado.complemento}`}
                </p>
                <p className="text-sm text-blue-700">
                  {enderecoSelecionado.bairro} - {enderecoSelecionado.cidade}/{enderecoSelecionado.estado}
                  {enderecoSelecionado.cep && ` - CEP: ${enderecoSelecionado.cep}`}
                </p>
                <p className="text-xs text-blue-700 mt-1">cliente_local_id: {String(enderecoSelecionado.id)}</p>

                {enderecoSelecionado.mapa_url && (
                  <a
                    href={enderecoSelecionado.mapa_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-2"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Ver no Google Maps
                  </a>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
