import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Save } from "lucide-react";
import { z } from "zod";
import FormWrapper from "@/components/common/FormWrapper";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

/**
 * V21.1.2 - WINDOW MODE READY
 */
export default function FeriasForm({ ferias, colaboradores = [], onSubmit, windowMode = false }) {
  const [formData, setFormData] = useState(ferias || {
    colaborador_id: "",
    tipo: "Férias",
    data_inicio: "",
    data_fim: "",
    dias_solicitados: 0,
    observacoes: "",
    status: "Solicitada"
  });

  const calcularDiasFerias = () => {
    if (formData.data_inicio && formData.data_fim) {
      const inicio = new Date(formData.data_inicio);
      const fim = new Date(formData.data_fim);
      const diff = Math.ceil((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      setFormData({ ...formData, dias_solicitados: diff });
    }
  };

  useEffect(() => {
    calcularDiasFerias();
  }, [formData.data_inicio, formData.data_fim]);

  const schema = z.object({
    colaborador_id: z.string().min(1, 'Colaborador é obrigatório'),
    data_inicio: z.string().min(4, 'Data início é obrigatória'),
    data_fim: z.string().min(4, 'Data fim é obrigatória')
  });

  const handleSubmit = async () => {
    const colaborador = colaboradores.find(c => c.id === formData.colaborador_id);
    const data = {
      ...formData,
      colaborador_nome: colaborador?.nome_completo
    };
    onSubmit(data);
  };

  const content = (
    <FormWrapper schema={schema} defaultValues={formData} onSubmit={handleSubmit} externalData={formData} className="space-y-6">
      <Card>
        <CardContent className="p-6 space-y-4">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            Solicitação de Férias
          </h3>

          <div>
            <Label>Colaborador *</Label>
            <Select 
              value={formData.colaborador_id} 
              onValueChange={(v) => setFormData({...formData, colaborador_id: v})}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o colaborador" />
              </SelectTrigger>
              <SelectContent>
                {colaboradores.filter(c => c.status === "Ativo").map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome_completo} - {c.cargo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Data Início *</Label>
              <Input
                type="date"
                value={formData.data_inicio}
                onChange={(e) => setFormData({...formData, data_inicio: e.target.value})}
                required
              />
            </div>

            <div>
              <Label>Data Fim *</Label>
              <Input
                type="date"
                value={formData.data_fim}
                onChange={(e) => setFormData({...formData, data_fim: e.target.value})}
                required
              />
            </div>
          </div>

          <div>
            <Label>Dias Solicitados</Label>
            <div className="flex items-center gap-3">
              <Input 
                type="number" 
                value={formData.dias_solicitados} 
                readOnly 
                className="bg-slate-50"
              />
              <Badge className="bg-blue-100 text-blue-700">
                Calculado automaticamente
              </Badge>
            </div>
          </div>

          <div>
            <Label>Tipo</Label>
            <Select 
              value={formData.tipo} 
              onValueChange={(v) => setFormData({...formData, tipo: v})}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Férias">Férias</SelectItem>
                <SelectItem value="Férias Coletivas">Férias Coletivas</SelectItem>
                <SelectItem value="Licença">Licença</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea
              value={formData.observacoes}
              onChange={(e) => setFormData({...formData, observacoes: e.target.value})}
              placeholder="Informações adicionais..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3 pt-4 border-t sticky bottom-0 bg-white">
        <Button 
          type="submit" 
          disabled={!formData.colaborador_id || !formData.data_inicio || !formData.data_fim}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Save className="w-4 h-4 mr-2" />
          {ferias ? 'Atualizar' : 'Solicitar'} Férias
        </Button>
      </div>
    </FormWrapper>
  );

  if (windowMode) {
    return (
      <div className="w-full h-full overflow-auto bg-gradient-to-b from-sky-50 to-white">
        <div className="flex items-center gap-3 p-4 border-b bg-gradient-to-r from-sky-50 to-sky-100">
          <Calendar className="w-5 h-5 text-sky-700" />
          <p className="font-semibold text-slate-900">Solicitação de Férias</p>
        </div>
        <div className="p-6">{content}</div>
      </div>
    );
  }

  return content;
}