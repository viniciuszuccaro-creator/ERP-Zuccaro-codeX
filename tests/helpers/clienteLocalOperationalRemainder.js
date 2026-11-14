import assert from 'node:assert/strict';

// Only the reviewed transport wiring is peeled; all ancestral pins remain intact.
export function clienteLocalOperationalRemainder(file, text) {
  let source = text.replace(/\r\n/g, '\n');
  const changes = file === 'src/api/httpApiClient.js' ? [
    ["import { createClienteLocalBatchHttpApi } from './clienteLocalBatchHttp.js';\n", ''],
    ['    ...createClienteLocalBatchHttpApi({ request, getScope, createHttpError }),\n', ''],
  ] : file === 'server/src/api/router.ts' ? [
    ['service.snapshot(ctxFromReq(req), req.params.clienteId, req.query.include_review === \'true\')',
      'service.snapshot(ctxFromReq(req), req.params.clienteId)'],
  ] : [];
  if (!changes.some(([after]) => source.includes(after))) return text;
  for (const [after, before] of changes) {
    assert.equal(source.split(after).length, 2, file + ': exact operational wiring');
    source = source.replace(after, () => before);
  }
  return text.includes('\r\n') ? source.replace(/\n/g, '\r\n') : source;
}
