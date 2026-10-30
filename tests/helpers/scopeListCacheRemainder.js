import assert from 'node:assert/strict';

/**
 * Pacote A — remainder autorizado do Visualizador V24 (pin e36231b3):
 * 1) limpa lastGoodData/everLoaded na troca de escopo
 * 2) propaga countsUnavailable (erro ≠ zero no total / cross-page)
 * Cada hunk [after→before] ocorre exatamente uma vez; mutação fora do after permanece.
 */
function peelOnce(source, after, before, label) {
  assert.equal(source.split(after).length, 2, `${label} must occur exactly once`);
  return source.replace(after, before);
}

export function scopeListCacheRemainder(source) {
  let result = source.replace(/\r\n/g, '\n');

  result = peelOnce(
    result,
    `  // Contagem — erro ≠ zero: countsUnavailable impede KPI/seleção cross-page com total fabricado
  const { counts, isLoading: countsLoading, countsUnavailable } = useEntityCounts(ENTITY ? [ENTITY] : []);
  const totalCount = countsUnavailable ? null : Number((counts && counts[ENTITY]) || 0);
  const countKnown = typeof totalCount === "number";

  useEffect(function() {
    if (countsUnavailable && crossPageAll) {
      setCrossPageAll(false);
      setDeselectedIds(new Set());
      setSelectedIds(new Set());
    }
  }, [countsUnavailable, crossPageAll]);
`,
    `  // Contagem
  const { counts, isLoading: countsLoading } = useEntityCounts(ENTITY ? [ENTITY] : []);
  const totalCount = Number((counts && counts[ENTITY]) || 0);
`,
    'visualizer countsUnavailable hook',
  );

  result = peelOnce(
    result,
    `    if (crossPageAll && !countKnown) {
      await auditCadastroEvent("Bloqueio", "Exclusao em lote bloqueada: contagem indisponivel", { sucesso: false, acao_sensivel: true });
      alert("Contagem indisponivel — nao e possivel excluir todas as paginas sem total confirmado.");
      return;
    }
    const effCount = crossPageAll
      ? Math.max(0, totalCount - deselectedIds.size)
      : selectedIds.size;
`,
    `    const effCount = crossPageAll
      ? Math.max(0, totalCount - deselectedIds.size)
      : selectedIds.size;
`,
    'visualizer delete-all countKnown guard',
  );

  result = peelOnce(
    result,
    `  }, [ENTITY, TITULO, crossPageAll, totalCount, countKnown, selectedIds, deselectedIds, readFilter, queryClient, items.length, deleteInContext, canDeleteCadastro, contextoValido, auditCadastroEvent]);
`,
    `  }, [ENTITY, TITULO, crossPageAll, totalCount, selectedIds, deselectedIds, readFilter, queryClient, items.length, deleteInContext, canDeleteCadastro, contextoValido, auditCadastroEvent]);
`,
    'visualizer delete deps countKnown',
  );

  result = peelOnce(
    result,
    `  const handleActivateCrossPage = useCallback(function() {
    if (!countKnown) return;
    setCrossPageAll(true); setDeselectedIds(new Set()); setSelectedIds(new Set());
  }, [countKnown]);
`,
    `  const handleActivateCrossPage = useCallback(function() {
    setCrossPageAll(true); setDeselectedIds(new Set()); setSelectedIds(new Set());
  }, []);
`,
    'visualizer activateCrossPage countKnown',
  );

  result = peelOnce(
    result,
    `  const effSelectedCount = (crossPageAll && countKnown) ? Math.max(0, totalCount - deselectedIds.size) : selectedIds.size;
  const showCrossPageBanner = countKnown && !crossPageAll && selectedIds.size > 0 && allPageSelected && totalCount > items.length;
`,
    `  const effSelectedCount = crossPageAll ? Math.max(0, totalCount - deselectedIds.size) : selectedIds.size;
  const showCrossPageBanner = !crossPageAll && selectedIds.size > 0 && allPageSelected && totalCount > items.length;
`,
    'visualizer cross-page banner countKnown',
  );

  result = peelOnce(
    result,
    `          <Badge
            variant="outline"
            className={"rounded-sm font-bold tabular-nums min-w-[32px] text-center " + (countsUnavailable ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-blue-50 text-blue-700 border-blue-200")}
            title={countsUnavailable ? "Contagem indisponível (erro de consulta — não é zero)" : undefined}
            data-counts-unavailable={countsUnavailable ? "true" : "false"}
          >
            {countsUnavailable
              ? <span aria-label="Contagem indisponível">—</span>
              : (countsLoading && totalCount === 0)
                ? <span className="animate-pulse text-[10px]">···</span>
                : totalCount.toLocaleString("pt-BR")}
          </Badge>
`,
    `          <Badge variant="outline" className="rounded-sm bg-blue-50 text-blue-700 border-blue-200 font-bold tabular-nums min-w-[32px] text-center">
            {(countsLoading && totalCount === 0)
              ? <span className="animate-pulse text-[10px]">···</span>
              : totalCount.toLocaleString("pt-BR")}
          </Badge>
`,
    'visualizer badge countsUnavailable',
  );

  result = peelOnce(
    result,
    `        <span>Pág. {page} · {items.length} exibidos · {countsUnavailable ? "total indisponível" : (totalCount + " total")}</span>
`,
    `        <span>Pág. {page} · {items.length} exibidos · {totalCount} total</span>
`,
    'visualizer footer countsUnavailable',
  );

  result = peelOnce(
    result,
    `  // Troca de empresa/grupo: fecha form, limpa seleção/cache de lista e invalida carga em voo.
  // lastGoodData zerado: erro/vazio do novo escopo não reutiliza linhas do tenant anterior.
  useEffect(function() {
    if (previousScopeRef.current === scopeKey) return;
    previousScopeRef.current = scopeKey;
    formScopeRef.current = null;
    lastGoodData.current = [];
    everLoadedRef.current = false;
    const reset = buildCadastroScopeSwitchReset({ formKey: 0 });
`,
    `  // Troca de empresa/grupo: fecha form, limpa seleção e invalida carga em voo (fail-closed multiempresa).
  useEffect(function() {
    if (previousScopeRef.current === scopeKey) return;
    previousScopeRef.current = scopeKey;
    formScopeRef.current = null;
    const reset = buildCadastroScopeSwitchReset({ formKey: 0 });
`,
    'scope list-cache hunk',
  );

  return result;
}
