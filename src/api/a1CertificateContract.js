import { z } from 'zod';

const metadata = z.object({
  id: z.string().uuid(),
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/i),
  validFrom: z.string().refine(value => Number.isFinite(Date.parse(value))),
  validTo: z.string().refine(value => Number.isFinite(Date.parse(value))),
  state: z.literal('ACTIVE'),
  revision: z.string().regex(/^[1-9]\d*$/),
  trustStoreVersion: z.string().min(1).max(200),
}).strict();

/** Only public metadata from the canonical vault may enter UI state/cache. */
export function parseA1CertificateMetadata(value) {
  if (value === null) return null;
  const result = metadata.safeParse(value);
  if (!result.success || Date.parse(result.data.validFrom) >= Date.parse(result.data.validTo)) {
    throw Object.assign(new Error('Resposta do cofre A1 invalida.'), { code: 'A1_RESPONSE_INVALID', status: 502 });
  }
  return result.data;
}
