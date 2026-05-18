import React, { useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FileText, Save } from "lucide-react";
import usePermissions from "@/components/lib/usePermissions";
import { useContextoVisual } from "@/components/lib/useContextoVisual";

export default function ParametroRecebimentoNFeForm({ parametro, onSubmit, windowMode = false }) {
  const { canCreate, canEdit } = usePermissions();
  const { empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || parametro?.group_id || null;
  const contextoValido = Boolean(groupId || empresaAtual?.id || parametro?.empresa_id);
  const podeCriar = canCreate("Cadastros", "ParametroRecebimentoNFe") || canCreate("Fiscal", "NF-e") || canCreate("Cadastros", null);
  const podeEditar = canEdit("Cadastros", "ParametroRecebimentoNFe") || canEdit("Fiscal", "NF-e") || canEdit("Cadastros", null);
  const podeSalvar = parametro?.id ? podeEditar : podeCriar;
  const [formData, setFormData] = useState(parametro || {
    sugerir_cadastro_automatico_produto: true,
    usar_ia_para_classificacao: true,
    vincular_produtos_fornecedor: true,
    exigir_conferencia_quantidade: true,
    exigir_conferencia_impostos: false,
    alertar_divergencia_preco: true,
    percentual_tolerancia_preco: 5,
    gerar_movimentacao_estoque_automatica: true,
    atualizar_custo_medio_automatico: true,
    exigir_foto_comprovante: false,
    ativo: true
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!contextoValido) {
      alert('Selecione um grupo ou empresa antes de salvar.');
      return;
    }
    if (!podeSalvar) {
      alert('Sem permissao para salvar parametros de recebimento de NF-e.');
      return;
    }
    onSubmit({
      ...formData,
      group_id: groupId || formData.group_id,
      empresa_id: contexto === "empresa" ? empresaAtual?.id : formData.empresa_id,
    });
  };

  const containerClass = windowMode ? "w-full h-full overflow-auto p-6" : "space-y-6";

  return (
    <div className={containerClass}>
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-green-600" />
              Parâmetros de Recebimento de NF-e
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Sugerir Cadastro Automático</Label>
                <Switch
                  checked={formData.sugerir_cadastro_automatico_produto}
                  onCheckedChange={(val) => setFormData({ ...formData, sugerir_cadastro_automatico_produto: val })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Usar IA para Classificação</Label>
                <Switch
                  checked={formData.usar_ia_para_classificacao}
                  onCheckedChange={(val) => setFormData({ ...formData, usar_ia_para_classificacao: val })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Vincular Produtos Fornecedor</Label>
                <Switch
                  checked={formData.vincular_produtos_fornecedor}
                  onCheckedChange={(val) => setFormData({ ...formData, vincular_produtos_fornecedor: val })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Exigir Conferência Quantidade</Label>
                <Switch
                  checked={formData.exigir_conferencia_quantidade}
                  onCheckedChange={(val) => setFormData({ ...formData, exigir_conferencia_quantidade: val })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Alertar Divergência Preço</Label>
                <Switch
                  checked={formData.alertar_divergencia_preco}
                  onCheckedChange={(val) => setFormData({ ...formData, alertar_divergencia_preco: val })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Gerar Movimentação Automática</Label>
                <Switch
                  checked={formData.gerar_movimentacao_estoque_automatica}
                  onCheckedChange={(val) => setFormData({ ...formData, gerar_movimentacao_estoque_automatica: val })}
                />
              </div>
            </div>

            <div>
              <Label>% Tolerância Preço</Label>
              <Input
                type="number"
                value={formData.percentual_tolerancia_preco}
                onChange={(e) => setFormData({ ...formData, percentual_tolerancia_preco: parseFloat(e.target.value) })}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="submit" className="bg-green-600 hover:bg-green-700" disabled={!contextoValido || !podeSalvar} data-permission="Cadastros.ParametroRecebimentoNFe.salvar" data-action="salvar-parametros-recebimento-nfe" data-sensitive>
            <Save className="w-4 h-4 mr-2" />
            Salvar Parâmetros
          </Button>
        </div>
      </form>
    </div>
  );
}
