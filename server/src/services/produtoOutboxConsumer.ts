/**
 * Consumidor controlado da outbox produto.publicado (Onda 15).
 * Reutiliza claim/lease/confirm/fail existentes. Sem sucesso falso para canal externo.
 */
import type { RequestContext } from '../audit/types.js';
import { AppError } from '../api/errors.js';
import type { CatalogPublisherPort } from './produtoOutboxClaim.js';
import { FakeCatalogPublisher, authorize, processProdutoOutboxBatch } from './produtoOutboxClaim.js';

export type OutboxConsumerMode = 'disabled' | 'fake' | 'external';

export type OutboxConsumerConfig = {
  /** disabled por padrao; fake somente para ensaio explicitamente configurado. */
  mode: OutboxConsumerMode;
  /** So para mode=fake. */
  fakeOutcome?: 'ok' | 'fail';
  /**
   * Canal externo so liga com evidencias explicitas (sem inventar sucesso).
   * Sem estes campos, external falha fechado.
   */
  externalChannelId?: string;
  externalCredentialsPresent?: boolean;
};

export class DisabledCatalogPublisher implements CatalogPublisherPort {
  async publish() {
    return { ok: false as const, error: 'OUTBOX_CONSUMER_DISABLED' };
  }
}

/** Nunca simula sucesso: publica so se canal+credenciais forem comprovados (ainda bloqueado). */
export class ExternalCatalogPublisherGate implements CatalogPublisherPort {
  constructor(
    private readonly channelId: string | undefined,
    private readonly credentialsPresent: boolean,
  ) {}

  async publish() {
    if (!this.channelId || !String(this.channelId).trim()) {
      return { ok: false as const, error: 'CATALOG_CHANNEL_NOT_CONFIGURED' };
    }
    if (!this.credentialsPresent) {
      return { ok: false as const, error: 'CATALOG_CHANNEL_CREDENTIALS_MISSING' };
    }
    // Provider real permanece bloqueado ate gate externo — nao inventa entrega.
    return { ok: false as const, error: 'CATALOG_EXTERNAL_PUBLISHER_BLOCKED' };
  }
}

export function resolveOutboxConsumerConfig(env: Record<string, string | undefined> = process.env): OutboxConsumerConfig {
  const raw = String(env.ERP_OUTBOX_CONSUMER_MODE || 'disabled').trim().toLowerCase();
  const mode: OutboxConsumerMode = raw === 'disabled' || raw === 'external' || raw === 'fake'
    ? raw
    : 'disabled'; // valor desconhecido → fail-closed
  const fakeOutcome = String(env.ERP_OUTBOX_FAKE_OUTCOME || 'ok').trim().toLowerCase() === 'fail'
    ? 'fail' as const
    : 'ok' as const;
  return {
    mode,
    fakeOutcome,
    externalChannelId: env.ERP_CATALOG_CHANNEL_ID?.trim() || undefined,
    externalCredentialsPresent: String(env.ERP_CATALOG_CHANNEL_CREDENTIALS_PRESENT || '').toLowerCase() === 'true',
  };
}

export function createCatalogPublisher(config: OutboxConsumerConfig): CatalogPublisherPort {
  if (config.mode === 'disabled') return new DisabledCatalogPublisher();
  if (config.mode === 'fake') return new FakeCatalogPublisher(config.fakeOutcome ?? 'ok');
  return new ExternalCatalogPublisherGate(config.externalChannelId, config.externalCredentialsPresent === true);
}

type BatchDeps = Parameters<typeof processProdutoOutboxBatch>[0];

/**
 * Processa um lote idempotente via contratos existentes.
 * Recuperacao de falha: fail→retry/dead_letter no claim; reprocess/discard manuais.
 */
export async function runProdutoOutboxConsumer(
  deps: Omit<BatchDeps, 'publisher'> & { publisher?: CatalogPublisherPort },
  ctx: RequestContext,
  options: { limit?: number; leaseMs?: number; config?: OutboxConsumerConfig } = {},
) {
  const config = options.config ?? resolveOutboxConsumerConfig();
  const publisher = deps.publisher ?? createCatalogPublisher(config);
  if (publisher instanceof DisabledCatalogPublisher) {
    await authorize(deps, ctx);
    throw new AppError(409, 'OUTBOX_CONSUMER_DISABLED', 'Outbox consumer is disabled');
  }
  return processProdutoOutboxBatch({ ...deps, publisher }, ctx, {
    limit: options.limit,
    leaseMs: options.leaseMs,
  });
}
