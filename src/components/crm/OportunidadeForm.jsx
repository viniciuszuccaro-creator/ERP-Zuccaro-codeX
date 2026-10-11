import React, { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Save, Target, TrendingUp } from "lucide-react";
import { z } from "zod";
import FormWrapper from "@/components/common/FormWrapper";
import { Badge } from "@/components/ui/badge";
import useContextoVisual from "@/components/lib/useContextoVisual";
import useCadastroFormScopeGuard from "@/components/cadastros/hooks/useCadastroFormScopeGuard";
import { createCrmFormSubmissionGate } from "./crmFormSubmission";

/**
 * V21.1.2: Oportunidade Form - Adaptado para Window Mode
 */
export default function OportunidadeForm({ oportunidade, onSubmit, windowMode = false }) {
  const { grupoAtual, empresaAtual } = useContextoVisual();
  const scopeGuard = useCadastroFormScopeGuard(grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id, empresaAtual?.id || null);
  const submissionGate = useRef(null);
  if (!submissionGate.current) submissionGate.current = createCrmFormSubmissionGate();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [formData, setFormData] = useState(oportunidade || {
    titulo: '',
    descricao: '',
    cliente_nome: '',
    cliente_email: '',
    cliente_telefone: '',
    origem: 'Site',
    responsavel: '',
    etapa: 'Prospecção',
    valor_estimado: 0,
    probabilidade: 50,
    temperatura: 'Morno',
    data_abertura: new Date().toISOString().split('T')[0],
    data_previsao: '',
    produtos_interesse: [],
    necessidades: '',
    orcamento_cliente: 0,
    proxima_acao: '',
    data_proxima_acao: '',
    observacoes: '',
    status: 'Aberto'
  });

  const schema = z.object({
    titulo: z.string().min(1, 'Título é obrigatório'),
    cliente_nome: z.string().min(1, 'Cliente é obrigatório'),
  });

  const handleSubmit = async (payload) => {
    setSubmitError('');
    try {
      return await submissionGate.current.run({payload,submit:onSubmit,
        assertCurrent:scopeGuard.assertCurrent,onPending:setSubmitting});
    } catch (error) {
      setSubmitError(error?.message || 'Falha ao salvar oportunidade.');
    }
  };

  const content = (
    <FormWrapper schema={schema} defaultValues={formData} onSubmit={handleSubmit} externalData={formData} className={`space-y-6 w-full h-full ${windowMode ? 'p-6 h-full overflow-auto' : ''}`}>
      <Card>
        <CardContent className="p-6 space-y-4">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-600" />
            Dados da Oportunidade
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Título *</Label>
              <Input
                value={formData.titulo}
                onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                required
              />
            </div>

            <div className="col-span-2">
              <Label>Descrição</Label>
              <Textarea
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                rows={2}
              />
            </div>

            <div>
              <Label>Cliente *</Label>
              <Input
                value={formData.cliente_nome}
                onChange={(e) => setFormData({ ...formData, cliente_nome: e.target.value })}
                required
              />
            </div>

            <div>
              <Label>Email do Cliente</Label>
              <Input
                type="email"
                value={formData.cliente_email}
                onChange={(e) => setFormData({ ...formData, cliente_email: e.target.value })}
              />
            </div>

            <div>
              <Label>Telefone</Label>
              <Input
                value={formData.cliente_telefone}
                onChange={(e) => setFormData({ ...formData, cliente_telefone: e.target.value })}
              />
            </div>

            <div>
              <Label>Origem</Label>
              <Select value={formData.origem} onValueChange={(v) => setFormData({ ...formData, origem: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Indicação">Indicação</SelectItem>
                  <SelectItem value="Site">Site</SelectItem>
                  <SelectItem value="Telefone">Telefone</SelectItem>
                  <SelectItem value="E-mail">E-mail</SelectItem>
                  <SelectItem value="Visita">Visita</SelectItem>
                  <SelectItem value="Evento">Evento</SelectItem>
                  <SelectItem value="Rede Social">Rede Social</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Responsável</Label>
              <Input
                value={formData.responsavel}
                onChange={(e) => setFormData({ ...formData, responsavel: e.target.value })}
              />
            </div>

            <div>
              <Label>Etapa do Funil</Label>
              <Select value={formData.etapa} onValueChange={(v) => setFormData({ ...formData, etapa: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Prospecção">Prospecção</SelectItem>
                  <SelectItem value="Contato Inicial">Contato Inicial</SelectItem>
                  <SelectItem value="Qualificação">Qualificação</SelectItem>
                  <SelectItem value="Proposta">Proposta</SelectItem>
                  <SelectItem value="Negociação">Negociação</SelectItem>
                  <SelectItem value="Fechamento">Fechamento</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Valor Estimado (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.valor_estimado}
                onChange={(e) => setFormData({ ...formData, valor_estimado: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div>
              <Label>Probabilidade (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={formData.probabilidade}
                onChange={(e) => setFormData({ ...formData, probabilidade: parseInt(e.target.value) || 0 })}
              />
            </div>

            <div>
              <Label>Temperatura</Label>
              <Select value={formData.temperatura} onValueChange={(v) => setFormData({ ...formData, temperatura: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Frio">Frio</SelectItem>
                  <SelectItem value="Morno">Morno</SelectItem>
                  <SelectItem value="Quente">Quente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Previsão de Fechamento</Label>
              <Input
                type="date"
                value={formData.data_previsao}
                onChange={(e) => setFormData({ ...formData, data_previsao: e.target.value })}
              />
            </div>

            <div className="col-span-2">
              <Label>Necessidades do Cliente</Label>
              <Textarea
                value={formData.necessidades}
                onChange={(e) => setFormData({ ...formData, necessidades: e.target.value })}
                rows={3}
              />
            </div>

            <div className="col-span-2">
              <Label>Observações</Label>
              <Textarea
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                rows={2}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3 pt-4 border-t sticky bottom-0 bg-white">
        {submitError && <p role="alert" className="text-sm text-red-700">{submitError}</p>}
        <Button type="submit" disabled={submitting} className="bg-blue-600 hover:bg-blue-700">
          <Save className="w-4 h-4 mr-2" />
          {submitting ? 'Salvando…' : `${oportunidade ? 'Atualizar' : 'Criar'} Oportunidade`}
        </Button>
      </div>
    </FormWrapper>
  );

  if (windowMode) {
    return <div className="w-full h-full bg-white">{content}</div>;
  }

  return content;
}
