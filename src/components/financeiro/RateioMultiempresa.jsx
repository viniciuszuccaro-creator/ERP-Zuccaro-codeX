import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Split, Shuffle, Building2, DollarSign, Percent } from "lucide-react";

/**
 * Componente de rateio automático de despesas/receitas do GRUPO para as empresas
 * @typedef {{tipo_documento: string, descricao: string, categoria: string, valor_total: number,
 * data_vencimento: string, criterio_rateio: string,
 * distribuicao: {empresa_id: string, empresa_nome: string, percentual: number, valor: number|string, observacao: string}[]}} RateioForm
 */
/**
 * @param {{empresas: {id: string, nome_fantasia?: string, razao_social: string}[], grupoId: string, windowMode?: boolean}} props
 */
export default function RateioMultiempresa({ empresas, grupoId, windowMode = false }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  /** @type {[RateioForm, import('react').Dispatch<import('react').SetStateAction<RateioForm>>]} */
  const [formRateio, setFormRateio] = useState({
    tipo_documento: "ContaPagar",
    descricao: "",
    categoria: "Aluguel",
    valor_total: 0,
    data_vencimento: "",
    criterio_rateio: "percentual",
    distribuicao: empresas.map(emp => ({
      empresa_id: emp.id,
      empresa_nome: emp.nome_fantasia || emp.razao_social,
      percentual: 0,
      valor: 0,
      observacao: ""
    }))
  });

  const criarRateioMutation = useMutation({
    mutationFn: async (/** @type {typeof formRateio} */ dados) => {
      // 1. Criar registro de rateio
      const rateio = await base44.entities.RateioFinanceiro.create({
        group_id: grupoId,
        tipo_documento: dados.tipo_documento,
        descricao: dados.descricao,
        valor_total: dados.valor_total,
        criterio_rateio: dados.criterio_rateio,
        data_rateio: new Date().toISOString().split('T')[0],
        distribuicao: dados.distribuicao,
        categoria: dados.categoria,
        responsavel: "Sistema",
        status_consolidacao: "pendente"
      });

      // 2. Criar títulos individuais para cada empresa
      const titulosCriados = [];
      
      for (const dist of dados.distribuicao) {
        if (Number(dist.valor) > 0) {
          const EntidadeAlvo = dados.tipo_documento === "ContaPagar" 
            ? base44.entities.ContaPagar 
            : base44.entities.ContaReceber;

          const titulo = await EntidadeAlvo.create({
            group_id: grupoId,
            empresa_id: dist.empresa_id,
            origem: "grupo",
            e_replicado: true,
            documento_grupo_id: rateio.id,
            rateio_id: rateio.id,
            descricao: `${dados.descricao} (${dist.empresa_nome})`,
            [dados.tipo_documento === "ContaPagar" ? "fornecedor" : "cliente"]: dados.descricao,
            valor: parseFloat(String(dist.valor)),
            valor_original_grupo: dados.valor_total,
            percentual_rateio: dist.percentual,
            data_emissao: new Date().toISOString().split('T')[0],
            data_vencimento: dados.data_vencimento,
            categoria: dados.categoria,
            status: "Pendente",
            observacoes: `Rateio do grupo - ${dist.observacao}`
          });

          titulosCriados.push(titulo);
        }
      }

      // 3. Atualizar rateio com distribuição realizada
      await base44.entities.RateioFinanceiro.update(rateio.id, {
        distribuicao_realizada: titulosCriados.map((t, idx) => ({
          empresa_id: dados.distribuicao[idx].empresa_id,
          empresa_nome: dados.distribuicao[idx].empresa_nome,
          titulo_id: t.id,
          valor: t.valor,
          percentual: t.percentual_rateio,
          status: t.status
        }))
      });

      return { rateio, titulos: titulosCriados };
    },
    onSuccess: (resultado) => {
      queryClient.invalidateQueries({ queryKey: ['rateios'] });
      queryClient.invalidateQueries({ queryKey: ['contasPagar'] });
      queryClient.invalidateQueries({ queryKey: ['contasReceber'] });
      
      toast({
        title: "✅ Rateio criado!",
        description: `${resultado.titulos.length} títulos distribuídos entre as empresas`
      });

      // Reset form
      setFormRateio({
        tipo_documento: "ContaPagar",
        descricao: "",
        categoria: "Aluguel",
        valor_total: 0,
        data_vencimento: "",
        criterio_rateio: "percentual",
        distribuicao: empresas.map(emp => ({
          empresa_id: emp.id,
          empresa_nome: emp.nome_fantasia || emp.razao_social,
          percentual: 0,
          valor: 0,
          observacao: ""
        }))
      });
    },
    onError: (error) => {
      toast({
        title: "❌ Erro ao criar rateio",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handlePercentualChange = (empresaId, percentual) => {
    const novaDistribuicao = formRateio.distribuicao.map(d => {
      if (d.empresa_id === empresaId) {
        const perc = parseFloat(percentual) || 0;
        const valor = (perc / 100) * formRateio.valor_total;
        return { ...d, percentual: perc, valor: valor.toFixed(2) };
      }
      return d;
    });
    setFormRateio({ ...formRateio, distribuicao: novaDistribuicao });
  };

  const distribuirIgual = () => {
    const percentualIgual = 100 / empresas.length;
    const novaDistribuicao = formRateio.distribuicao.map(d => ({
      ...d,
      percentual: percentualIgual,
      valor: ((percentualIgual / 100) * formRateio.valor_total).toFixed(2)
    }));
    setFormRateio({ ...formRateio, distribuicao: novaDistribuicao });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const totalPercentual = formRateio.distribuicao.reduce((sum, d) => sum + (parseFloat(String(d.percentual)) || 0), 0);
    
    if (Math.abs(totalPercentual - 100) > 0.01) {
      toast({
        title: "⚠️ Erro no Rateio",
        description: `A soma dos percentuais deve ser 100%. Atual: ${totalPercentual.toFixed(2)}%`,
        variant: "destructive"
      });
      return;
    }

    criarRateioMutation.mutate(formRateio);
  };

  const content = (
    <Card className="border-2 border-purple-200">
      <CardHeader className="bg-purple-50 border-b">
        <CardTitle className="flex items-center gap-2">
          <Split className="w-5 h-5 text-purple-600" />
          Rateio Multi-Empresa
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Tipo e Categoria */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Tipo de Documento *</Label>
              <Select
                value={formRateio.tipo_documento}
                onValueChange={(v) => setFormRateio({ ...formRateio, tipo_documento: v })}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ContaPagar">Conta a Pagar (Despesa)</SelectItem>
                  <SelectItem value="ContaReceber">Conta a Receber (Receita)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Categoria</Label>
              <Select
                value={formRateio.categoria}
                onValueChange={(v) => setFormRateio({ ...formRateio, categoria: v })}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Aluguel">Aluguel</SelectItem>
                  <SelectItem value="Contabilidade">Contabilidade</SelectItem>
                  <SelectItem value="Internet">Internet</SelectItem>
                  <SelectItem value="Energia">Energia</SelectItem>
                  <SelectItem value="Impostos">Impostos</SelectItem>
                  <SelectItem value="Água">Água</SelectItem>
                  <SelectItem value="Telefone">Telefone</SelectItem>
                  <SelectItem value="Outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Descrição */}
          <div>
            <Label>Descrição *</Label>
            <Input
              value={formRateio.descricao}
              onChange={(e) => setFormRateio({ ...formRateio, descricao: e.target.value })}
              placeholder="Ex: Aluguel Dezembro 2024"
              required
              className="mt-2"
            />
          </div>

          {/* Valor e Vencimento */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Valor Total *</Label>
              <Input
                type="number"
                step="0.01"
                value={formRateio.valor_total}
                onChange={(e) => {
                  const valor = parseFloat(e.target.value) || 0;
                  setFormRateio({ 
                    ...formRateio, 
                    valor_total: valor,
                    distribuicao: formRateio.distribuicao.map(d => ({
                      ...d,
                      valor: ((d.percentual / 100) * valor).toFixed(2)
                    }))
                  });
                }}
                required
                className="mt-2"
              />
            </div>

            <div>
              <Label>Data Vencimento *</Label>
              <Input
                type="date"
                value={formRateio.data_vencimento}
                onChange={(e) => setFormRateio({ ...formRateio, data_vencimento: e.target.value })}
                required
                className="mt-2"
              />
            </div>
          </div>

          {/* Distribuição */}
          <div className="border-t pt-4">
            <div className="flex justify-between items-center mb-4">
              <Label className="text-base font-semibold">Distribuição por Empresa</Label>
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={distribuirIgual}
              >
                <Shuffle className="w-4 h-4 mr-2" />
                Distribuir Igual
              </Button>
            </div>

            <div className="space-y-3">
              {formRateio.distribuicao.map((dist, idx) => (
                <Card key={dist.empresa_id} className="p-4 bg-slate-50">
                  <div className="grid grid-cols-4 gap-4">
                    <div className="col-span-2 flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-purple-600" />
                      <span className="font-semibold">{dist.empresa_nome}</span>
                    </div>
                    
                    <div>
                      <Label className="text-xs text-slate-600">Percentual %</Label>
                      <div className="relative mt-1">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={dist.percentual}
                          onChange={(e) => handlePercentualChange(dist.empresa_id, e.target.value)}
                          className="pr-8"
                        />
                        <Percent className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs text-slate-600">Valor R$</Label>
                      <div className="relative mt-1">
                        <Input
                          type="number"
                          step="0.01"
                          value={dist.valor}
                          readOnly
                          className="bg-white font-semibold"
                        />
                        <DollarSign className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Totalizador */}
            <div className="mt-4 p-4 bg-blue-50 rounded border border-blue-200">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-blue-900">TOTAL:</span>
                <div className="flex gap-6 items-center">
                  <div>
                    <span className="text-sm text-blue-700">Percentual: </span>
                    <span className={`font-bold text-lg ${
                      Math.abs(formRateio.distribuicao.reduce((s, d) => s + (parseFloat(String(d.percentual)) || 0), 0) - 100) < 0.01
                        ? "text-green-600"
                        : "text-red-600"
                    }`}>
                      {formRateio.distribuicao.reduce((s, d) => s + (parseFloat(String(d.percentual)) || 0), 0).toFixed(2)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-sm text-blue-700">Valor: </span>
                    <span className="font-bold text-lg text-blue-900">
                      R$ {formRateio.distribuicao.reduce((s, d) => s + (parseFloat(String(d.valor)) || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => {
              setFormRateio({
                tipo_documento: "ContaPagar",
                descricao: "",
                categoria: "Aluguel",
                valor_total: 0,
                data_vencimento: "",
                criterio_rateio: "percentual",
                distribuicao: empresas.map(emp => ({
                  empresa_id: emp.id,
                  empresa_nome: emp.nome_fantasia || emp.razao_social,
                  percentual: 0,
                  valor: 0,
                  observacao: ""
                }))
              });
            }}>
              Limpar
            </Button>
            <Button
              type="submit"
              disabled={criarRateioMutation.isPending}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {criarRateioMutation.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Criando...
                </>
              ) : (
                <>
                  <Split className="w-4 h-4 mr-2" />
                  Criar e Distribuir
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );

  if (windowMode) {
    return <div className="w-full h-full flex flex-col bg-gradient-to-br from-slate-50 to-purple-50 overflow-auto p-1.5">{content}</div>;
  }

  return content;
}
