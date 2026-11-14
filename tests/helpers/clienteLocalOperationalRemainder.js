import assert from 'node:assert/strict';

// Only the reviewed transport wiring is peeled; all ancestral pins remain intact.
export function clienteLocalOperationalRemainder(file, text) {
  let source = text.replace(/\r\n/g, '\n');
  const changes = file === 'src/api/httpApiClient.js' ? [
    ["import { createClienteLocalBatchHttpApi } from './clienteLocalBatchHttp.js';\n", ''],
    ['    ...createClienteLocalBatchHttpApi({ request, getScope, createHttpError }),\n', ''],
  ] : file === 'server/src/api/router.ts' ? [
    ['service.snapshot(ctxFromReq(req), req.params.clienteId, req.query.include_review === \'true\')',
      'service.snapshot(ctxFromReq(req), req.params.clienteId)'],
  ] : file === 'src/components/cadastros/CadastroClienteCompleto.jsx' ? [
    // Atomic syncLocais (Cursor) — peel before ENTREGA onOpenDraft.
    [
      '  syncClienteLocaisViaHttp,\n  syncClienteLocaisAtomicViaHttp,\n  buildClienteLocaisSyncOperations,\n  prepareClienteLocaisHttpDraft,\n',
      '  syncClienteLocaisViaHttp,\n  prepareClienteLocaisHttpDraft,\n',
    ],
    [
      `        try {
          // Preferir POST /locais/sync (batchAtomic:true). Overflow/legado pré-MASTER ou fallback.
          /** @param {Record<string, unknown>|null|undefined} summary @param {string|null} reason */
          const annotateLocaisSummary = (summary, reason) => {
            if (!summary || typeof summary !== 'object') return summary;
            return {
              ...summary,
              syncPath: summary.batchAtomic === true ? 'atomic' : 'legacy',
              fallbackReason: reason || null,
            };
          };
          let locaisSummary;
          if (locaisPreferLegacyRef.current) {
            locaisSummary = annotateLocaisSummary(await syncClienteLocaisViaHttp({
              clienteId: frozenScope.clienteId,
              draft: locaisDraft,
              baselineIds,
              assertScope: assertLocaisScope,
              api: api.clientes,
            }), 'ATOMIC_OVERFLOW_PREFLIGHT');
          } else {
            try {
              locaisSummary = annotateLocaisSummary(await syncClienteLocaisAtomicViaHttp({
                clienteId: frozenScope.clienteId,
                draft: locaisDraft,
                baselineIds,
                assertScope: assertLocaisScope,
                api: api.clientes,
              }), null);
            } catch (atomicErr) {
              const atomicCode = /** @type {Error & { code?: string, message?: string }} */ (atomicErr)?.code
                || String(/** @type {Error} */ (atomicErr)?.message || '');
              const canFallback = atomicCode === 'CLIENTE_LOCAIS_SNAPSHOT_INVALID'
                || atomicCode === 'CLIENTE_LOCAIS_ATOMIC_UNAVAILABLE'
                || atomicCode === 'CLIENTE_LOCAIS_INPUT_INVALID'
                || atomicCode === 'CLIENTE_LOCAIS_ATOMIC_OVERFLOW'
                || /SNAPSHOT_INVALID|ATOMIC_UNAVAILABLE|ATOMIC_OVERFLOW|CLIENTE_LOCAIS_INPUT_INVALID/.test(atomicCode);
              // Conflito de versão / sync inválido: fail-closed (não escrever path parcial).
              if (!canFallback) throw atomicErr;
              locaisSummary = annotateLocaisSummary(await syncClienteLocaisViaHttp({
                clienteId: frozenScope.clienteId,
                draft: locaisDraft,
                baselineIds,
                assertScope: assertLocaisScope,
                api: api.clientes,
              }), atomicCode || 'ATOMIC_FALLBACK');
            }
          }
          // Summary no ref: mutation continua retornando o MASTER (contrato AST/consumidores).
          lastLocaisSyncSummaryRef.current = locaisSummary;
`,
      `        try {
          const locaisSummary = await syncClienteLocaisViaHttp({
            clienteId: frozenScope.clienteId,
            draft: locaisDraft,
            baselineIds,
            assertScope: assertLocaisScope,
            api: api.clientes,
          });
          // Summary no ref: mutation continua retornando o MASTER (contrato AST/consumidores).
          lastLocaisSyncSummaryRef.current = locaisSummary;
`,
    ],
    [
      `      if (
        locaisSummary
        && locaisSummary.skipped !== true
        && locaisSummary.batchAtomic === true
      ) {
        toast({
          title: \`Cliente \${verb}\`,
          description: 'Endereços gravados atomicamente via /locais/sync (batchAtomic:true). Cliente MASTER + locais = lote atômico só dos endereços.',
        });
      } else if (
        locaisSummary
        && locaisSummary.skipped !== true
        && locaisSummary.batchAtomic === false
      ) {
        const ops = Number(locaisSummary.created || 0)
          + Number(locaisSummary.updated || 0)
          + Number(locaisSummary.deleted || 0);
        const reason = String(/** @type {{ fallbackReason?: unknown }} */ (locaisSummary).fallbackReason || '');
        const overflow = /OVERFLOW/i.test(reason);
        const recover = locaisSummary.reconcileRequired === true
          ? ' Reabra o cliente e confira o catálogo antes de repetir o save.'
          : ' Rascunho reconciliável — reabra se a lista operacional divergir.';
        // Fallback legado / overflow: NÃO declarar salvamento integral nem esconder em toast genérico.
        toast({
          title: overflow
            ? \`Cliente \${verb} — locais via legado (overflow >50 ops)\`
            : \`Cliente \${verb} — locais via fallback não atômico\`,
          description: (ops > 0
            ? \`MASTER gravado; \${ops} operação(ões) de endereço em path legado\`
              + (reason ? \` (\${reason})\` : '')
              + '. Não é atomicidade integral.'
            : \`MASTER gravado; sync de endereços sem operações no path legado\`
              + (reason ? \` (\${reason})\` : '')
              + '.')
            + recover,
          variant: 'default',
        });
      } else {
        toast({ title: \`Cliente \${verb}\`, description: 'Cadastro MASTER confirmado. Sync de endereços omitido ou sem operações.' });
      }
`,
      `      if (
        locaisSummary
        && locaisSummary.skipped !== true
        && locaisSummary.batchAtomic === false
      ) {
        const ops = Number(locaisSummary.created || 0)
          + Number(locaisSummary.updated || 0)
          + Number(locaisSummary.deleted || 0);
        // BATCH_ATOMIC=false = limitação BFF — não declarar salvamento integral/atômico.
        toast({
          title: \`Cliente \${verb}\`,
          description: ops > 0
            ? \`Endereços sincronizados em \${ops} operação(ões). Lote não atômico no BFF (BATCH_ATOMIC=false) — não é salvamento integral.\`
            : 'Cliente gravado. Sync de endereços sem operações (lote não atômico no BFF).',
        });
      } else {
        toast({ title: \`✅ Cliente \${verb} com sucesso!\` });
      }
`,
    ],
    // ENTREGA onOpenDraft (Cursor) — peels before FISCAL allowReviewEdit (Codex).
    [
      '  /** Contagem de entrega em revisão — null se falhou/desconhecido (≠ zero). */\n  const [revisaoEntregaTotal, setRevisaoEntregaTotal] = useState(/** @type {number|null} */ (null));\n  const reviewClienteId = clienteBoundId || cliente?.id || null;\n  useEffect(() => { setRevisaoEntregaTotal(null); }, [reviewClienteId]);\n',
      '',
    ],
    [
      `  /**
   * ENTREGA: revisão → rascunho operacional (não ativa/grava).
   * FISCAL: não copia para MASTER.endereco_principal — revisão in-place via allowReviewEdit.
   */
  const openLocalDraftFromReview = ({ finalidade, ui }) => {
    if (!ui || typeof ui !== 'object') return;
    if (finalidade === 'FISCAL') {
      toast({
        title: 'Fiscal não abre rascunho MASTER',
        description: 'Use «Revisar fiscal» no painel de revisão (activate:false). Nada foi copiado para endereco_principal.',
        variant: 'destructive',
      });
      return;
    }
    if (finalidade !== 'ENTREGA') return;
    // Fail-closed: sem catálogo HTTP confirmado, owned+review-only soft-deleta o restante no save.
    if (isHttpBackendMode) {
      if (locaisHttpBaselineRef.current === null) {
        toast({
          title: 'Catálogo operacional indisponível',
          description: 'Falha na leitura de locais — rascunho não aberto. Reabra o cliente e tente de novo.',
          variant: 'destructive',
        });
        return;
      }
      if (!Array.isArray(locaisHttpView) && !Array.isArray(locaisHttpBaselineRef.current)) {
        toast({
          title: 'Aguarde o catálogo operacional',
          description: 'Locais HTTP ainda carregando — rascunho não aberto para não apagar outros endereços no save.',
          variant: 'destructive',
        });
        return;
      }
    }
    setActiveTab('enderecos');
    locaisDraftOwnedRef.current = true;
    setFormData((prev) => {
      // Base = draft com itens, senão catálogo HTTP confirmado (view ou baseline).
      const httpList = Array.isArray(locaisHttpView)
        ? locaisHttpView
        : (Array.isArray(locaisHttpBaselineRef.current) ? locaisHttpBaselineRef.current : null);
      const draftList = Array.isArray(prev.locais_entrega) ? prev.locais_entrega : null;
      const list = (draftList && draftList.length > 0)
        ? [...draftList]
        : (httpList ? [...httpList] : []);
      const id = String(ui.id || '').trim();
      const without = id ? list.filter((row) => String(row?.id || '') !== id) : list;
      return {
        ...prev,
        locais_entrega: [...without, { ...ui, _rascunho_revisao: true, _fonte: 'cliente_locais_revisao' }],
      };
    });
    toast({
      title: 'Rascunho de entrega no formulário',
      description: 'Local de revisão copiado para o rascunho operacional. Não foi ativado nem gravado — complete e Salve para validar.',
    });
  };

`,
      '',
    ],
    // Clear-before-fetch + loadStatus operacional (Bugbot) — peel após onOpenDraft.
    [
      '    // Limpa visão anterior antes do fetch — loading ≠ catálogo vazio confirmado.\n'
      + '    setLocaisHttpView(undefined);\n'
      + '    locaisHttpBaselineRef.current = undefined;\n',
      '',
    ],
    [
      '  /** true só após edição explícita do rascunho (apply/openDraft) — [] inicial ≠ owned. */\n'
      + '  const locaisDraftOwnedRef = useRef(false);\n'
      + '  /** Cliente efetivo do catálogo — ownership só zera quando este id muda (não em reopen rejeitado). */\n'
      + '  const locaisCatalogClientIdRef = useRef(/** @type {string|null|undefined} */ (undefined));\n',
      '',
    ],
    // Owned reset + create [] confirmado + skip refetch no mesmo cliente.
    [
      '    const id = clienteBoundId || cliente?.id || null;\n'
      + '    const clientChanged = locaisCatalogClientIdRef.current !== id;\n'
      + '    if (clientChanged) {\n'
      + '      locaisCatalogClientIdRef.current = id;\n'
      + '      locaisDraftOwnedRef.current = false;\n'
      + '    }\n'
      + '    // Create HTTP: sem id = catálogo vazio confirmado (permite rascunho no 1º save).\n'
      + '    if (!id) {\n'
      + '      if (isHttpBackendMode) {\n'
      + '        setLocaisHttpView([]);\n'
      + '        locaisHttpBaselineRef.current = [];\n'
      + '      } else {\n'
      + '        setLocaisHttpView(undefined);\n'
      + '        locaisHttpBaselineRef.current = undefined;\n'
      + '      }\n'
      + '      return undefined;\n'
      + '    }\n'
      + '    if (!isHttpBackendMode) {\n'
      + '      setLocaisHttpView(undefined);\n'
      + '      locaisHttpBaselineRef.current = undefined;\n'
      + '      return undefined;\n'
      + '    }\n'
      + '    // Mesmo cliente efetivo com baseline já materializado — não limpa owned nem refetch.\n'
      + '    if (!clientChanged && Array.isArray(locaisHttpBaselineRef.current)) {\n'
      + '      return undefined;\n'
      + '    }\n',
      '    const id = clienteBoundId || cliente?.id || null;\n'
      + '    if (!id || !isHttpBackendMode) {\n'
      + '      setLocaisHttpView(undefined);\n'
      + '      locaisHttpBaselineRef.current = undefined;\n'
      + '      return undefined;\n'
      + '    }\n',
    ],
    [
      '  const applyEnderecosDraft = (novosEnderecos) => {\n'
      + '    // Mesma guarda do openDraft: owned parcial antes do catálogo soft-deleta o restante no save.\n'
      + '    // Throw: Gerenciar trata onChange rejeitado como falha e mantém o diálogo aberto.\n'
      + '    if (isHttpBackendMode) {\n'
      + '      if (locaisHttpBaselineRef.current === null) {\n'
      + '        const err = new Error(\'Catálogo operacional indisponível — edição não aplicada. Reabra o cliente.\');\n'
      + '        toast({ title: \'Catálogo operacional indisponível\', description: err.message, variant: \'destructive\' });\n'
      + '        throw err;\n'
      + '      }\n'
      + '      if (!Array.isArray(locaisHttpView) && !Array.isArray(locaisHttpBaselineRef.current)) {\n'
      + '        const err = new Error(\'Locais HTTP ainda carregando — edição não aplicada para não apagar outros endereços no save.\');\n'
      + '        toast({ title: \'Aguarde o catálogo operacional\', description: err.message, variant: \'destructive\' });\n'
      + '        throw err;\n'
      + '      }\n'
      + '    }\n'
      + '    locaisDraftOwnedRef.current = true;\n'
      + '    setFormData((prev) => ({ ...prev, locais_entrega: novosEnderecos }));\n'
      + '  };\n',
      '  const applyEnderecosDraft = (novosEnderecos) => {\n'
      + '    setFormData((prev) => ({ ...prev, locais_entrega: novosEnderecos }));\n'
      + '  };\n',
    ],
    [
      '      locaisPreferLegacyRef.current = false;\n'
      + '      if (isHttpBackendMode && locaisDraft !== undefined) {\n'
      + '        locaisDraft = data.locais_entrega;\n'
      + '        // [] inicial do form ≠ remoção explícita — omissão preserva operacionais HTTP.\n'
      + '        const omitPristineEmpty = Array.isArray(locaisDraft)\n'
      + '          && locaisDraft.length === 0\n'
      + '          && !locaisDraftOwnedRef.current;\n'
      + '        if (omitPristineEmpty) {\n'
      + '          locaisDraft = undefined;\n'
      + '        } else {\n'
      + '          const localPlan = prepareClienteLocaisHttpDraft(locaisDraft);\n'
      + '          const required = new Set(/** @type {string[]} */ (localPlan.map(step => step.kind === \'create\' ? \'criar\' : \'editar\')));\n'
      + '          for (const step of localPlan) {\n'
      + '            const original = locaisDraft.find(row => String(row?.id || \'\') === step.localId);\n'
      + '            const previous = original?._finalidades_detalhadas;\n'
      + '            const next = Array.isArray(step.fins) ? step.fins : [];\n'
      + '            if (step.kind === \'create\' ? next.some(row => row.principal === true)\n'
      + '              : !Array.isArray(previous) || next.some(row => !previous.some(before => before.finalidade === row.finalidade && before.principal === row.principal))\n'
      + '                || previous.some(before => before.principal && !next.some(row => row.finalidade === before.finalidade))) required.add(\'principal\');\n'
      + '          }\n'
      + '          const keptIds = new Set(localPlan.map(step => step.localId).filter(Boolean));\n'
      + '          const baseline = locaisHttpBaselineRef.current;\n'
      + '          if (Array.isArray(baseline) && baseline.some(row => {\n'
      + '            const id = row && typeof row === \'object\' ? String(/** @type {{id?: unknown}} */ (row).id || \'\') : \'\';\n'
      + '            return isClienteLocalCanonicalId(id) && !keptIds.has(id);\n'
      + '          })) required.add(\'inativar\');\n'
      + '          for (const action of required) if (!hasPermission(\'Cadastros\', \'cliente_local\', action)) {\n'
      + '            throw Object.assign(new Error(`Permissao de locais ausente: ${action}. MASTER nao enviado; rascunho preservado.`), { code: \'PERMISSION_DENIED\', status: 403 });\n'
      + '          }\n'
      + '          // Overflow atomico (>50 ops): legado ANTES do MASTER — evita cliente sem sync.\n'
      + '          const baselineIdsPlan = Array.isArray(baseline)\n'
      + '            ? baseline\n'
      + '              .map((row) => (row && typeof row === \'object\'\n'
      + '                ? String(/** @type {{ id?: unknown }} */ (row).id || \'\').trim()\n'
      + '                : \'\'))\n'
      + '              .filter(Boolean)\n'
      + '            : null;\n'
      + '          const atomicPlan = buildClienteLocaisSyncOperations(locaisDraft, baselineIdsPlan);\n'
      + '          if (atomicPlan.overflow) locaisPreferLegacyRef.current = true;\n'
      + '        }\n'
      + '        // Nunca empurrar locais no MASTER — sync canônico ou omissão explícita.\n'
      + '        delete payload.locais_entrega;\n'
      + '      }\n',
      '      if (isHttpBackendMode && locaisDraft !== undefined) {\n'
      + '        locaisDraft = data.locais_entrega;\n'
      + '        const localPlan = prepareClienteLocaisHttpDraft(locaisDraft);\n'
      + '        const required = new Set(/** @type {string[]} */ (localPlan.map(step => step.kind === \'create\' ? \'criar\' : \'editar\')));\n'
      + '        for (const step of localPlan) {\n'
      + '          const original = locaisDraft.find(row => String(row?.id || \'\') === step.localId);\n'
      + '          const previous = original?._finalidades_detalhadas;\n'
      + '          const next = Array.isArray(step.fins) ? step.fins : [];\n'
      + '          if (step.kind === \'create\' ? next.some(row => row.principal === true)\n'
      + '            : !Array.isArray(previous) || next.some(row => !previous.some(before => before.finalidade === row.finalidade && before.principal === row.principal))\n'
      + '              || previous.some(before => before.principal && !next.some(row => row.finalidade === before.finalidade))) required.add(\'principal\');\n'
      + '        }\n'
      + '        const keptIds = new Set(localPlan.map(step => step.localId).filter(Boolean));\n'
      + '        const baseline = locaisHttpBaselineRef.current;\n'
      + '        if (Array.isArray(baseline) && baseline.some(row => {\n'
      + '          const id = row && typeof row === \'object\' ? String(/** @type {{id?: unknown}} */ (row).id || \'\') : \'\';\n'
      + '          return isClienteLocalCanonicalId(id) && !keptIds.has(id);\n'
      + '        })) required.add(\'inativar\');\n'
      + '        for (const action of required) if (!hasPermission(\'Cadastros\', \'cliente_local\', action)) {\n'
      + '          throw Object.assign(new Error(`Permissao de locais ausente: ${action}. MASTER nao enviado; rascunho preservado.`), { code: \'PERMISSION_DENIED\', status: 403 });\n'
      + '        }\n'
      + '        delete payload.locais_entrega;\n'
      + '      }\n',
    ],
    [
      '  /** true se o lote atomico overflow (>50 ops) — legado antes do MASTER, sem órfãos. */\n'
      + '  const locaisPreferLegacyRef = useRef(false);\n',
      '',
    ],
    [
      '    reconcileRequired?: boolean,\n'
      + '    syncPath?: string,\n'
      + '    fallbackReason?: string|null,\n',
      '',
    ],
    [
      '                  {isHttpBackendMode ? (\n'
      + '                    <p className="text-xs text-slate-600 mb-2" data-block="fiscal-cliente-local-canonico" role="note">\n'
      + '                      Fiscal canônico = ClienteLocal (revisão abaixo). Campos MASTER.endereco_principal\n'
      + '                      são legado/visual — HTTP rejeita gravação significativa; não copiam o fiscal operacional.\n'
      + '                      Use «Revisar fiscal» (activate:false) e ativação explícita autorizada.\n'
      + '                    </p>\n'
      + '                  ) : null}\n',
      '',
    ],
    [
      '                        readOnly={isHttpBackendMode}\n'
      + '                        disabled={isHttpBackendMode}\n',
      '',
      'all',
    ],
    [
      '                        disabled={isHttpBackendMode || !formData.endereco_principal?.cep || formData.endereco_principal.cep.replace(/\\D/g, \'\').length < 8}\n',
      '                        disabled={!formData.endereco_principal?.cep || formData.endereco_principal.cep.replace(/\\D/g, \'\').length < 8}\n',
    ],
    [
      '  /**\n'
      + '   * [] inicial do form ≠ catálogo HTTP confirmado.\n'
      + '   * Draft só manda com itens ou ownership explícita (apply/openDraft) — baseline sozinho não assume [].\n'
      + '   */\n'
      + '  const locaisDraftAssumed = Array.isArray(formData.locais_entrega)\n'
      + '    && (formData.locais_entrega.length > 0 || locaisDraftOwnedRef.current);\n'
      + '  const locaisViewForUi = locaisDraftAssumed\n'
      + '    ? formData.locais_entrega\n'
      + '    : (Array.isArray(locaisHttpView) ? locaisHttpView : (Array.isArray(formData.locais_entrega) ? formData.locais_entrega : []));\n'
      + '\n'
      + '  /** Operacional: create sem id = loaded ([]); draft assumido / HTTP ok = loaded. */\n'
      + '  const locaisOperacionalLoadStatus = (() => {\n'
      + '    if (!isHttpBackendMode) {\n'
      + "      return Array.isArray(formData.locais_entrega) ? 'loaded' : 'unknown';\n"
      + '    }\n'
      + '    // Create: baseline [] confirmado — permite adicionar antes do 1º save.\n'
      + '    if (!(clienteBoundId || cliente?.id)) {\n'
      + '      return Array.isArray(locaisHttpBaselineRef.current) ? \'loaded\' : \'unknown\';\n'
      + '    }\n'
      + "    if (locaisHttpBaselineRef.current === null) return 'failed';\n"
      + '    if (locaisDraftAssumed || Array.isArray(locaisHttpView) || Array.isArray(locaisHttpBaselineRef.current)) {\n'
      + "      return 'loaded';\n"
      + '    }\n'
      + "    return 'loading';\n"
      + '  })();\n\n',
      '  const locaisViewForUi = Array.isArray(formData.locais_entrega)\n'
      + '    ? formData.locais_entrega\n'
      + '    : (Array.isArray(locaisHttpView) ? locaisHttpView : []);\n\n',
    ],
    [
      '                loadStatus={locaisOperacionalLoadStatus}\n',
      '',
    ],
    [
      '                reviewPendingHint={revisaoEntregaTotal}\n',
      '',
    ],
    [
      'finalidade="ENTREGA" onOpenDraft={openLocalDraftFromReview} onReviewMeta={({ total, error }) => setRevisaoEntregaTotal(error ? null : total)} />',
      'finalidade="ENTREGA" />',
    ],
    ['finalidade="FISCAL" allowReviewEdit />', 'finalidade="FISCAL" />'],
  ] : [];
  // Exige o pacote operacional completo; se faltar um hunk (ex.: allowReviewEdit
  // adulterado no teste), devolve o texto sem peel — não inventa ancestral parcial.
  if (!changes.every(([after]) => source.includes(after))) return text;
  for (const [after, before, mode] of changes) {
    if (mode === 'all') {
      assert.ok(source.includes(after), file + ': operational replace-all present');
      source = source.split(after).join(before);
      continue;
    }
    assert.equal(source.split(after).length, 2, file + ': exact operational wiring');
    source = source.replace(after, () => before);
  }
  return text.includes('\r\n') ? source.replace(/\n/g, '\r\n') : source;
}
