import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  ChevronRight, 
  ChevronLeft, 
  CheckCircle2, 
  User,
  Package,
  DollarSign,
  FileText,
  X
} from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

// Importar etapas do wizard
import WizardEtapa1Cliente from './wizard/WizardEtapa1Cliente';
import WizardEtapa2Itens from './wizard/WizardEtapa2Itens';
import WizardEtapa3Financeiro from './wizard/WizardEtapa3Financeiro';
import WizardEtapa4Revisao from './wizard/WizardEtapa4Revisao';

/**
 * Wizard Lateral de 4 Etapas para Pedido
 * Substitui o formulário com 10 abas
 */
export default function WizardPedidoLateral({ 
  open, 
  onClose, 
  pedido, 
  clientes,
  onSubmit 
}) {
  const [etapaAtual, setEtapaAtual] = useState(1);
  const [dadosPedido, setDadosPedido] = useState(pedido || {
    numero_pedido: '',
    data_pedido: new Date().toISOString().split('T')[0],
    tipo: 'Pedido',
    tipo_pedido: 'Revenda',
    origem_pedido: 'Manual',
    status: 'Rascunho',
    valor_total: 0,
    itens_revenda: [],
    itens_producao: []
  });

  const etapas = [
    { 
      numero: 1, 
      nome: 'Cliente & Endereço', 
      icone: User,
      campos: ['cliente_id', 'endereco_entrega_principal']
    },
    { 
      numero: 2, 
      nome: 'Itens & Produtos', 
      icone: Package,
      campos: ['itens_revenda', 'itens_producao']
    },
    { 
      numero: 3, 
      nome: 'Financeiro & Pagto', 
      icone: DollarSign,
      campos: ['forma_pagamento', 'condicao_pagamento', 'valor_total']
    },
    { 
      numero: 4, 
      nome: 'Revisão & Envio', 
      icone: FileText,
      campos: []
    }
  ];

  // Validação por etapa
  const validarEtapa = (etapa) => {
    switch (etapa) {
      case 1:
        return dadosPedido.cliente_id && dadosPedido.endereco_entrega_principal?.cidade;
      case 2:
        return (dadosPedido.itens_revenda?.length > 0 || dadosPedido.itens_producao?.length > 0);
      case 3:
        return dadosPedido.forma_pagamento && dadosPedido.condicao_pagamento;
      case 4:
        return true;
      default:
        return false;
    }
  };

  const podeAvancar = validarEtapa(etapaAtual);
  const progresso = (etapaAtual / 4) * 100;

  const handleProximo = () => {
    if (etapaAtual < 4 && podeAvancar) {
      setEtapaAtual(etapaAtual + 1);
    }
  };

  const handleAnterior = () => {
    if (etapaAtual > 1) {
      setEtapaAtual(etapaAtual - 1);
    }
  };

  const handleFinalizar = () => {
    if (onSubmit) {
      onSubmit(dadosPedido);
    }
  };

  const atualizarDados = (novosDeados) => {
    setDadosPedido({ ...dadosPedido, ...novosDeados });
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto p-0" side="right">
        {/* Header Fixo */}
        <div className="sticky top-0 bg-white z-10 border-b">
          <SheetHeader className="p-6 pb-4">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-2xl">
                {pedido ? 'Editar Pedido' : 'Novo Pedido'}
              </SheetTitle>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-5 h-5" />
              </Button>
            </div>
          </SheetHeader>

          {/* Barra de Progresso */}
          <div className="px-6 pb-4">
            <div className="mb-2 flex justify-between text-sm">
              <span className="text-slate-600">Etapa {etapaAtual} de 4</span>
              <span className="font-semibold text-blue-600">{progresso.toFixed(0)}%</span>
            </div>
            <Progress value={progresso} className="h-2" />
          </div>

          {/* Steps Navigation */}
          <div className="px-6 pb-4 flex gap-2">
            {etapas.map((etapa) => {
              const Icon = etapa.icone;
              const completo = etapa.numero < etapaAtual || validarEtapa(etapa.numero);
              const ativo = etapa.numero === etapaAtual;

              return (
                <button
                  key={etapa.numero}
                  onClick={() => {
                    if (etapa.numero <= etapaAtual || completo) {
                      setEtapaAtual(etapa.numero);
                    }
                  }}
                  className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                    ativo 
                      ? 'border-blue-600 bg-blue-50' 
                      : completo
                      ? 'border-green-300 bg-green-50 hover:bg-green-100'
                      : 'border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed'
                  }`}
                  disabled={etapa.numero > etapaAtual && !completo}
                >
                  <div className="flex flex-col items-center gap-1">
                    {completo && etapa.numero !== etapaAtual ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    ) : (
                      <Icon className={`w-5 h-5 ${ativo ? 'text-blue-600' : 'text-slate-400'}`} />
                    )}
                    <span className={`text-xs font-medium ${
                      ativo ? 'text-blue-900' : completo ? 'text-green-900' : 'text-slate-500'
                    }`}>
                      {etapa.nome}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Conteúdo das Etapas */}
        <div className="p-6">
          {etapaAtual === 1 && (
            <WizardEtapa1Cliente
              formData={dadosPedido}
              setFormData={atualizarDados}
              clientes={clientes}
              onNext={handleProximo}
            />
          )}

          {etapaAtual === 2 && (
            <WizardEtapa2Itens
              dados={dadosPedido}
              onChange={atualizarDados}
            />
          )}

          {etapaAtual === 3 && (
            <WizardEtapa3Financeiro
              dados={dadosPedido}
              onChange={atualizarDados}
            />
          )}

          {etapaAtual === 4 && (
            <WizardEtapa4Revisao
              dados={dadosPedido}
              clientes={clientes}
            />
          )}
        </div>

        {/* Footer Fixo com Navegação */}
        <div className="sticky bottom-0 bg-white border-t p-6">
          <div className="flex justify-between items-center">
            <Button
              variant="outline"
              onClick={handleAnterior}
              disabled={etapaAtual === 1}
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Anterior
            </Button>

            {etapaAtual < 4 ? (
              <Button
                onClick={handleProximo}
                disabled={!podeAvancar}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Próximo
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleFinalizar}
                disabled={!podeAvancar}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Finalizar Pedido
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}