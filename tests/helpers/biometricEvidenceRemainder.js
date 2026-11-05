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
 // Delta autorizado: escopo multiempresa Colaborador/Ponto via filterInContext + createInContext.
 ["import { useContextoVisual } from \"@/components/lib/useContextoVisual\";\n",''],
 ['  const videoRef = useRef(null);\n  const { empresaAtual, grupoAtual, filterInContext, createInContext } = useContextoVisual();\n  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;\n  const contextoValido = Boolean(empresaAtual?.id || groupId);\n','  const videoRef = useRef(null);\n'],
 ["  // Escopo multiempresa: Colaborador/Ponto via filterInContext (padrão DashboardRHRealtime).\n  // Sem list unscoped; enabled exige contexto; erro ≠ zero KPI.\n  const { data: colaboradores = [], isError: isErrorColaboradores } = useQuery({\n    queryKey: ['colaboradores', groupId, empresaAtual?.id],\n    queryFn: () => filterInContext('Colaborador', {}, 'nome_completo', 500),\n    enabled: contextoValido,\n  });\n\n  const { data: pontosHoje = [], isError: isErrorPontos } = useQuery({\n    queryKey: ['pontos-hoje', groupId, empresaAtual?.id],\n    queryFn: () => filterInContext('Ponto', {}, '-created_date', 200),\n    enabled: contextoValido,\n  });\n\n  // Mutation para registrar ponto (createInContext — sem Ponto.create unscoped)\n  const registrarPontoMutation = useMutation({\n    mutationFn: (/** @type {typeof registroPonto & {requer_aprovacao?: boolean, observacoes_ia?: string}} */ data) => {\n      if (!contextoValido) throw new Error('Selecione um grupo ou empresa antes de registrar ponto.');\n      return createInContext('Ponto', data);\n    },\n","  // Fetch colaboradores\n  const { data: colaboradores = [] } = useQuery({\n    queryKey: ['colaboradores'],\n    queryFn: () => base44.entities.Colaborador.list()\n  });\n\n  // Fetch pontos do dia\n  const { data: pontosHoje = [] } = useQuery({\n    queryKey: ['pontos-hoje'],\n    queryFn: () => base44.entities.Ponto.list()\n  });\n\n  // Mutation para registrar ponto\n  const registrarPontoMutation = useMutation({\n    mutationFn: (/** @type {typeof registroPonto & {requer_aprovacao?: boolean, observacoes_ia?: string}} */ data) => base44.entities.Ponto.create(data),\n"],
 ['          <CardContent className="space-y-4">\n            {(isErrorColaboradores || isErrorPontos) && (\n              <p className="text-xs text-slate-500">\n                Contagem RH indisponível (erro de carga ≠ zero).\n              </p>\n            )}\n            <div className="grid grid-cols-1 gap-3">\n','          <CardContent className="space-y-4">\n            <div className="grid grid-cols-1 gap-3">\n'],
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
