import React, { useState, useEffect, useRef } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, Save } from "lucide-react";
import usePermissions from "@/components/lib/usePermissions";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import CadastroCodigoRegistroField from "@/components/cadastros/CadastroCodigoRegistroField";

export default function ParametroCaixaDiarioForm({ parametro, item, data, initialData, defaultValues, onSubmit, windowMode = false }) {
  const registro = item || data || initialData || defaultValues || parametro;
  const { canCreate, canEdit } = usePermissions();
  const { empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || registro?.group_id || null;
  const contextoValido = Boolean(groupId || empresaAtual?.id || registro?.empresa_id);
  const podeCriar = canCreate("Cadastros", "ParametroCaixaDiario") || canCreate("Financeiro", "Caixa") || canCreate("Cadastros", null);
  const podeEditar = canEdit("Cadastros", "ParametroCaixaDiario") || canEdit("Financeiro", "Caixa") || canEdit("Cadastros", null);
  const podeSalvar = registro?.id ? podeEditar : podeCriar;
  const [formData, setFormData] = useState(registro || {
    exigir_abertura_caixa: true,
    exigir_fechamento_caixa: true,
    permitir_sangria: true,
    permitir_suprimento: true,
    valor_maximo_sangria: 1000,
    alertar_divergencia_fechamento: true,
    tolerancia_divergencia: 5,
    gerar_movimento_automatico: true,
    ativo: true
  });

  const prevIdRef = useRef(registro?.id);
  useEffect(() => {
    if (registro?.id && registro.id !== prevIdRef.current) {
      prevIdRef.current = registro.id;
      setFormData({ ...(registro || {}) });
    }
  }, [registro?.id]);


  const handleSubmit = (e) => {
    e.preventDefault();
    if (!contextoValido) {
      alert('Selecione um grupo ou empresa antes de salvar.');
      return;
    }
    if (!podeSalvar) {
      alert('Sem permissao para salvar parametros do caixa diario.');
      return;
    }
    onSubmit({
      ...formData,
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
              <Wallet className="w-5 h-5 text-emerald-600" />
              Parâmetros do Caixa Diário
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <CadastroCodigoRegistroField
              idOnly
              hasId={Boolean(registro?.id)}
              entityId={registro?.id}
              action="id-tecnico-parametro-caixa-diario"
            />

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Exigir Abertura Caixa</Label>
                <Switch
                  checked={formData.exigir_abertura_caixa}
                  onCheckedChange={(val) => setFormData({ ...formData, exigir_abertura_caixa: val })}
                  disabled={!podeSalvar}
                  data-permission="Cadastros.ParametroCaixaDiario.editar"
                  data-action="alternar-exigir-abertura-caixa"
                  data-sensitive
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Exigir Fechamento Caixa</Label>
                <Switch
                  checked={formData.exigir_fechamento_caixa}
                  onCheckedChange={(val) => setFormData({ ...formData, exigir_fechamento_caixa: val })}
                  disabled={!podeSalvar}
                  data-permission="Cadastros.ParametroCaixaDiario.editar"
                  data-action="alternar-exigir-fechamento-caixa"
                  data-sensitive
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Permitir Sangria</Label>
                <Switch
                  checked={formData.permitir_sangria}
                  onCheckedChange={(val) => setFormData({ ...formData, permitir_sangria: val })}
                  disabled={!podeSalvar}
                  data-permission="Cadastros.ParametroCaixaDiario.editar"
                  data-action="alternar-permitir-sangria"
                  data-sensitive
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Permitir Suprimento</Label>
                <Switch
                  checked={formData.permitir_suprimento}
                  onCheckedChange={(val) => setFormData({ ...formData, permitir_suprimento: val })}
                  disabled={!podeSalvar}
                  data-permission="Cadastros.ParametroCaixaDiario.editar"
                  data-action="alternar-permitir-suprimento"
                  data-sensitive
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Valor Máximo Sangria (R$)</Label>
                <Input
                  type="number"
                  value={formData.valor_maximo_sangria}
                  onChange={(e) => setFormData({ ...formData, valor_maximo_sangria: parseFloat(e.target.value) })}
                  disabled={!podeSalvar}
                  data-permission="Cadastros.ParametroCaixaDiario.editar"
                  data-action="editar-valor-maximo-sangria"
                  data-sensitive
                />
              </div>
              <div>
                <Label>Tolerância Divergência (R$)</Label>
                <Input
                  type="number"
                  value={formData.tolerancia_divergencia}
                  onChange={(e) => setFormData({ ...formData, tolerancia_divergencia: parseFloat(e.target.value) })}
                  disabled={!podeSalvar}
                  data-permission="Cadastros.ParametroCaixaDiario.editar"
                  data-action="editar-tolerancia-divergencia-caixa"
                  data-sensitive
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={!contextoValido || !podeSalvar} data-permission="Cadastros.ParametroCaixaDiario.salvar" data-action="salvar-parametros-caixa-diario" data-sensitive>
            <Save className="w-4 h-4 mr-2" />
            Salvar Parâmetros
          </Button>
        </div>
      </form>
    </div>
  );
}
