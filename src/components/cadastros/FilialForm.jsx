import React, { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import usePermissions from "@/components/lib/usePermissions";
import { useContextoVisual } from "@/components/lib/useContextoVisual";

const sanitizeText = (value, max = 500) => String(value ?? "").replace(/[<>]/g, "").slice(0, max).trim();
const sanitizeDocument = (value, max = 32) => String(value ?? "").replace(/[^0-9A-Za-z.\-/]/g, "").slice(0, max).trim();

export default function FilialForm({ filial, item, data, initialData, defaultValues, onSubmit, isSubmitting, windowMode = false }) {
  const dadosIniciais = item || data || initialData || defaultValues || filial;
  const { canCreate, canEdit } = usePermissions();
  const { empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || dadosIniciais?.group_id || null;
  const contextoValido = Boolean(empresaAtual?.id || groupId || dadosIniciais?.empresa_id || dadosIniciais?.group_id);
  const podeCriar = canCreate("Cadastros", "Filial") || canCreate("Administracao", "Filial") || canCreate("Cadastros", null);
  const podeEditar = canEdit("Cadastros", "Filial") || canEdit("Administracao", "Filial") || canEdit("Cadastros", null);
  const podeSalvar = dadosIniciais?.id ? podeEditar : podeCriar;
  const [formData, setFormData] = useState(dadosIniciais || {
    razao_social: "",
    nome_fantasia: "",
    cnpj: "",
    inscricao_estadual: "",
    tipo: "Filial",
    matriz_id: "",
    status: "Ativa"
  });

  const { data: empresas = [] } = useQuery({
    queryKey: ["empresas", groupId],
    queryFn: () => base44.entities.Empresa.list(),
  });

  const matrizes = useMemo(() => empresas.filter((empresa) => {
    const mesmoGrupo = !groupId || empresa.group_id === groupId || empresa.grupo_id === groupId || empresa.id === empresaAtual?.id;
    return empresa.tipo === "Matriz" && mesmoGrupo;
  }), [empresas, groupId, empresaAtual?.id]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!podeSalvar) {
      alert(dadosIniciais?.id ? "Sem permissao para editar filial." : "Sem permissao para criar filial.");
      return;
    }
    if (!contextoValido) {
      alert("Selecione um grupo ou empresa antes de salvar.");
      return;
    }

    const payload = {
      ...formData,
      razao_social: sanitizeText(formData.razao_social, 180),
      nome_fantasia: sanitizeText(formData.nome_fantasia, 180),
      nome: sanitizeText(formData.nome_fantasia || formData.razao_social, 180),
      cnpj: sanitizeDocument(formData.cnpj, 32),
      inscricao_estadual: sanitizeDocument(formData.inscricao_estadual, 32),
      tipo: sanitizeText(formData.tipo || "Filial", 40),
      matriz_id: sanitizeText(formData.matriz_id, 120),
      status: sanitizeText(formData.status || "Ativa", 40),
      group_id: groupId || formData.group_id,
      empresa_id: contexto === "empresa" ? empresaAtual?.id : formData.empresa_id
    };

    if (!payload.razao_social || !payload.cnpj) {
      alert("Preencha os campos obrigatorios");
      return;
    }
    onSubmit(payload);
  };

  const form = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Razao Social *</Label>
        <Input value={formData.razao_social} onChange={(e) => setFormData({ ...formData, razao_social: e.target.value })} placeholder="Empresa Filial Ltda" disabled={!podeSalvar} data-permission="Cadastros.Filial.editar" data-action="editar-razao-social-filial" data-sensitive />
      </div>

      <div>
        <Label>Nome Fantasia</Label>
        <Input value={formData.nome_fantasia} onChange={(e) => setFormData({ ...formData, nome_fantasia: e.target.value })} disabled={!podeSalvar} data-permission="Cadastros.Filial.editar" data-action="editar-nome-fantasia-filial" data-sensitive />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>CNPJ *</Label>
          <Input value={formData.cnpj} onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })} placeholder="00.000.000/0001-00" disabled={!podeSalvar} data-permission="Cadastros.Filial.editar" data-action="editar-cnpj-filial" data-sensitive />
        </div>
        <div>
          <Label>Inscricao Estadual</Label>
          <Input value={formData.inscricao_estadual} onChange={(e) => setFormData({ ...formData, inscricao_estadual: e.target.value })} disabled={!podeSalvar} data-permission="Cadastros.Filial.editar" data-action="editar-inscricao-estadual-filial" data-sensitive />
        </div>
      </div>

      <div>
        <Label>Matriz</Label>
        <Select value={formData.matriz_id} onValueChange={(v) => setFormData({ ...formData, matriz_id: v })} disabled={!podeSalvar}>
          <SelectTrigger data-permission="Cadastros.Filial.editar" data-action="selecionar-matriz-filial" data-sensitive>
            <SelectValue placeholder="Selecione a matriz" />
          </SelectTrigger>
          <SelectContent>
            {matrizes.map((matriz) => (
              <SelectItem key={matriz.id} value={matriz.id}>{matriz.razao_social}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="submit" disabled={isSubmitting || !podeSalvar} data-permission="Cadastros.Filial.salvar" data-action="salvar-filial" data-sensitive>
          {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {dadosIniciais ? "Atualizar" : "Criar Filial"}
        </Button>
      </div>
    </form>
  );

  if (windowMode) {
    return <div className="w-full h-full overflow-auto bg-white p-6">{form}</div>;
  }

  return form;
}
