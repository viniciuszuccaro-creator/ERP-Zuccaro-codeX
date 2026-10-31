import assert from 'node:assert/strict';
import {publicLookupSuggestionRemainder} from './publicLookupSuggestionRemainder.js';
export const biometricEvidenceFile='src/components/rh/PontoEletronicoBiometrico.jsx';
export const pointValidatorAddition=`
const pontoAnomalySchema = z.object({
  risco: z.enum(['Baixo', 'Médio', 'Alto']),
  requer_aprovacao_gestor: z.boolean(),
  observacoes_ia: text,
  anomalias_detectadas: z.array(text).max(100).optional(),
}).strict();

/** @param {unknown} response */
export function validarAnomaliasPontoIA(response) {
  const message = 'Resposta de analise de ponto IA invalida.';
  const result = pontoAnomalySchema.safeParse(parseResponse(response, 100000, message));
  if (!result.success) throw new Error(message);
  return result.data;
}
`;
export const biometricEvidenceHunks=[
 ["import { validarAnomaliasPontoIA } from '@/components/lib/iaResponsePolicy';\n",''],
 ['      return validarAnomaliasPontoIA(await base44.integrations.Core.InvokeLLM({','      return await base44.integrations.Core.InvokeLLM({'],
 ['      }));\n    }\n  });\n\n  // Capturar localização GPS','      });\n    }\n  });\n\n  // Capturar localização GPS'],
 ['      toast({ title: "Foto capturada", description: "Captura concluida; identidade facial nao verificada." });','      toast({ title: "✅ Foto capturada", description: "Validação facial concluída" });'],
 ['    setRegistroPonto(prev => ({ ...prev, biometria_validada: false }));\n    toast({ title: "Leitor biometrico indisponivel", description: "Nenhuma biometria foi validada." });','    setRegistroPonto(prev => ({ ...prev, biometria_validada: true }));\n    toast({ title: "✅ Biometria validada", description: "Digital reconhecida" });'],
 ['    /** @type {Parameters<typeof registrarPontoMutation.mutate>[0]} */\n',''],
 ['    const validacao = await validarPontoIAMutation.mutateAsync(pontoFinal).catch(() => {\n      toast({ title: "Analise indisponivel", description: "Nao foi possivel validar a resposta da analise. Nenhum ponto foi registrado.", variant: "destructive" });\n      return null;\n    });\n    if (!validacao) return;','    const validacao = await validarPontoIAMutation.mutateAsync(pontoFinal);'],
];
export function biometricEvidenceRemainder(file,text){
 let hunks;
 if(file===biometricEvidenceFile)hunks=biometricEvidenceHunks;
 else if(file==='src/components/lib/iaResponsePolicy.js')hunks=[[pointValidatorAddition,'']];
 else return text;
 let source=publicLookupSuggestionRemainder(file,text).replace(/\r\n/g,'\n');
 for(const [after,before] of hunks){assert.equal(source.split(after).length,2,file+': one exact biometric evidence hunk');source=source.replace(after,before);}
 return text.includes('\r\n')?source.replace(/\n/g,'\r\n'):source;
}
