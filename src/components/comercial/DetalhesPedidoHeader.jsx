import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Controller } from "react-hook-form";

export default function DetalhesPedidoHeader({ control, register, setValue, errors, clientes }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <Label htmlFor="numero_pedido">Nº Pedido</Label>
        <Input id="numero_pedido" placeholder="Gerado ao salvar" {...register("numero_pedido")} />
        {errors?.numero_pedido && (
          <p className="text-xs text-red-600 mt-1">{errors.numero_pedido.message}</p>
        )}
      </div>

      <div>
        <Label htmlFor="data_pedido">Data</Label>
        <Input id="data_pedido" type="date" {...register("data_pedido")} />
        {errors?.data_pedido && (
          <p className="text-xs text-red-600 mt-1">{errors.data_pedido.message}</p>
        )}
      </div>

      <div className="col-span-2">
        <Label htmlFor="cliente">Cliente *</Label>
        <Controller
          control={control}
          name="cliente_id"
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={(value) => {
                const cli = (clientes || []).find((c) => c.id === value);
                field.onChange(value);
                setValue("cliente_nome", cli?.nome || "");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um cliente" />
              </SelectTrigger>
              <SelectContent>
                {(clientes || []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors?.cliente_id && (
          <p className="text-xs text-red-600 mt-1">{errors.cliente_id.message}</p>
        )}
      </div>

      <div>
        <Label htmlFor="status">Status</Label>
        <Controller
          control={control}
          name="status"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Orçamento">Orçamento</SelectItem>
                <SelectItem value="Aprovado">Aprovado</SelectItem>
                <SelectItem value="Em Produção">Em Produção</SelectItem>
                <SelectItem value="Pronto para Envio">Pronto para Envio</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div>
        <Label htmlFor="forma_pagamento">Forma de Pagamento</Label>
        <Controller
          control={control}
          name="forma_pagamento"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="À Vista">À Vista</SelectItem>
                <SelectItem value="Cartão de Crédito">Cartão de Crédito</SelectItem>
                <SelectItem value="Boleto">Boleto</SelectItem>
                <SelectItem value="Parcelado">Parcelado</SelectItem>
                <SelectItem value="PIX">PIX</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </div>
    </div>
  );
}