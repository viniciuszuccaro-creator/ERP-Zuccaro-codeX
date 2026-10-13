const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatCentral360Money(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return 'Valor não informado';
  const raw = String(value).trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(raw)) return 'Valor não informado';
  const amount = Number(raw);
  return Number.isFinite(amount) ? brl.format(amount) : 'Valor não informado';
}
