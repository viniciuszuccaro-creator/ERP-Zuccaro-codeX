import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Star, Save } from "lucide-react";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";

/**
 * V21.1.2: Avaliação Fornecedor - Window Mode
 */
export default function AvaliacaoFornecedorForm({ ordemCompra, onSubmit, windowMode = false }) {
  const { empresaAtual, grupoAtual, createInContext } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const groupId = grupoAtual?.id || ordemCompra?.group_id || ordemCompra?.grupo_id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || ordemCompra?.empresa_id || null;
  const contextoValido = Boolean(groupId || empresaId);
  const canAvaliarFornecedor = hasPermission('Compras', 'Fornecedores', 'avaliar') ||
    hasPermission('Compras', 'Fornecedores', 'editar') ||
    hasPermission('Compras', null, 'editar');

  const [formData, setFormData] = useState({
    qualidade: 5,
    prazo: 5,
    preco: 5,
    atendimento: 5,
    comentario: ""
  });

  const notaMedia = ((formData.qualidade + formData.prazo + formData.preco + formData.atendimento) / 4).toFixed(1);

  const auditAvaliacaoFornecedor = async ({ acao, sucesso = true, motivo = null, dados = {} }) => {
    try {
      await createInContext('AuditLog', {
        acao,
        modulo: 'Compras',
        entidade: 'AvaliacaoFornecedor',
        tipo_auditoria: sucesso ? 'entidade' : 'seguranca',
        descricao: motivo || 'Auditoria de avaliacao de fornecedor.',
        dados_novos: {
          ordem_compra_id: ordemCompra?.id,
          fornecedor_id: ordemCompra?.fornecedor_id,
          ...dados
        },
        group_id: groupId,
        grupo_id: groupId,
        empresa_id: empresaId,
        sucesso,
        data_hora: new Date().toISOString(),
      });
    } catch (error) {
      console.warn('Falha ao auditar avaliacao de fornecedor:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!contextoValido || !canAvaliarFornecedor) {
      await auditAvaliacaoFornecedor({
        acao: 'AvaliacaoFornecedor.envio_bloqueado',
        sucesso: false,
        motivo: !contextoValido ? 'contexto_obrigatorio' : 'permissao_negada',
        dados: { nota_media: Number(notaMedia) }
      });
      return;
    }

    const payload = {
      ...formData,
      nota_media: Number(notaMedia),
      group_id: groupId,
      grupo_id: groupId,
      empresa_id: empresaId,
      ordem_compra_id: ordemCompra?.id,
      fornecedor_id: ordemCompra?.fornecedor_id
    };
    await onSubmit(payload);
    await auditAvaliacaoFornecedor({
      acao: 'AvaliacaoFornecedor.enviada',
      dados: { nota_media: Number(notaMedia) }
    });
  };

  const content = (
    <form
      onSubmit={handleSubmit}
      className={`space-y-6 ${windowMode ? 'p-6 h-full overflow-auto' : ''}`}
      data-permission="Compras.Fornecedores.avaliar"
      data-action="Compras.AvaliacaoFornecedor.formulario"
      data-context-required="group-or-company"
    >
      <Card>
        <CardContent className="p-6 space-y-6">
          <div className="p-4 bg-slate-50 rounded-lg">
            <p className="font-semibold text-lg">{ordemCompra?.fornecedor_nome}</p>
            <p className="text-sm text-slate-600">OC: {ordemCompra?.numero_oc}</p>
            <p className="text-sm text-slate-600">Valor: R$ {ordemCompra?.valor_total?.toFixed(2)}</p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <Label className="font-semibold">Qualidade do Produto</Label>
              <div className="flex gap-1">
                {[1,2,3,4,5].map(star => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setFormData({...formData, qualidade: star})}
                    className="transition-transform hover:scale-110"
                    disabled={!contextoValido || !canAvaliarFornecedor}
                    data-permission="Compras.Fornecedores.avaliar"
                    data-action="Compras.AvaliacaoFornecedor.qualidade"
                    data-context-required="group-or-company"
                    data-sensitive="true"
                  >
                    <Star 
                      className={`w-7 h-7 ${star <= formData.qualidade ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <Label className="font-semibold">Cumprimento de Prazo</Label>
              <div className="flex gap-1">
                {[1,2,3,4,5].map(star => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setFormData({...formData, prazo: star})}
                    className="transition-transform hover:scale-110"
                    disabled={!contextoValido || !canAvaliarFornecedor}
                    data-permission="Compras.Fornecedores.avaliar"
                    data-action="Compras.AvaliacaoFornecedor.prazo"
                    data-context-required="group-or-company"
                    data-sensitive="true"
                  >
                    <Star 
                      className={`w-7 h-7 ${star <= formData.prazo ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <Label className="font-semibold">Preço Competitivo</Label>
              <div className="flex gap-1">
                {[1,2,3,4,5].map(star => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setFormData({...formData, preco: star})}
                    className="transition-transform hover:scale-110"
                    disabled={!contextoValido || !canAvaliarFornecedor}
                    data-permission="Compras.Fornecedores.avaliar"
                    data-action="Compras.AvaliacaoFornecedor.preco"
                    data-context-required="group-or-company"
                    data-sensitive="true"
                  >
                    <Star 
                      className={`w-7 h-7 ${star <= formData.preco ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <Label className="font-semibold">Atendimento</Label>
              <div className="flex gap-1">
                {[1,2,3,4,5].map(star => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setFormData({...formData, atendimento: star})}
                    className="transition-transform hover:scale-110"
                    disabled={!contextoValido || !canAvaliarFornecedor}
                    data-permission="Compras.Fornecedores.avaliar"
                    data-action="Compras.AvaliacaoFornecedor.atendimento"
                    data-context-required="group-or-company"
                    data-sensitive="true"
                  >
                    <Star 
                      className={`w-7 h-7 ${star <= formData.atendimento ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <Label>Comentários e Observações</Label>
            <Textarea
              value={formData.comentario}
              onChange={(e) => setFormData({...formData, comentario: e.target.value})}
              rows={4}
              placeholder="Comentários sobre a compra, qualidade, atendimento..."
              className="mt-2"
              disabled={!contextoValido || !canAvaliarFornecedor}
              data-permission="Compras.Fornecedores.avaliar"
              data-action="Compras.AvaliacaoFornecedor.comentario"
              data-context-required="group-or-company"
              data-sensitive="true"
            />
          </div>

          <div className="p-6 bg-gradient-to-r from-blue-50 to-amber-50 rounded-lg text-center border-2 border-amber-200">
            <p className="text-sm text-slate-600 mb-2">Nota Média Final</p>
            <div className="flex items-center justify-center gap-2">
              <Star className="w-8 h-8 fill-amber-400 text-amber-400" />
              <p className="text-5xl font-bold text-amber-600">{notaMedia}</p>
              <span className="text-2xl text-slate-400">/5.0</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3 pt-4 border-t sticky bottom-0 bg-white">
        <Button
          type="submit"
          className="bg-amber-600 hover:bg-amber-700"
          disabled={!contextoValido || !canAvaliarFornecedor}
          data-permission="Compras.Fornecedores.avaliar"
          data-action="Compras.AvaliacaoFornecedor.confirmar"
          data-context-required="group-or-company"
          data-sensitive="true"
        >
          <Save className="w-4 h-4 mr-2" />
          Salvar Avaliação
        </Button>
      </div>
    </form>
  );

  if (windowMode) {
    return (
      <div
        className="w-full h-full bg-white"
        data-permission="Compras.Fornecedores.avaliar"
        data-context-required="group-or-company"
      >
        {content}
      </div>
    );
  }

  return content;
}
