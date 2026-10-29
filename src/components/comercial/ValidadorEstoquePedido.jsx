import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { resolveErpBackendMode } from "@/api/runtimeBackend";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Box, Package } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/**
 * Disponibilidade líquida: estoque_atual − estoque_reservado (nunca negativo).
 * Reutilizado no conversor Orçamento→Pedido e na aprovação — sem inventar saldo.
 */
export function estoqueLiquidoDisponivel(produto) {
  const atual = Number(produto?.estoque_atual ?? 0);
  const reservado = Number(produto?.estoque_reservado ?? 0);
  if (!Number.isFinite(atual) || !Number.isFinite(reservado)) return 0;
  return Math.max(0, atual - Math.max(0, reservado));
}

/**
 * Avalia linhas de pedido/orçamento contra o mapa de produtos do escopo.
 * Agrega demanda do mesmo produto nas linhas anteriores (Codex P2 #4410761988).
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
  return lista.map((item) => {
    const produtoId = item?.produto_id;
    const produto = catalog.find((p) => p.id === produtoId) || null;
    const quantidadeNecessaria = Number(item.quantidade || 0);
    const produtoAusente = !produto;
    // HTTP: master/store local ≠ saldo operacional canônico (Codex P1 #4410814402).
    const fonteIndisponivel = !fonteLocalAutoritativa;
    const estoqueAtual = Number(produto?.estoque_atual || 0);
    const estoqueReservado = Number(produto?.estoque_reservado || 0);
    const liquidoTotal = estoqueLiquidoDisponivel(produto);
    const jaConsumido = demandaAcumulada.get(produtoId) || 0;
    const disponivelLiquido = Math.max(0, liquidoTotal - jaConsumido);
    const disponivel = !fonteIndisponivel
      && Boolean(produto)
      && disponivelLiquido >= quantidadeNecessaria;
    const falta = Math.max(0, quantidadeNecessaria - disponivelLiquido);
    if (produtoId != null && produtoId !== "") {
      demandaAcumulada.set(produtoId, jaConsumido + Math.max(0, quantidadeNecessaria));
    }
    return {
      item,
      produto,
      estoqueAtual,
      estoqueReservado,
      disponivelLiquido,
      quantidadeNecessaria,
      disponivel,
      falta: fonteIndisponivel ? 0 : falta,
      produtoAusente,
      fonteIndisponivel,
    };
  });
}

export function resumoDisponibilidadeEstoque(verificacoes) {
  const list = Array.isArray(verificacoes) ? verificacoes : [];
  const authoritative = list.filter((v) => !v.fonteIndisponivel);
  const fontePronta = list.length === 0 || authoritative.length === list.length;
  return {
    todosDisponiveis: authoritative.length > 0 && authoritative.every((v) => v.disponivel),
    algumIndisponivel: authoritative.some((v) => !v.disponivel),
    vazio: list.length === 0,
    fontePronta,
    fonteIndisponivel: list.some((v) => v.fonteIndisponivel),
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
  const { todosDisponiveis, algumIndisponivel, vazio, fontePronta, fonteIndisponivel } = resumoDisponibilidadeEstoque(verificacoes);

  React.useEffect(() => {
    if (typeof onAvailabilityChange !== 'function') return;
    onAvailabilityChange({
      todosDisponiveis,
      algumIndisponivel,
      vazio,
      fontePronta,
      fonteIndisponivel,
      ready: Boolean(empresaId) && (vazio || fontePronta),
    });
  }, [todosDisponiveis, algumIndisponivel, vazio, fontePronta, fonteIndisponivel, empresaId, onAvailabilityChange]);

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
    <Card className={`border-2 ${cardTone}`} data-estoque-fonte={fonteLocalAutoritativa ? 'local' : 'http-advisory'}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <Box className="w-5 h-5" />
            Validação de Estoque
          </h3>
          {fonteIndisponivel ? (
            <Badge className="bg-amber-600">
              <AlertCircle className="w-3 h-3 mr-1" />
              Fonte canônica pendente
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
          <div className="mb-3 p-3 bg-amber-100 border border-amber-300 rounded" data-estoque-advisory="http-sem-fonte-operacional">
            <p className="text-sm text-amber-900">
              Saldo operacional canônico (grupo/empresa) ainda não está conectado a esta conversão HTTP.
              O cadastro master/store local não é fonte de estoque — a UI não bloqueia por ausência local;
              reserva/baixa permanece no backend canônico quando disponível.
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
                </TableCell>
                <TableCell>{v.quantidadeNecessaria}</TableCell>
                <TableCell className={
                  v.fonteIndisponivel
                    ? "text-amber-700 font-semibold"
                    : (v.disponivel ? "text-green-600 font-semibold" : "text-red-600 font-semibold")
                }>
                  {v.fonteIndisponivel || v.produtoAusente ? '—' : v.disponivelLiquido}
                  {!v.fonteIndisponivel && !v.produtoAusente && v.estoqueReservado > 0 ? (
                    <span className="block text-xs font-normal text-slate-500">
                      atual {v.estoqueAtual} · reservado {v.estoqueReservado}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell>
                  {v.fonteIndisponivel ? (
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
