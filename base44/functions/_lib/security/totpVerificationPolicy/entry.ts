const MFA_STEP_MS = 5 * 60 * 1000;
const MFA_REQUEST_WINDOW_MS = 15 * 60 * 1000;
const MFA_REQUEST_COOLDOWN_MS = 60 * 1000;
const MFA_MAX_REQUESTS = 5;
const MFA_VERIFY_WINDOW_MS = 5 * 60 * 1000;
const MFA_MAX_VERIFY_FAILURES = 5;
const MFA_DELIVERY_MAX_SKEW_MS = 60 * 1000;

const text = (value) => String(value || '').trim();
const normalizeId = (value) => text(value);

const hasActiveLink = (links, id, type) => Array.isArray(links) && links.some((link) => {
  if (typeof link === 'string') return normalizeId(link) === id;
  if (!link || typeof link !== 'object' || link.ativo === false) return false;
  const linkedId = type === 'group'
    ? link.grupo_id || link.group_id || link.id
    : link.empresa_id || link.company_id || link.id;
  return normalizeId(linkedId) === id;
});

export const isSixDigitMfaCode = (value) => /^\d{6}$/.test(text(value));

export const validateMfaProviderConfig = ({ provider, secret }) => {
  const normalizedProvider = text(provider).toLowerCase();
  if (!['email', 'whatsapp'].includes(normalizedProvider)) {
    return { valid: false, error: 'mfa_provider_unavailable', provider: null };
  }
  if (text(secret).length < 32) {
    return { valid: false, error: 'mfa_secret_unavailable', provider: normalizedProvider };
  }
  return { valid: true, error: null, provider: normalizedProvider };
};

export const resolveMfaDestination = (provider, user = {}) => {
  if (provider === 'email') {
    const email = text(user.email).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return { valid: false, error: 'mfa_email_unavailable', destination: null, masked: null };
    }
    const [local, domain] = email.split('@');
    return {
      valid: true,
      error: null,
      destination: email,
      masked: `${local.slice(0, 2)}${'*'.repeat(Math.max(local.length - 2, 2))}@${domain}`,
    };
  }
  if (provider === 'whatsapp') {
    const phone = text(user.telefone || user.whatsapp || user.celular || user.phone).replace(/\D/g, '');
    if (!/^\d{10,15}$/.test(phone)) {
      return { valid: false, error: 'mfa_whatsapp_unavailable', destination: null, masked: null };
    }
    return {
      valid: true,
      error: null,
      destination: phone,
      masked: phone.replace(/\d(?=\d{4})/g, '*'),
    };
  }
  return { valid: false, error: 'mfa_provider_unavailable', destination: null, masked: null };
};

const auditTime = (record) => Date.parse(record?.created_date || record?.data_hora || '');
const auditReason = (record) => text(record?.dados_novos?.motivo);

export const evaluateMfaRequestRateLimit = (records = [], nowMs = Date.now()) => {
  const requests = records
    .filter((record) => ['challenge_sent', 'challenge_reused', 'challenge_delivery_failed', 'challenge_rate_limited'].includes(auditReason(record)))
    .map((record) => auditTime(record))
    .filter((timestamp) => Number.isFinite(timestamp) && timestamp <= nowMs && nowMs - timestamp <= MFA_REQUEST_WINDOW_MS)
    .sort((left, right) => right - left);
  if (requests.length >= MFA_MAX_REQUESTS) {
    return { allowed: false, reused: false, reason: 'challenge_rate_limited', retryAfterSeconds: null };
  }
  const sent = records
    .filter((record) => auditReason(record) === 'challenge_sent')
    .map((record) => auditTime(record))
    .filter((timestamp) => Number.isFinite(timestamp) && timestamp <= nowMs && nowMs - timestamp <= MFA_REQUEST_WINDOW_MS)
    .sort((left, right) => right - left);
  if (sent[0] && nowMs - sent[0] < MFA_REQUEST_COOLDOWN_MS) {
    return {
      allowed: true,
      reused: true,
      reason: 'challenge_reused',
      retryAfterSeconds: Math.ceil((MFA_REQUEST_COOLDOWN_MS - (nowMs - sent[0])) / 1000),
    };
  }
  return { allowed: true, reused: false, reason: 'challenge_allowed', retryAfterSeconds: 0 };
};

export const evaluateMfaVerificationRateLimit = (records = [], nowMs = Date.now()) => {
  const failures = records.filter((record) => {
    const timestamp = auditTime(record);
    return ['invalid_code', 'invalid_code_format', 'rate_limited'].includes(auditReason(record))
      && Number.isFinite(timestamp)
      && timestamp <= nowMs
      && nowMs - timestamp <= MFA_VERIFY_WINDOW_MS;
  });
  return failures.length >= MFA_MAX_VERIFY_FAILURES
    ? { allowed: false, reason: 'rate_limited' }
    : { allowed: true, reason: 'verification_allowed' };
};

export const evaluateMfaScopeAccess = (context, { user, groups = [], companies = [] } = {}) => {
  if (!user?.id) return { allowed: false, reason: 'unauthorized' };
  const groupId = normalizeId(context.groupId);
  const empresaId = normalizeId(context.empresaId);
  const groupExists = groups.some((group) => normalizeId(group.id) === groupId);
  if (!groupExists) return { allowed: false, reason: 'group_not_found' };

  const groupAllowed = normalizeId(user.grupo_atual_id) === groupId
    || normalizeId(user.grupo_padrao_id) === groupId
    || hasActiveLink(user.grupos_vinculados, groupId, 'group');
  if (!groupAllowed) return { allowed: false, reason: 'group_forbidden' };
  if (context.scopeType === 'grupo') {
    return user.pode_operar_em_grupo === false
      ? { allowed: false, reason: 'group_scope_forbidden' }
      : { allowed: true, reason: 'group_scope_allowed' };
  }

  const company = companies.find((item) => normalizeId(item.id) === empresaId);
  if (!company) return { allowed: false, reason: 'company_not_found' };
  const companyGroupId = normalizeId(company.group_id || company.grupo_id || company.grupo_empresarial_id);
  if (companyGroupId !== groupId) return { allowed: false, reason: 'company_outside_group' };
  const companyAllowed = user.pode_ver_todas_empresas === true
    || normalizeId(user.empresa_atual_id) === empresaId
    || normalizeId(user.empresa_padrao_id) === empresaId
    || hasActiveLink(user.empresas_vinculadas, empresaId, 'company');
  return companyAllowed
    ? { allowed: true, reason: 'company_scope_allowed' }
    : { allowed: false, reason: 'company_forbidden' };
};

const buildMessage = ({ userId, moduleName, section, groupId, empresaId, step }) => (
  `${text(userId)}|${text(moduleName)}|${text(section)}|${text(groupId)}|${text(empresaId)}|${step}`
);

const hmacSha256 = async (secret, message) => {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(text(secret)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(message)));
};

export const createScopedMfaCode = async ({ secret, userId, moduleName, section, groupId, empresaId, step }) => {
  const signature = await hmacSha256(secret, buildMessage({ userId, moduleName, section, groupId, empresaId, step }));
  const offset = signature[signature.length - 1] & 0x0f;
  const binary = ((signature[offset] & 0x7f) << 24)
    | ((signature[offset + 1] & 0xff) << 16)
    | ((signature[offset + 2] & 0xff) << 8)
    | (signature[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, '0');
};

const constantTimeEqual = (left, right) => {
  const a = text(left);
  const b = text(right);
  let difference = a.length ^ b.length;
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    difference |= (a.charCodeAt(index) || 0) ^ (b.charCodeAt(index) || 0);
  }
  return difference === 0;
};

const buildDeliveryMessage = ({ userId, groupId, empresaId, destination, message, timestamp }) => (
  `${text(userId)}|${text(groupId)}|${text(empresaId)}|${text(destination).replace(/\D/g, '')}|${text(timestamp)}|${text(message)}`
);

export const createMfaDeliverySignature = async (input) => {
  const signature = await hmacSha256(input.secret, buildDeliveryMessage(input));
  return Array.from(signature, (byte) => byte.toString(16).padStart(2, '0')).join('');
};

export const verifyMfaDeliverySignature = async (input, nowMs = Date.now()) => {
  const timestamp = Number(input.timestamp);
  if (!Number.isFinite(timestamp) || Math.abs(nowMs - timestamp) > MFA_DELIVERY_MAX_SKEW_MS) return false;
  if (!/^[a-f0-9]{64}$/i.test(text(input.signature)) || text(input.secret).length < 32) return false;
  const expected = await createMfaDeliverySignature(input);
  return constantTimeEqual(text(input.signature).toLowerCase(), expected);
};

export const verifyScopedMfaCode = async ({ code, secret, userId, moduleName, section, groupId, empresaId, nowMs = Date.now() }) => {
  if (!isSixDigitMfaCode(code)) return false;
  const currentStep = Math.floor(nowMs / MFA_STEP_MS);
  for (const step of [currentStep, currentStep - 1]) {
    const expected = await createScopedMfaCode({ secret, userId, moduleName, section, groupId, empresaId, step });
    if (constantTimeEqual(code, expected)) return true;
  }
  return false;
};

export const mfaStepForTime = (nowMs = Date.now()) => Math.floor(nowMs / MFA_STEP_MS);
