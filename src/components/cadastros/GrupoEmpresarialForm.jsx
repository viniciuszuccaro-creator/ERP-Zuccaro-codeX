import React, { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Network, CheckCircle2, Trash2, Power, PowerOff } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import usePermissions from "@/components/lib/usePermissions";
import { useContextoVisual } from "@/components/lib/useContextoVisual";

const sanitizeText = (value, max = 500) => String(value ?? "").replace(/[<>]/g, "").slice(0, max).trim();
const sanitizeDocument = (value, max = 32) => String(value ?? "").replace(/[^0-9A-Za-z.\-/]/g, "").slice(0, max).trim();
const toNumber = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

/**
 * V21.1.2 - WINDOW MODE READY
 */
export default function GrupoEmpresarialForm({ grupo, item, data, initialData, defaultValues, onSubmit, isSubmitting, windowMode = false }) {
  const normalize = (registro) => {
    if (!registro) return null;
    return {
      ...registro,
      nome: registro.nome || registro.nome_do_grupo || "",
      cnpj: registro.cnpj || registro.cnpj_opcional || "",
    };
  };

  const dadosIniciais = normalize(item || data || initialData || defaultValues || grupo);
  const { canCreate, canEdit, canDelete } = usePermissions();
  const { empresaAtual, grupoAtual } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || dadosIniciais?.group_id || dadosIniciais?.id || null;
  const contextoValido = Boolean(groupId || dadosIniciais?.id);
  const podeCriar = canCreate("Cadastros", "GrupoEmpresarial") || canCreate("Sistema", "Grupos") || canCreate("Cadastros", null);
  const podeEditar = canEdit("Cadastros", "GrupoEmpresarial") || canEdit("Sistema", "Grupos") || canEdit("Cadastros", null);
  const podeExcluir = canDelete("Cadastros", "GrupoEmpresarial") || canDelete("Sistema", "Grupos") || canDelete("Cadastros", null);
  const podeSalvar = dadosIniciais?.id ? podeEditar : podeCriar;

  const [formData, setFormData] = useState(dadosIniciais || {
    nome: "",
    cnpj: "",
    descricao: "",
    inscricao_estadual: "",
    empresas_ids: [],
    status: "Ativo",
    governanca_consolidada: false,
    score_integracao_erp: 0
  });

  const { data: empresas = [] } = useQuery({
    queryKey: ["empresas", groupId || "sem-grupo"],
    queryFn: () => base44.entities.Empresa.list(),
  });

  const empresasDoGrupo = useMemo(() => empresas.filter((empresa) => {
    if (!groupId) return true;
    return empresa.group_id === groupId || empresa.grupo_id === groupId || (formData.empresas_ids || []).includes(empresa.id);
  }), [empresas, formData.empresas_ids, groupId]);

  const buildPayload = (extra = {}) => {
    const empresasIds = Array.isArray(formData.empresas_ids) ? formData.empresas_ids.map((id) => sanitizeText(id, 120)).filter(Boolean) : [];
    return {
      ...formData,
      ...extra,
      nome: sanitizeText(formData.nome, 180),
      nome_do_grupo: sanitizeText(formData.nome, 180),
      cnpj: sanitizeDocument(formData.cnpj, 32),
      cnpj_opcional: sanitizeDocument(formData.cnpj, 32),
      descricao: sanitizeText(formData.descricao, 1000),
      inscricao_estadual: sanitizeDocument(formData.inscricao_estadual, 32),
      empresas_ids: empresasIds,
      status: sanitizeText(formData.status || "Ativo", 40),
      score_integracao_erp: toNumber(formData.score_integracao_erp, 0),
      group_id: groupId || formData.group_id || formData.id
    };
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!podeSalvar) {
      alert(dadosIniciais?.id ? "Sem permissao para editar grupo empresarial." : "Sem permissao para criar grupo empresarial.");
      return;
    }
    if (!contextoValido) {
      alert("Selecione um grupo antes de salvar.");
      return;
    }

    const payload = buildPayload();
    if (!payload.nome) {
      alert("Preencha o nome do grupo");
      return;
    }
    onSubmit(payload);
  };

  const handleExcluir = () => {
    if (!podeExcluir) {
      alert("Sem permissao para excluir grupo empresarial.");
      return;
    }
    if (!window.confirm(`Tem certeza que deseja excluir o grupo "${sanitizeText(formData.nome, 180)}"? Esta acao nao pode ser desfeita.`)) {
      return;
    }
    if (onSubmit) {
      onSubmit(buildPayload({ _action: "delete" }));
    }
  };

  const handleAlternarStatus = () => {
    if (!podeEditar) {
      alert("Sem permissao para alterar status do grupo empresarial.");
      return;
    }
    const novoStatus = formData.status === "Ativo" ? "Inativo" : "Ativo";
    setFormData({ ...formData, status: novoStatus });
  };

  const toggleEmpresa = (empresaId) => {
    if (!podeSalvar) return;
    const ids = formData.empresas_ids || [];
    if (ids.includes(empresaId)) {
      setFormData({ ...formData, empresas_ids: ids.filter((id) => id !== empresaId) });
    } else {
      setFormData({ ...formData, empresas_ids: [...ids, empresaId] });
    }
  };

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Nome do Grupo *</Label>
        <Input value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} placeholder="Ex: Grupo CPA" disabled={!podeSalvar} data-permission="Cadastros.GrupoEmpresarial.editar" data-action="editar-nome-grupo" data-sensitive />
      </div>

      <div>
        <Label>Descricao</Label>
        <Textarea value={formData.descricao || ""} onChange={(e) => setFormData({ ...formData, descricao: e.target.value })} placeholder="Descricao do grupo empresarial..." rows={2} disabled={!podeSalvar} data-permission="Cadastros.GrupoEmpresarial.editar" data-action="editar-descricao-grupo" data-sensitive />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>CNPJ do Grupo</Label>
          <Input value={formData.cnpj || ""} onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })} placeholder="00.000.000/0001-00" disabled={!podeSalvar} data-permission="Cadastros.GrupoEmpresarial.editar" data-action="editar-cnpj-grupo" data-sensitive />
        </div>

        <div>
          <Label>Inscricao Estadual</Label>
          <Input value={formData.inscricao_estadual} onChange={(e) => setFormData({ ...formData, inscricao_estadual: e.target.value })} disabled={!podeSalvar} data-permission="Cadastros.GrupoEmpresarial.editar" data-action="editar-inscricao-grupo" data-sensitive />
        </div>
      </div>

      <div>
        <Label>Empresas Vinculadas ({(formData.empresas_ids || []).length})</Label>
        <Card className="border">
          <CardContent className="p-4 max-h-60 overflow-y-auto space-y-2">
            {empresasDoGrupo.map((empresa) => (
              <div key={empresa.id} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded">
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={(formData.empresas_ids || []).includes(empresa.id)} onChange={() => toggleEmpresa(empresa.id)} disabled={!podeSalvar} className="w-4 h-4" data-permission="Cadastros.GrupoEmpresarial.vincularEmpresa" data-action="vincular-empresa-grupo" data-sensitive />
                  <div>
                    <p className="text-sm font-medium">{empresa.razao_social}</p>
                    <p className="text-xs text-slate-500">{empresa.cnpj}</p>
                  </div>
                </div>
                {(formData.empresas_ids || []).includes(empresa.id) && (
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                )}
              </div>
            ))}

            {empresasDoGrupo.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-4">
                Nenhuma empresa cadastrada
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between p-3 bg-slate-50 rounded">
        <div>
          <Label>Governanca Consolidada</Label>
          <p className="text-xs text-slate-500">Sincroniza Plano de Contas entre empresas</p>
        </div>
        <Switch checked={formData.governanca_consolidada} onCheckedChange={(v) => setFormData({ ...formData, governanca_consolidada: v })} disabled={!podeSalvar} data-permission="Cadastros.GrupoEmpresarial.governanca" data-action="alternar-governanca-grupo" data-sensitive />
      </div>

      <Badge className="bg-blue-100 text-blue-700">
        <Network className="w-3 h-3 mr-1" />
        Score Integracao ERP: {formData.score_integracao_erp}% (calculado por IA)
      </Badge>

      <div className="flex justify-end gap-3 pt-4 border-t">
        {dadosIniciais && (
          <>
            <Button type="button" variant="outline" onClick={handleAlternarStatus} disabled={!podeEditar} data-permission="Cadastros.GrupoEmpresarial.alterarStatus" data-sensitive className={formData.status === "Ativo" ? "border-orange-300 text-orange-700" : "border-green-300 text-green-700"}>
              {formData.status === "Ativo" ? (
                <><PowerOff className="w-4 h-4 mr-2" />Inativar</>
              ) : (
                <><Power className="w-4 h-4 mr-2" />Ativar</>
              )}
            </Button>
            <Button type="button" variant="destructive" onClick={handleExcluir} disabled={!podeExcluir} data-permission="Cadastros.GrupoEmpresarial.excluir" data-sensitive>
              <Trash2 className="w-4 h-4 mr-2" />Excluir
            </Button>
          </>
        )}
        <Button type="submit" disabled={isSubmitting || !podeSalvar} data-permission="Cadastros.GrupoEmpresarial.salvar" data-action="salvar-grupo-empresarial" data-sensitive>
          {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {dadosIniciais ? "Atualizar Grupo" : "Criar Grupo"}
        </Button>
      </div>
    </form>
  );

  if (windowMode) {
    return (
      <div className="w-full h-full overflow-auto bg-white p-6">
        <div className="mb-4 pb-4 border-b">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Network className="w-5 h-5 text-blue-600" />
            {dadosIniciais ? "Editar Grupo Empresarial" : "Novo Grupo Empresarial"}
          </h2>
        </div>
        {formContent}
      </div>
    );
  }

  return formContent;
}
