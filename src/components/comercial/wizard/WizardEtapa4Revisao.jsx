import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, AlertTriangle, User, MapPin, Package, DollarSign } from 'lucide-react';

export default function WizardEtapa4Revisao({ dados, clientes }) {
  const cliente = clientes?.find(c => c.id === dados.cliente_id);
  const totalItens = (dados.itens_revenda?.length || 0) + (dados.itens_producao?.length || 0);

  const alertas = [];
  if (!dados.cliente_id) alertas.push('Cliente não selecionado');
  if (totalItens === 0) alertas.push('Nenhum item adicionado');
  if (!dados.forma_pagamento) alertas.push('Forma de pagamento não definida');

  return (
    <div className="space-y-6">
      {alertas.length > 0 && (
        <Alert className="border-orange-300 bg-orange-50">
          <AlertTriangle className="w-5 h-5 text-orange-600" />
          <AlertDescription>
            <p className="font-semibold text-orange-900 mb-2">Atenção:</p>
            <ul className="list-disc list-inside text-sm text-orange-800 space-y-1">
              {alertas.map((alerta, idx) => (
                <li key={idx}>{alerta}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {alertas.length === 0 && (
        <Alert className="border-green-300 bg-green-50">
          <CheckCircle2 className="w-5 h-5 text-green-600" />
          <AlertDescription>
            <p className="font-semibold text-green-900">
              ✅ Pedido pronto para finalizar!
            </p>
          </AlertDescription>
        </Alert>
      )}

      {/* Resumo Cliente */}
      <Card>
        <CardHeader className="bg-slate-50 border-b">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="w-5 h-5 text-blue-600" />
            Cliente
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <p className="font-semibold">{dados.cliente_nome || '-'}</p>
          <p className="text-sm text-slate-600">{dados.cliente_cpf_cnpj || '-'}</p>
        </CardContent>
      </Card>

      {/* Resumo Entrega */}
      <Card>
        <CardHeader className="bg-slate-50 border-b">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="w-5 h-5 text-green-600" />
            Endereço de Entrega
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {dados.endereco_entrega_principal ? (
            <>
              <p className="font-semibold text-sm">
                {dados.endereco_entrega_principal.logradouro}, {dados.endereco_entrega_principal.numero}
              </p>
              <p className="text-sm text-slate-600">
                {dados.endereco_entrega_principal.bairro} - {dados.endereco_entrega_principal.cidade}/{dados.endereco_entrega_principal.estado}
              </p>
              <p className="text-sm text-slate-600">
                CEP: {dados.endereco_entrega_principal.cep}
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-500">Não definido</p>
          )}
        </CardContent>
      </Card>

      {/* Resumo Itens */}
      <Card>
        <CardHeader className="bg-slate-50 border-b">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="w-5 h-5 text-sky-600" />
            Itens ({totalItens})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-2">
          {(dados.itens_revenda || []).map((item, idx) => (
            <div key={idx} className="flex justify-between text-sm">
              <span>{item.quantidade}x {item.descricao}</span>
              <span className="font-semibold">R$ {item.valor_item?.toLocaleString('pt-BR')}</span>
            </div>
          ))}
          {(dados.itens_producao || []).map((item, idx) => (
            <div key={idx} className="flex justify-between text-sm">
              <span>{item.quantidade}x {item.tipo_peca} ({item.identificador})</span>
              <span className="font-semibold">R$ {item.preco_venda_total?.toLocaleString('pt-BR')}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Resumo Financeiro */}
      <Card className="border-2 border-green-300 bg-gradient-to-br from-green-50 to-blue-50">
        <CardHeader className="bg-white/80 border-b">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            Resumo Financeiro
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <div className="flex justify-between">
            <span className="text-sm">Forma de Pagamento:</span>
            <Badge variant="outline">{dados.forma_pagamento || '-'}</Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-sm">Condição:</span>
            <Badge variant="outline">{dados.condicao_pagamento || '-'}</Badge>
          </div>
          {dados.valor_frete > 0 && (
            <div className="flex justify-between text-sm">
              <span>Frete:</span>
              <span>R$ {dados.valor_frete.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
          )}
          <div className="border-t pt-3 flex justify-between items-center">
            <span className="font-semibold">Valor Total:</span>
            <span className="text-3xl font-bold text-green-600">
              R$ {(dados.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}