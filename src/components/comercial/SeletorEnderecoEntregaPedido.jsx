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

/**
 * Seletor de entrega: só locais operacionais ativos com finalidade ENTREGA e id canônico.
 * Incompleto/inativo/sem id → rejeitados. Resposta tardia descartada ao trocar cliente/empresa.
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
  const [loadStatus, setLoadStatus] = useState(/** @type {'idle'|'loading'|'loaded'|'failed'|'denied'|'unknown'} */ ("idle"));
  const [operacionais, setOperacionais] = useState(/** @type {Array<Record<string, unknown>>} */ ([]));
  /** Tick de contexto: HTTP_CONTEXT_CHANGED/storage → re-fetch (não ficar preso em unknown). */
  const [contextTick, setContextTick] = useState(0);
  const epoch = useRef(0);
  const clienteId = String(cliente?.id || cliente?.cliente_id || "").trim();
  const session = readErpHttpSession();
  const sessionGroupId = session?.groupId || null;
  const sessionEmpresaId = session?.empresaId || null;
  const sessionToken = session?.token || null;

  const fromPropFallback = () => {
    const raw = Array.isArray(cliente?.locais_entrega) ? cliente.locais_entrega : [];
    return raw.filter((row) => {
      const id = String(row?.id || "").trim();
      if (!id || (isHttpBackendMode && !isClienteLocalCanonicalId(id))) return false;
      if (row?.endereco_incompleto === true) return false;
      const fins = Array.isArray(row?._finalidades) ? row._finalidades : [];
      const tipo = String(row?.tipo_endereco || "").toLowerCase();
      return fins.includes("ENTREGA") || tipo === "entrega" || tipo === "";
    });
  };

  useEffect(() => {
    const invalidate = () => {
      epoch.current += 1;
      setOperacionais([]);
      setLoadStatus("unknown");
      setContextTick((n) => n + 1);
    };
    window.addEventListener(HTTP_CONTEXT_CHANGED, invalidate);
    window.addEventListener("storage", invalidate);
    return () => {
      window.removeEventListener(HTTP_CONTEXT_CHANGED, invalidate);
      window.removeEventListener("storage", invalidate);
    };
  }, []);

  useEffect(() => {
    const generation = ++epoch.current;
    setOperacionais([]);
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
      .then((rows) => {
        if (epoch.current !== generation) return;
        const mapped = (Array.isArray(rows) ? rows : [])
          .map((row) => mapClienteLocalToUiEndereco(/** @type {Record<string, unknown>} */ (row)))
          .filter((ui) => {
            if (!isClienteLocalCanonicalId(String(ui.id || ""))) return false;
            if (ui.endereco_incompleto === true) return false;
            const fins = Array.isArray(ui._finalidades) ? ui._finalidades : [];
            return fins.includes("ENTREGA");
          });
        setOperacionais(mapped);
        setLoadStatus("loaded");
      })
      .catch(() => {
        if (epoch.current !== generation) return;
        setOperacionais([]);
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

  // Troca de cliente: limpa seleção textual sem id canônico.
  useEffect(() => {
    if (!onChange) return;
    const selectedId = String(enderecoSelecionado?.id || "").trim();
    if (!selectedId) return;
    if (loadStatus !== "loaded") return;
    const still = operacionais.some((row) => String(row.id) === selectedId);
    if (!still) onChange(null);
  }, [clienteId, loadStatus, operacionais, enderecoSelecionado?.id, onChange]);

  if (!cliente) return null;

  const handleSelecionarEndereco = (enderecoId) => {
    const endereco = operacionais.find((e) => String(e.id) === String(enderecoId));
    if (!endereco || !isClienteLocalCanonicalId(String(endereco.id || ""))) {
      onChange?.(null);
      return;
    }
    if (endereco.endereco_incompleto === true) return;
    const mapaUrl = endereco.latitude && endereco.longitude
      ? `https://www.google.com/maps?q=${endereco.latitude},${endereco.longitude}`
      : endereco.cep
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          `${endereco.logradouro}, ${endereco.numero}, ${endereco.cidade}, ${endereco.estado}`,
        )}`
        : "";
    onChange?.({
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

  return (
    <div className="space-y-4" data-seletor-locais-status={loadStatus}>
      <Label>Endereço de Entrega *</Label>

      {loadStatus === "loaded" && operacionais.length > 0 ? (
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
                      {end.apelido || `${end.cidade}, ${end.estado}`}
                    </p>
                    <p className="text-xs text-slate-600">
                      {end.logradouro}, {end.numero} - {end.bairro}
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
