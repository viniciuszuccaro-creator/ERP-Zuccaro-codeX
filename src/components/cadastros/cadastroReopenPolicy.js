/**
 * Decisão canônica de reidratação ao reabrir cadastro por id / updated_date.
 *
 * - identidade estável: keep
 * - troca de id + limpo: apply
 * - troca de id + sujo: confirmSwitch → apply | acknowledge (sem sobrescrita silenciosa)
 * - mesmo id + updated_date novo + limpo OU form == servidor (eco do próprio save): apply
 * - mesmo id + updated_date novo + sujo divergente: confirmDiscard → apply | acknowledge
 *
 * acknowledge: reconhece a versão/navegação sem sobrescrever o rascunho.
 */

/** Metadados de identidade/versão — não entram no snapshot de dirty/match. */
const IDENTITY_META_KEYS = new Set([
  "id",
  "updated_date",
  "updated_at",
  "created_date",
  "created_at",
]);

export function cadastroFormSnapshot(value) {
  if (value == null || typeof value !== "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  try {
    if (Array.isArray(value)) return JSON.stringify(value);
    const copy = { ...value };
    for (const key of IDENTITY_META_KEYS) delete copy[key];
    return JSON.stringify(copy);
  } catch {
    return "[unserializable]";
  }
}

export function decideCadastroReopen({
  idChanged,
  updatedChanged,
  isDirty,
  matchesIncoming,
  confirmDiscard,
  confirmSwitch,
}) {
  if (!idChanged && !updatedChanged) return "keep";

  if (idChanged) {
    if (!isDirty) return "apply";
    const ok = typeof confirmSwitch === "function"
      ? confirmSwitch()
      : (typeof confirmDiscard === "function" ? confirmDiscard() : false);
    return ok ? "apply" : "acknowledge";
  }

  // updatedChanged no mesmo id
  if (matchesIncoming || !isDirty) return "apply";
  return typeof confirmDiscard === "function" && confirmDiscard() ? "apply" : "acknowledge";
}

export function isCadastroFormDirty(formData, baselineJson) {
  if (baselineJson == null) return false;
  return cadastroFormSnapshot(formData) !== baselineJson;
}

export function cadastroFormMatchesIncoming(formData, incoming) {
  if (incoming == null) return false;
  return cadastroFormSnapshot(formData) === cadastroFormSnapshot(incoming);
}

export const CADASTRO_DIRTY_REOPEN_CONFIRM =
  "Há alterações não salvas. Descartar o rascunho e carregar a versão atualizada do servidor?";

export const CADASTRO_DIRTY_SWITCH_CONFIRM =
  "Há alterações não salvas. Descartar o rascunho e abrir o outro registro?";
