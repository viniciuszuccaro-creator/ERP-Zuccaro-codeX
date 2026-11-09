import React from "react";
import { Badge } from "@/components/ui/badge";
import useEntityCounts from "@/components/lib/useEntityCounts";

/**
 * CountBadgeSimplificado — badge de contagem para uma ou mais entidades
 * Usa useEntityCounts V5 (asServiceRole + filtro multiempresa correto)
 */
/**
 * REGRA: se allCounts foi passado (mesmo como {}), NUNCA fazer fetch próprio.
 * Só faz fetch interno quando allCounts NÃO foi fornecido pelo pai.
 * isLoading (prop do pai) controla o estado de carregamento visual.
 */
/** @param {{entities?: string | string[], className?: string, precomputedTotal?: number|null,
 * allCounts?: Record<string, unknown>, missing?: string[], isLoading?: boolean}} props */
export default function CountBadgeSimplificado({ entities = [], className = "", precomputedTotal, allCounts, missing, isLoading: isLoadingProp }) {
  const list = Array.isArray(entities) ? entities.filter(Boolean) : [entities].filter(Boolean);
  const missingSet = new Set(Array.isArray(missing) ? missing : []);

  // Se allCounts foi fornecido pelo pai, não faz fetch próprio (evita burst de 429s)
  const hasParentCounts = allCounts !== undefined;
  const {
    total: fetched,
    isLoading: isLoadingInternal,
    countsUnavailable: fetchedUnavailable,
  } = useEntityCounts(hasParentCounts ? [] : list);

  let total;
  let unavailable = false;
  if (precomputedTotal !== undefined) {
    total = precomputedTotal;
    unavailable = precomputedTotal == null;
  } else if (hasParentCounts) {
    // Chave ausente / missing explícito ≠ zero confirmado.
    unavailable = list.some((e) => (
      missingSet.has(e) || !Object.prototype.hasOwnProperty.call(allCounts || {}, e)
    ));
    total = unavailable
      ? null
      : list.reduce((s, e) => s + (Number(allCounts[e]) || 0), 0);
  } else {
    total = fetched;
    unavailable = Boolean(fetchedUnavailable) || total == null;
  }

  const isLoading = isLoadingProp || isLoadingInternal;

  if (!list.length) return null;

  return (
    <Badge
      variant="outline"
      className={`ml-1 rounded-sm bg-slate-100 text-slate-600 border-slate-300 text-xs font-semibold tabular-nums shrink-0 ${className}`}
      title={unavailable ? 'Contagem indisponível' : undefined}
    >
      {isLoading && (total === 0 || total == null) ? (
        <span className="animate-pulse opacity-60">···</span>
      ) : unavailable ? (
        '—'
      ) : (
        Number(total).toLocaleString("pt-BR")
      )}
    </Badge>
  );
}
