
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, Percent, Calendar } from "lucide-react"; // Changed CreditCard to DollarSign, added Percent
import { Separator } from "@/components/ui/separator";

// Assuming base44 and useQuery are available in the project context
// For a fully functional example, you might need to mock or define 'base44' and 'useQuery'
// Example of useQuery if react-query is installed:
// import { useQuery } from '@tanstack/react-query';
// const base44 = {
//   entities: {
//     FormaPagamento: {
//       list: async () => [
//         { id: "1", tipo: "À Vista", descricao: "Pagamento total", icone: "💵", ativa: true },
//         { id: "2", tipo: "PIX", descricao: "Via PIX", icone: "🔷", ativa: true },
//         { id: "3", tipo: "Boleto", descricao: "Boleto bancário", icone: "📄", ativa: true },
//         { id: "4", tipo: "Cartão de Crédito", descricao: "Cartão de crédito", icone: "💳", ativa: true },
//         { id: "5", tipo: "Cartão de Débito", descricao: "Cartão de débito", icone: "💳", ativa: true },
//         { id: "6", tipo: "Transferência", descricao: "Transferência bancária", icone: "🏦", ativa: true },
//         { id: "7", tipo: "Dinheiro", descricao: "Em espécie", icone: "💵", ativa: true },
//         { id: "8", tipo: "Parcelado", descricao: "Pagamento parcelado", icone: "📊", ativa: true },
//         { id: "9", tipo: "Outro", descricao: "Outra forma", icone: "❔", ativa: false }, // Inactive example
//       ],
//     },
//   },
// };
// import { useQuery } from 'react-query'; // Or '@tanstack/react-query'

// Placeholder for `useQuery` and `base44` if not actually imported in the project
// In a real project, these would be properly imported and configured.
const useQuery = ({ queryKey, queryFn }) => {
  const [data, setData] = useState([]);
  useEffect(() => {
    queryFn().then(setData);
  }, [queryKey[0]]);
  return { data };
};

const base44 = {
  entities: {
    FormaPagamento: {
      list: async () => [
        { id: "1", tipo: "À Vista", descricao: "Pagamento total", icone: "💵", ativa: true },
        { id: "2", tipo: "PIX", descricao: "Via PIX", icone: "🔷", ativa: true },
        { id: "3", tipo: "Boleto", descricao: "Boleto bancário", icone: "📄", ativa: true },
        { id: "4", tipo: "Cartão de Crédito", descricao: "Cartão de crédito", icone: "💳", ativa: true },
        { id: "5", tipo: "Cartão de Débito", descricao: "Cartão de débito", icone: "💳", ativa: true },
        { id: "6", tipo: "Transferência", descricao: "Transferência bancária", icone: "🏦", ativa: true },
        { id: "7", tipo: "Dinheiro", descricao: "Em espécie", icone: "💵", ativa: true },
        { id: "8", tipo: "Parcelado", descricao: "Pagamento parcelado", icone: "📊", ativa: true },
        { id: "9", tipo: "Outro", descricao: "Outra forma", icone: "❔", ativa: false }, // Inactive example
      ],
    },
  },
};


export default function FormasPagamentoPedido({ 
  valorTotal, 
  formaPagamento, 
  condicaoPagamento,
  parcelas = [],
  acrescimo = 0,
  onFormaPagamentoChange,
  onCondicaoPagamentoChange,
  onParcelasChange,
  onAcrescimoChange
}) {
  const [numeroParcelas, setNumeroParcelas] = useState(1);
  const [percentualAcrescimo, setPercentualAcrescimo] = useState(acrescimo || 0);

  const { data: formasPagamento = [] } = useQuery({
    queryKey: ['formas-pagamento'],
    queryFn: () => base44.entities.FormaPagamento.list(),
  });

  const formasAtivas = formasPagamento.filter(f => f.ativa);

  useEffect(() => {
    // Only generate parcels if the payment method is 'Parcelado'
    // and there's more than one parcel or if it's explicitly set to 1 and we need to refresh
    if (formaPagamento === 'Parcelado' && numeroParcelas > 0 && onParcelasChange) {
      gerarParcelas();
    } else if (formaPagamento !== 'Parcelado' && parcelas.length > 0) {
      // Clear parcels if payment method changes from 'Parcelado'
      onParcelasChange([]);
    }
  }, [numeroParcelas, valorTotal, percentualAcrescimo, formaPagamento]); // Added formaPagamento to dependencies

  // Effect to update local state if props change from parent
  useEffect(() => {
    if (acrescimo !== percentualAcrescimo) {
      setPercentualAcrescimo(acrescimo);
    }
  }, [acrescimo]);

  // Effect to handle initial parcel count from prop, if needed.
  // The current outline does not explicitly handle initial `numeroParcelas` from prop.
  // If `parcelas.length` is used to infer initial `numeroParcelas`, it would go here.
  // For now, it defaults to 1.

  const gerarParcelas = () => {
    const valorComAcrescimo = valorTotal * (1 + percentualAcrescimo / 100);
    const valorParcela = valorComAcrescimo / numeroParcelas;
    const novasParcelas = [];

    for (let i = 1; i <= numeroParcelas; i++) {
      const dataVencimento = new Date();
      // Set date for the i-th month from now.
      // E.g., for i=1, it's 30 days from now. For i=2, 60 days from now.
      // This is a common way to calculate monthly intervals.
      dataVencimento.setDate(dataVencimento.getDate() + (i * 30));

      novasParcelas.push({
        numero_parcela: i,
        data_vencimento: dataVencimento.toISOString().split('T')[0],
        valor: valorParcela,
        status: 'Pendente',
        forma_cobranca: formaPagamento // Use the selected formaPagamento for cobranca
      });
    }

    if (onParcelasChange) {
      onParcelasChange(novasParcelas);
    }
  };

  const handleAcrescimoChange = (valor) => {
    setPercentualAcrescimo(valor);
    if (onAcrescimoChange) {
      onAcrescimoChange(valor);
    }
  };

  return (
    <Card className="border-purple-200">
      <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50">
        <CardTitle className="text-base flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-purple-600" />
          Formas de Pagamento
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="forma-pagamento-select">Forma de Pagamento *</Label>
            <Select
              value={formaPagamento}
              onValueChange={onFormaPagamentoChange}
            >
              <SelectTrigger id="forma-pagamento-select">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="À Vista">💵 À Vista</SelectItem>
                <SelectItem value="PIX">🔷 PIX</SelectItem>
                <SelectItem value="Boleto">📄 Boleto</SelectItem>
                <SelectItem value="Cartão de Crédito">💳 Cartão de Crédito</SelectItem>
                <SelectItem value="Cartão de Débito">💳 Cartão de Débito</SelectItem>
                <SelectItem value="Transferência">🏦 Transferência</SelectItem>
                <SelectItem value="Dinheiro">💵 Dinheiro</SelectItem>
                <SelectItem value="Parcelado">📊 Parcelado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="condicao-pagamento-select">Condição de Pagamento</Label>
            <Select
              value={condicaoPagamento}
              onValueChange={onCondicaoPagamentoChange}
            >
              <SelectTrigger id="condicao-pagamento-select">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="À Vista">À Vista</SelectItem>
                <SelectItem value="7 dias">7 dias</SelectItem>
                <SelectItem value="15 dias">15 dias</SelectItem>
                <SelectItem value="30 dias">30 dias</SelectItem>
                <SelectItem value="45 dias">45 dias</SelectItem>
                <SelectItem value="60 dias">60 dias</SelectItem>
                <SelectItem value="Parcelado">Parcelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ACRÉSCIMO/JUROS PARA PARCELAMENTO */}
        {(formaPagamento === 'Parcelado' || formaPagamento === 'Cartão de Crédito') && (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <Label className="text-orange-900" htmlFor="percentual-acrescimo-input">Acréscimo/Juros (%)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="percentual-acrescimo-input"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={percentualAcrescimo}
                    onChange={(e) => handleAcrescimoChange(parseFloat(e.target.value) || 0)}
                    className="w-24"
                  />
                  <Percent className="w-4 h-4 text-orange-600" />
                </div>
              </div>
              {percentualAcrescimo > 0 && (
                <div className="mt-2 p-2 bg-white rounded">
                  <p className="text-sm text-orange-700">
                    Valor Original: <span className="font-bold">R$ {valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </p>
                  <p className="text-sm text-orange-900 font-bold">
                    Valor com Acréscimo: R$ {(valorTotal * (1 + percentualAcrescimo / 100)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* PARCELAMENTO */}
        {formaPagamento === 'Parcelado' && (
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <Label htmlFor="numero-parcelas-select">Número de Parcelas:</Label>
              <Select
                value={numeroParcelas.toString()}
                onValueChange={(v) => setNumeroParcelas(parseInt(v))}
              >
                <SelectTrigger id="numero-parcelas-select" className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                    <SelectItem key={n} value={n.toString()}>
                      {n}x
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {numeroParcelas > 0 && (
                <span className="text-sm text-slate-600">
                  de R$ {((valorTotal * (1 + percentualAcrescimo / 100)) / numeroParcelas).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              )}
            </div>

            {parcelas.length > 0 && (
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-purple-600" />
                    Parcelas Geradas
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3">
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {parcelas.map((parcela, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                        <span className="text-sm font-medium">Parcela {parcela.numero_parcela}/{numeroParcelas}</span>
                        <span className="text-sm text-slate-700">
                          Vencimento: {new Date(parcela.data_vencimento).toLocaleDateString('pt-BR')}
                        </span>
                        <span className="font-semibold text-sm">
                          R$ {parcela.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* RESUMO DE FORMAS DISPONÍVEIS */}
        {formaPagamento === undefined && formasAtivas.length > 0 && (
          <>
            <Separator />
            <h4 className="font-semibold text-base mb-2">Selecione uma Forma de Pagamento</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {formasAtivas.slice(0, 8).map(forma => (
                <Button
                  key={forma.id}
                  type="button"
                  variant="outline"
                  onClick={() => onFormaPagamentoChange(forma.tipo)}
                  className="h-auto py-3 flex flex-col items-center gap-1 text-center"
                >
                  <span className="text-lg">{forma.icone || '💰'}</span>
                  <span className="text-xs font-medium">{forma.descricao}</span>
                </Button>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
