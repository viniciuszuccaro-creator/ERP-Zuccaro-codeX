import React, { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Mail, Plus } from "lucide-react";
import { toast } from "sonner";
import { useWindow } from "@/components/lib/useWindow";
import useContextoVisual from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import CampanhaForm from "@/components/crm/CampanhaForm";

export default function CampanhasLista({ campanhas = [], windowMode = false }) {
  const queryClient = useQueryClient();
  const { openWindow } = useWindow();
  const { hasPermission } = usePermissions();
  const { createInContext, updateInContext } = useContextoVisual();
  const [busca, setBusca] = useState("");

  const canCreate = hasPermission("CRM", null, "criar") || hasPermission("CRM", "Campanha", "criar");
  const canEdit = hasPermission("CRM", null, "editar") || hasPermission("CRM", "Campanha", "editar");

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return campanhas;
    return campanhas.filter((item) => (
      String(item.nome || item.titulo || "").toLowerCase().includes(termo)
      || String(item.tipo || "").toLowerCase().includes(termo)
      || String(item.codigo_campanha || "").toLowerCase().includes(termo)
      || String(item.status || "").toLowerCase().includes(termo)
    ));
  }, [campanhas, busca]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["campanhas"] });

  const salvar = async (data, existente = null) => {
    if (existente?.id) {
      await updateInContext("Campanha", existente.id, data);
      invalidate();
      toast.success("Campanha atualizada");
      return;
    }
    await createInContext("Campanha", data);
    invalidate();
    toast.success("Campanha criada");
  };

  const abrirForm = (campanha = null) => {
    openWindow(
      CampanhaForm,
      {
        campanha,
        windowMode: true,
        onSubmit: async (data) => {
          try {
            await salvar(data, campanha);
          } catch (error) {
            toast.error(error?.message || "Falha ao salvar campanha");
          }
        },
      },
      {
        title: campanha?.id ? "Editar Campanha" : "Nova Campanha",
        width: 900,
        height: 650,
        uniqueKey: `crm-campanha-${campanha?.id || "nova"}`,
      },
    );
  };

  return (
    <div className={`space-y-4 p-4 ${windowMode ? "h-full overflow-auto" : ""}`}>
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-pink-600" />
          <h3 className="font-semibold text-lg">Campanhas</h3>
          <Badge variant="secondary">{lista.length}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Input
            className="w-64"
            placeholder="Buscar campanha"
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
          <p className="p-6 text-sm text-slate-500">Nenhuma campanha no contexto atual.</p>
        )}
        {lista.map((item) => (
          <div key={item.id} className="p-3 flex flex-wrap items-center gap-3 justify-between hover:bg-slate-50">
            <div className="min-w-0">
              <p className="font-medium truncate">{item.nome || item.titulo}</p>
              <p className="text-sm text-slate-600 truncate">
                {item.codigo_campanha ? `${item.codigo_campanha} · ` : ""}
                {item.tipo || "Marketing"} · {item.data_inicio || "—"} → {item.data_fim || "—"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge>{item.status || "Planejamento"}</Badge>
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
