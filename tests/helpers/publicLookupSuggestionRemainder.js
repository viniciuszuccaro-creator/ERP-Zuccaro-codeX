import assert from 'node:assert/strict';
export const publicSuggestionFile = 'src/components/lib/BuscaDadosPublicos.jsx';
export const publicSuggestionPolicy = 'src/components/lib/iaResponsePolicy.js';
export const publicSuggestionAddition = `
const publicLookupErrorSchema = z.object({erro: text.min(1)}).strict();
const ncmLookupSuggestionSchema = z.object({
  descricao: text.min(1), unidade: text.optional(),
  aliquota_ipi: z.number().finite().optional(),
  aliquota_pis: z.number().finite().optional(),
  aliquota_cofins: z.number().finite().optional(),
  cest: text.optional(), obs: text.optional(),
}).strict().or(publicLookupErrorSchema);
const rntrcLookupSuggestionSchema = z.object({
  valido: z.boolean(), situacao: z.enum(['Ativo', 'Suspenso', 'Cancelado']),
  tipo_registro: z.enum(['ETC', 'TAC', 'CTC']), categoria: text.optional(),
}).strict().or(publicLookupErrorSchema);

/** @param {unknown} response */
export function validarSugestaoNcmConsultaIA(response) {
  const message = 'Nao foi possivel obter uma sugestao NCM valida.';
  const result = ncmLookupSuggestionSchema.safeParse(parseResponse(response, 100000, message));
  if (!result.success || 'erro' in result.data) throw new Error(message);
  return result.data;
}

/** @param {unknown} response */
export function validarSugestaoRntrcConsultaIA(response) {
  const message = 'Nao foi possivel obter uma sugestao RNTRC valida.';
  const result = rntrcLookupSuggestionSchema.safeParse(parseResponse(response, 100000, message));
  if (!result.success || 'erro' in result.data) throw new Error(message);
  return result.data;
}
`;
const oldReturn = `    });

    if (resultado.erro) {
      throw new Error(resultado.erro);
    }

    return {
      sucesso: true,
      dados: resultado
    };`;
const newReturn = code => `    }));

    return {
      sucesso: true,
      verificado: false,
      fonte: 'Sugestao IA nao verificada',
      codigo_consultado: ${code},
      sugestao: resultado
    };`;
export const publicSuggestionHunks = [
 ["import { validarSugestaoNcmConsultaIA, validarSugestaoRntrcConsultaIA } from '@/components/lib/iaResponsePolicy';\n", ''],
 [' * - NCM: sugestao IA nao verificada, para revisao manual\n * - RNTRC: sugestao IA nao verificada, sem validacao cadastral', ' * - NCM: Tabela oficial + alíquotas\n * - RNTRC: Validação transportadoras'],
 ['    const resultado = validarSugestaoNcmConsultaIA(await base44.integrations.Core.InvokeLLM({\n      prompt: `Apresente uma sugestao nao verificada sobre o NCM ${ncmLimpo}. Nao afirme consulta ou confirmacao oficial. A revisao em fonte oficial e obrigatoria antes do preenchimento manual.', '    const resultado = await base44.integrations.Core.InvokeLLM({\n      prompt: `Busque informações oficiais do código NCM ${ncmLimpo} na tabela NCM brasileira (Nomenclatura Comum do Mercosul).'],
 ['      - descricao (descricao sugerida do produto)', '      - descricao (descrição oficial do produto)'],
 [newReturn('ncmLimpo'), oldReturn],
 ['    const resultado = validarSugestaoRntrcConsultaIA(await base44.integrations.Core.InvokeLLM({\n      prompt: `Apresente uma sugestao nao verificada sobre o RNTRC ${rntrc}. Nao afirme consulta ou validacao na ANTT. A revisao em fonte oficial e obrigatoria antes do preenchimento manual.', '    const resultado = await base44.integrations.Core.InvokeLLM({\n      prompt: `Valide o código RNTRC ${rntrc} no registro da ANTT (Agência Nacional de Transportes Terrestres).'],
 [newReturn('rntrc'), oldReturn],
 ["      erro: error?.message === 'NCM deve ter 8 dígitos' ? 'NCM deve ter 8 dígitos' : 'Nao foi possivel obter uma sugestao NCM valida.'", "      erro: error.message || 'Erro ao buscar NCM'"],
 ["      erro: 'Nao foi possivel obter uma sugestao RNTRC valida.'", "      erro: error.message || 'Erro ao validar RNTRC'"],
 ['      if (res.sucesso && res.verificado !== false && onDadosEncontrados) {', '      if (res.sucesso && onDadosEncontrados) {'],
 ["        <Alert className={resultado.verificado === false ? 'border-amber-300 bg-amber-50' : resultado.sucesso ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}>", "        <Alert className={resultado.sucesso ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}>"],
 ['          {resultado.sucesso && resultado.verificado !== false ? (', '          {resultado.sucesso ? ('],
 [`            {resultado.sucesso && resultado.verificado === false ? (
              <div className="text-amber-900 break-words">
                <p className="font-semibold">Sugestao IA nao verificada</p>
                <p>Codigo consultado: {resultado.codigo_consultado}</p>
                <p>Revise em fonte oficial antes de preencher manualmente. Nenhum campo foi preenchido ou validado automaticamente.</p>
                <dl className="mt-2 space-y-1">
                  {Object.entries(resultado.sugestao).map(([campo, valorSugerido]) => (
                    <div key={campo}><dt className="font-medium">{campo.replaceAll('_', ' ')} (sugerido)</dt><dd>{typeof valorSugerido === 'boolean' ? (valorSugerido ? 'Sim' : 'Nao') : String(valorSugerido)}</dd></div>
                  ))}
                </dl>
              </div>
            ) : resultado.sucesso ? (`, '            {resultado.sucesso ? ('],
 ['  const [sugestao, setSugestao] = React.useState(null);\n', ''],
 ['    setSugestao(null);\n', ''],
 ['    if (resultado.sucesso && resultado.verificado === false) {\n      setSugestao(resultado.sugestao);\n    } else if (resultado.sucesso) {', '    if (resultado.sucesso) {'],
 ['  return { buscar, buscando, dados, erro, sugestao };', '  return { buscar, buscando, dados, erro };'],
];
export function publicLookupSuggestionRemainder(file, text) {
 const hunks = file === publicSuggestionFile ? publicSuggestionHunks : file === publicSuggestionPolicy ? [[publicSuggestionAddition, '']] : null;
 if (!hunks) return text;
 let source = text.replace(/\r\n/g, '\n');
 for (const [after, before] of hunks) { assert.equal(source.split(after).length, 2, file + ': one exact unverified suggestion hunk'); source = source.replace(after, before); }
 return text.includes('\r\n') ? source.replace(/\n/g, '\r\n') : source;
}
