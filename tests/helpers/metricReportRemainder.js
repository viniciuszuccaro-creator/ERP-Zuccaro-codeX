import assert from 'node:assert/strict';

export function metricReportRemainder(file, source) {
  if (file !== 'src/components/expedicao/RelatoriosLogistica.jsx') return source;
  const after = 'Number(taxa) >= 90';
  assert.equal(source.split(after).length, 2, 'exactly one report numeric conversion');
  return source.replace(after, 'parseFloat(taxa) >= 90');
}
