import { z } from 'zod';

export const movimentacaoSchema = z.object({
  tipo_movimento: z.string().min(3, 'Tipo é obrigatório'),
  produto_id: z.string().min(1, 'Produto é obrigatório'),
  quantidade: z.number().positive('Quantidade > 0'),
  data_movimentacao: z.string().min(4, 'Data é obrigatória'),
  empresa_id: z.string().min(1, 'Empresa é obrigatória'),
  documento_referencia: z.string().optional().nullable(),
  observacoes: z.string().optional().nullable(),
});

export default movimentacaoSchema;