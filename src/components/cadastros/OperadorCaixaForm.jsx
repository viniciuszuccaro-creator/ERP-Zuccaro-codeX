import React, { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Wallet, Save, X } from "lucide-react";
import { toast } from "sonner";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import CadastroCodigoRegistroField from "@/components/cadastros/CadastroCodigoRegistroField";

export default function OperadorCaixaForm({ operador, item, data, initialData, defaultValues, onSubmit, onSave, onClose, onCancel, isSubmitting, windowMode = false }) {
  const { empresaAtual, grupoAtual, filterInContext, createInContext, updateInContext } = useContextoVisual();
  const { canCreate, canEdit } = usePermissions();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const contextKey = empresaAtual?.id || groupId || "sem-contexto";
  const contextoValido = contextKey !== "sem-contexto";
  const podeSalvar = operador?.id
    ? (canEdit("Cadastros", "OperadorCaixa") || canEdit("Financeiro", "Caixa") || canEdit("Cadastros", null))
    : (canCreate("Cadastros", "OperadorCaixa") || canCreate("Financeiro", "Caixa") || canCreate("Cadastros", null));
  const dadosIniciais = item || data || initialData || defaultValues || operador;
  const emptyFormData = {
    usuario_id: "",
    usuario_nome: "",
    colaborador_id: "",
    codigo_operador: "",
    nome_caixa: "Caixa Principal",
    turno_id: "",
    status_caixa: "Fechado",
    permissoes_especiais: [],
    pode_emitir_nfe: false,
    pode_gerar_boleto: false,
    pode_fazer_sangria: false,
    limite_desconto_percentual: 5,
    limite_valor_venda: 0,
    observacoes: "",
    ativo: true,
    empresa_id: empresaAtual?.id || "",
    group_id: groupId || ""
  };
  const [formData, setFormData] = useState(dadosIniciais || emptyFormData);
  const [saving, setSaving] = useState(false);

  const prevIdRef = React.useRef(dadosIniciais?.id || null);
  const prevUpdatedRef = React.useRef(dadosIniciais?.updated_date);
  useEffect(() => {
    const nextId = dadosIniciais?.id || null;
    const idChanged = nextId !== prevIdRef.current;
    const updatedChanged = Boolean(
      nextId && dadosIniciais?.updated_date && dadosIniciais.updated_date !== prevUpdatedRef.current,
    );
    if (!nextId) {
      if (prevIdRef.current !== null) {
        prevIdRef.current = null;
        prevUpdatedRef.current = undefined;
        setFormData(emptyFormData);
      }
      return;
    }
    if (idChanged || updatedChanged) {
      prevIdRef.current = nextId;
      prevUpdatedRef.current = dadosIniciais.updated_date;
      setFormData(dadosIniciais || emptyFormData);
    }
  }, [dadosIniciais?.id, dadosIniciais?.updated_date]);

  const { data: colaboradores = [] } = useQuery({
    queryKey: ['colaboradores', contextKey],
    queryFn: () => filterInContext('Colaborador', {}, 'nome_completo', 500),
    enabled: contextoValido,
  });

  const { data: turnos = [] } = useQuery({
    queryKey: ['turnos', contextKey],
    queryFn: () => filterInContext('Turno', {}, 'nome', 200),
    enabled: contextoValido,
  });

  const { data: empresas = [] } = useQuery({
    queryKey: ['empresas', contextKey],
    queryFn: () => filterInContext('Empresa', {}, 'nome_fantasia', 200, 'id'),
    enabled: contextoValido,
  });

  const submitLocked = Boolean(isSubmitting || saving);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitLocked) return;
    // Injeta 'nome' para compatibilidade com o Visualizador Universal
    if (!contextoValido) {
      toast.error("Selecione um grupo ou empresa antes de salvar.");
      return;
    }
    if (!podeSalvar) {
      toast.error("Seu perfil nao permite salvar operador de caixa.");
      return;
    }
    const payload = {
      ...formData,
      nome: formData.nome_caixa || formData.usuario_nome || '',
      ...(empresaAtual?.id && !formData.empresa_id ? { empresa_id: empresaAtual.id } : {}),
      ...(groupId && !formData.group_id ? { group_id: groupId } : {})
    };
    setSaving(true);
    try {
      if (operador?.id) {
        await updateInContext('OperadorCaixa', operador.id, payload);
        toast.success("✅ Operador atualizado!");
      } else {
        await createInContext('OperadorCaixa', payload);
        toast.success("✅ Operador criado!");
      }
      onSubmit?.();
    } catch (error) {
      toast.error("Erro: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const togglePermissao = (permissao) => {
    const permissoes = formData.permissoes_especiais || [];
    if (permissoes.includes(permissao)) {
      setFormData({
        ...formData,
        permissoes_especiais: permissoes.filter(p => p !== permissao)
      });
    } else {
      setFormData({
        ...formData,
        permissoes_especiais: [...permissoes, permissao]
      });
    }
  };

  const permissoesDisponiveis = [
    "Cancelar Venda",
    "Desconto Acima Limite",
    "Abrir Gaveta",
    "Sangria",
    "Reforço",
    "Alterar Preço",
    "Venda sem Estoque",
    "Fechamento Caixa"
  ];

  const containerClass = windowMode ? "w-full h-full overflow-auto p-6" : "space-y-6";

  return (
    <div className={containerClass}>
      <form onSubmit={handleSubmit} className="space-y-6">
      <CadastroCodigoRegistroField
        idOnly
        hasId={Boolean(dadosIniciais?.id)}
        entityId={dadosIniciais?.id}
        action="id-tecnico-operador-caixa"
      />
        <Card>
          <CardHeader className="bg-gradient-to-r from-emerald-50 to-green-50 border-b">
            <CardTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-emerald-600" />
              {operador ? 'Editar' : 'Novo'} Operador de Caixa
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Colaborador *</Label>
                <Select
                  value={formData.colaborador_id}
                  onValueChange={(v) => {
                    const colab = colaboradores.find(c => c.id === v);
                    setFormData({
                      ...formData,
                      colaborador_id: v,
                      usuario_nome: colab?.nome_completo || ''
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o colaborador..." />
                  </SelectTrigger>
                  <SelectContent>
                    {colaboradores.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.nome_completo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Empresa *</Label>
                <Select
                  value={formData.empresa_id}
                  onValueChange={(v) => setFormData({ ...formData, empresa_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a empresa..." />
                  </SelectTrigger>
                  <SelectContent>
                    {empresas.map(e => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.nome_fantasia || e.razao_social}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Código do Operador</Label>
                <Input
                  value={formData.codigo_operador}
                  onChange={(e) => setFormData({ ...formData, codigo_operador: e.target.value })}
                  placeholder="Ex: OP001"
                />
              </div>

              <div>
                <Label>Nome do Caixa *</Label>
                <Input
                  value={formData.nome_caixa}
                  onChange={(e) => setFormData({ ...formData, nome_caixa: e.target.value })}
                  placeholder="Ex: Caixa 1"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Limite Desconto (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.limite_desconto_percentual}
                  onChange={(e) => setFormData({ ...formData, limite_desconto_percentual: parseFloat(e.target.value) || 0 })}
                />
              </div>

              <div>
                <Label>Limite Valor Venda (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.limite_valor_venda}
                  onChange={(e) => setFormData({ ...formData, limite_valor_venda: parseFloat(e.target.value) || 0 })}
                  placeholder="0 = sem limite"
                />
              </div>

              <div>
                <Label>Turno</Label>
                <Select
                  value={formData.turno_id}
                  onValueChange={(v) => setFormData({ ...formData, turno_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {turnos.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <Label>Permissões Rápidas</Label>
              <div className="grid grid-cols-3 gap-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="emitir-nfe"
                    checked={formData.pode_emitir_nfe}
                    onCheckedChange={(checked) => setFormData({ ...formData, pode_emitir_nfe: checked })}
                  />
                  <label htmlFor="emitir-nfe" className="text-sm">Emitir NF-e</label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="gerar-boleto"
                    checked={formData.pode_gerar_boleto}
                    onCheckedChange={(checked) => setFormData({ ...formData, pode_gerar_boleto: checked })}
                  />
                  <label htmlFor="gerar-boleto" className="text-sm">Gerar Boleto</label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="sangria"
                    checked={formData.pode_fazer_sangria}
                    onCheckedChange={(checked) => setFormData({ ...formData, pode_fazer_sangria: checked })}
                  />
                  <label htmlFor="sangria" className="text-sm">Fazer Sangria</label>
                </div>
              </div>
            </div>

            <div>
              <Label className="mb-3 block">Permissões Especiais</Label>
              <div className="grid grid-cols-2 gap-2">
                {permissoesDisponiveis.map(permissao => (
                  <div key={permissao} className="flex items-center space-x-2">
                    <Checkbox
                      id={permissao}
                      checked={(formData.permissoes_especiais || []).includes(permissao)}
                      onCheckedChange={() => togglePermissao(permissao)}
                    />
                    <label htmlFor={permissao} className="text-sm">{permissao}</label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label>Observações</Label>
              <Textarea
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                rows={3}
                placeholder="Observações sobre o operador..."
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="ativo"
                checked={formData.ativo}
                onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
              />
              <label htmlFor="ativo" className="text-sm font-medium">Operador Ativo</label>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel}>
            <X className="w-4 h-4 mr-2" />
            Cancelar
          </Button>
          <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={submitLocked || !contextoValido || !podeSalvar}>
            <Save className="w-4 h-4 mr-2" />
            Salvar Operador
          </Button>
        </div>
      </form>
    </div>
  );
}
