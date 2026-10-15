/**
 * Adaptador somente-leitura do CRM legado para a Central 360 (opção B do contrato Onda 3).
 * Não cria HTTP/tabela paralela — reutiliza a fonte Oportunidade já consumida pelo CRM.
 */

export const CRM_CANONICAL_HTTP_PENDING = 'CRM_CANONICAL_HTTP_PENDING';

/**
 * @param {{ status?: string, code?: string|null }} block
 */
export function shouldUseCrmLegadoAdapter(block) {
  if (!block || block.status !== 'skipped') return false;
  const code = String(block.code || '');
  return code === CRM_CANONICAL_HTTP_PENDING || code.includes('CRM_CANONICAL');
}

/**
 * @param {Array<Record<string, any>>} rows
 * @param {string} clienteId
 */
export function filterOportunidadesDoCliente(rows, clienteId) {
  const id = String(clienteId || '').trim();
  if (!id || !Array.isArray(rows)) return [];
  return rows.filter((row) => {
    const cid = row?.cliente_id || row?.clienteId || row?.cliente?.id;
    return cid != null && String(cid) === id;
  });
}

/**
 * @param {Record<string, any>} row
 */
export function resumirOportunidadeCrm(row) {
  return {
    id: row?.id || null,
    titulo: row?.titulo || row?.nome || '—',
    etapa: row?.etapa || row?.etapa_funil || row?.status || '—',
    valor: Number(row?.valor_estimado ?? row?.valor ?? 0) || 0,
    codigo: row?.codigo_oportunidade || row?.codigo || null,
  };
}
