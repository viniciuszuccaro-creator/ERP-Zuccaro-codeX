import type { Oportunidade } from '../repositories/oportunidadeTypes.js';

/** Read-only Central projection. Contact PII, free-text notes, actor IDs and replay keys stay in CRM. */
export function projectCentralCrm(row:Oportunidade) {
  return {id:row.id,codigo:row.codigo,codigo_oportunidade:row.codigo_oportunidade,
    titulo:row.titulo,etapa:row.etapa,status:row.status,valor_estimado:row.valor_estimado,
    probabilidade:row.probabilidade,data_abertura:row.data_abertura,data_previsao:row.data_previsao,
    orcamento_id:row.orcamento_id,pedido_id:row.pedido_id,convertido_em:row.convertido_em,
    convertido_em_id:row.convertido_em_id,version:row.version};
}
