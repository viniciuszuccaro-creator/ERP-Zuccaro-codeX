import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import useEntityCounts from "@/components/lib/useEntityCounts";

/**
 * GroupCountBadge — badge de contagem para grupos de entidades (soma total).
 * Pacote A: erro de consulta ≠ zero — exibe "—" e title de indisponível.
 */
export default function GroupCountBadge({
  entities = [],
  badgeClassName = "",
  colorClass = "bg-blue-50 text-blue-700 border-blue-200",
  precomputedTotal,
  countsUnavailable = false,
}) {
  const list = Array.isArray(entities) ? entities.filter(Boolean) : [];
  const skip = precomputedTotal !== undefined;
  const { total: fetched, isLoading, isError } = useEntityCounts(skip ? [] : list);
  const unavailable = countsUnavailable || (!skip && isError);
  const total = skip ? precomputedTotal : fetched;

  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs rounded-sm tabular-nums shrink-0 font-semibold",
        unavailable ? "bg-amber-50 text-amber-800 border-amber-200" : colorClass,
        badgeClassName,
      )}
      title={unavailable ? "Contagem indisponível (erro de consulta — não é zero)" : undefined}
      data-counts-unavailable={unavailable ? "true" : "false"}
    >
      {unavailable ? (
        <span aria-label="Contagem indisponível">—</span>
      ) : isLoading && (total === 0 || total == null) ? (
        <span className="animate-pulse opacity-60">···</span>
      ) : total == null ? (
        <span aria-label="Contagem indisponível">—</span>
      ) : (
        Number(total).toLocaleString("pt-BR")
      )}
    </Badge>
  );
}
