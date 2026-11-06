import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Save, Clock, AlertCircle } from "lucide-react";
import { z } from "zod";
import FormWrapper from "@/components/common/FormWrapper";

/**
 * V21.1.2: Ponto Form - Adaptado para Window Mode
 */
export default function PontoForm({ ponto, onSubmit, windowMode = false }) {
  const [formData, setFormData] = useState(ponto || {
    colaborador_id: '',
    colaborador_nome: '',
    data: new Date().toISOString().split('T')[0],
    entrada_manha: '',
    saida_almoco: '',
    retorno_almoco: '',
    saida_tarde: '',
    tipo_dia: 'Normal',
    observacoes: '',
    status: 'Pendente',
    horas_trabalhadas: 0,
    horas_extras: 0
  });

  const { data: colaboradores = [] } = useQuery({
    queryKey: ['colaboradores'],
    queryFn: () => base44.entities.Colaborador.list(),
  });

  const calcularHoras = () => {
    if (!formData.entrada_manha || !formData.saida_tarde) return { horas: 0, extras: 0 };
    
    const entrada = new Date(`2000-01-01T${formData.entrada_manha}`);
    const saida = new Date(`2000-01-01T${formData.saida_tarde}`);
    const almoco = formData.saida_almoco && formData.retorno_almoco 
      ? (new Date(`2000-01-01T${formData.retorno_almoco}`).getTime() - new Date(`2000-01-01T${formData.saida_almoco}`).getTime()) / (1000 * 60 * 60)
      : 0;
    
    const horasTotais = (saida.getTime() - entrada.getTime()) / (1000 * 60 * 60) - almoco;
    const horasExtras = Math.max(0, horasTotais - 8);
    
    return { horas: horasTotais, extras: horasExtras };
  };

  const schema = z.object({
    colaborador_id: z.string().min(1, 'Colaborador é obrigatório'),
    data: z.string().min(4, 'Data é obrigatória')
  });

  const handleSubmit = async () => {
    const { horas, extras } = calcularHoras();
    onSubmit({
      ...formData,
      horas_trabalhadas: horas,
      horas_extras: extras
    });
  };

  const { horas, extras } = calcularHoras();

  const content = (
    <FormWrapper schema={schema} defaultValues={formData} onSubmit={handleSubmit} externalData={formData} className={`space-y-6 ${windowMode ? 'p-6 h-full overflow-auto' : ''}`}>
      <Card>
        <CardContent className="p-6 space-y-4">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Clock className="w-5 h-5 text-pink-600" />
            Registro de Ponto
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Colaborador *</Label>
              <Select
                value={formData.colaborador_id}
                onValueChange={(v) => {
                  const colab = colaboradores.find(c => c.id === v);
                  setFormData({ 
                    ...formData, 
                    colaborador_id: v,
                    colaborador_nome: colab?.nome_completo || ''
                  });
                }}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {colaboradores.filter(c => c.status === 'Ativo').map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome_completo} - {c.cargo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Data *</Label>
              <Input
                type="date"
                value={formData.data}
                onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                required
              />
            </div>

            <div>
              <Label>Tipo de Dia</Label>
              <Select
                value={formData.tipo_dia}
                onValueChange={(v) => setFormData({ ...formData, tipo_dia: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Normal">Normal</SelectItem>
                  <SelectItem value="Feriado">Feriado</SelectItem>
                  <SelectItem value="Fim de Semana">Fim de Semana</SelectItem>
                  <SelectItem value="Folga">Folga</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-4">
          <h3 className="font-bold">Horários</h3>

          <div className="grid grid-cols-4 gap-4">
            <div>
              <Label>Entrada Manhã</Label>
              <Input
                type="time"
                value={formData.entrada_manha}
                onChange={(e) => setFormData({ ...formData, entrada_manha: e.target.value })}
              />
            </div>

            <div>
              <Label>Saída Almoço</Label>
              <Input
                type="time"
                value={formData.saida_almoco}
                onChange={(e) => setFormData({ ...formData, saida_almoco: e.target.value })}
              />
            </div>

            <div>
              <Label>Retorno Almoço</Label>
              <Input
                type="time"
                value={formData.retorno_almoco}
                onChange={(e) => setFormData({ ...formData, retorno_almoco: e.target.value })}
              />
            </div>

            <div>
              <Label>Saída Tarde</Label>
              <Input
                type="time"
                value={formData.saida_tarde}
                onChange={(e) => setFormData({ ...formData, saida_tarde: e.target.value })}
              />
            </div>
          </div>

          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-xs text-blue-700">Horas Trabalhadas</p>
                <p className="text-2xl font-bold text-blue-900">{horas.toFixed(1)}h</p>
              </div>
              <div>
                <p className="text-xs text-orange-700">Horas Extras</p>
                <p className="text-2xl font-bold text-orange-900">{extras.toFixed(1)}h</p>
              </div>
            </div>
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

      <div className="flex justify-end gap-3 pt-4 border-t sticky bottom-0 bg-white">
        <Button type="submit" className="bg-pink-600 hover:bg-pink-700">
          <Save className="w-4 h-4 mr-2" />
          {ponto ? 'Atualizar' : 'Registrar'} Ponto
        </Button>
      </div>
    </FormWrapper>
  );

  if (windowMode) {
    return <div className="w-full h-full bg-white">{content}</div>;
  }

  return content;
}
