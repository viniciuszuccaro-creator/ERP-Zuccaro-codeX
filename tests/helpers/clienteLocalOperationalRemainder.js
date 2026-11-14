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
    setFormData((prev) => {
      const list = Array.isArray(prev.locais_entrega)
        ? prev.locais_entrega
        : (Array.isArray(locaisHttpView) ? [...locaisHttpView] : []);
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
      '  /** Operacional: draft = loaded; HTTP falhou = failed; lista HTTP ok = loaded; senão loading/unknown. */\n'
      + '  const locaisOperacionalLoadStatus = (() => {\n'
      + "    if (Array.isArray(formData.locais_entrega)) return 'loaded';\n"
      + "    if (!isHttpBackendMode) return 'unknown';\n"
      + '    if (!(clienteBoundId || cliente?.id)) return \'unknown\';\n'
      + "    if (locaisHttpBaselineRef.current === null) return 'failed';\n"
      + "    if (Array.isArray(locaisHttpView)) return 'loaded';\n"
      + "    return 'loading';\n"
      + '  })();\n\n',
      '',
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
