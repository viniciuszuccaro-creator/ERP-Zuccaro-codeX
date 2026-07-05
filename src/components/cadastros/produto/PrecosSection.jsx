import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { Loader2 } from "lucide-react";
import usePermissions from "@/components/lib/usePermissions";
import { useContextoVisual } from "@/components/lib/useContextoVisual";

const toNumber = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export default function PrecosSection({ formData, setFormData }) {
  const [optimizing, setOptimizing] = useState(false);
  const { hasPermission } = usePermissions();
  const { empresaAtual, grupoAtual } = useContextoVisual();
  const contextoValido = Boolean(empresaAtual?.id || grupoAtual?.id || formData?.empresa_id || formData?.group_id || formData?.grupo_id);
  const podeEditar = hasPermission?.("Cadastros.Produto.editar");
  const podeUsarIA = hasPermission?.("Cadastros.Produto.ia") || podeEditar;
  const canEdit = contextoValido && podeEditar;
  const canOptimize = Boolean(formData?.id) && contextoValido && podeUsarIA;
  const handleOptimize = async () => {
    if (!canOptimize || optimizing) return;
    setOptimizing(true);
    try {
      const { data } = await base44.functions.invoke('productPriceOptimizer', { produto_id: formData.id });
      if (data?.updated) {
        setFormData(prev => ({ ...prev, ...data.updated }));
      }
    } finally {
      setOptimizing(false);
    }
  };
  return (
    <Card className="border-green-200 bg-green-50">
      <CardContent className="p-4 space-y-4">
        <h3 className="font-bold text-green-900">ðŸ’° PrecificaÃ§Ã£o</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label>Custo AquisiÃ§Ã£o</Label>
            <Input
              type="number"
              step="0.01"
              value={formData.custo_aquisicao}
              onChange={(e) => setFormData(prev => ({...prev, custo_aquisicao: toNumber(e.target.value, 0)}))}
              disabled={!canEdit}
              data-permission="Cadastros.Produto.editar"
              data-action="editar-custo-aquisicao-produto"
              data-sensitive
            />
          </div>
          <div>
            <Label>PreÃ§o Venda</Label>
            <Input
              type="number"
              step="0.01"
              value={formData.preco_venda}
              onChange={(e) => setFormData(prev => ({...prev, preco_venda: toNumber(e.target.value, 0)}))}
              disabled={!canEdit}
              data-permission="Cadastros.Produto.editar"
              data-action="editar-preco-venda-produto"
              data-sensitive
            />
          </div>
          <div>
            <Label>Margem (%)</Label>
            <Input
              type="number"
              value={formData.custo_aquisicao > 0 ? (((formData.preco_venda - formData.custo_aquisicao) / formData.custo_aquisicao) * 100).toFixed(2) : 0}
              disabled
              className="bg-white"
              data-permission="Cadastros.Produto.visualizar"
              data-action="visualizar-margem-produto"
            />
          </div>
          <div>
            <Label>Margem MÃ­nima (%)</Label>
            <Input
              type="number"
              step="0.01"
              value={formData.margem_minima_percentual}
              onChange={(e) => setFormData(prev => ({...prev, margem_minima_percentual: toNumber(e.target.value, 0)}))}
              disabled={!canEdit}
              data-permission="Cadastros.Produto.editar"
              data-action="editar-margem-minima-produto"
              data-sensitive
            />
            <p className="text-xs text-slate-500 mt-1">Usada na aprovaÃ§Ã£o de descontos</p>
          </div>
        </div>
        <div className="flex justify-end pt-2">
          <Button
            onClick={handleOptimize}
            disabled={!canOptimize || optimizing}
            className="bg-blue-600 hover:bg-blue-700"
            data-permission="Cadastros.Produto.ia"
            data-action="otimizar-preco-produto"
            data-sensitive
          >
            {optimizing ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Otimizando...</>) : 'Otimizar PreÃ§o (PolÃ­ticas)'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
