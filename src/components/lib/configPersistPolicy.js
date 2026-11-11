/**
 * Política de persistência de ConfiguracaoSistema / upsertConfig.
 * Modo local explícito pode usar fallback entity; HTTP/remote não.
 */

/**
 * @param {{ localOnly?: boolean, httpMode?: boolean }} [flags]
 * @returns {boolean}
 */
export function canFallbackConfigToLocalEntity({
  localOnly = false,
  httpMode = false,
} = {}) {
  return Boolean(localOnly) && !httpMode;
}
