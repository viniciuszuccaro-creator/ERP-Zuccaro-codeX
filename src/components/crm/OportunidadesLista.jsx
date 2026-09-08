import React, { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Target, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import { useWindow } from "@/components/lib/useWindow";
import useContextoVisual from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import OportunidadeForm from "@/components/crm/OportunidadeForm";
import ConverterOportunidade from "@/components/crm/ConverterOportunidade";
import {
  buildDocumentoFromOportunidade,
  oportunidadeAberta,
  stampOportunidadeConvertida,
} from "@/components/lib/crmOportunidadePolicy";

export default function OportunidadesLista({ oportunidades = [], windowMode = false }) {
  const queryClient = useQueryClient();
  const { openWindow } = useWindow();
  const { hasPermission } = usePermissions();
  const { createInContext, updateInContext, empresaAtual } = useContextoVisual();
  const [busca, setBusca] = useState("");
  const [convertendo, setConvertendo] = useState(null);

  const canCreate = hasPermission("CRM", null, "criar") || hasPermission("CRM", "Oportunidade", "criar");
  const canEdit = hasPermission("CRM", null, "editar") || hasPermission("CRM", "Oportunidade", "editar");

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return oportunidades;
    return oportunidades.filter((item) => (
      String(item.titulo || "").toLowerCase().includes(termo)
      || String(item.cliente_nome || "").toLowerCase().includes(termo)
      || String(item.codigo_oportunidade || "").toLowerCase().includes(termo)
      || String(item.etapa || "").toLowerCase().includes(termo)
    ));
  }, [oportunidades, busca]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["oportunidades"] });
  };

  const createMutation = useMutation({
    mutationFn: (data) => createInContext("Oportunidade", {
      ...data,
      quantidade_interacoes: 0,
      dias_sem_contato: 0,
    }),
    onSuccess: () => {
      invalidate();
      toast.success("Oportunidade salva");
    },
    onError: (error) => toast.error(error?.message || "Falha ao salvar oportunidade"),
  });

  const convertMutation = useMutation({
    mutationFn: async ({ oportunidade, tipo }) => {
      const documento = await createInContext(
        "Pedido",
        buildDocumentoFromOportunidade(oportunidade, tipo, empresaAtual?.id || oportunidade.empresa_id),
      );
      await updateInContext(
        "Oportunidade",
        oportunidade.id,
        stampOportunidadeConvertida(oportunidade, documento, tipo),
      );
      return documento;
    },
    onSuccess: (_doc, vars) => {
      invalidate();
      setConvertendo(null);
      toast.success(vars.tipo === "pedido" ? "Pedido gerado a partir da oportunidade" : "Orçamento gerado a partir da oportunidade");
    },
    onError: (error) => toast.error(error?.message || "Falha na conversão"),
  });

  const abrirForm = (oportunidade = null) => {
    openWindow(
      OportunidadeForm,
      {
        oportunidade,
        windowMode: true,
        onSubmit: async (data) => {
          if (oportunidade?.id) {
            await updateInContext("Oportunidade", oportunidade.id, data);
            invalidate();
            toast.success("Oportunidade atualizada");
            return;
          }
          await createMutation.mutateAsync(data);
        },
      },
      {
        title: oportunidade?.id ? "Editar Oportunidade" : "Nova Oportunidade",
        width: 1000,
        height: 700,
        uniqueKey: `crm-oportunidade-${oportunidade?.id || "nova"}`,
      },
    );
  };

  return (
    <div className={`space-y-4 p-4 ${windowMode ? "h-full overflow-auto" : ""}`}>
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-indigo-600" />
          <h3 className="font-semibold text-lg">Oportunidades</h3>
          <Badge variant="secondary">{lista.length}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Input
            className="w-64"
            placeholder="Buscar título, cliente ou código"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          {canCreate && (
            <Button size="sm" onClick={() => abrirForm()}>
              <Plus className="w-4 h-4 mr-1" /> Nova
            </Button>
          )}
        </div>
      </div>

      <div className="border rounded-lg divide-y bg-white">
        {lista.length === 0 && (
          <p className="p-6 text-sm text-slate-500">Nenhuma oportunidade no contexto atual.</p>
        )}
        {lista.map((item) => (
          <div key={item.id} className="p-3 flex flex-wrap items-center gap-3 justify-between hover:bg-slate-50">
            <div className="min-w-0">
              <p className="font-medium truncate">{item.titulo}</p>
              <p className="text-sm text-slate-600 truncate">
                {item.codigo_oportunidade ? `${item.codigo_oportunidade} · ` : ""}
                {item.cliente_nome || "Sem cliente"} · {item.etapa || item.etapa_funil || "—"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge>{item.status || "Aberto"}</Badge>
              <span className="text-sm font-semibold text-green-700">
                R$ {(Number(item.valor_estimado) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
              {canEdit && (
                <Button size="sm" variant="outline" onClick={() => abrirForm(item)}>
                  Abrir
                </Button>
              )}
              {canEdit && oportunidadeAberta(item) && (
                <Button size="sm" variant="secondary" onClick={() => setConvertendo(item)}>
                  <ArrowRightLeft className="w-4 h-4 mr-1" /> Converter
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <ConverterOportunidade
        open={Boolean(convertendo)}
        oportunidade={convertendo}
        onClose={() => setConvertendo(null)}
        onConverter={(oportunidade, tipo) => convertMutation.mutate({ oportunidade, tipo })}
      />
    </div>
  );
}
