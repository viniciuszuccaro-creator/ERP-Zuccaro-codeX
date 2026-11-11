import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { BarChart3, TrendingUp, TrendingDown, Download, RefreshCw } from "lucide-react";

/**
 * Relatório de DRE (Demonstração do Resultado do Exercício)
 */
export default function RelatorioDRE({ empresaId, tipoRelatorio = "Individual" }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [periodo, setPeriodo] = useState(
    new Date().toISOString().substring(0, 7) // YYYY-MM
  );

  const { data: dre, isLoading } = useQuery({
    queryKey: ['dre', empresaId, periodo, tipoRelatorio],
    queryFn: async () => {
      const query = tipoRelatorio === "Individual"
        ? { empresa_id: empresaId, periodo }
        : { tipo: "Consolidado", periodo };

      const result = await base44.entities.DRE.filter(query);
      return result[0] || null;
    },
    enabled: !!periodo
  });

  const gerarDREMutation = useMutation({
    mutationFn: async () => {
      // Calcular DRE a partir dos lançamentos
      const dataInicio = `${periodo}-01`;
      const dataFim = new Date(Number(periodo.split('-')[0]), Number(periodo.split('-')[1]), 0).toISOString().split('T')[0];

      const lancamentos = await base44.entities.LancamentoContabil.filter({
        empresa_id: empresaId,
        status: "Efetivado"
      });

      const lancamentosPeriodo = lancamentos.filter(l => {
        const data = l.data_lancamento;
        return data >= dataInicio && data <= dataFim;
      });

      // Buscar plano de contas
      const contas = await base44.entities.PlanoDeContas.filter({ empresa_id: empresaId });

      // Calcular por grupo DRE
      const calcular = (grupoDre) => {
        return lancamentosPeriodo
          .filter(l => {
            const contaDebito = contas.find(c => c.id === l.conta_debito_id);
            const contaCredito = contas.find(c => c.id === l.conta_credito_id);
            return contaDebito?.grupo_dre === grupoDre || contaCredito?.grupo_dre === grupoDre;
          })
          .reduce((sum, l) => {
            const contaDebito = contas.find(c => c.id === l.conta_debito_id);
            if (contaDebito?.grupo_dre === grupoDre) {
              return sum + l.valor;
            }
            return sum;
          }, 0);
      };

      const receitaBruta = calcular("Receita Bruta");
      const deducoes = calcular("Deduções");
      const receitaLiquida = receitaBruta - deducoes;
      const cpv = calcular("CPV");
      const lucroBruto = receitaLiquida - cpv;
      const despAdmin = calcular("Despesas Administrativas");
      const despComerc = calcular("Despesas Comerciais");
      const despFinanc = calcular("Despesas Financeiras");
      const despOp = despAdmin + despComerc + despFinanc;
      const lucroOp = lucroBruto - despOp;
      const outrasRec = calcular("Outras Receitas");
      const outrasDesp = calcular("Outras Despesas");
      const lair = lucroOp + outrasRec - outrasDesp;
      const irCsll = calcular("Impostos");
      const lucroLiq = lair - irCsll;

      const dadosDRE = {
        group_id: "grupo_id",
        empresa_id: empresaId,
        tipo: tipoRelatorio,
        periodo,
        data_inicio: dataInicio,
        data_fim: dataFim,
        receita_bruta: receitaBruta,
        deducoes_impostos: deducoes,
        receita_liquida: receitaLiquida,
        cpv,
        lucro_bruto: lucroBruto,
        despesas_administrativas: despAdmin,
        despesas_comerciais: despComerc,
        despesas_financeiras: despFinanc,
        despesas_operacionais_total: despOp,
        lucro_operacional: lucroOp,
        outras_receitas: outrasRec,
        outras_despesas: outrasDesp,
        resultado_nao_operacional: outrasRec - outrasDesp,
        lucro_antes_tributos: lair,
        ir_csll: irCsll,
        lucro_liquido: lucroLiq,
        margem_bruta_percentual: receitaLiquida > 0 ? (lucroBruto / receitaLiquida) * 100 : 0,
        margem_operacional_percentual: receitaLiquida > 0 ? (lucroOp / receitaLiquida) * 100 : 0,
        margem_liquida_percentual: receitaLiquida > 0 ? (lucroLiq / receitaLiquida) * 100 : 0,
        gerado_automaticamente: true,
        data_geracao: new Date().toISOString(),
        usuario_geracao: "Sistema"
      };

      // Criar ou atualizar
      if (dre?.id) {
        return await base44.entities.DRE.update(dre.id, dadosDRE);
      } else {
        return await base44.entities.DRE.create(dadosDRE);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dre'] });
      toast({ title: "✅ DRE gerado com sucesso!" });
    },
  });

  const exportarExcel = () => {
    if (!dre) return;

    const dados = [
      ['DEMONSTRAÇÃO DO RESULTADO DO EXERCÍCIO'],
      ['Período:', periodo],
      ['Empresa:', tipoRelatorio === "Individual" ? "Individual" : "Consolidado"],
      [''],
      ['RECEITA BRUTA', dre.receita_bruta.toFixed(2)],
      ['(-) Deduções e Impostos', dre.deducoes_impostos.toFixed(2)],
      ['RECEITA LÍQUIDA', dre.receita_liquida.toFixed(2)],
      [''],
      ['(-) CPV - Custo dos Produtos Vendidos', dre.cpv.toFixed(2)],
      ['LUCRO BRUTO', dre.lucro_bruto.toFixed(2)],
      [`Margem Bruta`, `${dre.margem_bruta_percentual?.toFixed(2)}%`],
      [''],
      ['(-) DESPESAS OPERACIONAIS'],
      ['    Administrativas', dre.despesas_administrativas.toFixed(2)],
      ['    Comerciais', dre.despesas_comerciais.toFixed(2)],
      ['    Financeiras', dre.despesas_financeiras.toFixed(2)],
      ['Total Despesas Operacionais', dre.despesas_operacionais_total.toFixed(2)],
      ['LUCRO OPERACIONAL', dre.lucro_operacional.toFixed(2)],
      [`Margem Operacional`, `${dre.margem_operacional_percentual?.toFixed(2)}%`],
      [''],
      ['(+) Outras Receitas', dre.outras_receitas.toFixed(2)],
      ['(-) Outras Despesas', dre.outras_despesas.toFixed(2)],
      ['LUCRO ANTES DOS TRIBUTOS', dre.lucro_antes_tributos.toFixed(2)],
      [''],
      ['(-) IR e CSLL', dre.ir_csll.toFixed(2)],
      ['LUCRO LÍQUIDO', dre.lucro_liquido.toFixed(2)],
      [`Margem Líquida`, `${dre.margem_liquida_percentual?.toFixed(2)}%`],
    ];

    const csv = dados.map(row => row.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `DRE_${periodo}.csv`;
    link.click();
  };

  const LinhaValor = ({ label, valor, destaque = false, sublinha = false, margem = null }) => (
    <div className={`flex justify-between items-center py-2 px-4 ${destaque ? 'bg-blue-50 font-bold border-l-4 border-blue-600' : ''} ${sublinha ? 'font-semibold border-t-2' : ''}`}>
      <span className={destaque ? 'text-lg' : 'text-sm'}>{label}</span>
      <div className="flex items-center gap-3">
        {margem !== null && (
          <Badge variant="outline" className="text-xs">
            {margem.toFixed(1)}%
          </Badge>
        )}
        <span className={`${destaque ? 'text-xl' : 'text-sm'} ${valor < 0 ? 'text-red-600' : valor > 0 ? 'text-green-600' : 'text-slate-900'} font-mono`}>
          R$ {Math.abs(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </span>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Controles */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex gap-4 items-end">
            <div>
              <Label className="text-xs">Período</Label>
              <Input
                type="month"
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value)}
                className="w-48"
              />
            </div>
            <Button
              onClick={() => gerarDREMutation.mutate()}
              disabled={gerarDREMutation.isPending}
              variant="outline"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${gerarDREMutation.isPending ? 'animate-spin' : ''}`} />
              {gerarDREMutation.isPending ? 'Calculando...' : 'Gerar DRE'}
            </Button>
            {dre && (
              <Button variant="outline" onClick={exportarExcel}>
                <Download className="w-4 h-4 mr-2" />
                Excel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* DRE */}
      {isLoading ? (
        <Card className="border-0 shadow-md">
          <CardContent className="p-12 text-center text-slate-500">
            Carregando DRE...
          </CardContent>
        </Card>
      ) : dre ? (
        <Card className="border-0 shadow-md">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 border-b">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              DRE - {tipoRelatorio} - {new Date(periodo).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <LinhaValor label="RECEITA BRUTA" valor={dre.receita_bruta} />
            <LinhaValor label="(-) Deduções e Impostos" valor={-dre.deducoes_impostos} />
            <LinhaValor label="RECEITA LÍQUIDA" valor={dre.receita_liquida} destaque sublinha />

            <div className="h-4"></div>

            <LinhaValor label="(-) CPV - Custo dos Produtos Vendidos" valor={-dre.cpv} />
            <LinhaValor 
              label="LUCRO BRUTO" 
              valor={dre.lucro_bruto} 
              destaque 
              sublinha 
              margem={dre.margem_bruta_percentual}
            />

            <div className="h-4"></div>

            <div className="px-4 py-2 bg-slate-50 text-sm font-semibold">
              DESPESAS OPERACIONAIS
            </div>
            <LinhaValor label="    Administrativas" valor={-dre.despesas_administrativas} />
            <LinhaValor label="    Comerciais" valor={-dre.despesas_comerciais} />
            <LinhaValor label="    Financeiras" valor={-dre.despesas_financeiras} />
            <LinhaValor label="Total Despesas Operacionais" valor={-dre.despesas_operacionais_total} sublinha />
            <LinhaValor 
              label="LUCRO OPERACIONAL" 
              valor={dre.lucro_operacional} 
              destaque 
              margem={dre.margem_operacional_percentual}
            />

            <div className="h-4"></div>

            <LinhaValor label="(+) Outras Receitas" valor={dre.outras_receitas} />
            <LinhaValor label="(-) Outras Despesas" valor={-dre.outras_despesas} />
            <LinhaValor label="LUCRO ANTES DOS TRIBUTOS (LAIR)" valor={dre.lucro_antes_tributos} sublinha />

            <div className="h-4"></div>

            <LinhaValor label="(-) IR e CSLL" valor={-dre.ir_csll} />
            <LinhaValor 
              label="LUCRO LÍQUIDO" 
              valor={dre.lucro_liquido} 
              destaque 
              sublinha 
              margem={dre.margem_liquida_percentual}
            />

            {/* Rodapé */}
            <div className="p-4 bg-slate-50 text-xs text-slate-500 border-t">
              Gerado em: {new Date(dre.data_geracao).toLocaleString('pt-BR')}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-md">
          <CardContent className="p-12 text-center text-slate-500">
            <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p>DRE não gerado para este período</p>
            <Button
              onClick={() => gerarDREMutation.mutate()}
              disabled={gerarDREMutation.isPending}
              className="mt-4 bg-blue-600"
            >
              Gerar DRE
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
