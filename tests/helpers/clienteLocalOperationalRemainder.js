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
    setActiveTab('enderecos');
    locaisDraftOwnedRef.current = true;
    setFormData((prev) => {
      // [] inicial do form não apaga operacionais HTTP — preferir locaisHttpView até draft com itens.
      const httpList = Array.isArray(locaisHttpView) ? locaisHttpView : null;
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
      + '  const locaisDraftOwnedRef = useRef(false);\n',
      '',
    ],
    [
      '    // Troca de cliente/sessão: ownership do rascunho não cruza contexto.\n'
      + '    locaisDraftOwnedRef.current = false;\n',
      '',
    ],
    [
      '  const applyEnderecosDraft = (novosEnderecos) => {\n'
      + '    locaisDraftOwnedRef.current = true;\n'
      + '    setFormData((prev) => ({ ...prev, locais_entrega: novosEnderecos }));\n'
      + '  };\n',
      '  const applyEnderecosDraft = (novosEnderecos) => {\n'
      + '    setFormData((prev) => ({ ...prev, locais_entrega: novosEnderecos }));\n'
      + '  };\n',
    ],
    [
      '      if (isHttpBackendMode && locaisDraft !== undefined) {\n'
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
      + '  /** Operacional: draft assumido / HTTP ok = loaded; [] inicial ≠ loaded. */\n'
      + '  const locaisOperacionalLoadStatus = (() => {\n'
      + '    if (!isHttpBackendMode) {\n'
      + "      return Array.isArray(formData.locais_entrega) ? 'loaded' : 'unknown';\n"
      + '    }\n'
      + '    if (!(clienteBoundId || cliente?.id)) return \'unknown\';\n'
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
  for (const [after, before] of changes) {
    assert.equal(source.split(after).length, 2, file + ': exact operational wiring');
    source = source.replace(after, () => before);
  }
  return text.includes('\r\n') ? source.replace(/\n/g, '\r\n') : source;
}
