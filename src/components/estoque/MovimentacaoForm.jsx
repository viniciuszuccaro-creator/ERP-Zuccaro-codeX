import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import FormWrapper from "@/components/common/FormWrapper";
import { Input } from "@/components/ui/input";
import movimentacaoSchema from "@/components/estoque/movimentacaoSchema";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Save, ArrowDown, ArrowUp } from "lucide-react";
import { useUser } from "@/components/lib/UserContext";
import { useContextoVisual } from "@/components/lib/useContextoVisual";

/**
 * V21.1.2: Movimentação Form - Adaptado para Window Mode
 */
export default function MovimentacaoForm({ movimentacao, onSubmit, windowMode = false, canSubmit = true }) {
  const { user: authUser } = useUser();
  const { getFiltroContexto, carimbarContexto, filterInContext, empresaAtual, grupoAtual } = useContextoVisual();

  const defaultEmpresaId = (getFiltroContexto('empresa_id') || {}).empresa_id || '';
  const contextoValido = Boolean(defaultEmpresaId || grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id);
  const controlesDesabilitados = !canSubmit || !contextoValido;
  const [formData, setFormData] = useState(movimentacao || {
    tipo_movimento: '',
    produto_id: '',
    produto_nome: '',
    quantidade: 0,
    unidade_medida: '',
    data_movimentacao: new Date().toISOString().split('T')[0],
    documento_referencia: '',
    observacoes: '',
    responsavel: '',
    responsavel_id: '',
    empresa_id: '',
    group_id: '',
    origem_movimento: 'manual',
  });

  React.useEffect(() => {
    setFormData(prev => ({
      ...prev,
      empresa_id: prev.empresa_id || defaultEmpresaId,
      responsavel: prev.responsavel || (authUser?.full_name || authUser?.email || ''),
      responsavel_id: prev.responsavel_id || authUser?.id || ''
    }));
  }, [authUser?.id, defaultEmpresaId]);

  const { data: produtos = [] } = useQuery({
    queryKey: ['produtos', empresaAtual?.id],
    queryFn: () => filterInContext('Produto', {}, '-updated_date', 9999),
  });

  const handleProdutoChange = (produtoId) => {
    const produto = produtos.find(p => p.id === produtoId);
    if (produto) {
      setFormData({
        ...formData,
        produto_id: produtoId,
        produto_nome: produto.descricao,
        unidade_medida: produto.unidade_medida
      });
    }
  };

  const handleSubmit = async () => {
    if (controlesDesabilitados) return;
    const payload = {
      ...formData,
      empresa_id: formData.empresa_id || defaultEmpresaId,
      responsavel: formData.responsavel || (authUser?.full_name || authUser?.email),
      responsavel_id: formData.responsavel_id || authUser?.id
    };
    onSubmit(carimbarContexto(payload, 'empresa_id'));
  };

  const content = (
    <FormWrapper
      schema={movimentacaoSchema}
      defaultValues={formData}
      onSubmit={handleSubmit}
      externalData={formData}
      className={`space-y-6 w-full h-full ${windowMode ? 'p-6 h-full overflow-auto' : ''}`}
      data-permission="Estoque.Movimentacoes.criar"
      data-action="Estoque.Movimentacoes.formulario"
      data-context-required="group-or-company"
    >
      <Card>
        <CardContent className="p-6 space-y-4">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <ArrowDown className="w-5 h-5 text-indigo-600" />
            Registrar Movimentação
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Tipo de Movimentação *</Label>
              <Select
                value={formData.tipo_movimento}
                disabled={controlesDesabilitados}
                onValueChange={(v) => setFormData({ ...formData, tipo_movimento: v })}
                required
              >
                <SelectTrigger
                  data-permission="Estoque.Movimentacoes.criar"
                  data-action="Estoque.Movimentacoes.form.tipo"
                  data-context-required="group-or-company"
                >
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Entrada">
                    <div className="flex items-center gap-2">
                      <ArrowDown className="w-4 h-4 text-green-600" />
                      Entrada
                    </div>
                  </SelectItem>
                  <SelectItem value="Saída">
                    <div className="flex items-center gap-2">
                      <ArrowUp className="w-4 h-4 text-red-600" />
                      Saída
                    </div>
                  </SelectItem>
                  <SelectItem value="Ajuste">Ajuste</SelectItem>
                  <SelectItem value="Inventário">Inventário</SelectItem>
                  <SelectItem value="Devolução">Devolução</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Produto *</Label>
              <Select
                value={formData.produto_id}
                disabled={controlesDesabilitados}
                onValueChange={handleProdutoChange}
                required
              >
                <SelectTrigger
                  data-permission="Estoque.Movimentacoes.criar"
                  data-action="Estoque.Movimentacoes.form.produto"
                  data-context-required="group-or-company"
                >
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {produtos.filter(p => p.status === 'Ativo').map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.codigo ? `${p.codigo} - ` : ''}{p.descricao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Quantidade *</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="0.01"
                  value={formData.quantidade}
                  disabled={controlesDesabilitados}
                  onChange={(e) => setFormData({ ...formData, quantidade: parseFloat(e.target.value) || 0 })}
                  required
                  className="flex-1"
                  data-permission="Estoque.Movimentacoes.criar"
                  data-action="Estoque.Movimentacoes.form.quantidade"
                  data-context-required="group-or-company"
                />
                {formData.unidade_medida && (
                  <span className="bg-slate-100 px-3 py-2 rounded border text-sm">
                    {formData.unidade_medida}
                  </span>
                )}
              </div>
            </div>

            <div>
              <Label>Data *</Label>
              <Input
                type="date"
                value={formData.data_movimentacao}
                disabled={controlesDesabilitados}
                onChange={(e) => setFormData({ ...formData, data_movimentacao: e.target.value })}
                required
                data-permission="Estoque.Movimentacoes.criar"
                data-action="Estoque.Movimentacoes.form.data"
                data-context-required="group-or-company"
              />
            </div>

            <div>
              <Label>Nº Documento</Label>
              <Input
                value={formData.documento_referencia}
                disabled={controlesDesabilitados}
                onChange={(e) => setFormData({ ...formData, documento_referencia: e.target.value })}
                placeholder="NF, OC, OP..."
                data-permission="Estoque.Movimentacoes.criar"
                data-action="Estoque.Movimentacoes.form.documento"
                data-context-required="group-or-company"
              />
            </div>

            <div>
              <Label>Responsável</Label>
              <Input
                value={formData.responsavel}
                disabled={controlesDesabilitados}
                onChange={(e) => setFormData({ ...formData, responsavel: e.target.value })}
                placeholder="Nome"
                data-permission="Estoque.Movimentacoes.criar"
                data-action="Estoque.Movimentacoes.form.responsavel"
                data-context-required="group-or-company"
              />
            </div>

            <div className="col-span-2">
              <Label>Observações</Label>
              <Textarea
                value={formData.observacoes}
                disabled={controlesDesabilitados}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                rows={3}
                data-permission="Estoque.Movimentacoes.criar"
                data-action="Estoque.Movimentacoes.form.observacoes"
                data-context-required="group-or-company"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3 pt-4 border-t sticky bottom-0 bg-white">
        <Button
          type="submit"
          disabled={controlesDesabilitados}
          className="bg-indigo-600 hover:bg-indigo-700"
          data-permission="Estoque.Movimentacoes.criar"
          data-action="Estoque.Movimentacoes.form.registrar"
          data-context-required="group-or-company"
          data-sensitive="true"
        >
          <Save className="w-4 h-4 mr-2" />
          Registrar Movimentação
        </Button>
      </div>
    </FormWrapper>
  );

  if (windowMode) {
    return <div className="w-full h-full bg-white" data-permission="Estoque.Movimentacoes.criar" data-context-required="group-or-company">{content}</div>;
  }

  return content;
}
