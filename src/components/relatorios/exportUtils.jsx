import { serializeReportCsv } from '../../../base44/functions/_lib/security/entityReadPolicy/csv.js';

export function exportarCSV(dados, nomeArquivo) {
  if (!dados || dados.length === 0) return;
  const csv = serializeReportCsv(dados);
  const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' }));
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = `${String(nomeArquivo).replace(/[^a-zA-Z0-9_-]/g,'_')}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  } finally { URL.revokeObjectURL(url); }
}
