import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { resolveErpBackendMode } from "@/api/runtimeBackend";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Box, Package } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/**
 * Chave canônica de demanda: produto + unidade (id|sigla|legado).
 * Unidades distintas do mesmo produto NÃO se somam — sem conversão inventada.
 */
export function chaveDemandaEstoqueLinha(item) {
  const produtoId = item?.produto_id == null || item?.produto_id === ""
    ? ""
    : String(item.produto_id);
  const unidade = item?.unidade_id ?? item?.unidade_sigla ?? item?.unidade ?? item?.unidade_medida ?? "";
  const unidadeNorm = String(unidade).trim().toLowerCase();
  return `${produtoId}::${unidadeNorm}`;
}

/**
 * `estoque_atual` ausente no DTO ≠ zero (parecer #397 / produtoTypes MASTER).
 * Reserva ausente com atual conhecido → 0 (sem inventar estoque).
 * @returns {number|null} líquido conhecido, ou null quando saldo DESCONHECIDO
 */
export function estoqueLiquidoDisponivel(produto) {
  if (!produto || typeof produto !== "object") return null;
  if (!Object.prototype.hasOwnProperty.call(produto, "estoque_atual") || produto.estoque_atual == null || produto.estoque_atual === "") {
    return null;
  }
  const atual = Number(produto.estoque_atual);
  if (!Number.isFinite(atual)) return null;
  const reservadoRaw = Object.prototype.hasOwnProperty.call(produto, "estoque_reservado")
    && produto.estoque_reservado != null
    && produto.estoque_reservado !== ""
    ? Number(produto.estoque_reservado)
    : 0;
  if (!Number.isFinite(reservadoRaw)) return null;
  return Math.max(0, atual - Math.max(0, reservadoRaw));
}

/**
 * Avalia linhas de pedido/orçamento contra o mapa de produtos do escopo.
 * Agrega demanda por produto+unidade (Codex P2 #4410761988 + parecer unidade).
 * Aceita `itens` canônico ou `itens_revenda` legado — sem cadastro paralelo.
 * @param {object[]} [itens]
 * @param {object[]} [produtos]
 * @param {{ fonteLocalAutoritativa?: boolean }} [options]
 */
export function avaliarDisponibilidadeLinhasEstoque(itens, produtos = [], options = {}) {
  const lista = Array.isArray(itens) ? itens : [];
  const catalog = Array.isArray(produtos) ? produtos : [];
  const fonteLocalAutoritativa = options.fonteLocalAutoritativa !== false;
  /** @type {Map<string, number>} */
  const demandaAcumulada = new Map();
  /** @type {Map<string, Set<string>>} produto → unidades vistas (detecta conflito) */
  const unidadesPorProduto = new Map();

  // Pré-passe: mapear unidades distintas por produto (sem conversão inventada).
  for (const item of lista) {
    const produtoId = item?.produto_id;
    if (produtoId == null || produtoId === "") continue;
    const key = String(produtoId);
    const unidade = String(item?.unidade_id ?? item?.unidade_sigla ?? item?.unidade ?? item?.unidade_medida ?? "").trim().toLowerCase();
    if (!unidadesPorProduto.has(key)) unidadesPorProduto.set(key, new Set());
    unidadesPorProduto.get(key).add(unidade);
  }

  return lista.map((item) => {
    const produtoId = item?.produto_id;
    const produto = catalog.find((p) => p.id === produtoId) || null;
    const quantidadeNecessaria = Number(item.quantidade || 0);
    const produtoAusente = !produto;
    const demandaKey = chaveDemandaEstoqueLinha(item);
    const unidadesDoProduto = produtoId != null && produtoId !== ""
      ? (unidadesPorProduto.get(String(produtoId)) || new Set())
      : new Set();
    const unidadeIncompativel = unidadesDoProduto.size > 1;

    // HTTP master ≠ saldo operacional; DTO sem estoque_atual ≠ zero fabricado.
    const liquidoTotal = estoqueLiquidoDisponivel(produto);
    const saldoDesconhecido = Boolean(produto) && liquidoTotal == null;
    const fonteIndisponivel = !fonteLocalAutoritativa || saldoDesconhecido || unidadeIncompativel;

    const estoqueAtual = saldoDesconhecido || !produto
      ? null
      : Number(produto.estoque_atual);
    const estoqueReservado = saldoDesconhecido || !produto
      ? null
      : (Object.prototype.hasOwnProperty.call(produto, "estoque_reservado")
        && produto.estoque_reservado != null
        && produto.estoque_reservado !== ""
        ? Number(produto.estoque_reservado)
        : 0);

    const jaConsumido = demandaAcumulada.get(demandaKey) || 0;
    const disponivelLiquido = fonteIndisponivel || liquidoTotal == null
      ? null
      : Math.max(0, liquidoTotal - jaConsumido);
    const disponivel = !fonteIndisponivel
      && Boolean(produto)
      && disponivelLiquido != null
      && disponivelLiquido >= quantidadeNecessaria;
    const falta = (fonteIndisponivel || disponivelLiquido == null)
      ? null
      : Math.max(0, quantidadeNecessaria - disponivelLiquido);

    if (produtoId != null && produtoId !== "" && !unidadeIncompativel) {
      demandaAcumulada.set(demandaKey, jaConsumido + Math.max(0, quantidadeNecessaria));
    }

    return {
      item,
      produto,
      estoqueAtual,
      estoqueReservado,
      disponivelLiquido,
      quantidadeNecessaria,
      disponivel,
      falta,
      produtoAusente,
      fonteIndisponivel,
      saldoDesconhecido,
      unidadeIncompativel,
      demandaKey,
    };
  });
}

export function resumoDisponibilidadeEstoque(verificacoes) {
  const list = Array.isArray(verificacoes) ? verificacoes : [];
  const authoritative = list.filter((v) => !v.fonteIndisponivel);
  const fontePronta = list.length === 0 || authoritative.length === list.length;
  return {
    // Nunca declarar "estoque OK" quando há saldo desconhecido / unidade incompatível / fonte HTTP.
    todosDisponiveis: fontePronta && authoritative.length > 0 && authoritative.every((v) => v.disponivel),
    algumIndisponivel: authoritative.some((v) => !v.disponivel),
    vazio: list.length === 0,
    fontePronta,
    fonteIndisponivel: list.some((v) => v.fonteIndisponivel),
    saldoDesconhecido: list.some((v) => v.saldoDesconhecido),
    unidadeIncompativel: list.some((v) => v.unidadeIncompativel),
  };
}

/**
 * 📦 VALIDADOR DE ESTOQUE PARA PEDIDO V21.5
 *
 * Verifica disponibilidade de estoque antes de aprovar/converter pedido.
 * Exibe alertas de itens sem estoque líquido (atual − reservado).
 * @param {{ pedido?: object|null, orcamento?: object|null, empresaId?: string|null, onAvailabilityChange?: ((state: object) => void)|null }} [props]
 */
export default function ValidadorEstoquePedido({
  pedido = null,
  orcamento = null,
  empresaId = null,
  onAvailabilityChange = null,
} = {}) {
  const fonte = pedido || orcamento || null;
  const itens = Array.isArray(fonte?.itens) && fonte.itens.length > 0
    ? fonte.itens
    : (Array.isArray(fonte?.itens_revenda) ? fonte.itens_revenda : []);

  // Produto HTTP master não carrega estoque_atual/reservado; piloto de listagem
  // também exclui Produto. Em HTTP o store local não é fonte autoritativa.
  const httpMode = resolveErpBackendMode() === 'http';
  const fonteLocalAutoritativa = !httpMode;

  const { data: produtos = [] } = useQuery({
    queryKey: ['produtos-estoque-validacao', empresaId, fonteLocalAutoritativa ? 'local' : 'http-advisory'],
    queryFn: () => (
      fonteLocalAutoritativa
        ? base44.entities.Produto.filter({ empresa_id: empresaId })
        : Promise.resolve([])
    ),
    enabled: !!empresaId && fonteLocalAutoritativa,
  });

  const verificacoes = avaliarDisponibilidadeLinhasEstoque(itens, produtos, { fonteLocalAutoritativa });
  const {
    todosDisponiveis,
    algumIndisponivel,
    vazio,
    fontePronta,
    fonteIndisponivel,
    saldoDesconhecido,
    unidadeIncompativel,
  } = resumoDisponibilidadeEstoque(verificacoes);

  React.useEffect(() => {
    if (typeof onAvailabilityChange !== 'function') return;
    onAvailabilityChange({
      todosDisponiveis,
      algumIndisponivel,
      vazio,
      fontePronta,
      fonteIndisponivel,
      saldoDesconhecido,
      unidadeIncompativel,
      // Alinha OrcamentosTab: fontePronta===false (HTTP/desconhecido) ≠ bloqueio por “sem estoque”;
      // bloqueio só com saldo conhecido insuficiente (todosDisponiveis===false).
      ready: Boolean(empresaId) && (vazio || !fontePronta || todosDisponiveis),
    });
  }, [todosDisponiveis, algumIndisponivel, vazio, fontePronta, fonteIndisponivel, saldoDesconhecido, unidadeIncompativel, empresaId, onAvailabilityChange]);

  if (vazio) {
    return (
      <Card className="border-slate-200">
        <CardContent className="p-4 text-center text-slate-500">
          <Package className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhum item neste documento para validar estoque</p>
        </CardContent>
      </Card>
    );
  }

  if (!empresaId) {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="p-4 text-sm text-amber-900">
          Selecione a empresa do contexto para consultar disponibilidade de estoque.
        </CardContent>
      </Card>
    );
  }

  const cardTone = fonteIndisponivel
    ? 'border-amber-300 bg-amber-50'
    : (algumIndisponivel ? 'border-red-300 bg-red-50' : 'border-green-300 bg-green-50');

  return (
    <Card
      className={`border-2 ${cardTone}`}
      data-estoque-fonte={fonteLocalAutoritativa ? 'local' : 'http-advisory'}
      data-estoque-saldo={saldoDesconhecido ? 'desconhecido' : (fontePronta ? 'conhecido' : 'pendente')}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <Box className="w-5 h-5" />
            Validação de Estoque
          </h3>
          {fonteIndisponivel ? (
            <Badge className="bg-amber-600">
              <AlertCircle className="w-3 h-3 mr-1" />
              {unidadeIncompativel
                ? 'Unidade incompatível'
                : (saldoDesconhecido ? 'Saldo desconhecido' : 'Fonte canônica pendente')}
            </Badge>
          ) : todosDisponiveis ? (
            <Badge className="bg-green-600">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Estoque OK
            </Badge>
          ) : (
            <Badge className="bg-red-600">
              <AlertCircle className="w-3 h-3 mr-1" />
              Estoque Insuficiente
            </Badge>
          )}
        </div>

        {fonteIndisponivel ? (
          <div className="mb-3 p-3 bg-amber-100 border border-amber-300 rounded" data-estoque-advisory="saldo-nao-autoritativo">
            <p className="text-sm text-amber-900">
              {unidadeIncompativel
                ? 'Há linhas do mesmo produto com unidades distintas — sem conversão inventada; alinhe a unidade antes de comparar saldo.'
                : (saldoDesconhecido
                  ? 'Saldo operacional ausente no DTO do produto (master ≠ estoque). Ausência ≠ zero: estado DESCONHECIDO — não declara “sem estoque” nem “estoque suficiente”.'
                  : 'Saldo operacional canônico (grupo/empresa) ainda não está conectado a esta conversão HTTP. Cadastro master/store local não é fonte de estoque.')}
              {' '}Reserva/baixa permanece no backend canônico quando disponível — sem ledger paralelo nesta UI.
            </p>
          </div>
        ) : null}

        <Table>
          <TableHeader>
            <TableRow className="bg-white">
              <TableHead>Produto</TableHead>
              <TableHead>Qtd Necessária</TableHead>
              <TableHead>Disponível líquido</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {verificacoes.map((v, idx) => (
              <TableRow key={idx} className="hover:bg-white/50">
                <TableCell className="font-medium">
                  {v.item.descricao || v.item.produto_descricao || v.produto?.nome || v.item.produto_id}
                  {v.item.unidade_sigla || v.item.unidade ? (
                    <span className="block text-xs font-normal text-slate-500">
                      un. {v.item.unidade_sigla || v.item.unidade}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell>{v.quantidadeNecessaria}</TableCell>
                <TableCell className={
                  v.fonteIndisponivel
                    ? "text-amber-700 font-semibold"
                    : (v.disponivel ? "text-green-600 font-semibold" : "text-red-600 font-semibold")
                }>
                  {v.fonteIndisponivel || v.produtoAusente || v.disponivelLiquido == null ? '—' : v.disponivelLiquido}
                  {!v.fonteIndisponivel && !v.produtoAusente && Number(v.estoqueReservado) > 0 ? (
                    <span className="block text-xs font-normal text-slate-500">
                      atual {v.estoqueAtual} · reservado {v.estoqueReservado}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell>
                  {v.unidadeIncompativel ? (
                    <Badge className="bg-amber-100 text-amber-800">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      Unidade incompatível
                    </Badge>
                  ) : v.saldoDesconhecido ? (
                    <Badge className="bg-amber-100 text-amber-800">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      Saldo desconhecido
                    </Badge>
                  ) : v.fonteIndisponivel ? (
                    <Badge className="bg-amber-100 text-amber-800">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      Sem fonte operacional
                    </Badge>
                  ) : v.disponivel ? (
                    <Badge className="bg-green-100 text-green-700">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Disponível
                    </Badge>
                  ) : (
                    <Badge className="bg-red-100 text-red-700">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      {v.produtoAusente ? 'Produto fora do escopo' : `Falta ${v.falta}`}
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {algumIndisponivel && (
          <div className="mt-3 p-3 bg-red-100 border border-red-300 rounded">
            <p className="text-sm text-red-800">
              <strong>Ação necessária:</strong> Ajuste as quantidades ou aguarde reposição de estoque antes de converter/aprovar o pedido.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
