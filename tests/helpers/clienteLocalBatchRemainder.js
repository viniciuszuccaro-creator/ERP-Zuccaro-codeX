import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export const localBatchRoutesHunk = `
  router.get(\`\${basePath}/snapshot\`, requireTenantScope, async (req, res, next) => {
    try { res.json(await service.snapshot(ctxFromReq(req), req.params.clienteId)); }
    catch (error) { next(error); }
  });

  router.post(\`\${basePath}/sync\`, requireTenantScope, async (req, res, next) => {
    try { res.json(await service.sync(ctxFromReq(req), req.params.clienteId, req.body)); }
    catch (error) { next(error); }
  });
`;

// Keep all historical pins: peel only this exact new wiring, then compare the whole prior router.
export function clienteLocalBatchRemainder(file, text, required = false) {
  if (file !== 'server/src/api/router.ts') return text;
  const source = text.replace(/\r\n/g, '\n');
  if (!required && !source.includes('service.snapshot(') && !source.includes('service.sync(')) return text;
  assert.equal(source.split(localBatchRoutesHunk).length, 2, 'exact local batch routes');
  const before = source.replace(localBatchRoutesHunk, '');
  assert.equal(createHash('sha256').update(before).digest('hex'),
    '14be285cc1daf96e013355e2a4a6f105a1957f680ace919345a7bf46aeb9da61',
    'entire router before local batch');
  return text.includes('\r\n') ? before.replace(/\n/g, '\r\n') : before;
}
