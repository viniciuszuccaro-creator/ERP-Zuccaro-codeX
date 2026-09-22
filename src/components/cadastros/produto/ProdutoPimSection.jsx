import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const numberValue = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export default function ProdutoPimSection({ formData, setFormData }) {
  const update = (field, value) => setFormData((current) => ({ ...current, [field]: value }));

  return (
    <section className="w-full space-y-5" aria-labelledby="produto-pim-title">
      <div>
        <h3 id="produto-pim-title" className="text-base font-semibold">Conteúdo técnico e comercial</h3>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="descricao-tecnica">Descrição técnica</Label>
          <Textarea
            id="descricao-tecnica"
            value={formData.descricao_tecnica || ""}
            onChange={(event) => update("descricao_tecnica", event.target.value)}
            rows={5}
            maxLength={10000}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="descricao-comercial">Descrição comercial</Label>
          <Textarea
            id="descricao-comercial"
            value={formData.descricao_comercial || ""}
            onChange={(event) => update("descricao_comercial", event.target.value)}
            rows={5}
            maxLength={10000}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="titulo-seo">Título SEO</Label>
        <Input
          id="titulo-seo"
          value={formData.titulo_seo || ""}
          onChange={(event) => update("titulo_seo", event.target.value)}
          maxLength={180}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="embalagem-tipo">Embalagem</Label>
          <Input
            id="embalagem-tipo"
            value={formData.embalagem_tipo || ""}
            onChange={(event) => update("embalagem_tipo", event.target.value)}
            maxLength={120}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="multiplo-venda">Múltiplo de venda</Label>
          <Input
            id="multiplo-venda"
            type="number"
            min="0.000001"
            step="0.000001"
            value={formData.multiplo_venda ?? 1}
            onChange={(event) => update("multiplo_venda", numberValue(event.target.value, 1))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="quantidade-minima-venda">Quantidade mínima</Label>
          <Input
            id="quantidade-minima-venda"
            type="number"
            min="0"
            step="0.000001"
            value={formData.quantidade_minima_venda ?? 0}
            onChange={(event) => update("quantidade_minima_venda", numberValue(event.target.value, 0))}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 border-t pt-4">
        <Label htmlFor="permite-fracionamento">Permitir venda fracionada</Label>
        <Switch
          id="permite-fracionamento"
          checked={Boolean(formData.permite_fracionamento)}
          onCheckedChange={(checked) => update("permite_fracionamento", checked)}
        />
      </div>
    </section>
  );
}
