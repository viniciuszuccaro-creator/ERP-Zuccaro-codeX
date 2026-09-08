import React, { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { MessageSquare, Plus } from "lucide-react";
import { toast } from "sonner";
import { useWindow } from "@/components/lib/useWindow";
import useContextoVisual from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import InteracaoForm from "@/components/crm/InteracaoForm";

export default function InteracoesLista({ interacoes = [], windowMode = false }) {
  const queryClient = useQueryClient();
  const { openWindow } = useWindow();
  const { hasPermission } = usePermissions();
  const { createInContext, updateInContext } = useContextoVisual();
  const [busca, setBusca] = useState("");

  const canCreate = hasPermission("CRM", null, "criar") || hasPermission("CRM", "Interacao", "criar");
  const canEdit = hasPermission("CRM", null, "editar") || hasPermission("CRM", "Interacao", "editar");

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return interacoes;
    return interacoes.filter((item) => (
      String(item.titulo || "").toLowerCase().includes(termo)
      || String(item.cliente_nome || "").toLowerCase().includes(termo)
      || String(item.tipo || "").toLowerCase().includes(termo)
      || String(item.codigo_interacao || "").toLowerCase().includes(termo)
    ));
  }, [interacoes, busca]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["interacoes"] });

  const salvar = async (data, existente = null) => {
    if (existente?.id) {
      await updateInContext("Interacao", existente.id, data);
      invalidate();
      toast.success("Interação atualizada");
      return;
    }
    await createInContext("Interacao", data);
    invalidate();
    toast.success("Interação registrada");
  };

  const abrirForm = (interacao = null) => {
    openWindow(
      InteracaoForm,
      {
        interacao,
        windowMode: true,
        onSubmit: async (data) => {
          try {
            await salvar(data, interacao);
          } catch (error) {
            toast.error(error?.message || "Falha ao salvar interação");
          }
        },
      },
      {
        title: interacao?.id ? "Editar Interação" : "Nova Interação",
        width: 900,
        height: 650,
        uniqueKey: `crm-interacao-${interacao?.id || "nova"}`,
      },
    );
  };

  return (
    <div className={`space-y-4 p-4 ${windowMode ? "h-full overflow-auto" : ""}`}>
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-green-600" />
          <h3 className="font-semibold text-lg">Interações</h3>
          <Badge variant="secondary">{lista.length}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Input
            className="w-64"
            placeholder="Buscar interação"
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
          <p className="p-6 text-sm text-slate-500">Nenhuma interação no contexto atual.</p>
        )}
        {lista.map((item) => (
          <div key={item.id} className="p-3 flex flex-wrap items-center gap-3 justify-between hover:bg-slate-50">
            <div className="min-w-0">
              <p className="font-medium truncate">{item.titulo}</p>
              <p className="text-sm text-slate-600 truncate">
                {item.codigo_interacao ? `${item.codigo_interacao} · ` : ""}
                {item.tipo || "Contato"} · {item.cliente_nome || "—"} · {item.data_interacao || "—"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{item.resultado || "Neutro"}</Badge>
              {canEdit && (
                <Button size="sm" variant="outline" onClick={() => abrirForm(item)}>
                  Abrir
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
