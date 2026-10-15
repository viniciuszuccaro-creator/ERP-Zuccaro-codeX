/**
 * Wrapper compatível. A regra mora em `server/src/domain/crmOportunidadePolicy.js`.
 * Não acrescentar comportamento aqui.
 */
export {
  CRM_ENTITIES,
  CRM_ETAPAS,
  isCrmEntity,
  digitsOnly,
  normalizeEtapaCrm,
  oportunidadeAberta,
  oportunidadeIdempotencyKey,
  findDuplicateOportunidade,
  stampOportunidadeDefaults,
  assertOportunidadeOnCreate,
  assertInteracaoOnCreate,
  assertCampanhaOnCreate,
  assertOportunidadeOnUpdate,
  oportunidadeStatusPermissionActions,
  assertConversaoOportunidade,
  buildDocumentoFromOportunidade,
  stampOportunidadeConvertida,
  applyCrmCreate,
} from '../../../server/src/domain/crmOportunidadePolicy.js';
