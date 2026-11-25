import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Package, ShieldAlert } from "lucide-react";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { createHttpApiClient } from "@/api/httpApiClient";
import { readErpHttpSession } from "@/api/erpHttpSession";
import { resolveErpBackendMode } from "@/api/runtimeBackend";

const PEDIDOS_PAGE_LIMIT = 50;
const LINHAS_UI_LIMIT = 100;

/** Extrai linhas de produto de Pedido legado (itens_*) ou canônico HTTP (`itens`). */
export function mapPedidosToHistoricoLinhas(pedidos = []) {
  const rows = [];
  for (const p of pedidos) {
    const dataRaw = p.data_pedido || p.created_at || p.data_entrega_solicitada || null;
    const data = dataRaw ? new Date(dataRaw) : null;
    const numero = p.numero_pedido || p.numero || "-";

    (p.itens_revenda || []).forEach((it) => {
      rows.push({
        tipo: "Revenda",
        descricao: it.descricao || it.produto_descricao || "-",
        quantidade: it.quantidade,
        unidade: it.unidade || it.unidade_sigla,
        valor: Number(it.valor_total ?? it.total),
        data,
        numero_pedido: numero,
        pedido_id: p.id || null,
      });
    });
    (p.itens_armado_padrao || []).forEach((it) => {
      rows.push({
        tipo: "Armado",
        descricao: it.descricao || it.produto_descricao || `${it.elemento || ""}`,
        quantidade: it.quantidade || it.quantidade_barras_principais || 0,
        unidade: "PC",
        valor: Number(it.valor_total ?? it.total),
        data,
        numero_pedido: numero,
        pedido_id: p.id || null,
      });
    });
    (p.itens_corte_dobra || []).forEach((it) => {
      rows.push({
        tipo: "Corte/Dobra",
        descricao: it.descricao || it.descricao_automatica || "-",
        quantidade: it.quantidade || it.quantidade_pecas || 0,
        unidade: "PC",
        valor: Number(it.valor_total ?? it.total),
        data,
        numero_pedido: numero,
        pedido_id: p.id || null,
      });
    });
    // Contrato canônico HTTP: lista/get devolvem `itens` (não itens_revenda).
    if (Array.isArray(p.itens) && p.itens.length) {
      p.itens.forEach((it) => {
        rows.push({
          tipo: "Revenda",
          descricao: it.descricao || "-",
          quantidade: Number(it.quantidade) || 0,
          unidade: it.unidade_sigla || it.unidade || "-",
          valor: Number(it.total ?? it.valor_total ?? it.subtotal),
          data,
          numero_pedido: numero,
          pedido_id: p.id || null,
          produto_id: it.produto_id || null,
        });
      });
    }
  }
  return rows.sort((a, b) => (b.data?.getTime() || 0) - (a.data?.getTime() || 0));
}

/**
 * Fonte HTTP canônica: resolve ClienteEmpresa via Central 360 e lista Pedidos
 * com itens. Sem fallback silencioso para entityListSorted/local em modo HTTP.
 *
 * Dependência Codex (se evoluir): filtro `cliente_id` (mestre) em GET /pedidos
 * com itens, para evitar round-trip Central 360 só para obter clienteEmpresaId.
 */
async function loadPedidosHistoricoHttp({ clienteId, groupId, empresaId, signal }) {
  const session = readErpHttpSession();
  if (!session?.token || !session?.actorId || !session?.groupId) {
    throw Object.assign(new Error("Sessao HTTP ausente para historico de produtos."), {
      code: "HTTP_SESSION_REQUIRED",
    });
  }
  if (!empresaId) {
    throw Object.assign(new Error("Historico HTTP exige empresa no contexto."), {
      code: "EMPRESA_CONTEXT_REQUIRED",
    });
  }
  const http = createHttpApiClient({
    getScope: () => ({
      token: session.token,
      groupId: groupId || session.groupId,
      empresaId,
      actorId: session.actorId,
      actorEmail: session.email || null,
    }),
  });
  const central = await http.clientes.central360(clienteId, {
    signal,
    pedidosLimit: 1,
    pedidosOffset: 0,
    orcamentosLimit: 1,
    empresasLimit: 1,
    locaisLimit: 1,
    obrasLimit: 1,
    crmLimit: 1,
  });
  const body = central?.data || central;
  const clienteEmpresaId = body?.meta?.clienteEmpresaId || body?.empresaLink?.id || null;
  if (!clienteEmpresaId) {
    throw Object.assign(new Error("Cliente sem vinculo ClienteEmpresa na empresa atual."), {
      code: "CLIENTE_EMPRESA_LINK_MISSING",
    });
  }
  const page = await http.pedidos.list({
    limit: PEDIDOS_PAGE_LIMIT,
    offset: 0,
    clienteEmpresaId,
    signal,
  });
  const rows = Array.isArray(page?.data) ? page.data : (Array.isArray(page) ? page : []);
  return rows;
}

export default function HistoricoProdutosCliente({ clienteId }) {
  const { filterInContext, empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const { hasPermission } = usePermissions();

  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = contexto === "empresa" ? empresaAtual?.id : null;
  const contextoValido = Boolean(groupId || empresaId);
  const httpMode = resolveErpBackendMode() === "http";
  const podeVisualizarHistorico =
    hasPermission("Comercial.Pedido.visualizar") ||
    hasPermission("CRM.Cliente.visualizar") ||
    hasPermission("comercial", "visualizar_pedido");
  const consultaHabilitada = Boolean(
    clienteId && contextoValido && podeVisualizarHistorico && (!httpMode || empresaId),
  );

  const {
    data: pedidos = [],
    isError,
    error,
    isFetching,
  } = useQuery({
    queryKey: [
      "historico-produtos-cliente-contexto",
      clienteId,
      groupId,
      empresaId,
      contexto,
      httpMode ? "http" : "legado",
    ],
    queryFn: async ({ signal }) => {
      if (httpMode) {
        return loadPedidosHistoricoHttp({ clienteId, groupId, empresaId, signal });
      }
      // Legado/local: filterInContext. Em HTTP nunca cai aqui (sem facade silenciosa).
      return filterInContext("Pedido", { cliente_id: clienteId }, "-data_pedido", PEDIDOS_PAGE_LIMIT);
    },
    enabled: consultaHabilitada,
    staleTime: 60_000,
    retry: false,
  });

  const linhas = useMemo(() => mapPedidosToHistoricoLinhas(pedidos), [pedidos]);

  if (clienteId && (!contextoValido || !podeVisualizarHistorico || (httpMode && !empresaId))) {
    return (
      <Alert className="w-full h-full border-amber-200 bg-amber-50" data-context-required="true" data-permission="Comercial.Pedido.visualizar">
        <ShieldAlert className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800">
          {httpMode && !empresaId
            ? "Histórico HTTP exige empresa selecionada (além de permissão para visualizar pedidos)."
            : "Histórico de produtos exige contexto de grupo/empresa e permissão para visualizar pedidos."}
        </AlertDescription>
      </Alert>
    );
  }

  if (isError) {
    return (
      <Alert
        className="w-full h-full border-red-200 bg-red-50"
        data-historico-produtos-error={
          (error && typeof error === "object" && "code" in error && error.code) || "error"
        }
      >
        <ShieldAlert className="h-4 w-4 text-red-600" />
        <AlertDescription className="text-red-800">
          {error?.message || "Falha ao carregar histórico de produtos. Sem fallback local."}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="w-full h-full border-0 shadow-sm" data-context-required="true" data-permission="Comercial.Pedido.visualizar" data-historico-fonte={httpMode ? "http" : "legado"}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Package className="w-4 h-4 text-sky-600" />
          Histórico de Produtos ({linhas.length}){isFetching ? "…" : ""}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Data</TableHead>
                <TableHead>Pedido</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="text-center">Qtd</TableHead>
                <TableHead>Unid</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.slice(0, LINHAS_UI_LIMIT).map((l, idx) => (
                <TableRow key={`${l.pedido_id || l.numero_pedido}-${idx}`}>
                  <TableCell className="text-sm">
                    {l.data && !Number.isNaN(l.data.getTime()) ? l.data.toLocaleDateString("pt-BR") : "-"}
                  </TableCell>
                  <TableCell className="text-sm">{l.numero_pedido || "-"}</TableCell>
                  <TableCell>
                    <Badge className={
                      l.tipo === "Revenda" ? "bg-sky-100 text-sky-700" :
                      l.tipo === "Armado" ? "bg-amber-100 text-amber-700" :
                      "bg-blue-100 text-blue-700"
                    }>
                      {l.tipo}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{l.descricao}</TableCell>
                  <TableCell className="text-center text-sm">{l.quantidade}</TableCell>
                  <TableCell className="text-sm">{l.unidade || "-"}</TableCell>
                  <TableCell className="text-right text-sm">
                    {Number.isFinite(l.valor) ? `R$ ${l.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "-"}
                  </TableCell>
                </TableRow>
              ))}
              {linhas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-slate-500 py-8">
                    Nenhum histórico de produtos encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
