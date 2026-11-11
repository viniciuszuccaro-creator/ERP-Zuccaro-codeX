import { isDeepStrictEqual } from 'node:util';

const fields = Object.freeze({ rg: 'RG', numero_caixa_postal: 'NUMEROCXPOSTAL',
  cep_caixa_postal: 'CEPCXPOSTAL', caixa_postal_cobranca: 'CAIXAPOSTALCOBRANCA',
  inscricao_produtor_rural: 'INSCRICAOPRODUTORRURAL' });

/** Field-level continuation of the existing mapper. No inferred local or commercial link. */
export function mapLegadoClienteMasterFields(record, { validateFields } = {}) {
  if (typeof validateFields !== 'function') throw Error('MASTER_VALIDATOR_REQUIRED');
  const { nativeParent, nativeKey, canonical, sourceSystem } = record || {};
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const keyValid = (typeof nativeKey === 'string' && nativeKey.length > 0)
    || (typeof nativeKey === 'number' && Number.isSafeInteger(nativeKey));
  if (!keyValid || !nativeParent || !Object.hasOwn(nativeParent, 'CODIGOCLIENTE') || !canonical
    || canonical.empresa_id !== null || !uuid.test(canonical.id || '') || !uuid.test(canonical.group_id || '')
    || typeof sourceSystem !== 'string' || !sourceSystem
    || canonical.source_system !== sourceSystem || canonical.codigo_legado !== String(nativeKey)
    || typeof nativeParent.CODIGOCLIENTE !== typeof nativeKey || nativeParent.CODIGOCLIENTE !== nativeKey) {
    throw Error('MASTER_NATIVE_CANONICAL_BINDING_REQUIRED');
  }
  const masterFields = {}, candidates = {}, pending = [], provenance = [];
  for (const [target, native] of Object.entries(fields)) {
    const raw = nativeParent[native];
    const entry = { table: 'Clientes', nativeKey, native, target, transformation: 'none' };
    const defer = reason => pending.push({ ...entry, reason });
    if (!Object.hasOwn(nativeParent, native)) { defer('SOURCE_FIELD_NOT_LOADED'); continue; }
    if (raw == null || (typeof raw === 'string' && !raw.trim())) {
      provenance.push({ ...entry, outcome: 'ABSENT_SOURCE' }); continue;
    }
    if (typeof raw !== 'string') { defer('SOURCE_TYPE_UNPROVEN'); continue; }
    const value = raw.trim();
    entry.transformation = raw === value ? 'none' : 'trim-boundary';
    if (target === 'rg' && /^0+$/.test(value.replace(/[.\-\s/]/g, ''))) { defer('SOURCE_PLACEHOLDER'); continue; }
    const result = validateFields({ [target]: value });
    if (result?.success !== true || !isDeepStrictEqual(result.data, { [target]: value })) {
      defer('SOURCE_FIELD_INVALID'); continue;
    }
    candidates[target] = value;
    if (!Object.hasOwn(canonical, target)) { defer('TARGET_STORAGE_NOT_REVIEWED'); continue; }
    if (canonical[target] != null && canonical[target] !== '') {
      if (canonical[target] === value) provenance.push({ ...entry, outcome: 'ALREADY_COMPATIBLE' });
      else defer('TARGET_VALUE_CONFLICT');
      continue;
    }
    masterFields[target] = value;
    provenance.push({ ...entry, outcome: 'READY' });
  }
  return { masterFields, candidates, pending, provenance, businessWrites: 0,
    status: pending.length ? 'partial' : Object.keys(masterFields).length ? 'ready' : 'unchanged' };
}
