import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Save, TrendingUp, Plus, Trash2, AlertCircle } from "lucide-react";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Badge } from "@/components/ui/badge";
import FormWrapper from "@/components/common/FormWrapper";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import FormErrorSummary from "@/components/common/FormErrorSummary";
import usePermissions from "@/components/lib/usePermissions";

/**
 * V21.1.2: Cotação Form - Adaptado para Window Mode
 */
export default function CotacaoForm({ cotacao, onSubmit, windowMode = false }) {
  const { empresaAtual, grupoAtual, contexto, filterInContext, carimbarContexto, createInContext } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || cotacao?.group_id || cotacao?.grupo_id || null;
  const empresaId = empresaAtual?.id || cotacao?.empresa_id || null;
  const contextoValido = Boolean(groupId || empresaId);
  const canCreateCotacao = hasPermission('Compras', 'Cotacao', 'criar') || hasPermission('Compras', null, 'criar');

  const auditCotacaoForm = async ({ acao, sucesso = true, motivo = null, dados = {} }) => {
    try {
      await createInContext('AuditLog', {
        acao,
        modulo: 'Compras',
        entidade: 'Cotacao',
        tipo_auditoria: sucesso ? 'entidade' : 'seguranca',
        descricao: motivo || 'Auditoria do formulario de cotacao.',
        dados_novos: dados,
        group_id: groupId,
        grupo_id: groupId,
        empresa_id: empresaId,
        sucesso,
        data_hora: new Date().toISOString(),
      });
    } catch (error) {
      console.warn('Falha ao auditar formulario de cotacao:', error);
    }
  };
  const schema = z.object({
    numero_cotacao: z.string(),
    descricao: z.string().min(3, 'Descrição obrigatória'),
    data_criacao: z.string(),
    data_limite_resposta: z.string().min(8, 'Informe a data limite'),
    itens: z.array(z.object({
      produto_descricao: z.string().min(1, 'Selecione o produto'),
      quantidade: z.number().positive('Quantidade > 0'),
      unidade: z.string().min(1, 'Unidade'),
      observacoes: z.string().optional(),
    })).min(1, 'Inclua ao menos 1 item'),
    fornecedores_selecionados: z.array(z.string()).min(2, 'Selecione ao menos 2 fornecedores'),
    observacoes_gerais: z.string().optional(),
  });

  const { register, handleSubmit, control, setValue, watch, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: cotacao || {
      numero_cotacao: `COT-${Date.now()}`,
      descricao: '',
      data_criacao: new Date().toISOString().split('T')[0],
      data_limite_resposta: '',
      itens: [{ produto_descricao: '', quantidade: 0, unidade: 'UN', observacoes: '' }],
      fornecedores_selecionados: [],
      observacoes_gerais: ''
    }
  });

  const { fields, append, remove } = useFieldArray({ name: 'itens', control });

  const adicionarItem = () => append({ produto_descricao: '', quantidade: 0, unidade: 'UN', observacoes: '' });
  const removerItem = (index) => remove(index);

  const selecionados = watch('fornecedores_selecionados') || [];
  const toggleFornecedor = (fornecedorId) => {
    const already = selecionados.includes(fornecedorId);
    const novaLista = already ? selecionados.filter(id => id !== fornecedorId) : [...selecionados, fornecedorId];
    setValue('fornecedores_selecionados', novaLista, { shouldValidate: true });
  };

  const { data: produtos = [] } = useQuery({
    queryKey: ['produtos', groupId, empresaId, contexto],
    queryFn: () => filterInContext('Produto', {}, '-updated_date', 9999),
    enabled: contextoValido && canCreateCotacao,
  });

  const { data: fornecedores = [] } = useQuery({
    queryKey: ['fornecedores', groupId, empresaId, contexto],
    queryFn: () => filterInContext('Fornecedor', {}, '-updated_date', 9999),
    enabled: contextoValido && canCreateCotacao,
  });


  const onValid = async (data) => {
    if (!contextoValido || !canCreateCotacao) {
      await auditCotacaoForm({
        acao: 'CotacaoForm.envio_bloqueado',
        sucesso: false,
        motivo: !contextoValido ? 'contexto_obrigatorio' : 'permissao_negada',
        dados: { numero_cotacao: data.numero_cotacao, fornecedores: data.fornecedores_selecionados?.length || 0 }
      });
      throw new Error(!contextoValido ? 'Selecione grupo ou empresa antes de criar cotacao.' : 'Sem permissao para criar cotacao.');
    }

    const payload = carimbarContexto({
      ...data,
      group_id: groupId,
      grupo_id: groupId,
      empresa_id: empresaId
    }, 'empresa_id');
    await onSubmit(payload);
    await auditCotacaoForm({
      acao: 'CotacaoForm.enviada',
      dados: {
        numero_cotacao: data.numero_cotacao,
        itens: data.itens?.length || 0,
        fornecedores: data.fornecedores_selecionados?.length || 0
      }
    });
  };
  const unifiedSubmit = React.useCallback(() => handleSubmit(onValid)(), [handleSubmit, onValid]);

  const content = (
    <FormWrapper
      onSubmit={unifiedSubmit}
      externalData={watch()}
      className={`space-y-6 w-full h-full ${windowMode ? 'p-6 overflow-auto' : ''}`}
      data-permission="Compras.Cotacao.criar"
      data-action="Compras.CotacaoForm.formulario"
      data-context-required="group-or-company"
      data-context-mode={contexto}
    >
      <FormErrorSummary messages={Object.values(errors || {}).map(e => e?.message).filter(Boolean)} />
      <Card>
        <CardContent className="p-6 space-y-4">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-cyan-600" />
            Nova Cotação de Compras
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Nº Cotação</Label>
              <Input
                {...register('numero_cotacao')}
                readOnly
                className="bg-slate-50"
                data-permission="Compras.Cotacao.criar"
                data-action="Compras.CotacaoForm.numero"
                data-context-required="group-or-company"
              />
            </div>

            <div>
              <Label>Data Limite Resposta *</Label>
              <Input
                type="date"
                {...register('data_limite_resposta')}
                data-permission="Compras.Cotacao.criar"
                data-action="Compras.CotacaoForm.dataLimite"
                data-context-required="group-or-company"
              />
              {errors.data_limite_resposta && <p className="text-red-600 text-xs mt-1">{errors.data_limite_resposta.message}</p>}
            </div>

            <div className="col-span-2">
              <Label>Descrição da Cotação *</Label>
              <Input
                {...register('descricao')}
                placeholder="Ex: Cotação de Bitolas - Lote Fevereiro"
                data-permission="Compras.Cotacao.criar"
                data-action="Compras.CotacaoForm.descricao"
                data-context-required="group-or-company"
              />
              {errors.descricao && <p className="text-red-600 text-xs mt-1">{errors.descricao.message}</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold">Itens para Cotação</h3>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={adicionarItem}
              disabled={!contextoValido || !canCreateCotacao}
              data-permission="Compras.Cotacao.criar"
              data-action="Compras.CotacaoForm.adicionarItem"
              data-context-required="group-or-company"
            >
              <Plus className="w-4 h-4 mr-2" />
              Item
            </Button>
          </div>

          <div className="space-y-3">
            {fields.map((field, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-3 p-3 bg-slate-50 rounded-lg">
                <div className="col-span-5">
                  <Controller
                    control={control}
                    name={`itens.${idx}.produto_descricao`}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger
                          data-permission="Compras.Cotacao.criar"
                          data-action="Compras.CotacaoForm.itemProduto"
                          data-context-required="group-or-company"
                        >
                          <SelectValue placeholder="Produto" />
                        </SelectTrigger>
                        <SelectContent>
                          {produtos.map(p => (
                            <SelectItem key={p.id} value={p.descricao}>
                              {p.codigo} - {p.descricao}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    placeholder="Qtd"
                    {...register(`itens.${idx}.quantidade`, { valueAsNumber: true })}
                    data-permission="Compras.Cotacao.criar"
                    data-action="Compras.CotacaoForm.itemQuantidade"
                    data-context-required="group-or-company"
                    data-sensitive="true"
                  />
                  {errors.itens?.[idx]?.quantidade && <p className="text-red-600 text-xs mt-1">{errors.itens[idx].quantidade.message}</p>}
                </div>
                <div className="col-span-2">
                  <Controller
                    control={control}
                    name={`itens.${idx}.unidade`}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger
                          data-permission="Compras.Cotacao.criar"
                          data-action="Compras.CotacaoForm.itemUnidade"
                          data-context-required="group-or-company"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="UN">UN</SelectItem>
                          <SelectItem value="KG">KG</SelectItem>
                          <SelectItem value="MT">MT</SelectItem>
                          <SelectItem value="LT">LT</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    placeholder="Obs"
                    {...register(`itens.${idx}.observacoes`)}
                    data-permission="Compras.Cotacao.criar"
                    data-action="Compras.CotacaoForm.itemObservacoes"
                    data-context-required="group-or-company"
                  />
                </div>
                <div className="col-span-1 flex items-center justify-center">
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removerItem(idx)}
                      disabled={!contextoValido || !canCreateCotacao}
                      data-permission="Compras.Cotacao.criar"
                      data-action="Compras.CotacaoForm.removerItem"
                      data-context-required="group-or-company"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div>
            <Label className="mb-3 block">Fornecedores Convidados * (min. 2)</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto border rounded-lg p-3">
              {fornecedores.filter(f => f.status === 'Ativo').map(fornecedor => (
                <div key={fornecedor.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer">
                  <Checkbox
                    checked={selecionados.includes(fornecedor.id)}
                    onCheckedChange={() => toggleFornecedor(fornecedor.id)}
                    data-permission="Compras.Cotacao.criar"
                    data-action="Compras.CotacaoForm.selecionarFornecedor"
                    data-context-required="group-or-company"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{fornecedor.nome}</p>
                    <Badge variant="outline" className="text-xs mt-1">
                      {fornecedor.categoria}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
            {selecionados.length < 2 && (
              <p className="text-xs text-orange-600 mt-2 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Selecione ao menos 2 fornecedores
              </p>
            )}
          </div>

          <div>
            <Label>Observações Gerais</Label>
            <Textarea
              {...register('observacoes_gerais')}
              rows={3}
              placeholder="Condições especiais, prazos..."
              data-permission="Compras.Cotacao.criar"
              data-action="Compras.CotacaoForm.observacoesGerais"
              data-context-required="group-or-company"
              data-sensitive="true"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3 pt-4 border-t sticky bottom-0 bg-white">
        <Button 
          type="submit" 
          className="bg-cyan-600 hover:bg-cyan-700"
          disabled={selecionados.length < 2 || !contextoValido || !canCreateCotacao}
          data-permission="Compras.Cotacao.criar"
          data-action="Compras.CotacaoForm.confirmar"
          data-context-required="group-or-company"
          data-sensitive="true"
        >
          <Save className="w-4 h-4 mr-2" />
          Criar e Enviar Cotação
        </Button>
      </div>
    </FormWrapper>
  );

  if (windowMode) {
    return (
      <div
        className="w-full h-full bg-white"
        data-permission="Compras.Cotacao.criar"
        data-context-required="group-or-company"
      >
        {content}
      </div>
    );
  }

  return content;
}
