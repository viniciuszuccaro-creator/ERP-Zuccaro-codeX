import React, { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Loader2, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import usePermissions from "@/components/lib/usePermissions";
import { useContextoVisual } from "@/components/lib/useContextoVisual";

/**
 * V21.1.2 - WINDOW MODE READY
 */
export default function TurnoForm({ turno, item, data, initialData, defaultValues, onSubmit, isSubmitting, windowMode = false }) {
  const dadosIniciais = item || data || initialData || defaultValues || turno;
  const { canCreate, canEdit } = usePermissions();
  const { empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || dadosIniciais?.group_id || null;
  const contextoValido = Boolean(empresaAtual?.id || groupId || dadosIniciais?.empresa_id || dadosIniciais?.group_id);
  const podeCriar = canCreate("Cadastros", "Turno") || canCreate("Sistema", "Turno") || canCreate("Cadastros", null);
  const podeEditar = canEdit("Cadastros", "Turno") || canEdit("Sistema", "Turno") || canEdit("Cadastros", null);
  const podeSalvar = dadosIniciais?.id ? podeEditar : podeCriar;
  const [formData, setFormData] = useState(dadosIniciais || {
    nome_turno: '',
    horario_inicio: '08:00',
    horario_fim: '17:00',
    intervalo_inicio: '12:00',
    intervalo_fim: '13:00',
    dias_semana: ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'],
    ativo: true
  });

  const prevIdRef = useRef(dadosIniciais?.id);
  useEffect(() => {
    if (dadosIniciais?.id && dadosIniciais.id !== prevIdRef.current) {
      prevIdRef.current = dadosIniciais.id;
      setFormData({ ...dadosIniciais });
    }
  }, [dadosIniciais?.id]);

  const diasDisponiveis = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

  const toggleDia = (dia) => {
    const dias = formData.dias_semana || [];
    if (dias.includes(dia)) {
      setFormData({...formData, dias_semana: dias.filter(d => d !== dia)});
    } else {
      setFormData({...formData, dias_semana: [...dias, dia]});
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.nome_turno || !formData.horario_inicio || !formData.horario_fim) {
      alert('Preencha os campos obrigatórios');
      return;
    }
    if (!contextoValido) {
      alert('Selecione um grupo ou empresa antes de salvar.');
      return;
    }
    if (!podeSalvar) {
      alert('Sem permissao para salvar turnos.');
      return;
    }
    onSubmit({
      ...formData,
      nome: formData.nome_turno,
      group_id: groupId || formData.group_id,
      empresa_id: contexto === "empresa" ? empresaAtual?.id : formData.empresa_id,
    });
  };

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Nome do Turno *</Label>
        <Input
          value={formData.nome_turno}
          onChange={(e) => setFormData({...formData, nome_turno: e.target.value})}
          placeholder="Ex: Manhã, Tarde, Noite"
          disabled={!podeSalvar}
          data-permission="Cadastros.Turno.editar"
          data-action="editar-nome-turno"
          data-sensitive
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Horário Início *</Label>
          <Input
            type="time"
            value={formData.horario_inicio}
            onChange={(e) => setFormData({...formData, horario_inicio: e.target.value})}
            disabled={!podeSalvar}
            data-permission="Cadastros.Turno.editar"
            data-action="editar-inicio-turno"
            data-sensitive
          />
        </div>
        <div>
          <Label>Horário Fim *</Label>
          <Input
            type="time"
            value={formData.horario_fim}
            onChange={(e) => setFormData({...formData, horario_fim: e.target.value})}
            disabled={!podeSalvar}
            data-permission="Cadastros.Turno.editar"
            data-action="editar-fim-turno"
            data-sensitive
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Intervalo Início</Label>
          <Input
            type="time"
            value={formData.intervalo_inicio}
            onChange={(e) => setFormData({...formData, intervalo_inicio: e.target.value})}
            disabled={!podeSalvar}
            data-permission="Cadastros.Turno.editar"
            data-action="editar-inicio-intervalo-turno"
            data-sensitive
          />
        </div>
        <div>
          <Label>Intervalo Fim</Label>
          <Input
            type="time"
            value={formData.intervalo_fim}
            onChange={(e) => setFormData({...formData, intervalo_fim: e.target.value})}
            disabled={!podeSalvar}
            data-permission="Cadastros.Turno.editar"
            data-action="editar-fim-intervalo-turno"
            data-sensitive
          />
        </div>
      </div>

      <div>
        <Label className="mb-2 block">Dias da Semana</Label>
        <div className="flex flex-wrap gap-2">
          {diasDisponiveis.map(dia => (
            <Badge
              key={dia}
              className={`cursor-pointer ${
                (formData.dias_semana || []).includes(dia)
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-200 text-slate-700'
              }`}
              onClick={() => podeSalvar && toggleDia(dia)}
              data-permission="Cadastros.Turno.editar"
              data-action="alternar-dia-turno"
              data-sensitive
            >
              {dia.slice(0, 3)}
            </Badge>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="submit" disabled={isSubmitting || !contextoValido || !podeSalvar} data-permission="Cadastros.Turno.salvar" data-action="salvar-turno" data-sensitive>
          {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {dadosIniciais ? 'Atualizar' : 'Criar Turno'}
        </Button>
      </div>
    </form>
  );

  if (windowMode) {
    return (
      <div className="w-full h-full overflow-auto bg-white p-6">
        <div className="mb-4 pb-4 border-b">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            {dadosIniciais ? 'Editar Turno' : 'Novo Turno'}
          </h2>
        </div>
        {formContent}
      </div>
    );
  }

  return formContent;
}
