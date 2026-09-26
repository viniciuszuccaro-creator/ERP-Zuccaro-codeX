/**
 * Crédito Comercial 360 (Onda 6) — política pura.
 * Saldo/limite NÃO são copiados para o Pedido; vêm de porta do Financeiro/Cadastros.
 * Sem porta / snapshot null → não inventa e não força alçada.
 * Com porta e limite insuficiente → exige `aprovar-credito`.
 */
import { AppError } from '../api/errors.js';

const MICROS = 1_000_000n;

function toMicros(value: string): bigint {
  const raw = String(value ?? '0').trim();
  if (!/^-?\d+(\.\d+)?$/.test(raw)) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Invalid money amount');
  }
  const neg = raw.startsWith('-');
  const [intPart, fracPart = ''] = (neg ? raw.slice(1) : raw).split('.');
  const frac = `${fracPart}000000`.slice(0, 6);
  const micros = BigInt(intPart || '0') * MICROS + BigInt(frac || '0');
  return neg ? -micros : micros;
}

function microsToDecimal(value: bigint): string {
  const neg = value < 0n;
  const abs = neg ? -value : value;
  const text = `${abs / MICROS}.${String(abs % MICROS).padStart(6, '0')}`;
  return neg ? `-${text}` : text;
}

/** Porta mínima de crédito por ClienteEmpresa (Financeiro/Cadastros — fora do agregado Pedido). */
export type ComercialCreditPort = {
  getClienteEmpresaCredit(input: {
    groupId: string;
    empresaId: string;
    clienteEmpresaId: string;
  }): Promise<{ limite_credito: string; limite_utilizado: string } | null>;
};

export type CreditoItem = {
  quantidade: string;
  preco_unitario: string;
  desconto?: string | null;
};

export type CreditoAvaliacao = {
  aprovado: boolean;
  limite_total: string;
  limite_utilizado: string;
  limite_disponivel: string;
  valor_pedido: string;
  motivo: string;
};

export function computePedidoTotalMicros(items: CreditoItem[]): bigint {
  let total = 0n;
  for (const item of items) {
    const line = (toMicros(item.quantidade) * toMicros(item.preco_unitario)) / MICROS;
    const discount = toMicros(item.desconto ?? '0');
    if (discount < 0n || discount > line) {
      throw new AppError(422, 'PEDIDO_DESCONTO_INVALIDO', 'Item discount exceeds line subtotal');
    }
    total += line - discount;
  }
  return total;
}

/**
 * Adapter CreditPort lendo limite no ClienteEmpresa canônico (Onda 6).
 * limite_credito NULL → retorna null (não inventa / não força alçada).
 */
export function createClienteEmpresaCreditPort(
  clientes: {
    getEmpresaLinkById(
      scope: { groupId: string; empresaId: string },
      id: string,
    ): Promise<{
      ativo: boolean;
      limite_credito: string | null;
      limite_utilizado: string;
    } | null>;
  },
): ComercialCreditPort {
  return {
    async getClienteEmpresaCredit({ groupId, empresaId, clienteEmpresaId }) {
      const link = await clientes.getEmpresaLinkById({ groupId, empresaId }, clienteEmpresaId);
      if (!link || !link.ativo) return null;
      if (link.limite_credito == null || link.limite_credito === '') return null;
      return {
        limite_credito: link.limite_credito,
        limite_utilizado: link.limite_utilizado || '0.000000',
      };
    },
  };
}

export function evaluatePedidoCreditoSnapshot(options: {
  items: CreditoItem[];
  limite_credito: string;
  limite_utilizado: string;
}): CreditoAvaliacao {
  const limiteTotal = toMicros(options.limite_credito);
  const limiteUtilizado = toMicros(options.limite_utilizado);
  if (limiteTotal < 0n || limiteUtilizado < 0n) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Invalid credit limit');
  }
  const disponivel = limiteTotal - limiteUtilizado;
  const valorPedido = computePedidoTotalMicros(options.items);
  const base = {
    limite_total: microsToDecimal(limiteTotal),
    limite_utilizado: microsToDecimal(limiteUtilizado),
    limite_disponivel: microsToDecimal(disponivel),
    valor_pedido: microsToDecimal(valorPedido),
  };
  if (limiteTotal <= 0n) {
    return { aprovado: false, ...base, motivo: 'Cliente sem limite de credito cadastrado' };
  }
  if (valorPedido > disponivel) {
    return { aprovado: false, ...base, motivo: 'Limite insuficiente' };
  }
  return { aprovado: true, ...base, motivo: 'Credito aprovado' };
}

export async function assertCreditoSuficienteOuAprovar(options: {
  groupId: string;
  empresaId: string;
  clienteEmpresaId: string;
  items: CreditoItem[];
  credit: ComercialCreditPort | null;
  canAprovarCredito: boolean;
  entityLabel?: string;
}): Promise<CreditoAvaliacao | null> {
  if (!options.credit) return null;
  const snap = await options.credit.getClienteEmpresaCredit({
    groupId: options.groupId,
    empresaId: options.empresaId,
    clienteEmpresaId: options.clienteEmpresaId,
  });
  if (!snap) {
    // Snapshot ausente = crédito não configurado no ClienteEmpresa (não inventa, não força alçada).
    return null;
  }
  const evaluation = evaluatePedidoCreditoSnapshot({
    items: options.items,
    limite_credito: snap.limite_credito,
    limite_utilizado: snap.limite_utilizado,
  });
  if (evaluation.aprovado) return evaluation;
  if (options.canAprovarCredito) return { ...evaluation, aprovado: true, motivo: `${evaluation.motivo}; override aprovar-credito` };
  throw new AppError(
    403,
    'CREDITO_ALCADA_DENIED',
    `${options.entityLabel || 'Pedido'} com credito insuficiente exige permissao aprovar-credito`,
    evaluation,
  );
}
