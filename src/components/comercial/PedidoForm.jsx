import React, { useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2 } from "lucide-react";
import { z } from "zod";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import useContextoVisual from "@/components/lib/useContextoVisual";
import FormErrorSummary from "@/components/common/FormErrorSummary";
import FormWrapper from "@/components/common/FormWrapper";
import PedidoItensEditor from "./PedidoItensEditor";
import PedidoResumoTotal from "./PedidoResumoTotal";
import DetalhesPedidoHeader from "./DetalhesPedidoHeader";

// Tipos auxiliares
const itemSchema = z
  .object({
    descricao: z.string().min(1, "Descrição obrigatória"),
    quantidade: z.coerce.number().positive("Qtd > 0"),
    valor_unitario: z.coerce.number().min(0, "Valor inválido"),
    valor_total: z.coerce.number().min(0),
  })
  .refine(
    (d) => Math.abs(d.valor_total - d.quantidade * d.valor_unitario) < 0.0001,
    { path: ["valor_total"], message: "Total ≠ qtd x valor" }
  );

const pedidoSchema = z
  .object({
    numero_pedido: z.string().optional().default(""),
    cliente_id: z.string().min(1, "Cliente é obrigatório"),
    cliente_nome: z.string().min(1, "Cliente é obrigatório"),
    data_pedido: z
      .string()
      .min(8, "Data inválida")
      .refine((s) => {
        const d = new Date(s);
        const hoje = new Date();
        d.setHours(0, 0, 0, 0);
        hoje.setHours(0, 0, 0, 0);
        return d <= hoje;
      }, "Data não pode ser futura"),
    status: z.enum(["Orçamento", "Aprovado", "Em Produção", "Pronto para Envio"]).default("Orçamento"),
    forma_pagamento: z.enum(["À Vista", "Cartão de Crédito", "Boleto", "Parcelado", "PIX"]).default("À Vista"),
    itens: z.array(itemSchema).min(1, "Inclua pelo menos 1 item"),
    observacoes: z.string().optional().default(""),
  })
  .refine((p) => p.itens.reduce((s, i) => s + (i.valor_total || 0), 0) >= 0, {
    message: "Total do pedido inválido",
    path: ["itens"],
  })
  .superRefine((p, ctx) => {
    if (p.forma_pagamento === 'Parcelado' && (!p.observacoes || p.observacoes.trim().length < 5)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['observacoes'], message: 'Informe as condições do parcelamento nas observações' });
    }
    if (p.status === 'Aprovado') {
      const algumZerado = p.itens.some(i => (i.valor_unitario || 0) <= 0);
      if (algumZerado) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['itens'], message: 'Itens aprovados devem ter valor unitário > 0' });
      }
    }
  });

export default function PedidoForm({ clientes = [], onSubmit, isSubmitting }) {
  const { carimbarContexto } = useContextoVisual();

  const defaultValues = useMemo(
    () => ({
      numero_pedido: "",
      cliente_nome: "",
      cliente_id: "",
      data_pedido: new Date().toISOString().split("T")[0],
      status: "Orçamento",
      forma_pagamento: "À Vista",
      itens: [{ descricao: "", quantidade: 1, valor_unitario: 0, valor_total: 0 }],
      observacoes: "",
    }),
    []
  );

  const {
    control,
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues,
    resolver: zodResolver(pedidoSchema),
    mode: "onChange",
  });

  const { fields, append, remove } = useFieldArray({ control, name: "itens" });

  const itens = watch("itens");

  // Recalcular valor_total do item ao alterar quantidade/valor
  const setItemField = (index, field, value) => {
    const path = `itens.${index}.${field}`;
    setValue(path, value, { shouldValidate: true, shouldDirty: true });
    if (field === "quantidade" || field === "valor_unitario") {
      const qtd = field === "quantidade" ? value : itens?.[index]?.quantidade || 0;
      const vu = field === "valor_unitario" ? value : itens?.[index]?.valor_unitario || 0;
      setValue(`itens.${index}.valor_total`, (Number(qtd) || 0) * (Number(vu) || 0), {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
  };

  const calculateTotal = () => (itens || []).reduce((sum, i) => sum + (Number(i?.valor_total) || 0), 0);

  const allValues = watch();

  const handleFormWrapperSubmit = (data) => {
      const total = (data?.itens || []).reduce((sum, i) => sum + (Number(i?.valor_total) || 0), 0);
      const stamped = carimbarContexto({ ...data, valor_total: total }, "empresa_id");
      onSubmit(stamped);
  };

  return (
      <FormWrapper schema={pedidoSchema} defaultValues={defaultValues} onSubmit={handleFormWrapperSubmit} externalData={allValues} className="space-y-6 w-full h-full">
        <DetalhesPedidoHeader
          control={control}
          register={register}
          setValue={setValue}
          errors={errors}
          clientes={clientes}
        />

      <div>
        <PedidoItensEditor
          fields={fields}
          itens={itens}
          errors={errors}
          setItemField={setItemField}
          append={append}
          remove={remove}
        />
      </div>

      <PedidoResumoTotal total={calculateTotal()} />

      <div>
        <Label htmlFor="observacoes">Observações</Label>
        <Textarea id="observacoes" rows={3} {...register("observacoes")} />
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700">
          {isSubmitting ? "Salvando..." : "Salvar Pedido"}
        </Button>
      </div>
    </FormWrapper>
  );
}