import { createHash } from 'node:crypto';
import { mapLegadoRowToCanonicalStub, catalogarProdutoClasseUnidadeLegado } from './mapear-registro-sintetico.mjs';

export const rowHash = value => createHash('sha256').update(JSON.stringify(value) ?? 'undefined').digest('hex');
export function projectionDifferences(payload, record) {
  return Object.keys(payload).filter(key => key !== 'migration_batch' && rowHash(payload[key]) !== rowHash(record[key]));
}
const digits = value => String(value ?? '').replace(/\D/g, '');

/** Only prepares inputs for existing canonical services; raw sources stay private. */
export function selectFunctionalRows(input, { groupId, batch, sourceSystem, clienteSchema, fornecedorSchema }) {
  const selected = { cliente: [], fornecedor: [] }, quarantine = [], auxiliary = [];
  const counts = {};
  for (const entity of ['cliente', 'fornecedor']) {
    const source = input.rows[entity], identities = new Map(), documents = new Map(), codes = new Map();
    const document = r => digits(entity === 'cliente' ? (r.tipo === 'Pessoa Física' ? r.cpf : r.cnpj) : r.cpf_cnpj);
    for (const [index, r] of source.entries()) {
      const code = r.codigo_legado, hash = rowHash(r), doc = document(r);
      const known = identities.get(code) || new Set(); known.add(hash); identities.set(code, known);
      for (const [map, key] of [[documents, doc], [codes, r.codigo]]) {
        if (!key) continue; const owners = map.get(key) || new Set(); owners.add(code); map.set(key, owners);
      }
    }
    let duplicates = 0;
    const seen = new Set();
    for (const [index, r] of source.entries()) {
      const code = r.codigo_legado, doc = document(r);
      const reject = reason => quarantine.push({ entity, index, sourceCode: code, reason });
      if (!code || !r.codigo || identities.get(code).size > 1 || (documents.get(doc)?.size || 0) > 1
        || (codes.get(r.codigo)?.size || 0) > 1) { reject('SOURCE_IDENTITY_CONFLICT'); continue; }
      if (r.quarantine_reasons && r.quarantine_reasons !== '[]') { reject('SOURCE_QUARANTINE'); continue; }
      if (entity === 'cliente' && String(r.status).trim().toLowerCase() !== 'ativo') {
        reject('INACTIVE_CLIENT_PRESERVED_NOT_REACTIVATED'); continue;
      }
      const schema = entity === 'cliente' ? clienteSchema : fornecedorSchema;
      const payload = entity === 'cliente' ? {
        empresa_id: null, codigo: r.codigo, tipo: r.tipo, documento: doc,
        ...(r.tipo === 'Pessoa Física' ? { nome: r.nome } : { razao_social: r.razao_social }),
        ...(r.nome_fantasia ? { nome_fantasia: r.nome_fantasia } : {}),
        origem: 'MIGRACAO', status: r.status, codigo_legado: code, legacy_id: code,
        source_system: sourceSystem, migration_batch: batch,
      } : {
        codigo: r.codigo, tipo_pessoa: r.tipo_pessoa, cpf_cnpj: doc, nome: r.nome,
        razao_social: r.razao_social, nome_fantasia: r.nome_fantasia,
        endereco: r.endereco, bairro: r.bairro, cidade: r.cidade, estado: r.estado, cep: r.cep,
        tipo_fornecedor: r.tipo_fornecedor, categoria: r.categoria,
        status: r.status, status_fornecedor: r.status_fornecedor, codigo_legado: code,
        legacy_id: code, source_system: sourceSystem, migration_batch: batch,
      };
      if (entity === 'fornecedor' && [r.cpf, r.cnpj].some(x => digits(x) && digits(x) !== doc)) {
        reject('SOURCE_DOCUMENT_FIELDS_CONFLICT'); continue;
      }
      const email = entity === 'cliente' ? r.contato_email : r.email;
      if (email) {
        if (schema.safeParse({ ...payload, email }).success) payload.email = email;
        else auxiliary.push({ entity, index, reason: 'EMAIL_REQUIRES_REVIEW', rawField: entity === 'cliente' ? 'contato_email' : 'email' });
      }
      if (entity === 'cliente' && Object.entries(r).some(([k, v]) => /^(endereco_|cobranca_)/.test(k) && v)) {
        auxiliary.push({ entity, index, reason: 'ADDRESS_NUMBER_AND_COUNTRY_NOT_PROVEN',
          required: ['numero', 'pais'], sourcePreserved: true });
      }
      if (entity === 'fornecedor' && r.endereco_cobranca) {
        try {
          const billing = JSON.parse(r.endereco_cobranca);
          if (schema.safeParse({ ...payload, endereco_cobranca: billing }).success) payload.endereco_cobranca = billing;
          else auxiliary.push({ entity, index, reason: 'BILLING_ADDRESS_STRUCTURE_UNPROVEN' });
        } catch { auxiliary.push({ entity, index, reason: 'BILLING_ADDRESS_STRUCTURE_UNPROVEN' }); }
      }
      const parsed = schema.safeParse(payload);
      if (!parsed.success) { reject('CANONICAL_VALIDATION_FAILED'); continue; }
      if (seen.has(code)) { duplicates++; continue; } seen.add(code);
      const mapped = mapLegadoRowToCanonicalStub({ codigo_legado: code, documento: doc,
        nome: entity === 'cliente' ? (r.tipo === 'Pessoa Física' ? r.nome : r.razao_social) : (r.razao_social || r.nome),
        nome_fantasia: r.nome_fantasia || '', group_id: groupId },
      { entidade: entity, groupId, arquivoNome: 'verified-private-staging' });
      if (mapped.quarentena) { reject('CANONICAL_MAPPER_QUARANTINE'); continue; }
      selected[entity].push({ index, payload: parsed.data, mapped });
    }
    counts[entity] = { source: source.length, processed: source.length, eligible: selected[entity].length,
      duplicates, rejected: quarantine.filter(x => x.entity === entity).length };
  }
  return { selected, quarantine, auxiliary, counts };
}

/** Metadata approvals must be explicit. Equal names/siglas are never approval. */
export function planProductEvidence(rows, unitRows, options = {}) {
  const truth = v => v === true || String(v).trim().toLowerCase() === 'true';
  const verifiedUnits = unitRows.filter(r => /^[a-f0-9-]{36}$/i.test(r.approved_target_unit_id || '')
    && truth(r.scope_verified) && truth(r.semantic_equivalence_verified));
  const projected = rows.map(r => ({ codigo_legado: r.codigo_legado, descricao: r.descricao,
    classe: r.classe_origem || r.codigo_classe || '', unidade: r.unidade_origem || r.unidade_principal || '' }));
  const catalog = catalogarProdutoClasseUnidadeLegado(projected, { groupId: options.groupId,
    produtoClassUnitMap: options.classUnitMap || {}, unidadesCanonicas: options.unidadesCanonicas || [] });
  const released = [];
  const decisions = [];
  for (const [index, r] of rows.entries()) {
    const mapped = catalog.grupos.find(x => x.classe_legado === projected[index].classe && x.unidade_legado === projected[index].unidade);
    const target = options.classUnitMap?.[`${projected[index].classe}|${projected[index].unidade}`]?.unidade_medida_id;
    if (mapped?.mapeamento_comprovado && verifiedUnits.some(u => u.approved_target_unit_id === target)) {
      released.push(index); continue;
    }
    decisions.push({ index, codigo_legado: r.codigo_legado,
    sourceClass: r.classe_origem || r.codigo_classe || null, stagedType: r.tipo_item,
    sourceUnit: r.unidade_origem, principalUnit: r.unidade_principal,
    reason: !verifiedUnits.length ? 'NO_VERIFIED_TARGET_UNIT_AND_CLASS_PROVENANCE' : 'CLASS_PROVENANCE_AND_TARGET_GROUP_REQUIRED',
    requires: ['source class identity and canonical classification evidence',
      'unit identity, dimension, group scope and verified semantic mapping'],
    canonicalReasons: mapped?.motivos || ['classe_unidade_ausente'],
    conversionInvented: false, approvedByName: false });
  }
  return { processed: rows.length, deterministicallyReleased: released.length, released,
    pending: decisions.length, verifiedUnitRows: verifiedUnits.length, catalog, decisions };
}
