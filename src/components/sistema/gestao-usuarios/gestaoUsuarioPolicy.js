/**
 * @typedef {Record<string, unknown> & {
 *   perfil_acesso_id?: string,
 *   nivel_acesso_contexto?: string,
 *   escopo_acesso?: string,
 *   empresas_vinculadas?: unknown[],
 *   restricoes_adicionais?: Partial<UserAccessRestrictions>,
 *   autenticacao_dois_fatores?: boolean,
 *   telefone?: string,
 *   cargo?: string,
 *   departamento?: string,
 *   usuario_piloto?: boolean,
 *   papel_piloto?: string,
 * }} UserAccessSource
 * @typedef {{
 *   pode_ver_apenas_proprios_registros: boolean,
 *   limite_aprovacao_valor: number,
 *   departamentos_permitidos: string[],
 *   centros_custo_permitidos: string[],
 * }} UserAccessRestrictions
 * @typedef {{
 *   perfil_acesso_id: string,
 *   nivel_acesso_contexto: string,
 *   empresas_vinculadas: string[],
 *   restricoes_adicionais: UserAccessRestrictions,
 *   autenticacao_dois_fatores: boolean,
 *   telefone: string,
 *   cargo: string,
 *   departamento: string,
 *   usuario_piloto: boolean,
 *   papel_piloto: string,
 * }} UserAccessFormData
 */

/** @param {unknown} values */
export const normalizeEmpresaIds = (values = []) => (Array.isArray(values) ? values : [])
  .map((item) => (typeof item === "string" ? item : item?.empresa_id || item?.id))
  .filter(Boolean)
  .map(String);

/** @param {unknown} value @param {number} max */
export const sanitizeText = (value, max = 120) => String(value || "")
  .replace(/[<>]/g, "")
  .replace(/javascript:/gi, "")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, max);

/** @param {unknown} value */
export const sanitizePhone = (value) => String(value || "")
  .replace(/[^\d()+\-\s]/g, "")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, 30);

/** @param {unknown} values */
export const sanitizeList = (values = []) => (Array.isArray(values) ? values : [])
  .map((item) => sanitizeText(item, 60))
  .filter(Boolean)
  .slice(0, 50);

/** @param {unknown} value */
export const sanitizeCurrencyLimit = (value) => {
  const parsed = Number.parseFloat(String(value ?? ""));
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.min(parsed, 999999999.99);
};

/** @param {UserAccessSource | null | undefined} usuario @returns {UserAccessFormData} */
export const createInitialUserAccessForm = (usuario) => ({
  perfil_acesso_id: usuario?.perfil_acesso_id || "sem-perfil",
  nivel_acesso_contexto: usuario?.nivel_acesso_contexto || usuario?.escopo_acesso || "empresa",
  empresas_vinculadas: normalizeEmpresaIds(usuario?.empresas_vinculadas),
  restricoes_adicionais: {
    pode_ver_apenas_proprios_registros: usuario?.restricoes_adicionais?.pode_ver_apenas_proprios_registros === true,
    limite_aprovacao_valor: sanitizeCurrencyLimit(usuario?.restricoes_adicionais?.limite_aprovacao_valor),
    departamentos_permitidos: sanitizeList(usuario?.restricoes_adicionais?.departamentos_permitidos),
    centros_custo_permitidos: sanitizeList(usuario?.restricoes_adicionais?.centros_custo_permitidos),
  },
  autenticacao_dois_fatores: usuario?.autenticacao_dois_fatores === true,
  telefone: String(usuario?.telefone || ""),
  cargo: String(usuario?.cargo || ""),
  departamento: String(usuario?.departamento || ""),
  usuario_piloto: usuario?.usuario_piloto === true,
  papel_piloto: String(usuario?.papel_piloto || ""),
});
