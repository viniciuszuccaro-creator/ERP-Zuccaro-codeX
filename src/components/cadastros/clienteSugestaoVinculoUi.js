/**
 * UI pura da sugestão de vínculo por documento (Onda 3).
 * Não mescla, não cria cliente e não copia saldo — só decide o banner.
 */

/**
 * Chave de corrida para ignorar resposta atrasada após troca de
 * documento/grupo/empresa (fail-closed: não pintar banner de outro escopo).
 * @param {{ documento?: unknown, groupId?: unknown, empresaId?: unknown }} input
 * @returns {string}
 */
export function buildClienteSugestaoVinculoRaceKey(input = {}) {
  const doc = digitsDocumento(input.documento);
  const groupId = String(input.groupId ?? '').trim() || 'sem-grupo';
  const empresaId = String(input.empresaId ?? '').trim() || 'sem-empresa';
  return `${groupId}|${empresaId}|${doc || 'sem-documento'}`;
}

/**
 * @param {string} expectedKey
 * @param {string} responseKey
 * @returns {boolean}
 */
export function shouldApplyClienteSugestaoVinculoBanner(expectedKey, responseKey) {
  if (!expectedKey || !responseKey) return false;
  return expectedKey === responseKey;
}

/**
 * @param {unknown} value
 * @returns {string} só dígitos
 */
export function digitsDocumento(value) {
  return String(value ?? '').replace(/\D/g, '');
}

/**
 * Documento pronto para consulta HTTP (CPF 11 / CNPJ 14).
 * @param {unknown} value
 * @returns {string | null}
 */
export function documentoProntoParaSugestao(value) {
  const digits = digitsDocumento(value);
  if (digits.length === 11 || digits.length === 14) return digits;
  return null;
}

/**
 * Normaliza resposta do BFF (ou erro) em estado de banner fail-closed.
 * @param {{
 *   ok?: boolean,
 *   status?: number,
 *   data?: {
 *     sugestao?: boolean,
 *     motivo?: string,
 *     mescla?: string,
 *     codigo?: string | null,
 *     nome?: string | null,
 *     documento_mascarado?: string | null,
 *     cliente_id?: string | null,
 *   } | null,
 *   errorCode?: string | null,
 * }} input
 */
export function buildClienteSugestaoVinculoBanner(input = {}) {
  if (input.ok === false) {
    const status = Number(input.status) || 0;
    if (status === 401 || status === 403) {
      return {
        visible: true,
        tone: 'blocked',
        title: 'Consulta de vínculo indisponível',
        detail: 'Sem permissão ou sessão para sugerir vínculo por documento.',
        mescla: 'proibida',
      };
    }
    return {
      visible: true,
      tone: 'blocked',
      title: 'Falha ao consultar vínculo',
      detail: 'Não foi possível verificar duplicidade neste momento. Tente novamente.',
      mescla: 'proibida',
    };
  }

  const data = input.data && typeof input.data === 'object' ? input.data : null;
  if (!data) {
    return { visible: false, tone: 'idle', title: '', detail: '', mescla: 'proibida' };
  }

  if (data.sugestao === true) {
    const codigo = data.codigo != null ? String(data.codigo) : '';
    const nome = data.nome != null ? String(data.nome) : '';
    const doc = data.documento_mascarado != null ? String(data.documento_mascarado) : '';
    const parts = [
      doc ? `Documento ${doc}` : null,
      codigo ? `código ${codigo}` : null,
      nome ? nome : null,
    ].filter(Boolean);
    return {
      visible: true,
      tone: 'match',
      title: 'Cliente já existe neste Grupo',
      detail: `${parts.join(' · ')}. Mescla automática proibida — revisão humana obrigatória.`,
      mescla: String(data.mescla || 'revisao_humana_obrigatoria'),
      clienteId: data.cliente_id ? String(data.cliente_id) : null,
    };
  }

  if (data.motivo === 'documento_ausente') {
    return { visible: false, tone: 'idle', title: '', detail: '', mescla: 'proibida' };
  }

  // sem_match ou equivalente: não afirmar "livre" como garantia de create.
  return {
    visible: false,
    tone: 'idle',
    title: '',
    detail: '',
    mescla: String(data.mescla || 'proibida'),
  };
}
