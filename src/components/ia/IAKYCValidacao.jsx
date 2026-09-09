import React from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import {
  assertIaUiContext,
  stampIaLogSugestao,
} from '@/components/lib/iaTransversalPolicy';

export default function IAKYCValidacao({ tipo, cpfCnpj, onDadosValidados }) {
  const { contexto, empresaAtual, grupoAtual, createInContext, estaNoGrupo } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const scopeType = estaNoGrupo || contexto === 'grupo' ? 'grupo' : 'empresa';
  const contextoValido = (() => {
    try {
      assertIaUiContext({ groupId, empresaId, scopeType });
      return true;
    } catch {
      return false;
    }
  })();

  const validarMutation = useMutation({
    mutationFn: async () => {
      const ctx = assertIaUiContext({ groupId, empresaId, scopeType });

      const prompt = tipo === 'CNPJ'
        ? `Consulte informações da Receita Federal para o CNPJ ${cpfCnpj}. Retorne: razão social, nome fantasia, situação cadastral, CNAE principal, ramo de atividade, porte, endereço completo (CEP, logradouro, número, bairro, cidade, estado).`
        : `Valide o CPF ${cpfCnpj} e retorne se é válido e situação cadastral.`;

      const resultado = await base44.integrations.Core.InvokeLLM({
        prompt,
        group_id: ctx.group_id,
        empresa_id: ctx.empresa_id,
        add_context_from_internet: true,
        response_json_schema: tipo === 'CNPJ' ? {
          type: 'object',
          properties: {
            razao_social: { type: 'string' },
            nome_fantasia: { type: 'string' },
            situacao_cadastral: { type: 'string' },
            cnae_principal: { type: 'string' },
            ramo_atividade: { type: 'string' },
            porte: { type: 'string' },
            endereco: {
              type: 'object',
              properties: {
                cep: { type: 'string' },
                logradouro: { type: 'string' },
                numero: { type: 'string' },
                bairro: { type: 'string' },
                cidade: { type: 'string' },
                estado: { type: 'string' },
              },
            },
          },
        } : {
          type: 'object',
          properties: {
            valido: { type: 'boolean' },
            situacao: { type: 'string' },
          },
        },
      });

      await createInContext('LogsIA', stampIaLogSugestao({
        tipo_ia: 'IA_KYC',
        contexto_execucao: 'Cadastro',
        entidade_relacionada: tipo === 'CNPJ' ? 'Cliente/Fornecedor' : 'Cliente',
        acao_sugerida: `Validação ${tipo} sugerida (preenchimento assistido)`,
        confianca_ia: 90,
        dados_entrada: { cpf_cnpj: cpfCnpj },
        dados_saida: resultado,
        empresa_id: ctx.empresa_id,
        group_id: ctx.group_id,
      }));

      return resultado;
    },
    onSuccess: (dados) => {
      toast.success('Sugestão de validação pronta. Revise antes de salvar o cadastro.');
      if (onDadosValidados) {
        onDadosValidados(dados);
      }
    },
    onError: (error) => {
      toast.error(String(error?.message || 'Erro ao validar dados. Verifique o CPF/CNPJ informado.'));
    },
  });

  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => validarMutation.mutate()}
      disabled={!cpfCnpj || validarMutation.isPending || !contextoValido}
      className="w-full"
      data-action="IA.KYC.validar"
    >
      {validarMutation.isPending ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Validando com IA...
        </>
      ) : (
        <>
          <Search className="w-4 h-4 mr-2" />
          Validar e Preencher com IA
        </>
      )}
    </Button>
  );
}
