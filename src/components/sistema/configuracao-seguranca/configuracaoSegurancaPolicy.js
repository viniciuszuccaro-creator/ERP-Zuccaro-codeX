const DEFAULT_SECURITY_CONFIG = {
  jwt_ativo: true,
  jwt_algoritmo: 'HS256',
  jwt_validade_access_minutos: 15,
  jwt_validade_refresh_dias: 30,
  jwt_rotacao_refresh: true,
  jwt_familia_tokens: true,
  jwt_revogar_familia_em_suspeita: true,
  sessao_unica: false,
  sessoes_simultaneas_max: 3,
  encerrar_sessoes_antigas_auto: true,
  timeout_inatividade_minutos: 60,
  timeout_absoluto_horas: 24,
  exigir_mfa: false,
  mfa_metodos_disponiveis: ['Email', 'WhatsApp'],
  mfa_validade_codigo_minutos: 5,
  mfa_exigir_novo_ip: true,
  mfa_exigir_novo_dispositivo: true,
  mfa_exigir_horario_incomum: false,
  tentativas_login_max: 5,
  bloqueio_tempo_minutos: 30,
  bloqueio_ip_suspeito: true,
  detectar_anomalias_ia: false,
  registrar_dispositivos: true,
  notificar_novo_dispositivo: true,
  notificar_novo_ip: true,
  politica_senha: {
    tamanho_minimo: 8,
    exigir_maiusculas: true,
    exigir_minusculas: true,
    exigir_numeros: true,
    exigir_especiais: false,
    trocar_senha_dias: 90,
    historico_senhas: 3
  }
};

/**
 * @typedef {typeof DEFAULT_SECURITY_CONFIG & {
 *   id?: string,
 *   empresa_id?: unknown,
 *   group_id?: unknown,
 *   origem_configuracao?: string,
 *   estatisticas?: {
 *     total_sessoes_ativas?: number,
 *     total_tentativas_falhas?: number,
 *     total_bloqueios?: number,
 *     total_mfa_validados?: number,
 *   },
 * }} SecurityConfig
 * @typedef {{ empresaId?: string | null, grupoId?: string | null }} ConfiguracaoSegurancaProps
 * @typedef {{ acao: string, descricao: string, dadosNovos?: unknown, dadosAnteriores?: unknown }} SecurityAuditOptions
 */

/** @param {unknown} value @param {boolean} fallback */
const toBool = (value, fallback = false) => typeof value === 'boolean' ? value : fallback;
/** @param {unknown} value @param {number} fallback */
const toInt = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;

/**
 * @param {Partial<SecurityConfig> & Record<string, unknown>} data
 * @returns {SecurityConfig}
 */
export const normalizeSecurityConfig = (data = {}) => {
  const merged = {
    ...DEFAULT_SECURITY_CONFIG,
    ...data,
    politica_senha: {
      ...DEFAULT_SECURITY_CONFIG.politica_senha,
      ...(data?.politica_senha || {})
    }
  };

  return /** @type {SecurityConfig} */ ({
    ...merged,
    jwt_ativo: toBool(merged.jwt_ativo, true),
    jwt_validade_access_minutos: toInt(merged.jwt_validade_access_minutos, 15),
    jwt_validade_refresh_dias: toInt(merged.jwt_validade_refresh_dias, 30),
    jwt_rotacao_refresh: toBool(merged.jwt_rotacao_refresh, true),
    jwt_familia_tokens: toBool(merged.jwt_familia_tokens, true),
    jwt_revogar_familia_em_suspeita: toBool(merged.jwt_revogar_familia_em_suspeita, true),
    sessao_unica: toBool(merged.sessao_unica, false),
    sessoes_simultaneas_max: toInt(merged.sessoes_simultaneas_max, 3),
    encerrar_sessoes_antigas_auto: toBool(merged.encerrar_sessoes_antigas_auto, true),
    timeout_inatividade_minutos: toInt(merged.timeout_inatividade_minutos, 60),
    timeout_absoluto_horas: toInt(merged.timeout_absoluto_horas, 24),
    exigir_mfa: toBool(merged.exigir_mfa, false),
    mfa_metodos_disponiveis: Array.isArray(merged.mfa_metodos_disponiveis) ? merged.mfa_metodos_disponiveis : DEFAULT_SECURITY_CONFIG.mfa_metodos_disponiveis,
    mfa_validade_codigo_minutos: toInt(merged.mfa_validade_codigo_minutos, 5),
    mfa_exigir_novo_ip: toBool(merged.mfa_exigir_novo_ip, true),
    mfa_exigir_novo_dispositivo: toBool(merged.mfa_exigir_novo_dispositivo, true),
    mfa_exigir_horario_incomum: toBool(merged.mfa_exigir_horario_incomum, false),
    tentativas_login_max: toInt(merged.tentativas_login_max, 5),
    bloqueio_tempo_minutos: toInt(merged.bloqueio_tempo_minutos, 30),
    bloqueio_ip_suspeito: toBool(merged.bloqueio_ip_suspeito, true),
    detectar_anomalias_ia: toBool(merged.detectar_anomalias_ia, false),
    registrar_dispositivos: toBool(merged.registrar_dispositivos, true),
    notificar_novo_dispositivo: toBool(merged.notificar_novo_dispositivo, true),
    notificar_novo_ip: toBool(merged.notificar_novo_ip, true),
    politica_senha: {
      tamanho_minimo: toInt(merged.politica_senha?.tamanho_minimo, 8),
      exigir_maiusculas: toBool(merged.politica_senha?.exigir_maiusculas, true),
      exigir_minusculas: toBool(merged.politica_senha?.exigir_minusculas, true),
      exigir_numeros: toBool(merged.politica_senha?.exigir_numeros, true),
      exigir_especiais: toBool(merged.politica_senha?.exigir_especiais, false),
      trocar_senha_dias: toInt(merged.politica_senha?.trocar_senha_dias, 90),
      historico_senhas: toInt(merged.politica_senha?.historico_senhas, 3)
    }
  });
};

/** @param {SecurityConfig} data */
export const validateSecurityConfig = (data) => {
  const issues = [];
  if (data.jwt_ativo && data.jwt_validade_access_minutos < 5) issues.push('Access Token deve ter validade minima de 5 minutos.');
  if (data.jwt_ativo && data.jwt_validade_refresh_dias < 1) issues.push('Refresh Token deve ter validade minima de 1 dia.');
  if (data.exigir_mfa && (!Array.isArray(data.mfa_metodos_disponiveis) || data.mfa_metodos_disponiveis.length === 0)) issues.push('MFA exige ao menos um metodo disponivel.');
  if ((data.politica_senha?.tamanho_minimo || 0) < 8) issues.push('Politica de senha deve exigir no minimo 8 caracteres.');
  if (data.tentativas_login_max < 3) issues.push('Tentativas maximas de login deve ser no minimo 3.');
  return issues;
};
