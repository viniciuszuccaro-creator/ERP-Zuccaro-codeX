import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

// Purpose split only; the preceding c93 helper and all its pins remain intact.
export const clienteLocaisPurposeBaseline = '109ec52a5f866eff1d5c689bacfcccacd73dcabf';
export const clienteLocaisPurposeHunks = {
  "src/api/httpApiClient.js": {
    "hash": "9159f8a6330530fea2d633889972cf9ef1a5a9c52f841de9ee81600640ba8d74",
    "hunks": [
      [
        "    /**\n     * Pagina autoritativa para revisao; envelope invalido nunca representa vazio.\n     * @param {string} clienteId\n     * @param {{offset?: number, finalidade?: 'FISCAL'|'ENTREGA', signal?: AbortSignal}} [options]\n     */\n    async listLocaisReviewPage(clienteId, { offset = 0, finalidade, signal } = {}) {\n      const id = String(clienteId ?? '').trim();\n      if (!id) throw new Error('Cliente obrigatorio para revisao de locais');\n      if (finalidade !== undefined && !['FISCAL', 'ENTREGA'].includes(finalidade)) throw new Error('Finalidade de revisao invalida');\n      const scope = Object.freeze({ ...getScope() });\n      const page = await request(`/api/v1/clientes/${encodeURIComponent(id)}/locais`, {\n        query: { limit: 50, offset, ativo: 'false', order_by: 'nome', ...(finalidade ? { finalidade } : {}) }, signal, unwrap: false,\n      }, scope);\n      const meta = page?.meta;\n      if (!Array.isArray(page?.data) || !meta || page.partial === true || meta.partial === true\n        || page.incomplete === true || meta.incomplete === true || meta.limit !== 50 || meta.offset !== offset\n        || !Number.isSafeInteger(meta.total) || meta.total < 0 || typeof meta.hasMore !== 'boolean'\n        || page.data.length > 50 || offset + page.data.length > meta.total\n        || meta.hasMore !== (offset + page.data.length < meta.total)\n        || (meta.hasMore && page.data.length === 0)\n        || new Set(page.data.map(row => row?.id)).size !== page.data.length\n        || page.data.some(row => !row || typeof row.id !== 'string' || row.ativo !== false\n          || row.cliente_id !== id || row.group_id !== scope.groupId\n          || !Array.isArray(row.finalidades)\n          || row.finalidades.some(f => !f || typeof f.finalidade !== 'string')\n          || (finalidade && !row.finalidades.some(f => f.finalidade === finalidade && f.ativo === true)))) {\n        throw new Error('Resposta incompleta ou invalida na revisao de locais');\n      }\n      return page;\n    },\n",
        "    /**\n     * Pagina autoritativa para revisao; envelope invalido nunca representa vazio.\n     * @param {string} clienteId\n     * @param {{offset?: number, signal?: AbortSignal}} [options]\n     */\n    async listLocaisReviewPage(clienteId, { offset = 0, signal } = {}) {\n      const id = String(clienteId ?? '').trim();\n      if (!id) throw new Error('Cliente obrigatorio para revisao de locais');\n      const scope = Object.freeze({ ...getScope() });\n      const page = await request(`/api/v1/clientes/${encodeURIComponent(id)}/locais`, {\n        query: { limit: 50, offset, ativo: 'false', order_by: 'nome' }, signal, unwrap: false,\n      }, scope);\n      const meta = page?.meta;\n      if (!Array.isArray(page?.data) || !meta || page.partial === true || meta.partial === true\n        || page.incomplete === true || meta.incomplete === true || meta.limit !== 50 || meta.offset !== offset\n        || !Number.isSafeInteger(meta.total) || meta.total < 0 || typeof meta.hasMore !== 'boolean'\n        || page.data.length > 50 || offset + page.data.length > meta.total\n        || meta.hasMore !== (offset + page.data.length < meta.total)\n        || (meta.hasMore && page.data.length === 0)\n        || new Set(page.data.map(row => row?.id)).size !== page.data.length\n        || page.data.some(row => !row || typeof row.id !== 'string' || row.ativo !== false\n          || row.cliente_id !== id || row.group_id !== scope.groupId\n          || !Array.isArray(row.finalidades)\n          || row.finalidades.some(f => !f || typeof f.finalidade !== 'string'))) {\n        throw new Error('Resposta incompleta ou invalida na revisao de locais');\n      }\n      return page;\n    },\n"
      ]
    ]
  },
  "src/components/cadastros/CadastroClienteCompleto.jsx": {
    "hash": "8a99466088c04fa056ef8d343018469399481b46b1e6117aee30090fd3172cd5",
    "hunks": [
      // Cursor pós-594: peels extras MASTER → Continuity (Codex RG HTTP) antes dos peels locais.
      [
        "import {\n  applyClienteMasterExtrasToHttpPayload,\n  isClienteMasterStorageRequired,\n} from \"@/api/clienteMasterExtrasUi\";\n",
        '',
      ],
      [
        '    rg: "",\n'
        + '    // Create: \'\' = opcional vazio (omit no wire); undefined só em carga edit ausente.\n'
        + '    numero_caixa_postal: "",\n'
        + '    cep_caixa_postal: "",\n'
        + '    caixa_postal_cobranca: "",\n'
        + '    inscricao_produtor_rural: "",\n',
        '    rg: "",\n',
      ],
      [
        '      rg: "",\n'
        + '      numero_caixa_postal: "",\n'
        + '      cep_caixa_postal: "",\n'
        + '      caixa_postal_cobranca: "",\n'
        + '      inscricao_produtor_rural: "",\n'
        + '      inscricao_estadual: "",\n',
        '      rg: "",\n'
        + '      inscricao_estadual: "",\n',
      ],
      [
        '      if (isHttpBackendMode) {\n'
        + '        // Extensões MASTER (rg/caixa/produtor): omit ≠ limpar; \'\' ≠ clear (Codex).\n'
        + '        applyClienteMasterExtrasToHttpPayload(payload, data);\n'
        + '      }\n',
        '      if (isHttpBackendMode) {\n'
        + '        if (data.rg !== undefined) payload.rg = data.rg;\n'
        + '        else delete payload.rg;\n'
        + '      }\n',
      ],
      [
        '      const storageRequired = isClienteMasterStorageRequired(err);\n'
        + '      // MASTER pode ter gravado; sync parcial ≠ sucesso — invalida; UI já reconciliou se possível.\n'
        + '      if (partial) {\n'
        + '        queryClient.invalidateQueries({ queryKey: [\'clientes\'] });\n'
        + '      }\n'
        + '      toast({\n'
        + '        title: !sameScope\n'
        + '          ? "Contexto alterado"\n'
        + '          : (storageRequired\n'
        + '            ? "❌ Extensões MASTER sem storage revisado"\n'
        + '            : (partial ? "❌ Endereços parcialmente sincronizados" : "❌ Erro ao salvar cliente")),\n'
        + '        description: sameScope\n'
        + '          ? (storageRequired\n'
        + '            ? "Schema antigo ou colunas RG/caixa postal/produtor ainda não aplicadas. Rascunho preservado — omissão ≠ limpar; sem inventar sucesso."\n'
        + '            : (err?.message || String(error)))\n'
        + '          : "A operação anterior falhou. Reabra o cadastro no contexto atual.",\n',
        '      // MASTER pode ter gravado; sync parcial ≠ sucesso — invalida; UI já reconciliou se possível.\n'
        + '      if (partial) {\n'
        + '        queryClient.invalidateQueries({ queryKey: [\'clientes\'] });\n'
        + '      }\n'
        + '      toast({\n'
        + '        title: !sameScope\n'
        + '          ? "Contexto alterado"\n'
        + '          : (partial ? "❌ Endereços parcialmente sincronizados" : "❌ Erro ao salvar cliente"),\n'
        + '        description: sameScope\n'
        + '          ? (err?.message || String(error))\n'
        + '          : "A operação anterior falhou. Reabra o cadastro no contexto atual.",\n',
      ],
      [
        '                        data-campo="rg"\n'
        + '                        data-persistencia={formData.rg === undefined ? \'nao-carregado\' : \'rascunho\'}\n'
        + '                        placeholder={formData.rg === undefined ? \'Não recuperado nesta carga\' : undefined}\n'
        + '                      />\n'
        + '                      <p className="text-xs text-amber-800 mt-1" data-campo-estado="rg-master-extra">\n'
        + '                        RG no MASTER — omitir ≠ limpar; schema antigo → 503 STORAGE_REQUIRED.\n'
        + '                      </p>\n'
        + '                    </div>\n'
        + '                  </>\n'
        + '                )}\n\n'
        + '                <div className="col-span-2 pt-4 border-t space-y-3" data-block="cliente-master-extras">\n'
        + '                  <h3 className="font-semibold">Extensões MASTER (caixa postal / produtor)</h3>\n'
        + '                  <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded px-2 py-1.5" role="status" data-fonte="cliente-master-extras-contrato">\n'
        + '                    Contrato Codex no mesmo Cliente: numero_caixa_postal, cep_caixa_postal, caixa_postal_cobranca,\n'
        + '                    inscricao_produtor_rural. Opcionais; omissão ≠ limpar. SQL candidato pode não estar aplicado —\n'
        + '                    escrita com storage ausente → 503 CLIENTE_MASTER_STORAGE_REQUIRED.\n'
        + '                  </p>\n'
        + '                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">\n'
        + '                    <div>\n'
        + '                      <Label htmlFor="numero_caixa_postal">Nº caixa postal</Label>\n'
        + '                      <Input\n'
        + '                        id="numero_caixa_postal"\n'
        + '                        value={formData.numero_caixa_postal ?? \'\'}\n'
        + '                        onChange={(e) => setFormData({\n'
        + '                          ...formData,\n'
        + '                          numero_caixa_postal: e.target.value === \'\' ? null : e.target.value,\n'
        + '                        })}\n'
        + '                        data-campo="numero_caixa_postal"\n'
        + '                        data-persistencia={formData.numero_caixa_postal === undefined ? \'nao-carregado\' : \'rascunho\'}\n'
        + '                        placeholder={formData.numero_caixa_postal === undefined ? \'Não recuperado nesta carga\' : undefined}\n'
        + '                      />\n'
        + '                    </div>\n'
        + '                    <div>\n'
        + '                      <Label htmlFor="cep_caixa_postal">CEP caixa postal</Label>\n'
        + '                      <Input\n'
        + '                        id="cep_caixa_postal"\n'
        + '                        value={formData.cep_caixa_postal ?? \'\'}\n'
        + '                        onChange={(e) => setFormData({\n'
        + '                          ...formData,\n'
        + '                          cep_caixa_postal: e.target.value === \'\' ? null : e.target.value,\n'
        + '                        })}\n'
        + '                        data-campo="cep_caixa_postal"\n'
        + '                        data-persistencia={formData.cep_caixa_postal === undefined ? \'nao-carregado\' : \'rascunho\'}\n'
        + '                        placeholder={formData.cep_caixa_postal === undefined ? \'Não recuperado nesta carga\' : \'00000000\'}\n'
        + '                      />\n'
        + '                    </div>\n'
        + '                    <div>\n'
        + '                      <Label htmlFor="caixa_postal_cobranca">Caixa postal cobrança</Label>\n'
        + '                      <Input\n'
        + '                        id="caixa_postal_cobranca"\n'
        + '                        value={formData.caixa_postal_cobranca ?? \'\'}\n'
        + '                        onChange={(e) => setFormData({\n'
        + '                          ...formData,\n'
        + '                          caixa_postal_cobranca: e.target.value === \'\' ? null : e.target.value,\n'
        + '                        })}\n'
        + '                        data-campo="caixa_postal_cobranca"\n'
        + '                        data-persistencia={formData.caixa_postal_cobranca === undefined ? \'nao-carregado\' : \'rascunho\'}\n'
        + '                        placeholder={formData.caixa_postal_cobranca === undefined ? \'Não recuperado nesta carga\' : undefined}\n'
        + '                      />\n'
        + '                    </div>\n'
        + '                    <div>\n'
        + '                      <Label htmlFor="inscricao_produtor_rural">Inscrição produtor rural</Label>\n'
        + '                      <Input\n'
        + '                        id="inscricao_produtor_rural"\n'
        + '                        value={formData.inscricao_produtor_rural ?? \'\'}\n'
        + '                        onChange={(e) => setFormData({\n'
        + '                          ...formData,\n'
        + '                          inscricao_produtor_rural: e.target.value === \'\' ? null : e.target.value,\n'
        + '                        })}\n'
        + '                        data-campo="inscricao_produtor_rural"\n'
        + '                        data-persistencia={formData.inscricao_produtor_rural === undefined ? \'nao-carregado\' : \'rascunho\'}\n'
        + '                        placeholder={formData.inscricao_produtor_rural === undefined ? \'Não recuperado nesta carga\' : undefined}\n'
        + '                      />\n'
        + '                    </div>\n'
        + '                  </div>\n'
        + '                </div>\n\n'
        + '                <div className="col-span-2 pt-4 border-t">\n'
        + '                  <h3 className="font-semibold mb-3">Endereço Principal (Fiscal)</h3>',
        '                      />\n'
        + '                    </div>\n'
        + '                  </>\n'
        + '                )}\n\n'
        + '                <div className="col-span-2 pt-4 border-t">\n'
        + '                  <h3 className="font-semibold mb-3">Endereço Principal (Fiscal)</h3>',
      ],
      [
        "  const { canCreate, canEdit, canDelete, hasPermission, isLoading: permissionsLoading } = usePermissions();\n",
        "  const { canCreate, canEdit, canDelete, hasPermission } = usePermissions();\n",
      ],
      [
        "  /** Locais canônicos BFF — leitura; write via `/locais` no save (não MASTER). */\n  const [locaisHttpView, setLocaisHttpView] = useState(/** @type {unknown[]|undefined} */ (undefined));\n  /** loaded | loading | failed | denied | unknown — nunca exibir zero se falhou/desconhecido. */\n  const [locaisLoadStatus, setLocaisLoadStatus] = useState(/** @type {'loaded'|'loading'|'failed'|'denied'|'unknown'} */ ('unknown'));\n  const [revisaoEntregaTotal, setRevisaoEntregaTotal] = useState(/** @type {number|null} */ (null));\n  /** Baseline lido para soft-delete só quando a carga HTTP concluiu (ref evita stale no mutate). */\n  const locaisHttpBaselineRef = useRef(/** @type {unknown[]|null|undefined} */ (undefined));\n  /** Último summary de sync `/locais` — BATCH_ATOMIC=false nunca vira toast de salvamento integral. */\n  const lastLocaisSyncSummaryRef = useRef(/** @type {{\n    skipped?: boolean,\n    batchAtomic?: boolean,\n    created?: number,\n    updated?: number,\n    deleted?: number,\n  }|null} */ (null));\n  // Booleano estável — não colocar `hasPermission` (nova identidade a cada render) nas deps.\n  const canViewLocais = hasPermission('Cadastros', 'cliente_local', 'visualizar') === true;\n  useEffect(() => {\n    const id = clienteBoundId || cliente?.id || null;\n    setRevisaoEntregaTotal(null);\n    if (!id || !isHttpBackendMode) {\n      setLocaisHttpView(undefined);\n      locaisHttpBaselineRef.current = undefined;\n      setLocaisLoadStatus('unknown');\n      return undefined;\n    }\n    if (!canViewLocais) {\n      setLocaisHttpView(undefined);\n      locaisHttpBaselineRef.current = undefined;\n      setLocaisLoadStatus(permissionsLoading ? 'loading' : 'denied');\n      return undefined;\n    }\n    let cancelled = false;\n    const session = readErpHttpSession();\n    if (!session?.token || !session?.groupId) {\n      setLocaisHttpView(undefined);\n      locaisHttpBaselineRef.current = undefined;\n      setLocaisLoadStatus('unknown');\n      return undefined;\n    }\n    setLocaisLoadStatus('loading');\n    (async () => {\n      try {\n        const api = createHttpApiClient({ getScope: () => readErpHttpSession() || {} });\n        const rows = await api.clientes.listLocais(id, { limit: 50, ativo: true });\n        if (cancelled) return;\n        const mapped = (Array.isArray(rows) ? rows : []).map((row) => mapClienteLocalToUiEndereco(\n          /** @type {Record<string, unknown>} */ (row),\n        ));\n        setLocaisHttpView(mapped);\n        locaisHttpBaselineRef.current = mapped;\n        setLocaisLoadStatus('loaded');\n      } catch {\n        if (!cancelled) {\n          setLocaisHttpView(undefined);\n          // Carga falhou: não autoriza remoção por omissão.\n          locaisHttpBaselineRef.current = null;\n          setLocaisLoadStatus('failed');\n        }\n      }\n    })();\n    return () => { cancelled = true; };\n  }, [clienteBoundId, cliente?.id, permissionsLoading, canViewLocais]);\n\n  const locaisViewForUi = Array.isArray(formData.locais_entrega)\n    ? formData.locais_entrega\n    : (Array.isArray(locaisHttpView) ? locaisHttpView : []);\n\n  const applyContatosDraft = (novosContatos) => {\n    setFormData((prev) => {\n      const quarantine = Array.isArray(prev.contatos)\n        ? partitionContatosByCanal(prev.contatos).quarentena\n        : [];\n      const validos = Array.isArray(novosContatos) ? novosContatos : [];\n      return { ...prev, contatos: [...validos, ...quarantine] };\n    });\n  };\n  const applyEnderecosDraft = (novosEnderecos) => {\n    setFormData((prev) => ({ ...prev, locais_entrega: novosEnderecos }));\n  };\n\n  /** Revisão → rascunho canônico: não PATCH/ativar; cancelar = não chamar Salvar. */\n  const openLocalDraftFromReview = ({ finalidade, ui }) => {\n    if (!ui || typeof ui !== 'object') return;\n    if (finalidade === 'FISCAL') {\n      setActiveTab('dados-gerais');\n      setFormData((prev) => {\n        const cur = prev.endereco_principal && typeof prev.endereco_principal === 'object'\n          ? prev.endereco_principal\n          : {};\n        const fill = (key, next) => {\n          const current = cur[key];\n          const empty = current === undefined || current === null || String(current).trim() === '';\n          return empty && next !== undefined && next !== null && String(next).trim() !== '' ? next : current;\n        };\n        return {\n          ...prev,\n          endereco_principal: {\n            ...cur,\n            cep: fill('cep', ui.cep),\n            logradouro: fill('logradouro', ui.logradouro),\n            numero: fill('numero', ui.numero),\n            complemento: fill('complemento', ui.complemento),\n            bairro: fill('bairro', ui.bairro),\n            cidade: fill('cidade', ui.cidade),\n            estado: fill('estado', ui.estado),\n            // País: só preenche se operacional vazio e revisão trouxe valor — nunca inventa.\n            ...(fill('pais', ui.pais) !== cur.pais && ui.pais ? { pais: fill('pais', ui.pais) } : {}),\n          },\n        };\n      });\n      toast({\n        title: 'Rascunho fiscal carregado',\n        description: 'Campos operacionais vazios preenchidos a partir da revisão. Nada foi gravado — revise e Salve se for o caso. Dados manuais existentes preservados.',\n      });\n      return;\n    }\n    if (finalidade === 'ENTREGA') {\n      setActiveTab('enderecos');\n      setFormData((prev) => {\n        const list = Array.isArray(prev.locais_entrega)\n          ? prev.locais_entrega\n          : (Array.isArray(locaisHttpView) ? [...locaisHttpView] : []);\n        const id = String(ui.id || '').trim();\n        const without = id ? list.filter((row) => String(row?.id || '') !== id) : list;\n        // Rascunho operacional: marca origem revisão; ativo efetivo só no save canônico.\n        return {\n          ...prev,\n          locais_entrega: [...without, { ...ui, _rascunho_revisao: true, _fonte: 'cliente_locais_revisao' }],\n        };\n      });\n      toast({\n        title: 'Rascunho de entrega no formulário',\n        description: 'Local de revisão copiado para o rascunho operacional. Não foi ativado nem gravado — complete e Salve para validar.',\n      });\n    }\n  };\n\n",
        "  /** Locais canônicos BFF — leitura; write via `/locais` no save (não MASTER). */\n  const [locaisHttpView, setLocaisHttpView] = useState(/** @type {unknown[]|undefined} */ (undefined));\n  /** Baseline lido para soft-delete só quando a carga HTTP concluiu (ref evita stale no mutate). */\n  const locaisHttpBaselineRef = useRef(/** @type {unknown[]|null|undefined} */ (undefined));\n  /** Último summary de sync `/locais` — BATCH_ATOMIC=false nunca vira toast de salvamento integral. */\n  const lastLocaisSyncSummaryRef = useRef(/** @type {{\n    skipped?: boolean,\n    batchAtomic?: boolean,\n    created?: number,\n    updated?: number,\n    deleted?: number,\n  }|null} */ (null));\n  useEffect(() => {\n    const id = clienteBoundId || cliente?.id || null;\n    if (!id || !isHttpBackendMode) {\n      setLocaisHttpView(undefined);\n      locaisHttpBaselineRef.current = undefined;\n      return undefined;\n    }\n    let cancelled = false;\n    const session = readErpHttpSession();\n    if (!session?.token || !session?.groupId) {\n      setLocaisHttpView(undefined);\n      locaisHttpBaselineRef.current = undefined;\n      return undefined;\n    }\n    (async () => {\n      try {\n        const api = createHttpApiClient({ getScope: () => readErpHttpSession() || {} });\n        const rows = await api.clientes.listLocais(id, { limit: 50, ativo: true });\n        if (cancelled) return;\n        const mapped = (Array.isArray(rows) ? rows : []).map((row) => mapClienteLocalToUiEndereco(\n          /** @type {Record<string, unknown>} */ (row),\n        ));\n        setLocaisHttpView(mapped);\n        locaisHttpBaselineRef.current = mapped;\n      } catch {\n        if (!cancelled) {\n          setLocaisHttpView(undefined);\n          // Carga falhou: não autoriza remoção por omissão.\n          locaisHttpBaselineRef.current = null;\n        }\n      }\n    })();\n    return () => { cancelled = true; };\n  }, [clienteBoundId, cliente?.id]);\n\n  const locaisViewForUi = Array.isArray(formData.locais_entrega)\n    ? formData.locais_entrega\n    : (Array.isArray(locaisHttpView) ? locaisHttpView : []);\n\n  const applyContatosDraft = (novosContatos) => {\n    setFormData((prev) => {\n      const quarantine = Array.isArray(prev.contatos)\n        ? partitionContatosByCanal(prev.contatos).quarentena\n        : [];\n      const validos = Array.isArray(novosContatos) ? novosContatos : [];\n      return { ...prev, contatos: [...validos, ...quarantine] };\n    });\n  };\n  const applyEnderecosDraft = (novosEnderecos) => {\n    setFormData((prev) => ({ ...prev, locais_entrega: novosEnderecos }));\n  };\n\n",
      ],
      [
        "<GerenciarEnderecosClienteForm\n                enderecos={locaisViewForUi}\n                onChange={applyEnderecosDraft}\n                commitMode=\"draft\"\n                assertScopeCurrent={assertFormScopeCurrent}\n                persistBusy={isSaving || saveMutation.isPending}\n                loadStatus={Array.isArray(formData.locais_entrega) ? 'loaded' : locaisLoadStatus}\n                reviewPendingHint={revisaoEntregaTotal}\n              />",
        "<GerenciarEnderecosClienteForm\n                enderecos={locaisViewForUi}\n                onChange={applyEnderecosDraft}\n                commitMode=\"draft\"\n                assertScopeCurrent={assertFormScopeCurrent}\n                persistBusy={isSaving || saveMutation.isPending}\n              />",
      ],
      [
        "                  <h3 className=\"font-semibold mb-3\">Endereço Principal (Fiscal)</h3>\n                  {isHttpBackendMode && <ClienteLocaisRevisao clienteId={clienteBoundId || cliente?.id} groupId={groupId} empresaId={empresaAtual?.id} finalidade=\"FISCAL\" onOpenDraft={openLocalDraftFromReview} />}\n                  <div className=\"grid grid-cols-4 gap-4\">\n",
        "                  <h3 className=\"font-semibold mb-3\">Endereço Principal (Fiscal)</h3>\n                  {isHttpBackendMode && cliente?.id && <button type=\"button\" className=\"text-sm text-blue-700 underline mb-3\" onClick={() => setActiveTab('enderecos')}>Consultar locais inativos em revisao, sem substituir este endereco</button>}\n                  <div className=\"grid grid-cols-4 gap-4\">\n"
      ],
      [
        "              />\n              {isHttpBackendMode && <ClienteLocaisRevisao clienteId={clienteBoundId || cliente?.id} groupId={groupId} empresaId={empresaAtual?.id} finalidade=\"ENTREGA\" onOpenDraft={openLocalDraftFromReview} onReviewMeta={({ total, error }) => setRevisaoEntregaTotal(error ? null : total)} />}\n            </TabsContent>\n",
        "              />\n              {isHttpBackendMode && <ClienteLocaisRevisao clienteId={clienteBoundId || cliente?.id} groupId={groupId} empresaId={empresaAtual?.id} />}\n            </TabsContent>\n"
      ]
    ]
  }
};
const hash = source => createHash('sha256').update(source).digest('hex');

export function clienteLocaisPurposeRemainder(file, text, verify = true) {
  const entry = clienteLocaisPurposeHunks[file];
  if (!entry) return text;
  let source = text.replace(/\r\n/g, '\n');
  if (hash(source) === entry.hash) return text;
  const markers = file.endsWith('.jsx')
    ? ['finalidade="FISCAL"', 'finalidade="ENTREGA"']
    : ["Finalidade de revisao invalida", "finalidade?: 'FISCAL'|'ENTREGA'", 'offset = 0, finalidade, signal'];
  // Older inputs must still pass the unchanged downstream historical guards.
  if (!markers.some(marker => source.includes(marker))) return text;
  for (const [after, before] of entry.hunks) {
    assert.equal(source.split(after).length, 2, file + ': exact purpose review hunk');
    source = source.replace(after, () => before);
  }
  if (verify) assert.equal(hash(source), entry.hash, file + ': entire pre-purpose source');
  return text.includes('\r\n') ? source.replace(/\n/g, '\r\n') : source;
}
