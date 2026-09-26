/**
 * Condição à vista — Onda 2 (política pura).
 * "Sem aprovação de supervisor quando a regra permitir":
 * exige (1) parcelas ativas todas com dias === 0 e (2) flag explícita fail-closed.
 * Sem inventar percentuais de negócio; default = não liberar.
 */
export type CondicaoParcelaAvista = {
  dias: number;
  ativo?: boolean;
};

/** À vista = há ao menos uma parcela ativa e todas as ativas têm dias === 0. */
export function condicaoPagamentoEhAVista(
  parcelas: CondicaoParcelaAvista[] | null | undefined,
): boolean {
  if (!Array.isArray(parcelas) || parcelas.length === 0) return false;
  const ativas = parcelas.filter((p) => p?.ativo !== false);
  if (ativas.length === 0) return false;
  return ativas.every((p) => Number(p.dias) === 0);
}

/**
 * Libera alçada de desconto somente se à vista E a regra explícita permitir.
 * Qualquer outro caso → false (fail-closed).
 */
export function deveLiberarDescontoSemAprovarPorAvista(options: {
  parcelas: CondicaoParcelaAvista[] | null | undefined;
  /** Config explícita por Grupo/Empresa; omitida/false = não libera. */
  regraPermite?: boolean | null;
}): boolean {
  if (options.regraPermite !== true) return false;
  return condicaoPagamentoEhAVista(options.parcelas);
}

/** Porta opcional de configuração de alçada (sem migration / sem módulo novo). */
export type ComercialAlcadaConfigPort = {
  getConfig(input: {
    groupId: string;
    empresaId: string;
  }): Promise<{ avistaLiberaDescontoSemAprovar?: boolean } | null>;
};
