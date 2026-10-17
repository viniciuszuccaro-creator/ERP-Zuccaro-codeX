import type { Oportunidade } from '../repositories/oportunidadeTypes.js';

// Deliberate download projection: no contact details, notes, actors or replay keys.
export const OPORTUNIDADE_CSV_COLUMNS = ['id','codigo','codigo_oportunidade','titulo','etapa','status',
  'cliente_empresa_id','valor_estimado','probabilidade','data_abertura','data_previsao',
  'data_proxima_acao','orcamento_id','pedido_id','ativo','version'] as const satisfies readonly (keyof Oportunidade)[];
export const OPORTUNIDADE_EXPORT_LIMIT = 2000;

function cell(value: unknown): string {
  let text = value == null ? '' : String(value);
  // Quoting alone does not stop spreadsheet formula evaluation, including after whitespace.
  if (/^[\s\u0000-\u001f]*[=+@-]/u.test(text) || /^[\t\r\n]/u.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"','""')}"`;
}

export function oportunidadeCsv(rows: readonly Oportunidade[]): string {
  return '\uFEFF' + [OPORTUNIDADE_CSV_COLUMNS.map(cell).join(';'),
    ...rows.map(row => OPORTUNIDADE_CSV_COLUMNS.map(key => cell(row[key])).join(';'))].join('\r\n') + '\r\n';
}
