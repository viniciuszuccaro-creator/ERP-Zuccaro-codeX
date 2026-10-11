import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare } from "lucide-react";
import { z } from "zod";
import FormWrapper from "@/components/common/FormWrapper";
import useContextoVisual from "@/components/lib/useContextoVisual";
import useCadastroFormScopeGuard from "@/components/cadastros/hooks/useCadastroFormScopeGuard";
import { createCrmFormSubmissionGate } from "./crmFormSubmission";

/**
 * V21.1.2 - WINDOW MODE READY
 */
export default function InteracaoForm({ interacao, onSubmit, windowMode = false }) {
  const { grupoAtual, empresaAtual } = useContextoVisual();
  const scopeGuard = useCadastroFormScopeGuard(grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id, empresaAtual?.id || null);
  const submissionGate = useRef(null);
  if (!submissionGate.current) submissionGate.current = createCrmFormSubmissionGate();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [formData, setFormData] = useState(interacao || {
    tipo: "Ligação",
    titulo: "",
    descricao: "",
    data_interacao: new Date().toISOString().split('T')[0],
    duracao: "",
    cliente_nome: "",
    responsavel: "",
    resultado: "Neutro",
    proxima_acao: "",
    data_proxima_acao: "",
    observacoes: ""
  });

  const schema = z.object({
    tipo: z.string().min(1, 'Tipo é obrigatório'),
    titulo: z.string().min(1, 'Título é obrigatório'),
    cliente_nome: z.string().min(1, 'Cliente é obrigatório'),
  });

  const handleSubmit = async (payload) => {
    const data = { ...payload, duracao: parseFloat(payload.duracao) || null };
    setSubmitError('');
    try {
      return await submissionGate.current.run({payload:data,submit:onSubmit,
        assertCurrent:scopeGuard.assertCurrent,onPending:setSubmitting});
    } catch (error) {
      setSubmitError(error?.message || 'Falha ao salvar interação.');
    }
  };

  const content = (
    <FormWrapper schema={schema} defaultValues={formData} onSubmit={handleSubmit} externalData={formData} className="space-y-4 w-full h-full">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="tipo">Tipo *</Label>
          <Select
            value={formData.tipo}
            onValueChange={(value) => setFormData({ ...formData, tipo: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Ligação">Ligação</SelectItem>
              <SelectItem value="E-mail">E-mail</SelectItem>
              <SelectItem value="Reunião">Reunião</SelectItem>
              <SelectItem value="Visita">Visita</SelectItem>
              <SelectItem value="WhatsApp">WhatsApp</SelectItem>
              <SelectItem value="Chat">Chat</SelectItem>
              <SelectItem value="Outros">Outros</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="cliente_nome_int">Cliente *</Label>
          <Input
            id="cliente_nome_int"
            value={formData.cliente_nome}
            onChange={(e) => setFormData({ ...formData, cliente_nome: e.target.value })}
            required
          />
        </div>
        <div className="col-span-2">
          <Label htmlFor="titulo_int">Título *</Label>
          <Input
            id="titulo_int"
            value={formData.titulo}
            onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
            required
          />
        </div>
        <div className="col-span-2">
          <Label htmlFor="descricao_int">Descrição</Label>
          <Textarea
            id="descricao_int"
            value={formData.descricao}
            onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
            rows={3}
          />
        </div>
        <div>
          <Label htmlFor="data_interacao">Data</Label>
          <Input
            id="data_interacao"
            type="date"
            value={formData.data_interacao}
            onChange={(e) => setFormData({ ...formData, data_interacao: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="duracao">Duração (min)</Label>
          <Input
            id="duracao"
            type="number"
            value={formData.duracao}
            onChange={(e) => setFormData({ ...formData, duracao: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="responsavel_int">Responsável</Label>
          <Input
            id="responsavel_int"
            value={formData.responsavel}
            onChange={(e) => setFormData({ ...formData, responsavel: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="resultado">Resultado</Label>
          <Select
            value={formData.resultado}
            onValueChange={(value) => setFormData({ ...formData, resultado: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Positivo">Positivo</SelectItem>
              <SelectItem value="Neutro">Neutro</SelectItem>
              <SelectItem value="Negativo">Negativo</SelectItem>
              <SelectItem value="Sem Resposta">Sem Resposta</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="proxima_acao">Próxima Ação</Label>
          <Input
            id="proxima_acao"
            value={formData.proxima_acao}
            onChange={(e) => setFormData({ ...formData, proxima_acao: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="data_proxima_acao">Data Próxima Ação</Label>
          <Input
            id="data_proxima_acao"
            type="date"
            value={formData.data_proxima_acao}
            onChange={(e) => setFormData({ ...formData, data_proxima_acao: e.target.value })}
          />
        </div>
        <div className="col-span-2">
          <Label htmlFor="observacoes">Observações</Label>
          <Textarea
            id="observacoes"
            value={formData.observacoes}
            onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
            rows={2}
          />
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-4">
        {submitError && <p role="alert" className="text-sm text-red-700">{submitError}</p>}
        <Button type="submit" disabled={submitting} className="bg-blue-600 hover:bg-blue-700">
          {interacao ? 'Atualizar' : 'Registrar Interação'}
        </Button>
      </div>
    </FormWrapper>
  );

  if (windowMode) {
    return (
      <div className="w-full h-full overflow-auto bg-white p-6">
        <div className="mb-4 pb-4 border-b">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-600" />
            {interacao ? 'Editar Interação' : 'Nova Interação'}
          </h2>
        </div>
        {content}
      </div>
    );
  }

  return content;
}
