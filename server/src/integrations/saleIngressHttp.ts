import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { AppConfig } from '../config/env.js';
import { AppError } from '../api/errors.js';
import { channelIdentitySchema, saleEnvelopeSchema, receiptQuerySchema, verifySale, type ChannelIdentity } from './saleIngressContract.js';
import { SaleIngress } from './saleIngress.js';

export function loadChannelIdentities(env: NodeJS.ProcessEnv): ChannelIdentity[] {
  if (env.ERP_OMNICHANNEL_ENABLED !== 'true') return [];
  const identities = z.array(channelIdentitySchema).min(1).max(100).safeParse(
    (() => { try { return JSON.parse(env.ERP_OMNICHANNEL_IDENTITIES ?? 'null'); } catch { return null; } })());
  if (!identities.success || new Set(identities.data.map((i) => i.id)).size !== identities.data.length) {
    // Never print parse issues: they may contain secret material.
    throw new Error('Invalid omnichannel identity configuration');
  }
  return identities.data;
}

export function saleIngressHttp(service: SaleIngress, identities: ChannelIdentity[], config: AppConfig, now = Date.now) {
  const router = express.Router();
  router.use(helmet());
  router.use(rateLimit({ windowMs: config.rateLimitWindowMs, max: config.rateLimitMax }));
  router.use((req, res, next) => { req.requestId = randomUUID(); res.setHeader('x-request-id', req.requestId); next(); });
  // Sign exact bytes, before parsing. No body, secret or external PII in error responses/logs.
  router.post(['/', '/recibos'], express.raw({ type: 'application/json', limit: '128kb', inflate: false }), async (req, res, next) => {
    try {
      const identity = identities.find((i) => i.id === req.header('x-channel-id'));
      if (!identity || !Buffer.isBuffer(req.body)) throw new AppError(401, 'CHANNEL_AUTH_INVALID', 'Invalid channel authentication');
      verifySale(identity, req.header('x-channel-timestamp') ?? '', req.header('x-channel-nonce') ?? '',
        req.header('x-channel-signature') ?? '', req.body, now());
      let payload: unknown;
      try { payload = JSON.parse(req.body.toString('utf8')); } catch { throw new AppError(422, 'CHANNEL_PAYLOAD_INVALID', 'Invalid sale payload'); }
      if (req.path === '/recibos') {
        const parsed = receiptQuerySchema.safeParse(payload);
        if (!parsed.success) throw new AppError(422, 'CHANNEL_PAYLOAD_INVALID', 'Invalid receipt query');
        const receipt = await service.receipt(identity, parsed.data, req.requestId);
        res.status(200).json({ data: receipt });
        return;
      }
      const parsed = saleEnvelopeSchema.safeParse(payload);
      if (!parsed.success) throw new AppError(422, 'CHANNEL_PAYLOAD_INVALID', 'Invalid sale payload');
      const result = await service.receive(identity, parsed.data, req.header('x-channel-nonce')!, req.requestId);
      res.status(result.replayed ? 200 : 201).json({ data: result.receipt, replayed: result.replayed });
    } catch (error) { next(error); }
  });
  router.use((error: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = error instanceof AppError ? error.statusCode
      : (error as { status?: number })?.status === 413 ? 413 : 500;
    const code = error instanceof AppError ? error.code : status === 413 ? 'CHANNEL_BODY_TOO_LARGE' : 'CHANNEL_INTERNAL_ERROR';
    if (status >= 500) console.error(JSON.stringify({ event: 'channel.sale.failed', code, requestId: req.requestId }));
    res.status(status).json({ error: { code, message: 'Channel sale request failed', requestId: req.requestId } });
  });
  return router;
}
