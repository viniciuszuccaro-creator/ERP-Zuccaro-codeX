import { createHash } from 'node:crypto';
import { mapLegadoRowToCanonicalStub, catalogarProdutoClasseUnidadeLegado } from './mapear-registro-sintetico.mjs';
import { resolveProdutoTipoImportacao } from '../../src/components/cadastros/produto/produtoTipoPolicy.js';

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

/** Private rule review: native identities resolve provenance, never semantic approval by name. */
export function resolveNativeProductRules(rows, materials, unitRows, { groupId, classificationRules = [], units = [] } = {}) {
  const byCode = new Map(), details = [], released = [], decisions = new Map();
  const truth = value => value === true || value === 'true';
  const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
  const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
  for (const material of materials) {
    const key = String(material.CODIGOMATERIAL ?? '');
    const entries = byCode.get(key) || []; entries.push(material); byCode.set(key, entries);
  }
  for (const [index, row] of rows.entries()) {
    const identities = [...new Set([row.codigo_legado, row.codigo_origem, row.id_antigo].filter(Boolean).map(String))];
    const source = identities.length === 1 ? byCode.get(identities[0]) || [] : [];
    const triples = [...new Set(source.map(r => JSON.stringify([r.CODIGOCLASSE, r.UNIDADE, r.TIPOMATERIAL])))];
    const native = triples.length === 1 ? JSON.parse(triples[0]).map(v => String(v ?? '')) : null;
    const reasons = [];
    let classification, unit;
    if (identities.length !== 1 || !native || native.some(v => !v)) reasons.push('NATIVE_IDENTITY_OR_DEFINITION_CONFLICT');
    else {
      const matches = classificationRules.filter(rule => rule.group_id === groupId
        && rule.sourceClassIds?.includes(native[0]) && rule.sourceTypeId === native[2]
        && truth(rule.semantic_verified) && digest(rule.contract_sha256));
      const types = [...new Set(matches.map(rule => {
        const resolved = resolveProdutoTipoImportacao(rule.tipo_item);
        return resolved && !resolved.requiresReview && !resolved.usedDefault ? resolved.value : null;
      }).filter(Boolean))];
      const nativeType = resolveProdutoTipoImportacao(native[2]);
      const nativeTypeProven = !nativeType.requiresReview && !nativeType.usedDefault;
      if (nativeTypeProven && types.every(type => type === nativeType.value)) classification = nativeType.value;
      else if (!nativeTypeProven && types.length === 1 && matches.every(rule => {
        const resolved = resolveProdutoTipoImportacao(rule.tipo_item);
        return resolved && !resolved.requiresReview && !resolved.usedDefault;
      })) classification = types[0];
      else reasons.push('NATIVE_TYPE_TO_CANONICAL_CLASSIFICATION_REQUIRES_CONTRACT');
      const approved = unitRows.filter(r => String(r.source_unit_code).trim() === native[1].trim() && uuid(r.approved_target_unit_id)
        && truth(r.scope_verified) && truth(r.semantic_equivalence_verified));
      const targets = [...new Set(approved.map(r => r.approved_target_unit_id))];
      const candidates = targets.length === 1 ? units.filter(u => u.id === targets[0]) : [];
      const target = candidates.length === 1 && candidates[0].group_id === groupId && candidates[0].ativo === true ? candidates[0] : null;
      if (target) unit = target.id;
      else reasons.push('UNIT_NATIVE_ID_SEMANTICS_AND_TARGET_SCOPE_REQUIRE_EVIDENCE');
    }
    const item = { index, sourceCode: row.codigo_legado, sourceClass: native?.[0], sourceUnit: native?.[1].trim(), sourceUnitRaw: native?.[1],
      sourceType: native?.[2], canonicalClassification: classification ?? null,
      classificationProven: Boolean(classification), nativeIdentityProven: Boolean(native && native.every(Boolean) && identities.length === 1), reasons };
    details.push(item);
    if (!reasons.length) released.push({ ...item, tipo_item: classification, unidade_medida_id: unit,
      grupo_legado: native[0], grupo_produto_id: null });
    for (const reason of reasons) {
      const group = decisions.get(reason) || { reason, sourceClasses: new Set(), sourceTypes: new Set(), sourceUnits: new Set(), indices: [] };
      if (native) { group.sourceClasses.add(native[0]); group.sourceUnits.add(native[1].trim()); group.sourceTypes.add(native[2]); }
      group.indices.push(index); decisions.set(reason, group);
    }
  }
  return { processed: rows.length, nativeIdentitiesProven: details.filter(x => x.nativeIdentityProven).length,
    classificationsProven: details.filter(x => x.classificationProven).length,
    released, pending: rows.length - released.length, details,
    decisions: [...decisions.values()].map(d => ({ ...d, sourceClasses: [...d.sourceClasses], sourceTypes: [...d.sourceTypes], sourceUnits: [...d.sourceUnits] })),
    conversionFactorsInvented: 0, approvalsByName: 0 };
}

/** Availability is not completeness. No address-number/country inference or postal lookup. */
export function classifyLegacyAddresses(input, { validateAddress } = {}) {
  const entries = [];
  const required = ['nome', 'cep', 'logradouro', 'numero', 'bairro', 'cidade', 'uf', 'pais', 'finalidades'];
  const add = (entity, index, kind, fields, conflict = []) => {
    const available = required.filter(k => k === 'finalidades' ? Array.isArray(fields[k]) && fields[k].length > 0
      : typeof fields[k] === 'string' && fields[k].trim());
    if (!available.length && !conflict.length) return;
    const missing = required.filter(k => !available.includes(k));
    if (fields.cep && String(fields.cep).replace(/\D/g, '').length !== 8) conflict.push('CEP_FORMAT');
    if (fields.uf && !/^[A-Za-z]{2}$/.test(String(fields.uf))) conflict.push('STATE_FORMAT');
    const checked = !missing.length && !conflict.length && typeof validateAddress === 'function'
      ? validateAddress(fields) : null;
    entries.push({ entity, index, kind, available, missing, conflicts: [...new Set(conflict)],
      canonicalReady: Boolean(checked?.success), sourcePreserved: true, fieldsInvented: [] });
  };
  for (const [index, row] of input.rows.cliente.entries()) {
    for (const [kind, prefix] of [['principal', 'endereco_'], ['cobranca', 'cobranca_']]) {
      const fields = Object.fromEntries(required.map(k => [k, row[prefix + k]]));
      const legacyState = row[prefix + 'estado'];
      const conflict = legacyState && fields.uf && String(legacyState).toUpperCase() !== String(fields.uf).toUpperCase()
        ? ['STATE_FIELDS_CONFLICT'] : [];
      fields.uf = fields.uf ?? legacyState;
      add('cliente', index, kind, fields, conflict);
    }
  }
  for (const [index, row] of input.rows.fornecedor.entries()) {
    add('fornecedor', index, 'principal', { logradouro: row.endereco, cep: row.cep,
      bairro: row.bairro, cidade: row.cidade, uf: row.estado });
    if (row.endereco_cobranca) {
      try {
        const value = JSON.parse(row.endereco_cobranca);
        if (!value || typeof value !== 'object' || Array.isArray(value)) add('fornecedor', index, 'cobranca', {}, ['BILLING_STRUCTURE']);
        else add('fornecedor', index, 'cobranca', { ...value, logradouro: value.logradouro ?? value.endereco,
          uf: value.uf ?? value.estado }, value.uf && value.estado && String(value.uf).toUpperCase() !== String(value.estado).toUpperCase()
          ? ['STATE_FIELDS_CONFLICT'] : []);
      } catch { add('fornecedor', index, 'cobranca', {}, ['BILLING_JSON_INVALID']); }
    }
  }
  const groups = new Map();
  for (const entry of entries) {
    const key = JSON.stringify([entry.entity, entry.kind, entry.available, entry.missing, entry.conflicts]);
    const group = groups.get(key) || { entity: entry.entity, kind: entry.kind, available: entry.available,
      missing: entry.missing, conflicts: entry.conflicts, count: 0, indices: [] };
    group.count++; group.indices.push(entry.index); groups.set(key, group);
  }
  return { addresses: entries.length, ready: entries.filter(e => e.canonicalReady).length,
    missingRequired: entries.filter(e => e.missing.length).length, conflicting: entries.filter(e => e.conflicts.length).length,
    entries, groups: [...groups.values()], fieldsInvented: 0 };
}

export function isReleasedProductPilotRow(raw) {
  return raw?.status === 'Ativo' && ['quarantine_reason', 'quarantine_reasons']
    .every(field => raw[field] == null || raw[field] === '' || raw[field] === '[]');
}

/** Review projection only: never grants permissions or authorizes an operational load. */
export function projectAssistedLegacyReview(evidence) {
  const operations = ['cadastro.utilizar', 'endereco.entrega', 'financeiro.cobrar', 'financeiro.baixar',
    'estoque.disponibilizar', 'fiscal.emitir'];
  const labels = {
    VALIDATED_ELIGIBLE: 'Validado e elegivel para uso',
    IMPORTED_PENDING: 'Importado com pendencia nao critica',
    REVIEW_REQUIRED: 'Disponivel para revisao, com operacao afetada bloqueada',
    HISTORY_ONLY: 'Historico somente para consulta/conciliacao',
  };
  if (!evidence || !Array.isArray(evidence.issues)) throw new Error('ASSISTED_REVIEW_EVIDENCE_REQUIRED');
  const reasons = evidence.issues.map(issue => {
    if (!issue || typeof issue.field !== 'string' || !issue.field || typeof issue.reason !== 'string'
        || !issue.reason || typeof issue.critical !== 'boolean' || !Array.isArray(issue.blocks)
        || issue.blocks.some(op => !operations.includes(op))) throw new Error('ASSISTED_REVIEW_FIELD_CONTRACT_REQUIRED');
    return { field: issue.field, reason: issue.reason, critical: issue.critical, blocks: [...new Set(issue.blocks)] };
  });
  const gates = ['identityVerified', 'scopeVerified', 'canonicalValidated', 'reconciled'];
  const unproven = gates.filter(gate => evidence[gate] !== true);
  for (const field of unproven) reasons.push({ field, reason: 'EVIDENCE_NOT_PROVEN', critical: true, blocks: operations });
  if (evidence.imported !== true) reasons.push({ field: 'persistence', reason: 'NOT_IMPORTED', critical: true, blocks: operations });
  if (evidence.ambiguousIdentity === true || evidence.destinationConflict === true)
    reasons.push({ field: 'identity', reason: 'IDENTITY_OR_DESTINATION_CONFLICT', critical: true, blocks: operations });
  const history = evidence.historyOnly === true || evidence.sourceInactive === true || evidence.batchReverted === true;
  const critical = reasons.some(reason => reason.critical);
  const status = history ? 'HISTORY_ONLY' : critical || evidence.imported !== true ? 'REVIEW_REQUIRED'
    : reasons.length ? 'IMPORTED_PENDING' : 'VALIDATED_ELIGIBLE';
  const blocked = new Set(history ? operations : reasons.flatMap(reason => reason.blocks));
  if (status !== 'VALIDATED_ELIGIBLE') for (const op of operations.filter(op => /^(financeiro|estoque|fiscal)\./.test(op))) blocked.add(op);
  return { status, label: labels[status], reasons, blockedOperations: [...blocked].sort(),
    originalPreserved: true, autoMerge: false, grantsPermissions: false, operationalLoadAuthorized: false };
}
