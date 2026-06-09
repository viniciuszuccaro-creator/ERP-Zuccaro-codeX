import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { z } from "zod";
import FormWrapper from "@/components/common/FormWrapper";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import { Save, PackageMinus } from "lucide-react";

/**
 * V21.1.2: Requisição Almoxarifado Form - Adaptado para Window Mode
 */
export default function RequisicaoAlmoxarifadoForm({ requisicao, onSubmit, windowMode = false }) {
  const { carimbarContexto, filterInContext, empresaAtual } = useContextoVisual();
  
  const [formData, setFormData] = useState(requisicao || {
    numero_requisicao: `REQ-ALM-${Date.now()}`,
    produto_id: '',
    produto_descricao: '',
    quantidade: 1,
    unidade_medida: '',
    setor_solicitante: '',
    solicitante: '',
    data_requisicao: new Date().toISOString().split('T')[0],
    finalidade: '',
    centro_custo: '',
    observacoes: ''
  });

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
        produto_descricao: produto.descricao,
        unidade_medida: produto.unidade_medida
      });
    }
  };

  const schema = z.object({
    produto_id: z.string().min(1, 'Produto é obrigatório'),
    quantidade: z.number().positive('Quantidade deve ser > 0'),
    data_requisicao: z.string().min(4, 'Data é obrigatória'),
  });

  const handleSubmit = async () => {
    onSubmit(carimbarContexto(formData, 'empresa_id'));
  };

  const content = (
    <FormWrapper
      schema={schema}
      defaultValues={formData}
      onSubmit={handleSubmit}
      externalData={formData}
      className={`space-y-6 w-full h-full ${windowMode ? 'p-6 h-full overflow-auto' : ''}`}
      data-permission="Estoque.Requisicoes.criar"
      data-action="Estoque.Requisicoes.formularioJanela"
      data-context-required="group-or-company"
    >
      <Card
        data-permission="Estoque.Requisicoes.criar"
        data-action="Estoque.Requisicoes.dadosRequisicao"
        data-context-required="group-or-company"
      >
        <CardContent className="p-6 space-y-4">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <PackageMinus className="w-5 h-5 text-orange-600" />
            Requisição de Almoxarifado
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Nº Requisição</Label>
              <Input
                value={formData.numero_requisicao}
                readOnly
                className="bg-slate-50"
                data-permission="Estoque.Requisicoes.visualizar"
                data-action="Estoque.Requisicoes.numero"
                data-context-required="group-or-company"
              />
            </div>

            <div>
              <Label>Data *</Label>
              <Input
                type="date"
                value={formData.data_requisicao}
                onChange={(e) => setFormData({ ...formData, data_requisicao: e.target.value })}
                required
                data-permission="Estoque.Requisicoes.criar"
                data-action="Estoque.Requisicoes.data"
                data-context-required="group-or-company"
              />
            </div>

            <div className="col-span-2">
              <Label>Produto *</Label>
              <Select
                value={formData.produto_id}
                onValueChange={handleProdutoChange}
                required
              >
                <SelectTrigger
                  data-permission="Estoque.Requisicoes.criar"
                  data-action="Estoque.Requisicoes.produto"
                  data-context-required="group-or-company"
                >
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {produtos.filter(p => p.status === 'Ativo' && (p.estoque_disponivel || p.estoque_atual) > 0).map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.codigo ? `${p.codigo} - ` : ''}{p.descricao} ({p.estoque_disponivel || p.estoque_atual} {p.unidade_medida})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Quantidade *</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  step="0.01"
                  value={formData.quantidade}
                  onChange={(e) => setFormData({ ...formData, quantidade: parseFloat(e.target.value) || 0 })}
                  required
                  className="flex-1"
                  data-permission="Estoque.Requisicoes.criar"
                  data-action="Estoque.Requisicoes.quantidade"
                  data-context-required="group-or-company"
                  data-sensitive="true"
                />
                <span className="bg-slate-100 px-3 py-2 rounded border text-sm">
                  {formData.unidade_medida}
                </span>
              </div>
            </div>

            <div>
              <Label>Setor Solicitante *</Label>
              <Select
                value={formData.setor_solicitante}
                onValueChange={(v) => setFormData({ ...formData, setor_solicitante: v })}
                required
              >
                <SelectTrigger
                  data-permission="Estoque.Requisicoes.criar"
                  data-action="Estoque.Requisicoes.setorSolicitante"
                  data-context-required="group-or-company"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Produção">Produção</SelectItem>
                  <SelectItem value="Manutenção">Manutenção</SelectItem>
                  <SelectItem value="Administrativo">Administrativo</SelectItem>
                  <SelectItem value="Comercial">Comercial</SelectItem>
                  <SelectItem value="Logística">Logística</SelectItem>
                  <SelectItem value="Outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Solicitante</Label>
              <Input
                value={formData.solicitante}
                onChange={(e) => setFormData({ ...formData, solicitante: e.target.value })}
                placeholder="Nome"
                data-permission="Estoque.Requisicoes.criar"
                data-action="Estoque.Requisicoes.solicitante"
                data-context-required="group-or-company"
              />
            </div>

            <div>
              <Label>Centro de Custo</Label>
              <Input
                value={formData.centro_custo}
                onChange={(e) => setFormData({ ...formData, centro_custo: e.target.value })}
                data-permission="Estoque.Requisicoes.criar"
                data-action="Estoque.Requisicoes.centroCusto"
                data-context-required="group-or-company"
              />
            </div>

            <div className="col-span-2">
              <Label>Finalidade *</Label>
              <Textarea
                value={formData.finalidade}
                onChange={(e) => setFormData({ ...formData, finalidade: e.target.value })}
                data-permission="Estoque.Requisicoes.criar"
                data-action="Estoque.Requisicoes.finalidade"
                data-context-required="group-or-company"
                placeholder="Para que será utilizado..."
                required
                rows={2}
              />
            </div>

            <div className="col-span-2">
              <Label>Observações</Label>
              <Textarea
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                rows={2}
                data-permission="Estoque.Requisicoes.criar"
                data-action="Estoque.Requisicoes.observacoes"
                data-context-required="group-or-company"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3 pt-4 border-t sticky bottom-0 bg-white">
        <Button
          type="submit"
          className="bg-orange-600 hover:bg-orange-700"
          data-permission="Estoque.Requisicoes.criar"
          data-action="Estoque.Requisicoes.confirmarJanela"
          data-context-required="group-or-company"
          data-sensitive="true"
        >
          <Save className="w-4 h-4 mr-2" />
          Registrar Requisição
        </Button>
      </div>
    </FormWrapper>
  );

  if (windowMode) {
    return (
      <div
        className="w-full h-full bg-white"
        data-permission="Estoque.Requisicoes.criar"
        data-context-required="group-or-company"
      >
        {content}
      </div>
    );
  }

  return content;
}
