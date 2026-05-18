import React, { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, Save } from "lucide-react";
import usePermissions from "@/components/lib/usePermissions";
import { useContextoVisual } from "@/components/lib/useContextoVisual";

export default function JobAgendadoForm({ jobAgendado, onSubmit, isSubmitting, windowMode = false }) {
  const { canCreate, canEdit } = usePermissions();
  const { empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || jobAgendado?.group_id || null;
  const contextoValido = Boolean(groupId || empresaAtual?.id || jobAgendado?.empresa_id);
  const podeCriar = canCreate("Cadastros", "JobAgendado") || canCreate("Sistema", "JobAgendado") || canCreate("Cadastros", null);
  const podeEditar = canEdit("Cadastros", "JobAgendado") || canEdit("Sistema", "JobAgendado") || canEdit("Cadastros", null);
  const podeSalvar = jobAgendado?.id ? podeEditar : podeCriar;
  const [formData, setFormData] = useState(jobAgendado || {
    nome_job: "",
    tipo_job: "IA_Fiscal",
    descricao: "",
    frequencia: "Diária",
    horario_execucao: "00:00",
    parametros_execucao: {},
    ativo: true,
    observacoes: ""
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.nome_job) {
      alert('Nome do job é obrigatório');
      return;
    }
    if (!contextoValido) {
      alert('Selecione um grupo ou empresa antes de salvar.');
      return;
    }
    if (!podeSalvar) {
      alert('Sem permissao para salvar jobs agendados.');
      return;
    }
    await onSubmit({
      ...formData,
      nome: formData.nome_job,
      group_id: groupId || formData.group_id,
      empresa_id: contexto === "empresa" ? empresaAtual?.id : formData.empresa_id,
    });
  };

  const form = (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-600" />
            Job Agendado de IA
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Nome do Job *</Label>
              <Input
                value={formData.nome_job}
                onChange={(e) => setFormData({ ...formData, nome_job: e.target.value })}
                placeholder="Ex: Validação Fiscal Diária"
              />
            </div>
            <div>
              <Label>Tipo de Job</Label>
              <Select value={formData.tipo_job} onValueChange={(val) => setFormData({ ...formData, tipo_job: val })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IA_Fiscal">IA Fiscal</SelectItem>
                  <SelectItem value="IA_PriceBrain">IA PriceBrain</SelectItem>
                  <SelectItem value="IA_Churn">IA Churn Detection</SelectItem>
                  <SelectItem value="IA_KYC">IA KYC/Validação</SelectItem>
                  <SelectItem value="IA_Governanca">IA Governança</SelectItem>
                  <SelectItem value="IA_Logistica">IA Logística</SelectItem>
                  <SelectItem value="IA_Recomendacao">IA Recomendação</SelectItem>
                  <SelectItem value="Sincronizacao">Sincronização</SelectItem>
                  <SelectItem value="Backup">Backup</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Descrição</Label>
            <Textarea
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Frequência</Label>
              <Select value={formData.frequencia} onValueChange={(val) => setFormData({ ...formData, frequencia: val })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Horária">Horária</SelectItem>
                  <SelectItem value="Diária">Diária</SelectItem>
                  <SelectItem value="Semanal">Semanal</SelectItem>
                  <SelectItem value="Mensal">Mensal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Horário de Execução</Label>
              <Input
                type="time"
                value={formData.horario_execucao}
                onChange={(e) => setFormData({ ...formData, horario_execucao: e.target.value })}
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-50 rounded">
            <Label>Job Ativo</Label>
            <Switch
              checked={formData.ativo}
              onCheckedChange={(val) => setFormData({ ...formData, ativo: val })}
            />
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea
              value={formData.observacoes}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="submit" className="bg-amber-600 hover:bg-amber-700" disabled={isSubmitting || !contextoValido || !podeSalvar} data-permission="Cadastros.JobAgendado.salvar" data-action="salvar-job-agendado" data-sensitive>
          <Save className="w-4 h-4 mr-2" />
          {isSubmitting ? 'Salvando...' : jobAgendado ? 'Atualizar' : 'Criar'}
        </Button>
      </div>
    </form>
  );

  if (windowMode) {
    return (
      <div className="w-full h-full overflow-auto bg-white p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b">
            <Clock className="w-8 h-8 text-amber-600" />
            <h2 className="text-2xl font-bold text-slate-900">
              {jobAgendado ? 'Editar Job Agendado' : 'Novo Job Agendado'}
            </h2>
          </div>
          {form}
        </div>
      </div>
    );
  }

  return form;
}
