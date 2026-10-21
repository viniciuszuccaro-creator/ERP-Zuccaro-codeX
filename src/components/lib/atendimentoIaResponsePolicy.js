import { z } from 'zod';

const text = z.string().max(4000);
const texts = z.array(text).max(50);
const intentSchema = z.object({
  intent: text.min(1),
  confianca: z.number().finite().min(0).max(100),
  necessita_atendente: z.boolean().optional(),
}).passthrough();
const analiseSchema = z.object({
  resumo: text.optional(),
  sentimento: z.object({
    tipo: text.optional(), intensidade: z.number().finite().min(0).max(1).optional(), motivo: text.optional(),
  }).passthrough().optional(),
  necessidade_principal: text.optional(),
  acoes_recomendadas: texts.optional(),
  produtos_sugeridos: z.array(z.object({ produto: text, motivo: text }).passthrough()).max(50).optional(),
  risco_insatisfacao: text.optional(),
  oportunidade_venda: z.object({
    existe: z.boolean().optional(), valor_estimado: z.number().finite().nonnegative().optional(), tipo: text.optional(),
  }).passthrough().optional(),
  palavras_chave: texts.optional(),
}).passthrough();

const sugestoesSchema = z.object({
  respostas_sugeridas: z.array(z.object({
    texto: text, tom: z.enum(['formal', 'amigavel', 'tecnico']),
  }).passthrough()).max(50).optional(),
  acoes_recomendadas: texts.optional(),
  alerta: z.object({
    tem_alerta: z.boolean(), mensagem: text, tipo: z.enum(['info', 'aviso', 'urgente']),
  }).passthrough().optional(),
}).passthrough();

/** @param {unknown} input */
const parseResponse = (input) => {
  if (typeof input !== 'string') return input;
  if (input.length > 100000) throw new Error('Resposta IA de atendimento invalida.');
  try { return JSON.parse(input); }
  catch { throw new Error('Resposta IA de atendimento invalida.'); }
};

/** @param {unknown} input */
export const validarAnaliseAtendimentoIA = (input) => {
  const result = analiseSchema.safeParse(parseResponse(input));
  if (!result.success) throw new Error('Resposta IA de atendimento invalida.');
  return result.data;
};

/** @param {unknown} input */
export const validarIntentAtendimentoIA = (input) => {
  const result = intentSchema.safeParse(parseResponse(input));
  if (!result.success) throw new Error('Resposta IA de atendimento invalida.');
  return result.data;
};

/** @param {unknown} input */
export const validarSugestoesAtendimentoIA = (input) => {
  const result = sugestoesSchema.safeParse(parseResponse(input));
  if (!result.success) throw new Error('Resposta IA de atendimento invalida.');
  return result.data;
};
