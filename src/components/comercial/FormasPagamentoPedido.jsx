import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, Percent, Calendar, AlertCircle } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useFormasPagamento } from "@/components/lib/useFormasPagamento";
import { formatMasterCodigoLabel } from "@/components/comercial/comercialMasterPicker";

/**
 * Formulário canônico de formas de pagamento (Cadastros Gerais → FormaPagamento).
 * Não gera código no browser; não usa fixture/mock.
 * Central360 Pedido HTTP persiste via `condicao_pagamento_id` (CondicaoComercial) —
 * este componente serve jornadas que ainda editam forma + parcelas no documento legado.
 *
 * @param {object} props
 * @param {number} props.valorTotal
 * @param {string} [props.formaPagamento] — id canônico ou tipo legado
 * @param {string} [props.condicaoPagamento]
 * @param {Array<{id?:string,codigo?:string,nome?:string,ativo?:boolean}>} [props.condicoes]
 *   CondicaoComercial do escopo — sem lista hardcoded.
 * @param {Array} [props.parcelas]
 * @param {number} [props.acrescimo]
 * @param {(value: string) => void} [props.onFormaPagamentoChange]
 * @param {(value: string) => void} [props.onCondicaoPagamentoChange]
 * @param {(parcelas: Array) => void} [props.onParcelasChange]
 * @param {(valor: number) => void} [props.onAcrescimoChange]
 * @param {{ empresa_id?: string }} [props.filtros]
 */
export default function FormasPagamentoPedido({
  valorTotal,
  formaPagamento,
  condicaoPagamento,
  condicoes = [],
  parcelas = [],
  acrescimo = 0,
  onFormaPagamentoChange,
  onCondicaoPagamentoChange,
  onParcelasChange,
  onAcrescimoChange,
  filtros = {},
}) {
  const [numeroParcelas, setNumeroParcelas] = useState(
    Array.isArray(parcelas) && parcelas.length > 0 ? parcelas.length : 1,
  );
  const [percentualAcrescimo, setPercentualAcrescimo] = useState(acrescimo || 0);

  const {
    formasPagamento = [],
    isLoading: loadingFormas,
    isError: formasQueryError,
    obterConfiguracao,
  } = useFormasPagamento(filtros);

  const formasAtivas = (formasPagamento || []).filter((f) => f && f.ativa !== false);
  // Hook defaulta `[]` no sucesso vazio; falha de query vem por isError (≠ lista vazia confirmada).
  const formasLoadFailed = Boolean(formasQueryError) && !loadingFormas;
  const formasEmptyConfirmed = !loadingFormas && !formasLoadFailed && formasAtivas.length === 0;

  const formaSelecionada = formasAtivas.find(
    (f) => f.id === formaPagamento || f.tipo === formaPagamento || f.descricao === formaPagamento,
  );
  const config = formaSelecionada ? obterConfiguracao(formaSelecionada.id) : null;
  const permiteParcelar = Boolean(
    config?.permite_parcelar
    || formaSelecionada?.permite_parcelamento
    || formaSelecionada?.tipo === "Parcelado"
    || formaSelecionada?.tipo === "Cartão de Crédito",
  );
  const maxParcelas = Math.min(12, Math.max(1, Number(config?.max_parcelas) || 12));

  const condicoesAtivas = (Array.isArray(condicoes) ? condicoes : []).filter(
    (c) => c && c.id && c.ativo !== false,
  );

  useEffect(() => {
    if (permiteParcelar && numeroParcelas > 0 && onParcelasChange) {
      gerarParcelas();
    } else if (!permiteParcelar && Array.isArray(parcelas) && parcelas.length > 0 && onParcelasChange) {
      onParcelasChange([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- regenera só quando inputs de parcela mudam
  }, [numeroParcelas, valorTotal, percentualAcrescimo, formaPagamento, permiteParcelar]);

  useEffect(() => {
    if (acrescimo !== percentualAcrescimo) {
      setPercentualAcrescimo(acrescimo || 0);
    }
  }, [acrescimo]);

  const gerarParcelas = () => {
    const base = Number(valorTotal);
    if (!Number.isFinite(base) || base < 0) {
      if (onParcelasChange) onParcelasChange([]);
      return;
    }
    const valorComAcrescimo = base * (1 + (Number(percentualAcrescimo) || 0) / 100);
    const n = Math.max(1, Math.min(maxParcelas, Number(numeroParcelas) || 1));
    const valorParcela = valorComAcrescimo / n;
    const intervalo = Number(config?.intervalo_parcelas_dias) || 30;
    const novasParcelas = [];
    for (let i = 1; i <= n; i += 1) {
      const dataVencimento = new Date();
      dataVencimento.setDate(dataVencimento.getDate() + (i * intervalo));
      novasParcelas.push({
        numero_parcela: i,
        data_vencimento: dataVencimento.toISOString().split("T")[0],
        valor: valorParcela,
        status: "Pendente",
        forma_cobranca: formaSelecionada?.tipo || formaPagamento,
        forma_pagamento_id: formaSelecionada?.id || undefined,
      });
    }
    if (onParcelasChange) onParcelasChange(novasParcelas);
  };

  const handleAcrescimoChange = (valor) => {
    setPercentualAcrescimo(valor);
    if (onAcrescimoChange) onAcrescimoChange(valor);
  };

  const labelForma = (forma) => formatMasterCodigoLabel(
    forma?.codigo,
    forma?.descricao || forma?.tipo || forma?.nome,
  ) || forma?.id;

  return (
    <Card className="border-sky-200" data-block="formas-pagamento-pedido-canonico">
      <CardHeader className="bg-gradient-to-r from-sky-50 to-blue-50">
        <CardTitle className="text-base flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-sky-600" />
          Formas de Pagamento
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        {loadingFormas ? (
          <p className="text-sm text-slate-600" role="status" data-formas-state="carregando">
            Carregando formas de pagamento do cadastro…
          </p>
        ) : null}
        {formasLoadFailed ? (
          <p className="text-sm text-amber-800 flex items-center gap-2" role="alert" data-formas-state="falha">
            <AlertCircle className="w-4 h-4" />
            Falha ao ler FormaPagamento — lista indisponível (≠ zero formas).
          </p>
        ) : null}
        {formasEmptyConfirmed ? (
          <p className="text-sm text-slate-600" role="status" data-formas-state="nenhuma">
            Nenhuma forma ativa neste contexto. Cadastre em Cadastros Gerais antes de cobrar.
          </p>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="forma-pagamento-select">Forma de Pagamento *</Label>
            <Select
              value={formaSelecionada?.id || formaPagamento || undefined}
              onValueChange={(value) => {
                if (onFormaPagamentoChange) onFormaPagamentoChange(value);
              }}
              disabled={loadingFormas || formasAtivas.length === 0}
            >
              <SelectTrigger id="forma-pagamento-select" data-action="pedido-forma-pagamento">
                <SelectValue placeholder={loadingFormas ? "Carregando…" : "Selecione…"} />
              </SelectTrigger>
              <SelectContent>
                {formasAtivas.map((forma) => (
                  <SelectItem key={forma.id} value={forma.id}>
                    {labelForma(forma)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="condicao-pagamento-select">Condição de Pagamento</Label>
            {condicoesAtivas.length === 0 ? (
              <p
                className="text-xs text-amber-800 mt-2"
                role="status"
                data-condicao-state="sem-mestre"
              >
                CondicaoComercial não fornecida neste painel — use o seletor canônico do Pedido/Orçamento
                (id), sem lista ilustrativa.
              </p>
            ) : (
              <Select
                value={condicaoPagamento || undefined}
                onValueChange={onCondicaoPagamentoChange}
              >
                <SelectTrigger id="condicao-pagamento-select" data-action="pedido-condicao-pagamento">
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  {condicoesAtivas.map((condicao) => (
                    <SelectItem key={condicao.id} value={condicao.id}>
                      {formatMasterCodigoLabel(condicao.codigo, condicao.nome) || condicao.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {permiteParcelar && (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <Label className="text-orange-900" htmlFor="percentual-acrescimo-input">
                  Acréscimo/Juros (%)
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="percentual-acrescimo-input"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={percentualAcrescimo}
                    onChange={(e) => handleAcrescimoChange(parseFloat(e.target.value) || 0)}
                    className="w-24"
                  />
                  <Percent className="w-4 h-4 text-orange-600" />
                </div>
              </div>
              {percentualAcrescimo > 0 && Number.isFinite(Number(valorTotal)) && (
                <div className="mt-2 p-2 bg-white rounded">
                  <p className="text-sm text-orange-700">
                    Valor Original:{" "}
                    <span className="font-bold">
                      R$ {Number(valorTotal).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </p>
                  <p className="text-sm text-orange-900 font-bold">
                    Valor com Acréscimo: R${" "}
                    {(Number(valorTotal) * (1 + percentualAcrescimo / 100)).toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                    })}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {permiteParcelar && (
          <div className="space-y-3">
            <div className="flex items-center gap-4 flex-wrap">
              <Label htmlFor="numero-parcelas-select">Número de Parcelas:</Label>
              <Select
                value={String(Math.min(maxParcelas, Math.max(1, numeroParcelas)))}
                onValueChange={(v) => setNumeroParcelas(parseInt(v, 10))}
              >
                <SelectTrigger id="numero-parcelas-select" className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: maxParcelas }, (_, i) => i + 1).map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}x
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {numeroParcelas > 0 && Number.isFinite(Number(valorTotal)) && (
                <span className="text-sm text-slate-600">
                  de R${" "}
                  {(
                    (Number(valorTotal) * (1 + percentualAcrescimo / 100))
                    / Math.max(1, numeroParcelas)
                  ).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
              )}
            </div>

            {Array.isArray(parcelas) && parcelas.length > 0 && (
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-sky-600" />
                    Parcelas (rascunho local — persistência só após salvar o documento)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3">
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {parcelas.map((parcela) => (
                      <div
                        key={`${parcela.numero_parcela}-${parcela.data_vencimento}`}
                        className="flex items-center justify-between p-2 bg-slate-50 rounded gap-2 flex-wrap"
                      >
                        <span className="text-sm font-medium">
                          Parcela {parcela.numero_parcela}/{numeroParcelas}
                        </span>
                        <span className="text-sm text-slate-700">
                          Vencimento:{" "}
                          {parcela.data_vencimento
                            ? new Date(`${parcela.data_vencimento}T12:00:00`).toLocaleDateString("pt-BR")
                            : "—"}
                        </span>
                        <span className="font-semibold text-sm">
                          R${" "}
                          {Number(parcela.valor || 0).toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {!formaPagamento && formasAtivas.length > 0 && (
          <>
            <Separator />
            <h4 className="font-semibold text-base mb-2">Selecione uma Forma de Pagamento</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {formasAtivas.slice(0, 8).map((forma) => (
                <Button
                  key={forma.id}
                  type="button"
                  variant="outline"
                  onClick={() => onFormaPagamentoChange?.(forma.id)}
                  className="h-auto py-3 flex flex-col items-center gap-1 text-center"
                  data-action="pedido-forma-pagamento-atalho"
                >
                  <span className="text-xs font-medium font-mono">{forma.codigo || "—"}</span>
                  <span className="text-xs font-medium">{forma.descricao || forma.tipo}</span>
                </Button>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
