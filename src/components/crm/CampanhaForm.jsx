import React, { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail } from "lucide-react";
import { z } from "zod";
import FormWrapper from "@/components/common/FormWrapper";
import useContextoVisual from "@/components/lib/useContextoVisual";
import useCadastroFormScopeGuard from "@/components/cadastros/hooks/useCadastroFormScopeGuard";
import { createCrmFormSubmissionGate } from "./crmFormSubmission";

/**
 * V21.1.2 - WINDOW MODE READY
 */
export default function CampanhaForm({ campanha, onSubmit, windowMode = false }) {
  const { grupoAtual, empresaAtual } = useContextoVisual();
  const scopeGuard = useCadastroFormScopeGuard(grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id, empresaAtual?.id || null);
  const submissionGate = useRef(null);
  if (!submissionGate.current) submissionGate.current = createCrmFormSubmissionGate();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [formData, setFormData] = useState(campanha || {
    nome: "",
    descricao: "",
    tipo: "E-mail Marketing",
    data_inicio: new Date().toISOString().split('T')[0],
    data_fim: "",
    publico_alvo: "Todos os Clientes",
    responsavel: "",
    objetivo: "",
    orcamento: "",
    status: "Planejamento"
  });

  const schema = z.object({
    nome: z.string().min(1, 'Nome é obrigatório'),
    data_inicio: z.string().min(4, 'Data início obrigatória')
  });

  const handleSubmit = async (payload) => {
    const data = { ...payload, orcamento: parseFloat(payload.orcamento) || 0 };
    setSubmitError('');
    try {
      return await submissionGate.current.run({payload:data,submit:onSubmit,
        assertCurrent:scopeGuard.assertCurrent,onPending:setSubmitting});
    } catch (error) {
      setSubmitError(error?.message || 'Falha ao salvar campanha.');
    }
  };

  const content = (
    <FormWrapper schema={schema} defaultValues={formData} onSubmit={handleSubmit} externalData={formData} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label htmlFor="nome_camp">Nome *</Label>
          <Input
            id="nome_camp"
            value={formData.nome}
            onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
            required
          />
        </div>
        <div className="col-span-2">
          <Label htmlFor="descricao_camp">Descrição</Label>
          <Textarea
            id="descricao_camp"
            value={formData.descricao}
            onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
            rows={2}
          />
        </div>
        <div>
          <Label htmlFor="tipo_camp">Tipo</Label>
          <Select
            value={formData.tipo}
            onValueChange={(value) => setFormData({ ...formData, tipo: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="E-mail Marketing">E-mail Marketing</SelectItem>
              <SelectItem value="WhatsApp">WhatsApp</SelectItem>
              <SelectItem value="SMS">SMS</SelectItem>
              <SelectItem value="Ligação">Ligação</SelectItem>
              <SelectItem value="Evento">Evento</SelectItem>
              <SelectItem value="Promoção">Promoção</SelectItem>
              <SelectItem value="Pesquisa">Pesquisa</SelectItem>
              <SelectItem value="Outros">Outros</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="publico_alvo">Público Alvo</Label>
          <Select
            value={formData.publico_alvo}
            onValueChange={(value) => setFormData({ ...formData, publico_alvo: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Todos os Clientes">Todos os Clientes</SelectItem>
              <SelectItem value="Clientes Ativos">Clientes Ativos</SelectItem>
              <SelectItem value="Prospects">Prospects</SelectItem>
              <SelectItem value="Inativos">Inativos</SelectItem>
              <SelectItem value="Segmento Específico">Segmento Específico</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="data_inicio_camp">Data Início</Label>
          <Input
            id="data_inicio_camp"
            type="date"
            value={formData.data_inicio}
            onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="data_fim_camp">Data Fim</Label>
          <Input
            id="data_fim_camp"
            type="date"
            value={formData.data_fim}
            onChange={(e) => setFormData({ ...formData, data_fim: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="responsavel_camp">Responsável</Label>
          <Input
            id="responsavel_camp"
            value={formData.responsavel}
            onChange={(e) => setFormData({ ...formData, responsavel: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="orcamento_camp">Orçamento</Label>
          <Input
            id="orcamento_camp"
            type="number"
            step="0.01"
            value={formData.orcamento}
            onChange={(e) => setFormData({ ...formData, orcamento: e.target.value })}
          />
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-4">
        {submitError && <p role="alert" className="text-sm text-red-700">{submitError}</p>}
        <Button type="submit" disabled={submitting} className="bg-blue-600 hover:bg-blue-700">
          {campanha ? 'Atualizar' : 'Criar Campanha'}
        </Button>
      </div>
    </FormWrapper>
  );

  if (windowMode) {
    return (
      <div className="w-full h-full overflow-auto bg-white p-6">
        <div className="mb-4 pb-4 border-b">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-600" />
            {campanha ? 'Editar Campanha' : 'Nova Campanha'}
          </h2>
        </div>
        {content}
      </div>
    );
  }

  return content;
}
