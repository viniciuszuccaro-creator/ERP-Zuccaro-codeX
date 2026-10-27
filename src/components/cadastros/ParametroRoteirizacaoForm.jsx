import React, { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Save } from "lucide-react";
import usePermissions from "@/components/lib/usePermissions";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import useCadastroReopenOnIdentity from "@/components/cadastros/useCadastroReopenOnIdentity";

const EMPTY_PARAM = {
  usar_ia_otimizacao: true,
  considerar_janela_horario: true,
  priorizar_urgencia: true,
  agrupar_por_regiao: true,
  distancia_maxima_km: 100,
  tempo_medio_entrega_minutos: 30,
  ativo: true,
  empresa_id: "",
  group_id: "",
};

const mapParametroRoteirizacaoToForm = (record, defaults = {}) => {
  if (!record) {
    return {
      ...EMPTY_PARAM,
      empresa_id: defaults.empresa_id || "",
      group_id: defaults.group_id || "",
    };
  }
  const distancia = Number(record.distancia_maxima_km);
  const tempo = Number(record.tempo_medio_entrega_minutos);
  return {
    ...EMPTY_PARAM,
    ...record,
    usar_ia_otimizacao: record.usar_ia_otimizacao !== false,
    considerar_janela_horario: record.considerar_janela_horario !== false,
    priorizar_urgencia: record.priorizar_urgencia !== false,
    agrupar_por_regiao: record.agrupar_por_regiao !== false,
    distancia_maxima_km: Number.isFinite(distancia) ? distancia : 100,
    tempo_medio_entrega_minutos: Number.isFinite(tempo) ? tempo : 30,
    ativo: record.ativo !== false,
  };
};

/**
 * Reopen canônico (#353): useCadastroReopenOnIdentity — updated_at|updated_date,
 * preservação de flags/números de roteirização; identidade no boundId.
 */
export default function ParametroRoteirizacaoForm({
  parametro, item, data, initialData, defaultValues, onSubmit, windowMode = false,
}) {
  const dadosIniciais = item || data || initialData || defaultValues || parametro;
  const { canCreate, canEdit } = usePermissions();
  const { empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || dadosIniciais?.group_id || null;
  const contextoValido = Boolean(groupId || empresaAtual?.id || dadosIniciais?.empresa_id);
  // Mesma identidade de tenant que o RecordState anterior (grupo+empresa+escopo).
  const tenantKey = JSON.stringify([groupId ?? null, empresaAtual?.id ?? null, contexto ?? null]);
  const emptyForm = mapParametroRoteirizacaoToForm(null, {
    empresa_id: empresaAtual?.id || "",
    group_id: groupId || "",
  });
  const [formData, setFormData] = useState(() => mapParametroRoteirizacaoToForm(dadosIniciais, emptyForm));

  const { boundId: roteirizacaoBoundId } = useCadastroReopenOnIdentity(dadosIniciais, {
    formData,
    setFormData,
    emptyForm,
    tenantKey,
    mapToForm: (record) => mapParametroRoteirizacaoToForm(record, emptyForm),
  });

  const podeCriar = canCreate("Cadastros", "ParametroRoteirizacao") || canCreate("Logistica", "Roteirizacao") || canCreate("Cadastros", null);
  const podeEditar = canEdit("Cadastros", "ParametroRoteirizacao") || canEdit("Logistica", "Roteirizacao") || canEdit("Cadastros", null);
  const podeSalvar = roteirizacaoBoundId ? podeEditar : podeCriar;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!contextoValido) {
      alert("Selecione um grupo ou empresa antes de salvar.");
      return;
    }
    if (!podeSalvar) {
      alert("Sem permissao para salvar parametros de roteirizacao.");
      return;
    }
    onSubmit({
      ...formData,
      ...(roteirizacaoBoundId ? { id: roteirizacaoBoundId } : {}),
      group_id: groupId || formData.group_id,
      empresa_id: contexto === "empresa" ? empresaAtual?.id : formData.empresa_id,
    });
  };

  const containerClass = windowMode ? "w-full h-full overflow-auto p-6" : "space-y-6";

  return (
    <div className={containerClass}>
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-sky-600" />
              Parâmetros de Roteirização
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between">
                <Label>Usar IA para Otimização</Label>
                <Switch
                  checked={formData.usar_ia_otimizacao}
                  onCheckedChange={(val) => setFormData({ ...formData, usar_ia_otimizacao: val })}
                  disabled={!podeSalvar}
                  data-permission="Cadastros.ParametroRoteirizacao.ia"
                  data-action="alternar-ia-roteirizacao"
                  data-sensitive
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Considerar Janela Horário</Label>
                <Switch
                  checked={formData.considerar_janela_horario}
                  onCheckedChange={(val) => setFormData({ ...formData, considerar_janela_horario: val })}
                  disabled={!podeSalvar}
                  data-permission="Cadastros.ParametroRoteirizacao.editar"
                  data-action="alternar-janela-horario-roteirizacao"
                  data-sensitive
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Priorizar Urgência</Label>
                <Switch
                  checked={formData.priorizar_urgencia}
                  onCheckedChange={(val) => setFormData({ ...formData, priorizar_urgencia: val })}
                  disabled={!podeSalvar}
                  data-permission="Cadastros.ParametroRoteirizacao.editar"
                  data-action="alternar-urgencia-roteirizacao"
                  data-sensitive
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Agrupar por Região</Label>
                <Switch
                  checked={formData.agrupar_por_regiao}
                  onCheckedChange={(val) => setFormData({ ...formData, agrupar_por_regiao: val })}
                  disabled={!podeSalvar}
                  data-permission="Cadastros.ParametroRoteirizacao.editar"
                  data-action="alternar-regiao-roteirizacao"
                  data-sensitive
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Distância Máxima (km)</Label>
                <Input
                  type="number"
                  value={formData.distancia_maxima_km}
                  onChange={(e) => setFormData({ ...formData, distancia_maxima_km: parseFloat(e.target.value) })}
                  disabled={!podeSalvar}
                  data-permission="Cadastros.ParametroRoteirizacao.editar"
                  data-action="editar-distancia-maxima-roteirizacao"
                  data-sensitive
                />
              </div>
              <div>
                <Label>Tempo Médio Entrega (min)</Label>
                <Input
                  type="number"
                  value={formData.tempo_medio_entrega_minutos}
                  onChange={(e) => setFormData({ ...formData, tempo_medio_entrega_minutos: parseInt(e.target.value) })}
                  disabled={!podeSalvar}
                  data-permission="Cadastros.ParametroRoteirizacao.editar"
                  data-action="editar-tempo-medio-roteirizacao"
                  data-sensitive
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="submit" className="bg-sky-600 hover:bg-sky-700" disabled={!contextoValido || !podeSalvar} data-permission="Cadastros.ParametroRoteirizacao.salvar" data-action="salvar-parametros-roteirizacao" data-sensitive>
            <Save className="w-4 h-4 mr-2" />
            {roteirizacaoBoundId ? "Atualizar Parâmetros" : "Salvar Parâmetros"}
          </Button>
        </div>
      </form>
    </div>
  );
}
