import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { 
  Star, 
  ThumbsUp, 
  ThumbsDown,
  MessageSquare,
  Send,
  Check
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import usePermissions from '@/components/lib/usePermissions';

/**
 * V21.6 - AVALIAÇÃO DE ATENDIMENTO (CSAT)
 * 
 * Widget de avaliação:
 * ✅ Nota de 1 a 5 estrelas
 * ✅ Feedback por texto
 * ✅ Emoji de satisfação
 * ✅ NPS (Net Promoter Score)
 * ✅ Registro na conversa
 */
export default function AvaliacaoAtendimento({ conversa, onAvaliacaoEnviada }) {
  const { empresaAtual, grupoAtual, updateInContext, createInContext } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const [nota, setNota] = useState(0);
  const [hoverNota, setHoverNota] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [nps, setNps] = useState(null);
  const [etapa, setEtapa] = useState('estrelas'); // estrelas, feedback, nps, concluido
  const empresaId = conversa?.empresa_id || empresaAtual?.id;
  const groupId = conversa?.group_id || conversa?.grupo_id || grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id;
  const contextoValido = Boolean(empresaId || groupId);
  const canAvaliar = hasPermission('CRM', 'Atendimento', 'editar') ||
    hasPermission('CRM', 'Atendimento', 'criar');

  const enviarAvaliacaoMutation = useMutation({
    mutationFn: async () => {
      if (!contextoValido || !canAvaliar) {
        throw new Error('Contexto ou permissao insuficiente para registrar avaliacao');
      }

      await updateInContext('ConversaOmnicanal', conversa.id, {
        score_satisfacao: nota,
        feedback_cliente: feedback || null,
        nps_score: nps,
        resolvido: true,
        status: 'Resolvida',
        data_finalizacao: new Date().toISOString()
      });

      // Criar mensagem de sistema
      await createInContext('MensagemOmnicanal', {
        conversa_id: conversa.id,
        sessao_id: conversa.sessao_id,
        canal: conversa.canal,
        tipo_remetente: 'Sistema',
        remetente_nome: 'Sistema',
        mensagem: `Cliente avaliou o atendimento: ${nota}/5 estrelas${feedback ? `\nFeedback: "${feedback}"` : ''}${nps !== null ? `\nNPS: ${nps}/10` : ''}`,
        tipo_conteudo: 'texto',
        data_envio: new Date().toISOString(),
        interno: true
      });
    },
    onSuccess: () => {
      toast.success('Obrigado pela avaliação!');
      setEtapa('concluido');
      onAvaliacaoEnviada?.();
    }
  });

  const getEmoji = (n) => {
    if (n >= 5) return '😍';
    if (n >= 4) return '😊';
    if (n >= 3) return '😐';
    if (n >= 2) return '😕';
    return '😞';
  };

  const getNPSLabel = (score) => {
    if (score >= 9) return 'Promotor';
    if (score >= 7) return 'Neutro';
    return 'Detrator';
  };

  if (!conversa) return null;

  return (
    <Card className="w-full h-full max-w-md mx-auto" data-permission="CRM.Atendimento.editar" data-context-required="group-or-company">
      <CardHeader className="pb-3 text-center">
        <CardTitle className="text-lg flex items-center justify-center gap-2">
          {etapa === 'concluido' ? (
            <>
              <Check className="w-5 h-5 text-green-600" />
              Avaliação Enviada!
            </>
          ) : (
            <>
              <Star className="w-5 h-5 text-yellow-500" />
              Avalie o Atendimento
            </>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        {etapa === 'estrelas' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <p className="text-center text-sm text-slate-600">
              Como foi sua experiência de atendimento?
            </p>
            
            {/* Estrelas */}
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <motion.button
                  key={n}
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.9 }}
                  onMouseEnter={() => setHoverNota(n)}
                  onMouseLeave={() => setHoverNota(0)}
                  onClick={() => setNota(n)}
                  className="p-1"
                >
                  <Star
                    className={`w-10 h-10 transition-all ${
                      n <= (hoverNota || nota)
                        ? 'text-yellow-400 fill-yellow-400'
                        : 'text-slate-300'
                    }`}
                  />
                </motion.button>
              ))}
            </div>

            {/* Emoji */}
            {nota > 0 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="text-center"
              >
                <span className="text-5xl">{getEmoji(nota)}</span>
                <p className="text-sm text-slate-600 mt-2">
                  {nota === 5 && 'Excelente!'}
                  {nota === 4 && 'Muito bom!'}
                  {nota === 3 && 'Regular'}
                  {nota === 2 && 'Pode melhorar'}
                  {nota === 1 && 'Precisa melhorar'}
                </p>
              </motion.div>
            )}

            <Button
              onClick={() => setEtapa('feedback')}
              disabled={nota === 0}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              Continuar
            </Button>
          </motion.div>
        )}

        {etapa === 'feedback' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-center gap-2 text-2xl">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  className={`w-6 h-6 ${
                    n <= nota ? 'text-yellow-400 fill-yellow-400' : 'text-slate-300'
                  }`}
                />
              ))}
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">
                Conte-nos mais (opcional)
              </label>
              <Textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="O que podemos melhorar? O que você gostou?"
                className="mt-1 h-24"
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setEtapa('estrelas')}
                className="flex-1"
              >
                Voltar
              </Button>
              <Button
                onClick={() => setEtapa('nps')}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                Continuar
              </Button>
            </div>
          </motion.div>
        )}

        {etapa === 'nps' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <p className="text-center text-sm text-slate-600">
              De 0 a 10, qual a probabilidade de recomendar nossa empresa?
            </p>

            {/* Escala NPS */}
            <div className="flex flex-wrap justify-center gap-1">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <motion.button
                  key={n}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setNps(n)}
                  className={`w-9 h-9 rounded-lg font-bold transition-all ${
                    nps === n
                      ? n >= 9 ? 'bg-green-500 text-white' :
                        n >= 7 ? 'bg-yellow-500 text-white' :
                        'bg-red-500 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {n}
                </motion.button>
              ))}
            </div>

            {nps !== null && (
              <p className="text-center text-sm">
                <span className={`font-bold ${
                  nps >= 9 ? 'text-green-600' :
                  nps >= 7 ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {getNPSLabel(nps)}
                </span>
              </p>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setEtapa('feedback')}
                className="flex-1"
              >
                Voltar
              </Button>
              <Button
              onClick={() => enviarAvaliacaoMutation.mutate()}
                disabled={enviarAvaliacaoMutation.isPending || !contextoValido || !canAvaliar}
                className="flex-1 bg-green-600 hover:bg-green-700"
                data-action="AvaliacaoAtendimento.enviar"
                data-permission="CRM.Atendimento.editar"
                data-context-required="group-or-company"
                data-sensitive="true"
              >
                {enviarAvaliacaoMutation.isPending ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Enviar
                  </>
                )}
              </Button>
            </div>

            <button
              onClick={() => enviarAvaliacaoMutation.mutate()}
              disabled={enviarAvaliacaoMutation.isPending || !contextoValido || !canAvaliar}
              className="w-full text-sm text-slate-500 hover:text-slate-700"
              data-action="AvaliacaoAtendimento.pularNpsEnviar"
              data-permission="CRM.Atendimento.editar"
              data-context-required="group-or-company"
              data-sensitive="true"
            >
              Pular NPS e enviar
            </button>
          </motion.div>
        )}

        {etapa === 'concluido' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-6"
          >
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <p className="text-lg font-semibold text-slate-900">Obrigado!</p>
            <p className="text-sm text-slate-600 mt-1">
              Sua opinião é muito importante para nós.
            </p>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
