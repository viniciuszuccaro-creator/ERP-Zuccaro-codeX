// Projecao estrita do V22 legado para o Produto MASTER DATA; campos operacionais
// continuam com seus modulos proprietarios e nunca entram no body do BFF.
const MASTER_FIELDS = [
  'descricao', 'descricao_tecnica', 'descricao_comercial', 'titulo_seo',
  'descricao_seo', 'embalagem_tipo', 'multiplo_venda', 'quantidade_minima_venda',
  'permite_fracionamento', 'nome', 'tipo_item', 'tipo_aco', 'eh_bitola',
  'peso_teorico_kg_m', 'bitola_diametro_mm', 'comprimento_barra_padrao_m',
  'unidade_medida_id', 'unidade_medida', 'unidade_principal',
  'unidades_secundarias', 'grupo_produto_id', 'marca_id', 'setor_atividade_id',
  'peso_liquido_kg', 'peso_bruto_kg', 'altura_cm', 'largura_cm',
  'comprimento_cm', 'volume_m3', 'ncm', 'cest', 'origem_mercadoria',
];
const NON_NEGATIVE = new Set([
  'quantidade_minima_venda', 'peso_teorico_kg_m', 'bitola_diametro_mm',
  'comprimento_barra_padrao_m', 'peso_liquido_kg', 'peso_bruto_kg',
  'altura_cm', 'largura_cm', 'comprimento_cm', 'volume_m3',
]);
const REFERENCE_FIELDS = new Set(['unidade_medida_id', 'grupo_produto_id', 'marca_id', 'setor_atividade_id']);

export function validateProdutoPimQuantities(form) {
  const multiple = form.multiplo_venda;
  const minimum = form.quantidade_minima_venda;
  if (multiple === '' || multiple == null || !Number.isFinite(Number(multiple)) || Number(multiple) <= 0) {
    throw new Error('Multiplo de venda deve ser maior que zero');
  }
  if (minimum === '' || minimum == null || !Number.isFinite(Number(minimum)) || Number(minimum) < 0) {
    throw new Error('Quantidade minima deve ser zero ou maior');
  }
}

export function toProdutoHttpPayload(form, { update = false } = {}) {
  const result = {};
  for (const key of MASTER_FIELDS) {
    let value = form[key];
    if (value === undefined || value === '') continue;
    if (REFERENCE_FIELDS.has(key) && value == null) continue;
    if (NON_NEGATIVE.has(key) || key === 'multiplo_venda') {
      value = Number(value);
      if (!Number.isFinite(value) || (key === 'multiplo_venda' ? value <= 0 : value < 0)) {
        throw new Error(`Valor invalido: ${key}`);
      }
    }
    result[key] = value;
  }
  const factors = {};
  for (const [unit, raw] of Object.entries(form.fatores_conversao || {})) {
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) throw new Error(`Fator invalido: ${unit}`);
    if (value > 0) factors[unit] = value;
  }
  if (Object.keys(factors).length) result.fatores_conversao = factors;
  if (update && form.codigo) result.codigo = String(form.codigo).trim();
  if (!result.descricao && !update) throw new Error('Descricao do produto obrigatoria');
  return result;
}

const MEDIA_FORMATS = Object.freeze({
  'image/png': { extensions: ['png'], folder: 'images', categoria: 'IMAGEM' },
  'image/jpeg': { extensions: ['jpg', 'jpeg'], folder: 'images', categoria: 'IMAGEM' },
  'image/webp': { extensions: ['webp'], folder: 'images', categoria: 'IMAGEM' },
  'application/pdf': { extensions: ['pdf'], folder: 'documents', categoria: 'DESENHO' },
  'video/mp4': { extensions: ['mp4'], folder: 'videos', categoria: 'VIDEO' },
});

export const CAD_FORMAT_POLICY = Object.freeze({
  dxf: 'application/dxf', dwg: 'application/acad', step: 'model/step',
  stp: 'model/step', iges: 'model/iges', igs: 'model/iges',
  enabled: false,
  activation: 'antivirus + MIME real + limite de tamanho + download privado homologados',
});

const WORKFLOW_TRANSITIONS = Object.freeze({
  RASCUNHO: [{ target: 'EM_REVISAO', label: 'Enviar para revisao', permission: 'edit' }],
  EM_REVISAO: [
    { target: 'RASCUNHO', label: 'Voltar ao rascunho', permission: 'edit' },
    { target: 'APROVADO', label: 'Aprovar conteudo', permission: 'approve' },
  ],
  APROVADO: [
    { target: 'EM_REVISAO', label: 'Reabrir revisao', permission: 'edit' },
    { target: 'PUBLICADO', label: 'Publicar produto', permission: 'publish' },
  ],
  PUBLICADO: [{ target: 'INATIVO', label: 'Inativar publicacao', permission: 'deactivate' }],
  INATIVO: [{ target: 'RASCUNHO', label: 'Retomar rascunho', permission: 'edit' }],
});

export function getProdutoWorkflowActions(status, permissions = {}) {
  const permitted = {
    edit: permissions.canEdit === true, approve: permissions.canApprove === true,
    publish: permissions.canPublish === true, deactivate: permissions.canDeactivate === true,
  };
  return (WORKFLOW_TRANSITIONS[status] || []).filter((action) => permitted[action.permission]);
}
export function getProdutoMediaScanLabel(media) {
  if (media?.status !== 'QUARENTENA') return media?.status || 'Estado indisponivel';
  if (media.scan_verdict === 'INFECTED') return 'Ameaca detectada; em quarentena';
  if (media.scan_verdict === 'CLEAN') return 'Sem ameaca detectada; ainda em quarentena';
  return 'Varredura pendente; em quarentena';
}
export function prepareProdutoMediaFile(file, { groupId, empresaId, produtoId, version = 1, maxBytes = 10_000_000 }) {
  if (!groupId || !empresaId || !produtoId) throw new Error('Produto e empresa canonicos obrigatorios para midia');
  const originalName = String(file?.name || '');
  const unsafeName = [...originalName].some((character) => {
    const code = character.codePointAt(0);
    return code === 47 || code === 92 || code <= 31 || (code >= 127 && code <= 159)
      || (code >= 0x202a && code <= 0x202e) || (code >= 0x2066 && code <= 0x2069);
  });
  if (!originalName.trim() || originalName.length > 255 || unsafeName) {
    throw new Error('Nome de arquivo invalido');
  }
  const extension = originalName.split('.').pop()?.toLowerCase();
  const format = MEDIA_FORMATS[file?.type];
  if (!format || !format.extensions.includes(extension)) throw new Error('Formato nao permitido');
  if (!Number.isSafeInteger(file.size) || file.size <= 0 || file.size > maxBytes) throw new Error('Tamanho de arquivo invalido');
  const safeName = originalName.normalize('NFKD').replace(/[^a-zA-Z0-9._-]/g, '-').slice(-120);
  const storageKey = `groups/${groupId}/companies/${empresaId}/products/${produtoId}/${format.folder}/${crypto.randomUUID()}-${safeName}`;
  return { storage_key: storageKey, categoria: format.categoria, nome_arquivo: originalName,
    mime_type: file.type, tamanho_bytes: file.size, versao: version };
}
