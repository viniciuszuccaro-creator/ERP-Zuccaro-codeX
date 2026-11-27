import assert from 'node:assert/strict';

// Project only the reviewed catalog hunks before older byte-preservation checks.
const hunks = {
  "server/src/api/router.ts": [
    {
      "before": "  router.get('/api/v1/produtos', requireTenantScope, async (req, res, next) => {\n    try {\n      const forOperation=parseProdutoOperation(req.query.operacao);\n      if(forOperation)res.setHeader('Cache-Control','no-store');\n      const ativoParam = req.query.ativo;\n      const ativo = ativoParam == null\n",
      "after": "  router.get('/api/v1/produtos', requireTenantScope, async (req, res, next) => {\n    try {\n      const forOperation=parseProdutoOperation(req.query.operacao);\n      const catalogo = req.query.catalogo;\n      if (catalogo !== undefined && catalogo !== 'true' && catalogo !== 'false')\n        throw new AppError(422, 'VALIDATION_ERROR', 'catalogo must be true or false');\n      const forCatalog = catalogo === 'true';\n      if (forCatalog && forOperation)\n        throw new AppError(422, 'VALIDATION_ERROR', 'catalogo and operacao are mutually exclusive');\n      if(forOperation)res.setHeader('Cache-Control','no-store');\n      const ativoParam = req.query.ativo;\n      const ativo = ativoParam == null\n"
    },
    {
      "before": "        : ['1', 'true', 'yes'].includes(String(ativoParam).toLowerCase());\n      const page = await service.list(ctxFromReq(req), {\n        forOperation,\n        ativo,\n        search: req.query.search ? String(req.query.search) : undefined,\n        codigo: req.query.codigo ? String(req.query.codigo) : undefined,\n",
      "after": "        : ['1', 'true', 'yes'].includes(String(ativoParam).toLowerCase());\n      const page = await service.list(ctxFromReq(req), {\n        forOperation,\n        forCatalog,\n        ativo,\n        search: req.query.search ? String(req.query.search) : undefined,\n        codigo: req.query.codigo ? String(req.query.codigo) : undefined,\n"
    }
  ],
  "src/api/httpApiClient.js": [
    {
      "before": "      });\n      return {\n        ...base,\n        variantes: relationRoutes('variantes'),\n        empresaOperacao: {\n          /** @param {string} produtoId @param {{signal?:AbortSignal}} [options] */\n",
      "after": "      });\n      return {\n        ...base,\n        /** @param {{search?:string,limit:number,offset:number,signal?:AbortSignal}} page */\n        listCatalogPage({ search, limit, offset, signal }) {\n          return request('/api/v1/produtos', { query: { catalogo: true, search, limit, offset }, signal, unwrap: false });\n        },\n        variantes: relationRoutes('variantes'),\n        empresaOperacao: {\n          /** @param {string} produtoId @param {{signal?:AbortSignal}} [options] */\n"
    }
  ],
  "src/components/cadastros/VisualizadorUniversalEntidadeV24.jsx": [
    {
      "before": "  base44,\n  erpBackendMode,\n  isHttpBackendMode,\n  isHttpClienteListMode,\n  isLocalOnlyMode,\n} from \"@/api/base44Client\";\n",
      "after": "  base44,\n  erpBackendMode,\n  isHttpBackendMode,\n  isHttpProdutoEnabled,\n  getHttpProdutoApi,\n  isHttpClienteListMode,\n  isLocalOnlyMode,\n} from \"@/api/base44Client\";\n"
    },
    {
      "before": "  const ENTITY   = nomeEntidade || entityName || \"\";\n  const TITULO   = tituloDisplay || ENTITY;\n  const fornecedorHttp = ENTITY === \"Fornecedor\" && isHttpBackendMode && import.meta.env.VITE_ERP_HTTP_FORNECEDOR_READ === 'true';\n  const FormComponent = fornecedorHttp ? null : (FormComponentProp || DEFAULT_FORM_COMPONENTS[ENTITY] || null);\n  const _camposPrincipais = camposPrincipais || [];\n  const _extraColors      = extraColors || {};\n  const _pageSizeProp     = pageSizeProp || 20;\n",
      "after": "  const ENTITY   = nomeEntidade || entityName || \"\";\n  const TITULO   = tituloDisplay || ENTITY;\n  const fornecedorHttp = ENTITY === \"Fornecedor\" && isHttpBackendMode && import.meta.env.VITE_ERP_HTTP_FORNECEDOR_READ === 'true';\n  const produtoHttp = ENTITY === \"Produto\" && isHttpProdutoEnabled;\n  const canonicalRead = fornecedorHttp || produtoHttp;\n  const FormComponent = canonicalRead ? null : (FormComponentProp || DEFAULT_FORM_COMPONENTS[ENTITY] || null);\n  const _camposPrincipais = camposPrincipais || [];\n  const _extraColors      = extraColors || {};\n  const _pageSizeProp     = pageSizeProp || 20;\n"
    },
    {
      "before": "    isLoading: permissionsLoading,\n  };\n  const canViewCadastro = hasCadastroEntityPermission(ENTITY, \"visualizar\", permCheckers);\n  const canCreateCadastro = hasCadastroEntityPermission(ENTITY, \"criar\", permCheckers);\n  const canEditCadastro = hasCadastroEntityPermission(ENTITY, \"editar\", permCheckers);\n  const canDeleteCadastro = hasCadastroEntityPermission(ENTITY, \"excluir\", permCheckers);\n  const [supplierEpoch, setSupplierEpoch] = useState(0);\n  const [supplierDetail, setSupplierDetail] = useState(null);\n  const supplierSession = fornecedorHttp ? readErpHttpSession() : null;\n  const supplierMatches = Boolean(supplierSession?.actorId && supplierSession.groupId === groupId &&\n    (supplierSession.empresaId || null) === empresaId);\n  const supplierScope = JSON.stringify([supplierSession?.actorId, groupId, empresaId, supplierEpoch]);\n",
      "after": "    isLoading: permissionsLoading,\n  };\n  const canViewCadastro = hasCadastroEntityPermission(ENTITY, \"visualizar\", permCheckers);\n  const canCreateCadastro = !produtoHttp && hasCadastroEntityPermission(ENTITY, \"criar\", permCheckers);\n  const canEditCadastro = !produtoHttp && hasCadastroEntityPermission(ENTITY, \"editar\", permCheckers);\n  const canDeleteCadastro = !produtoHttp && hasCadastroEntityPermission(ENTITY, \"excluir\", permCheckers);\n  const [supplierEpoch, setSupplierEpoch] = useState(0);\n  const [supplierDetail, setSupplierDetail] = useState(null);\n  const supplierSession = canonicalRead ? readErpHttpSession() : null;\n  const supplierMatches = Boolean(supplierSession?.actorId && supplierSession.groupId === groupId &&\n    (supplierSession.empresaId || null) === empresaId);\n  const supplierScope = JSON.stringify([supplierSession?.actorId, groupId, empresaId, supplierEpoch]);\n"
    },
    {
      "before": "        (current.empresaId || null) !== empresaId) throw new Error('CONTEXT_CHANGED');\n  };\n  useEffect(() => {\n    if (!fornecedorHttp) return;\n    const reset = () => { setSupplierEpoch(value => value + 1); setSupplierDetail(null); };\n    window.addEventListener(HTTP_CONTEXT_CHANGED, reset);\n    return () => window.removeEventListener(HTTP_CONTEXT_CHANGED, reset);\n  }, [fornecedorHttp]);\n  const showSupplierDetail = fornecedorHttp && supplierMatches && canViewCadastro && supplierDetail?.scope === supplierScope;\n  const supplierDetailQuery = useQuery({\n    queryKey: ['fornecedor-http-detalhe', supplierScope, supplierDetail?.id],\n",
      "after": "        (current.empresaId || null) !== empresaId) throw new Error('CONTEXT_CHANGED');\n  };\n  useEffect(() => {\n    if (!canonicalRead) return;\n    const reset = () => { setSupplierEpoch(value => value + 1); setSupplierDetail(null); };\n    window.addEventListener(HTTP_CONTEXT_CHANGED, reset);\n    return () => window.removeEventListener(HTTP_CONTEXT_CHANGED, reset);\n  }, [canonicalRead]);\n  const showSupplierDetail = fornecedorHttp && supplierMatches && canViewCadastro && supplierDetail?.scope === supplierScope;\n  const supplierDetailQuery = useQuery({\n    queryKey: ['fornecedor-http-detalhe', supplierScope, supplierDetail?.id],\n"
    },
    {
      "before": "  }, [search]);\n\n  // Contagem — erro ≠ zero; loading ≠ 0: total desconhecido até number validado (Codex P1 a9948387).\n  const { counts, isLoading: countsLoading, countsUnavailable: legacyCountsUnavailable } = useEntityCounts(ENTITY && !fornecedorHttp ? [ENTITY] : []);\n  const countsUnavailable = fornecedorHttp || legacyCountsUnavailable;\n  const rawEntityCount = counts && Object.prototype.hasOwnProperty.call(counts, ENTITY)\n    ? counts[ENTITY]\n    : undefined;\n",
      "after": "  }, [search]);\n\n  // Contagem — erro ≠ zero; loading ≠ 0: total desconhecido até number validado (Codex P1 a9948387).\n  const { counts, isLoading: countsLoading, countsUnavailable: legacyCountsUnavailable } = useEntityCounts(ENTITY && !canonicalRead ? [ENTITY] : []);\n  const countsUnavailable = canonicalRead || legacyCountsUnavailable;\n  const rawEntityCount = counts && Object.prototype.hasOwnProperty.call(counts, ENTITY)\n    ? counts[ENTITY]\n    : undefined;\n"
    },
    {
      "before": "  const queryKey = useMemo(\n    function() {\n      const legacyKey = [\"viz-v33\", ENTITY, sortField, sortDir, page, pageSize, debouncedSearch, empresaId, groupId];\n      return fornecedorHttp ? [...legacyKey, supplierScope] : legacyKey;\n    },\n    [ENTITY, sortField, sortDir, page, pageSize, debouncedSearch, empresaId, groupId, fornecedorHttp, supplierScope]\n  );\n  const visibleScope = JSON.stringify([ENTITY, groupId, empresaId, debouncedSearch, fornecedorHttp ? supplierScope : null]);\n  // Limpa cache no render ao trocar tenant/busca — evita um frame com linhas do contexto anterior.\n  if (lastGoodScope.current !== visibleScope) {\n    lastGoodScope.current = visibleScope;\n",
      "after": "  const queryKey = useMemo(\n    function() {\n      const legacyKey = [\"viz-v33\", ENTITY, sortField, sortDir, page, pageSize, debouncedSearch, empresaId, groupId];\n      return canonicalRead ? [...legacyKey, supplierScope] : legacyKey;\n    },\n    [ENTITY, sortField, sortDir, page, pageSize, debouncedSearch, empresaId, groupId, canonicalRead, supplierScope]\n  );\n  const visibleScope = JSON.stringify([ENTITY, groupId, empresaId, debouncedSearch, canonicalRead ? supplierScope : null]);\n  // Limpa cache no render ao trocar tenant/busca — evita um frame com linhas do contexto anterior.\n  if (lastGoodScope.current !== visibleScope) {\n    lastGoodScope.current = visibleScope;\n"
    },
    {
      "before": "\n  // ── query principal ──────────────────────────────────────────────────────────\n  // placeholderData garante que a lista NÃO desaparece durante sort/paginação/exclusão\n  const { data: rawItems, isFetching, isError, status } = useQuery({\n    queryKey: queryKey,\n    queryFn: async function({ signal }) {\n      if (!ENTITY) return [];\n      if (fornecedorHttp) {\n        assertSupplierScope();\n        const result = await fornecedorReadApi.list({ search: debouncedSearch?.trim(), limit: pageSize, offset: skip, signal });\n",
      "after": "\n  // ── query principal ──────────────────────────────────────────────────────────\n  // placeholderData garante que a lista NÃO desaparece durante sort/paginação/exclusão\n  const { data: rawItems, isFetching, isError, status, error: listError } = useQuery({\n    queryKey: queryKey,\n    queryFn: async function({ signal }) {\n      if (!ENTITY) return [];\n      if (produtoHttp) {\n        assertSupplierScope();\n        const result = await getHttpProdutoApi().listCatalogPage({\n          search: debouncedSearch?.trim(), limit: pageSize, offset: skip, signal,\n        });\n        assertSupplierScope();\n        if (signal?.aborted) throw new DOMException('Consulta cancelada', 'AbortError');\n        const { data, meta } = result || {};\n        if (!Array.isArray(data) || !Number.isSafeInteger(meta?.total) || meta.total < 0 ||\n            typeof meta.hasMore !== 'boolean') throw new Error('PRODUTO_PAGE_INVALID');\n        return { items: data, total: meta.total, hasMore: meta.hasMore };\n      }\n      if (fornecedorHttp) {\n        assertSupplierScope();\n        const result = await fornecedorReadApi.list({ search: debouncedSearch?.trim(), limit: pageSize, offset: skip, signal });\n"
    },
    {
      "before": "    refetchOnWindowFocus: false,\n    refetchOnMount: 'always',\n    placeholderData: function(prev, previousQuery) {\n      if (fornecedorHttp) return undefined;\n      return getScopedCadastroPlaceholder(prev, previousQuery?.queryKey, queryKey);\n    },\n    // HTTP + Cliente sem piloto: não consultar store local (evita lista vazia como “sucesso”).\n    enabled: !!ENTITY && contextoValido && canViewCadastro && !clienteHttpSemPiloto && (!fornecedorHttp || supplierMatches),\n  });\n\n  // items: estabilidade total — nunca desaparece durante sort/paginação/exclusão\n  const items = useMemo(function() {\n    if (fornecedorHttp) return supplierMatches && canViewCadastro && Array.isArray(rawItems?.items) ? rawItems.items : [];\n    const arr = Array.isArray(rawItems) ? rawItems : [];\n    if (arr.length > 0) {\n      lastGoodData.current = arr;\n",
      "after": "    refetchOnWindowFocus: false,\n    refetchOnMount: 'always',\n    placeholderData: function(prev, previousQuery) {\n      if (canonicalRead) return undefined;\n      return getScopedCadastroPlaceholder(prev, previousQuery?.queryKey, queryKey);\n    },\n    // HTTP + Cliente sem piloto: não consultar store local (evita lista vazia como “sucesso”).\n    enabled: !!ENTITY && contextoValido && canViewCadastro && !clienteHttpSemPiloto && (!canonicalRead || supplierMatches),\n  });\n  const produtoTotal = produtoHttp && supplierMatches && canViewCadastro && !isError ? rawItems?.total : undefined;\n\n  // items: estabilidade total — nunca desaparece durante sort/paginação/exclusão\n  const items = useMemo(function() {\n    if (canonicalRead) return supplierMatches && canViewCadastro && Array.isArray(rawItems?.items) ? rawItems.items : [];\n    const arr = Array.isArray(rawItems) ? rawItems : [];\n    if (arr.length > 0) {\n      lastGoodData.current = arr;\n"
    },
    {
      "before": "    everLoadedRef.current = true;\n    lastGoodData.current = [];\n    return [];\n  }, [rawItems, isFetching, isError, status, fornecedorHttp, supplierMatches, canViewCadastro]);\n\n  // Reset do cache quando muda de entidade, empresa, grupo ou busca\n  // NÃO reseta ao mudar sort/page para manter estabilidade visual\n",
      "after": "    everLoadedRef.current = true;\n    lastGoodData.current = [];\n    return [];\n  }, [rawItems, isFetching, isError, status, canonicalRead, supplierMatches, canViewCadastro]);\n\n  // Reset do cache quando muda de entidade, empresa, grupo ou busca\n  // NÃO reseta ao mudar sort/page para manter estabilidade visual\n"
    },
    {
      "before": "                <th\n                  key={col.field}\n                  className={\"px-3 py-2.5 text-left font-semibold text-slate-600 whitespace-nowrap select-none\" + (col.sortable !== false ? \" cursor-pointer hover:bg-slate-100 transition-colors\" : \"\")}\n                  onClick={function() { if (col.sortable !== false) handleSort(col.field); }}\n                >\n                  <div className=\"flex items-center gap-1\">\n                    <span>{col.label}</span>\n",
      "after": "                <th\n                  key={col.field}\n                  className={\"px-3 py-2.5 text-left font-semibold text-slate-600 whitespace-nowrap select-none\" + (col.sortable !== false ? \" cursor-pointer hover:bg-slate-100 transition-colors\" : \"\")}\n                  onClick={function() { if (!produtoHttp && col.sortable !== false) handleSort(col.field); }}\n                >\n                  <div className=\"flex items-center gap-1\">\n                    <span>{col.label}</span>\n"
    },
    {
      "before": "            title={countsUnavailable ? \"Contagem indisponível (erro de consulta — não é zero)\" : undefined}\n            data-counts-unavailable={countsUnavailable ? \"true\" : \"false\"}\n          >\n            {countsUnavailable\n              ? <span aria-label=\"Contagem indisponível\">—</span>\n              : !countKnown\n                ? <span className=\"animate-pulse text-[10px]\" data-counts-unknown-during-load=\"true\" aria-label=\"Contagem carregando\">···</span>\n",
      "after": "            title={countsUnavailable ? \"Contagem indisponível (erro de consulta — não é zero)\" : undefined}\n            data-counts-unavailable={countsUnavailable ? \"true\" : \"false\"}\n          >\n            {produtoTotal !== undefined ? produtoTotal.toLocaleString(\"pt-BR\") : countsUnavailable\n              ? <span aria-label=\"Contagem indisponível\">—</span>\n              : !countKnown\n                ? <span className=\"animate-pulse text-[10px]\" data-counts-unknown-during-load=\"true\" aria-label=\"Contagem carregando\">···</span>\n"
    },
    {
      "before": "          {PAGE_SIZES.map(function(ps) { return <option key={ps} value={ps}>{ps}/pág</option>; })}\n        </select>\n\n        {!fornecedorHttp && <select\n          value={sortField + \"|\" + sortDir}\n          onChange={function(e) { handleSortDropdown(e.target.value); }}\n          className=\"border border-slate-200 rounded-sm h-9 px-2 text-sm text-slate-700 bg-white cursor-pointer shrink-0\"\n",
      "after": "          {PAGE_SIZES.map(function(ps) { return <option key={ps} value={ps}>{ps}/pág</option>; })}\n        </select>\n\n        {!canonicalRead && <select\n          value={sortField + \"|\" + sortDir}\n          onChange={function(e) { handleSortDropdown(e.target.value); }}\n          className=\"border border-slate-200 rounded-sm h-9 px-2 text-sm text-slate-700 bg-white cursor-pointer shrink-0\"\n"
    },
    {
      "before": "          </button>\n        </div>\n      )}\n      {fornecedorHttp && !supplierMatches && (\n        <p role=\"alert\" className=\"text-sm text-amber-800\">Aguarde a confirmação do contexto para consultar fornecedores.</p>\n      )}\n      {/* Paginação */}\n      <div className=\"flex items-center justify-between text-xs text-slate-500 shrink-0 flex-wrap gap-1\">\n        <span>\n          Pág. {page} · {items.length} exibidos ·{\" \"}\n          {countsUnavailable\n            ? \"total indisponível\"\n            : !countKnown\n              ? \"total …\"\n",
      "after": "          </button>\n        </div>\n      )}\n      {canonicalRead && !supplierMatches && (\n        <p role=\"alert\" className=\"text-sm text-amber-800\">Aguarde a confirmação do contexto para consultar {produtoHttp ? \"produtos\" : \"fornecedores\"}.</p>\n      )}\n      {produtoHttp && isError && (\n        <p role=\"alert\" className=\"text-sm text-amber-800\">{listError && 'status' in listError && listError.status === 403 ? \"Acesso negado à consulta de Produtos.\" : \"Consulta de Produtos indisponível.\"}</p>\n      )}\n      {/* Paginação */}\n      <div className=\"flex items-center justify-between text-xs text-slate-500 shrink-0 flex-wrap gap-1\">\n        <span>\n          Pág. {page} · {items.length} exibidos ·{\" \"}\n          {produtoTotal !== undefined ? produtoTotal + \" total\" : countsUnavailable\n            ? \"total indisponível\"\n            : !countKnown\n              ? \"total …\"\n"
    },
    {
      "before": "          <button\n            type=\"button\"\n            onClick={function() { setPage(function(p) { return p + 1; }); }}\n            disabled={(fornecedorHttp ? !rawItems?.hasMore : items.length < pageSize) || isFetching}\n            className=\"h-7 px-2 border border-slate-200 rounded-sm bg-white hover:bg-slate-50 disabled:opacity-40\"\n            data-action={`Cadastros.${ENTITY}.proxima-pagina`}\n          >Próx. →</button>\n",
      "after": "          <button\n            type=\"button\"\n            onClick={function() { setPage(function(p) { return p + 1; }); }}\n            disabled={(canonicalRead ? !rawItems?.hasMore : items.length < pageSize) || isFetching}\n            className=\"h-7 px-2 border border-slate-200 rounded-sm bg-white hover:bg-slate-50 disabled:opacity-40\"\n            data-action={`Cadastros.${ENTITY}.proxima-pagina`}\n          >Próx. →</button>\n"
    }
  ]
};

const markers = {
  'server/src/api/router.ts': 'const forCatalog',
  'src/api/httpApiClient.js': 'listCatalogPage',
  'src/components/cadastros/VisualizadorUniversalEntidadeV24.jsx': 'const produtoHttp',
};

const clientePageHunks = {
  "src/api/base44Client.js": [
    {
      "before": "              filter.search = String(payload.search).trim();\n            }\n            return runLocalEntityReadFunction(name, { ...payload, filter }, {\n              expandFilter: (_entity, nextFilter) => nextFilter || {},\n              listEntity: async (entity, nextFilter, order, limit, skip) => {\n                const rows = await http.entities[entity].filter(nextFilter, order, limit, skip);\n                return Array.isArray(rows) ? rows : [];\n              },\n            });\n          }\n        }\n",
      "after": "              filter.search = String(payload.search).trim();\n            }\n            const clientePage = name === 'entityListSorted' && entityName === 'Cliente' && payload.includePageMeta === true;\n            let meta;\n            const result = await runLocalEntityReadFunction(name, { ...payload, filter }, {\n              expandFilter: (_entity, nextFilter) => nextFilter || {},\n              listEntity: async (entity, nextFilter, order, limit, skip) => {\n                if (clientePage) {\n                  const page = await http.entities.Cliente.filterPage(nextFilter, order, limit, skip, payload.signal);\n                  meta = page.meta;\n                  return page.data;\n                }\n                const rows = await http.entities[entity].filter(nextFilter, order, limit, skip);\n                return Array.isArray(rows) ? rows : [];\n              },\n            });\n            return clientePage ? { ...result, meta } : result;\n          }\n        }\n"
    }
  ],
  "src/api/httpApiClient.js": [
    {
      "before": "    const searchKeys = opts.searchKeys || ['search', 'nome', 'descricao'];\n    const ativoKeys = opts.ativoKeys || ['ativo', 'ativa'];\n    async function readFilterPage(query = {}, orderBy, limit = 100, skip = 0, unwrap = true) {\n        if (typeof orderBy === 'number') {\n          skip = limit || 0;\n",
      "after": "    const searchKeys = opts.searchKeys || ['search', 'nome', 'descricao'];\n    const ativoKeys = opts.ativoKeys || ['ativo', 'ativa'];\n    async function readFilterPage(query = {}, orderBy, limit = 100, skip = 0, unwrap = true, signal) {\n        if (typeof orderBy === 'number') {\n          skip = limit || 0;\n"
    },
    {
      "before": "          query: { limit, offset, search, ativo: ativoQuery, ...exact, ...normalizeOrderByQuery(orderBy) },\n          unwrap,\n        });\n    }\n",
      "after": "          query: { limit, offset, search, ativo: ativoQuery, ...exact, ...normalizeOrderByQuery(orderBy) },\n          unwrap,\n          signal,\n        });\n    }\n"
    },
    {
      "before": "        return total;\n      },\n      async get(id) {\n        return request(`${basePath}/${encodeURIComponent(id)}`);\n",
      "after": "        return total;\n      },\n      filterPage(query, orderBy, limit, skip, signal) {\n        return readFilterPage(query, orderBy, limit, skip, false, signal);\n      },\n      async get(id) {\n        return request(`${basePath}/${encodeURIComponent(id)}`);\n"
    },
    {
      "before": "          return Array.isArray(rows) ? rows.map(hydrateClienteHttpRowForUi) : rows;\n        },\n        async create(data) {\n          return hydrateClienteHttpRowForUi(\n",
      "after": "          return Array.isArray(rows) ? rows.map(hydrateClienteHttpRowForUi) : rows;\n        },\n        async filterPage(query, orderBy, limit, skip, signal) {\n          const page = await base.filterPage(query, orderBy, limit, skip, signal);\n          if (!Array.isArray(page?.data) || !Number.isSafeInteger(page.meta?.total) ||\n              page.meta.total < page.data.length || typeof page.meta.hasMore !== 'boolean') {\n            throw new Error('CLIENTE_PAGE_INVALID');\n          }\n          return { data: page.data.map(hydrateClienteHttpRowForUi), meta: page.meta };\n        },\n        async create(data) {\n          return hydrateClienteHttpRowForUi(\n"
    }
  ],
  "src/components/cadastros/VisualizadorUniversalEntidadeV24.jsx": [
    {
      "before": "  const clienteHttpSemPiloto =\n    ENTITY === \"Cliente\" && isHttpBackendMode && !isHttpClienteListMode;\n  /** Modo local puro: store local explícito (≠ HML). */\n  const clienteFonteLocalOnly =\n",
      "after": "  const clienteHttpSemPiloto =\n    ENTITY === \"Cliente\" && isHttpBackendMode && !isHttpClienteListMode;\n  const clienteHttpPage = ENTITY === \"Cliente\" && isHttpClienteListMode;\n  /** Modo local puro: store local explícito (≠ HML). */\n  const clienteFonteLocalOnly =\n"
    },
    {
      "before": "  const [supplierEpoch, setSupplierEpoch] = useState(0);\n  const [supplierDetail, setSupplierDetail] = useState(null);\n  const supplierSession = canonicalRead ? readErpHttpSession() : null;\n  const supplierMatches = Boolean(supplierSession?.actorId && supplierSession.groupId === groupId &&\n    (supplierSession.empresaId || null) === empresaId);\n",
      "after": "  const [supplierEpoch, setSupplierEpoch] = useState(0);\n  const [supplierDetail, setSupplierDetail] = useState(null);\n  const scopedPageRead = canonicalRead || clienteHttpPage;\n  const supplierSession = scopedPageRead ? readErpHttpSession() : null;\n  const supplierMatches = Boolean(supplierSession?.actorId && supplierSession.groupId === groupId &&\n    (supplierSession.empresaId || null) === empresaId);\n"
    },
    {
      "before": "  };\n  useEffect(() => {\n    if (!canonicalRead) return;\n    const reset = () => { setSupplierEpoch(value => value + 1); setSupplierDetail(null); };\n    window.addEventListener(HTTP_CONTEXT_CHANGED, reset);\n    return () => window.removeEventListener(HTTP_CONTEXT_CHANGED, reset);\n  }, [canonicalRead]);\n  const showSupplierDetail = fornecedorHttp && supplierMatches && canViewCadastro && supplierDetail?.scope === supplierScope;\n  const supplierDetailQuery = useQuery({\n",
      "after": "  };\n  useEffect(() => {\n    if (!scopedPageRead) return;\n    const reset = () => { setSupplierEpoch(value => value + 1); setSupplierDetail(null); };\n    window.addEventListener(HTTP_CONTEXT_CHANGED, reset);\n    return () => window.removeEventListener(HTTP_CONTEXT_CHANGED, reset);\n  }, [scopedPageRead]);\n  const showSupplierDetail = fornecedorHttp && supplierMatches && canViewCadastro && supplierDetail?.scope === supplierScope;\n  const supplierDetailQuery = useQuery({\n"
    },
    {
      "before": "    function() {\n      const legacyKey = [\"viz-v33\", ENTITY, sortField, sortDir, page, pageSize, debouncedSearch, empresaId, groupId];\n      return canonicalRead ? [...legacyKey, supplierScope] : legacyKey;\n    },\n    [ENTITY, sortField, sortDir, page, pageSize, debouncedSearch, empresaId, groupId, canonicalRead, supplierScope]\n  );\n  const visibleScope = JSON.stringify([ENTITY, groupId, empresaId, debouncedSearch, canonicalRead ? supplierScope : null]);\n  // Limpa cache no render ao trocar tenant/busca — evita um frame com linhas do contexto anterior.\n  if (lastGoodScope.current !== visibleScope) {\n",
      "after": "    function() {\n      const legacyKey = [\"viz-v33\", ENTITY, sortField, sortDir, page, pageSize, debouncedSearch, empresaId, groupId];\n      return scopedPageRead ? [...legacyKey, supplierScope] : legacyKey;\n    },\n    [ENTITY, sortField, sortDir, page, pageSize, debouncedSearch, empresaId, groupId, scopedPageRead, supplierScope]\n  );\n  const visibleScope = JSON.stringify([ENTITY, groupId, empresaId, debouncedSearch, scopedPageRead ? supplierScope : null]);\n  // Limpa cache no render ao trocar tenant/busca — evita um frame com linhas do contexto anterior.\n  if (lastGoodScope.current !== visibleScope) {\n"
    },
    {
      "before": "        return result;\n      }\n      const res = await base44.functions.invoke(\"entityListSorted\", {\n        entityName: ENTITY,\n",
      "after": "        return result;\n      }\n      if (clienteHttpPage) assertSupplierScope();\n      const res = await base44.functions.invoke(\"entityListSorted\", {\n        entityName: ENTITY,\n"
    },
    {
      "before": "        limit: pageSize,\n        skip: skip,\n      });\n      return Array.isArray(res && res.data) ? res.data : [];\n    },\n",
      "after": "        limit: pageSize,\n        skip: skip,\n        ...(clienteHttpPage ? { includePageMeta: true, signal } : {}),\n      });\n      if (clienteHttpPage) {\n        assertSupplierScope();\n        if (signal?.aborted) throw new DOMException('Consulta cancelada', 'AbortError');\n        if (!Array.isArray(res?.data) || !Number.isSafeInteger(res.meta?.total) ||\n            res.meta.total < res.data.length || typeof res.meta.hasMore !== 'boolean') throw new Error('CLIENTE_PAGE_INVALID');\n        return { items: res.data, total: res.meta.total, hasMore: res.meta.hasMore };\n      }\n      return Array.isArray(res && res.data) ? res.data : [];\n    },\n"
    },
    {
      "before": "    refetchOnMount: 'always',\n    placeholderData: function(prev, previousQuery) {\n      if (canonicalRead) return undefined;\n      return getScopedCadastroPlaceholder(prev, previousQuery?.queryKey, queryKey);\n    },\n    // HTTP + Cliente sem piloto: não consultar store local (evita lista vazia como “sucesso”).\n    enabled: !!ENTITY && contextoValido && canViewCadastro && !clienteHttpSemPiloto && (!canonicalRead || supplierMatches),\n  });\n  const produtoTotal = produtoHttp && supplierMatches && canViewCadastro && !isError ? rawItems?.total : undefined;\n\n  // items: estabilidade total — nunca desaparece durante sort/paginação/exclusão\n  const items = useMemo(function() {\n    if (canonicalRead) return supplierMatches && canViewCadastro && Array.isArray(rawItems?.items) ? rawItems.items : [];\n    const arr = Array.isArray(rawItems) ? rawItems : [];\n    if (arr.length > 0) {\n",
      "after": "    refetchOnMount: 'always',\n    placeholderData: function(prev, previousQuery) {\n      if (scopedPageRead) return undefined;\n      return getScopedCadastroPlaceholder(prev, previousQuery?.queryKey, queryKey);\n    },\n    // HTTP + Cliente sem piloto: não consultar store local (evita lista vazia como “sucesso”).\n    enabled: !!ENTITY && contextoValido && canViewCadastro && !clienteHttpSemPiloto && (!scopedPageRead || supplierMatches),\n  });\n  const produtoTotal = produtoHttp && supplierMatches && canViewCadastro && !isError ? rawItems?.total : undefined;\n  const clientePageTotal = clienteHttpPage && supplierMatches && canViewCadastro && !isError ? rawItems?.total : undefined;\n\n  // items: estabilidade total — nunca desaparece durante sort/paginação/exclusão\n  const items = useMemo(function() {\n    if (scopedPageRead) return supplierMatches && canViewCadastro && Array.isArray(rawItems?.items) ? rawItems.items : [];\n    const arr = Array.isArray(rawItems) ? rawItems : [];\n    if (arr.length > 0) {\n"
    },
    {
      "before": "    lastGoodData.current = [];\n    return [];\n  }, [rawItems, isFetching, isError, status, canonicalRead, supplierMatches, canViewCadastro]);\n\n  // Reset do cache quando muda de entidade, empresa, grupo ou busca\n",
      "after": "    lastGoodData.current = [];\n    return [];\n  }, [rawItems, isFetching, isError, status, scopedPageRead, supplierMatches, canViewCadastro]);\n\n  // Reset do cache quando muda de entidade, empresa, grupo ou busca\n"
    },
    {
      "before": "      );\n    }\n    if (items.length === 0 && !isFetching) {\n      let emptyMsg = debouncedSearch\n",
      "after": "      );\n    }\n    if (scopedPageRead && !supplierMatches) {\n      return <p role=\"status\" className=\"p-4\" data-fonte-estado=\"aguardando-contexto\">Aguarde a confirmação do contexto.</p>;\n    }\n    if (clienteHttpPage && status === 'pending') {\n      return <p role=\"status\" className=\"p-4\">Aguardando a consulta de Clientes.</p>;\n    }\n    if (items.length === 0 && !isFetching) {\n      let emptyMsg = debouncedSearch\n"
    },
    {
      "before": "        </div>\n      )}\n      {canonicalRead && !supplierMatches && (\n        <p role=\"alert\" className=\"text-sm text-amber-800\">Aguarde a confirmação do contexto para consultar {produtoHttp ? \"produtos\" : \"fornecedores\"}.</p>\n      )}\n      {produtoHttp && isError && (\n        <p role=\"alert\" className=\"text-sm text-amber-800\">{listError && 'status' in listError && listError.status === 403 ? \"Acesso negado à consulta de Produtos.\" : \"Consulta de Produtos indisponível.\"}</p>\n",
      "after": "        </div>\n      )}\n      {produtoHttp && isError && (\n        <p role=\"alert\" className=\"text-sm text-amber-800\">{listError && 'status' in listError && listError.status === 403 ? \"Acesso negado à consulta de Produtos.\" : \"Consulta de Produtos indisponível.\"}</p>\n"
    },
    {
      "before": "        <span>\n          Pág. {page} · {items.length} exibidos ·{\" \"}\n          {produtoTotal !== undefined ? produtoTotal + \" total\" : countsUnavailable\n            ? \"total indisponível\"\n            : !countKnown\n",
      "after": "        <span>\n          Pág. {page} · {items.length} exibidos ·{\" \"}\n          {scopedPageRead && !supplierMatches ? \"aguardando contexto\" : clienteHttpPage\n            ? clientePageTotal !== undefined ? clientePageTotal + \" total\" : isError ? \"total indisponível\" : \"total …\"\n            : produtoTotal !== undefined ? produtoTotal + \" total\" : countsUnavailable\n            ? \"total indisponível\"\n            : !countKnown\n"
    },
    {
      "before": "            type=\"button\"\n            onClick={function() { setPage(function(p) { return p + 1; }); }}\n            disabled={(canonicalRead ? !rawItems?.hasMore : items.length < pageSize) || isFetching}\n            className=\"h-7 px-2 border border-slate-200 rounded-sm bg-white hover:bg-slate-50 disabled:opacity-40\"\n            data-action={`Cadastros.${ENTITY}.proxima-pagina`}\n",
      "after": "            type=\"button\"\n            onClick={function() { setPage(function(p) { return p + 1; }); }}\n            disabled={(scopedPageRead ? !rawItems?.hasMore : items.length < pageSize) || isFetching}\n            className=\"h-7 px-2 border border-slate-200 rounded-sm bg-white hover:bg-slate-50 disabled:opacity-40\"\n            data-action={`Cadastros.${ENTITY}.proxima-pagina`}\n"
    }
  ]
};

export function produtoCatalogoRemainder(file, source) {
  const pageMarker = { 'src/api/base44Client.js': 'payload.includePageMeta === true',
    'src/api/httpApiClient.js': 'CLIENTE_PAGE_INVALID',
    'src/components/cadastros/VisualizadorUniversalEntidadeV24.jsx': 'const clienteHttpPage' };
  if (pageMarker[file] && source.includes(pageMarker[file])) {
    const crlf = source.includes('\r\n');
    let projected = source.replace(/\r\n/g, '\n');
    for (const { before, after } of clientePageHunks[file]) {
      assert.equal(projected.split(after).length, 2, `Exact Cliente page hunk: ${file}`);
      projected = projected.replace(after, () => before);
    }
    source = crlf ? projected.replace(/\n/g, '\r\n') : projected;
  }
  if (file === 'tests/perfil-pedido-contract-reconciliation.test.js' && source.includes('produtoHttp: false')) {
    const binding = "ENTITY: 'PerfilAcesso', produtoHttp: false, hasCadastroEntityPermission";
    assert.equal(source.split(binding).length, 2);
    return source.replace(binding, "ENTITY: 'PerfilAcesso', hasCadastroEntityPermission");
  }
  if (!markers[file] || !source.includes(markers[file])) return source;
  let result = source.replace(/\r\n/g, '\n');
  for (const { before, after } of hunks[file]) {
    assert.equal(result.split(after).length, 2, `Exact Produto catalog hunk: ${file}`);
    result = result.replace(after, () => before);
  }
  return result;
}
