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

  // #591 — origem lista Cliente (fonte local ≠ contagem API); peel → golden e36231b3.
  result = peelOnce(
    result,
    `import {
  base44,
  erpBackendMode,
  isHttpBackendMode,
  isHttpClienteListMode,
  isLocalOnlyMode,
} from "@/api/base44Client";
`,
    `import { base44 } from "@/api/base44Client";
`,
    'visualizer cliente fonte import',
  );

  result = peelOnce(
    result,
    `  // Fail-closed: catálogo "simples" tambem exige grupo/empresa para listar/salvar
  const contextoValido = !!(empresaId || groupId);
  /** Cliente: em HTTP, sem piloto ≠ fallback local silencioso (sucesso fictício). */
  const clienteHttpSemPiloto =
    ENTITY === "Cliente" && isHttpBackendMode && !isHttpClienteListMode;
  /** Modo local puro: store local explícito (≠ HML). */
  const clienteFonteLocalOnly =
    ENTITY === "Cliente" && isLocalOnlyMode;
  const clienteFonteLocal = clienteHttpSemPiloto || clienteFonteLocalOnly;
  const clientePilotoHttpOff = clienteHttpSemPiloto;
  const permCheckers = { hasPermission, canCreate, canEdit, canDelete, isLoading: permissionsLoading };
`,
    `  // Fail-closed: catálogo "simples" tambem exige grupo/empresa para listar/salvar
  const contextoValido = !!(empresaId || groupId);
  const permCheckers = { hasPermission, canCreate, canEdit, canDelete, isLoading: permissionsLoading };
`,
    'visualizer cliente fonte flags',
  );

  result = peelOnce(
    result,
    `    // HTTP + Cliente sem piloto: não consultar store local (evita lista vazia como “sucesso”).
    enabled: !!ENTITY && contextoValido && canViewCadastro && !clienteHttpSemPiloto,
`,
    `    enabled: !!ENTITY && contextoValido && canViewCadastro,
`,
    'visualizer cliente http enabled gate',
  );

  result = peelOnce(
    result,
    `    if (clienteHttpSemPiloto) {
      return (
        <div
          className="flex flex-col items-center justify-center h-40 text-amber-800 gap-2 px-4"
          data-fonte-estado="http-piloto-cliente-off"
          role="status"
        >
          <AlertCircle className="w-7 h-7 text-amber-600" />
          <span className="text-sm text-center font-medium">Fonte BFF indisponível para Cliente</span>
          <span className="text-xs text-center text-amber-700">
            Modo HTTP ativo, mas o piloto Cliente está desligado. A lista local/sintética não é usada — isto não é lista vazia nem erro de rede.
          </span>
        </div>
      );
    }
    if (!canViewCadastro) {
      return (
        <div className="flex flex-col items-center justify-center h-40 text-slate-500 gap-2" data-fonte-estado="sem-permissao" role="status">
          <AlertCircle className="w-7 h-7" />
          <span className="text-sm text-center">Sem permissão para visualizar este cadastro.</span>
        </div>
      );
    }
    if (isError && items.length === 0 && !isFetching) {
      return (
        <div className="flex flex-col items-center justify-center h-40 text-red-500 gap-2" data-fonte-estado="erro-api">
          <AlertCircle className="w-7 h-7" />
          <span className="text-sm">Erro ao carregar dados.</span>
          <button
            className="text-xs underline text-red-400"
            onClick={function() { lastGoodData.current = []; everLoadedRef.current = false; invalidateAll(queryClient, ENTITY); }}
          >
            Tentar novamente
          </button>
        </div>
      );
    }
    if (items.length === 0 && !isFetching) {
      let emptyMsg = debouncedSearch
        ? "Nenhum resultado para \\"" + debouncedSearch + "\\""
        : "Nenhum registro de " + TITULO;
      if (!debouncedSearch && clienteFonteLocalOnly) {
        emptyMsg = "Modo local — store local vazio. Não é a listagem da API HML.";
      }
      return (
        <div
          className="flex flex-col items-center justify-center h-40 text-slate-400 gap-2"
          data-fonte-estado={debouncedSearch ? "busca-vazia" : "lista-vazia"}
        >
          <Search className="w-7 h-7 opacity-30" />
          <span className="text-sm text-center px-4">{emptyMsg}</span>
        </div>
      );
    }
`,
    `    if (isError && items.length === 0 && !isFetching) {
      return (
        <div className="flex flex-col items-center justify-center h-40 text-red-500 gap-2">
          <AlertCircle className="w-7 h-7" />
          <span className="text-sm">Erro ao carregar dados.</span>
          <button
            className="text-xs underline text-red-400"
            onClick={function() { lastGoodData.current = []; everLoadedRef.current = false; invalidateAll(queryClient, ENTITY); }}
          >
            Tentar novamente
          </button>
        </div>
      );
    }
    if (items.length === 0 && !isFetching) {
      return (
        <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-2">
          <Search className="w-7 h-7 opacity-30" />
          <span className="text-sm">
            {debouncedSearch
              ? "Nenhum resultado para \\"" + debouncedSearch + "\\""
              : "Nenhum registro de " + TITULO}
          </span>
        </div>
      );
    }
`,
    'visualizer cliente empty fonte',
  );

  result = peelOnce(
    result,
    `      {!contextoValido && (
        <div className="bg-amber-50 border border-amber-200 rounded-sm px-3 py-2 text-xs text-amber-800 shrink-0">
          Selecione um grupo ou empresa para carregar, criar ou editar este cadastro no escopo correto.
        </div>
      )}
      {contextoValido && clienteHttpSemPiloto && (
        <div
          className="bg-amber-50 border border-amber-300 rounded-sm px-3 py-2 text-xs text-amber-950 shrink-0"
          data-fonte-dados="http-piloto-cliente-off"
          data-erp-backend={erpBackendMode}
        >
          Modo HTTP: piloto Cliente desligado — sem fallback local/sintético. Contagem da API ≠ aceite desta tela até ligar o piloto e a sessão autorizada.
        </div>
      )}
      {contextoValido && clienteFonteLocalOnly && (
        <div
          className="bg-sky-50 border border-sky-200 rounded-sm px-3 py-2 text-xs text-sky-900 shrink-0"
          data-fonte-dados="local-only"
          data-erp-backend={erpBackendMode}
        >
          Fonte desta lista: modo local. Contagem/API HML não alimenta este grid.
        </div>
      )}

      {/* Banner cross-page */}
`,
    `      {!contextoValido && (
        <div className="bg-amber-50 border border-amber-200 rounded-sm px-3 py-2 text-xs text-amber-800 shrink-0">
          Selecione um grupo ou empresa para carregar, criar ou editar este cadastro no escopo correto.
        </div>
      )}

      {/* Banner cross-page */}
`,
    'visualizer cliente fonte banner',
  );

  result = peelOnce(
    result,
    `  // Contagem — erro ≠ zero; loading ≠ 0: total desconhecido até number validado (Codex P1 a9948387).
  const { counts, isLoading: countsLoading, countsUnavailable } = useEntityCounts(ENTITY ? [ENTITY] : []);
  const rawEntityCount = counts && Object.prototype.hasOwnProperty.call(counts, ENTITY)
    ? counts[ENTITY]
    : undefined;
  const countKnown = !countsUnavailable
    && typeof rawEntityCount === "number"
    && Number.isSafeInteger(rawEntityCount)
    && rawEntityCount >= 0;
  const totalCount = countKnown ? rawEntityCount : null;

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
              : !countKnown
                ? <span className="animate-pulse text-[10px]" data-counts-unknown-during-load="true" aria-label="Contagem carregando">···</span>
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
    `        <span>
          Pág. {page} · {items.length} exibidos ·{" "}
          {countsUnavailable
            ? "total indisponível"
            : !countKnown
              ? "total …"
              : (totalCount + " total")}
        </span>
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
