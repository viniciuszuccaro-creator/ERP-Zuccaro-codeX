import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, Package, Wrench } from 'lucide-react';
import AdicionarItemRevendaModal from '../AdicionarItemRevendaModal';
import ItemProducaoForm from '../ItemProducaoForm';

export default function WizardEtapa2Itens({ dados, onChange }) {
  const [modalRevenda, setModalRevenda] = useState(false);
  const [modalProducao, setModalProducao] = useState(false);

  const totalItens = (dados.itens_revenda?.length || 0) + (dados.itens_producao?.length || 0);

  const removerItemRevenda = (index) => {
    const novosItens = [...(dados.itens_revenda || [])];
    novosItens.splice(index, 1);
    onChange({ itens_revenda: novosItens });
  };

  const removerItemProducao = (index) => {
    const novosItens = [...(dados.itens_producao || [])];
    novosItens.splice(index, 1);
    onChange({ itens_producao: novosItens });
  };

  return (
    <div className="space-y-6">
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader className="bg-white/80 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Itens do Pedido</CardTitle>
            <Badge className="bg-blue-600 text-white">
              {totalItens} {totalItens === 1 ? 'item' : 'itens'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <Tabs defaultValue="revenda">
            <TabsList className="w-full">
              <TabsTrigger value="revenda" className="flex-1">
                <Package className="w-4 h-4 mr-2" />
                Revenda ({dados.itens_revenda?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="producao" className="flex-1">
                <Wrench className="w-4 h-4 mr-2" />
                Produção ({dados.itens_producao?.length || 0})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="revenda" className="space-y-3 mt-4">
              <Button
                onClick={() => setModalRevenda(true)}
                variant="outline"
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Item de Revenda
              </Button>

              {(dados.itens_revenda || []).map((item, idx) => (
                <div key={idx} className="p-3 bg-white border rounded-lg">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{item.descricao}</p>
                      <p className="text-xs text-slate-600">
                        Qtd: {item.quantidade} {item.unidade} × R$ {item.preco_unitario?.toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-green-600">
                        R$ {item.valor_item?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-600"
                        onClick={() => removerItemRevenda(idx)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="producao" className="space-y-3 mt-4">
              <Button
                onClick={() => setModalProducao(true)}
                variant="outline"
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Item de Produção
              </Button>

              {(dados.itens_producao || []).map((item, idx) => (
                <div key={idx} className="p-3 bg-white border rounded-lg">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{item.tipo_peca} - {item.identificador}</p>
                      <p className="text-xs text-slate-600">
                        Qtd: {item.quantidade} | {item.comprimento}cm × {item.largura}cm
                      </p>
                      <p className="text-xs text-slate-500">
                        Bitola: {item.ferro_principal_bitola} | {item.peso_total_kg}kg
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-green-600">
                        R$ {item.preco_venda_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-600"
                        onClick={() => removerItemProducao(idx)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Modais */}
      {modalRevenda && (
        <AdicionarItemRevendaModal
          isOpen={modalRevenda}
          onClose={() => setModalRevenda(false)}
          onAddItem={(item) => {
            const novosItens = [...(dados.itens_revenda || []), item];
            onChange({ itens_revenda: novosItens });
            setModalRevenda(false);
          }}
        />
      )}

      {modalProducao && (
        <ItemProducaoForm
          onSubmit={(item) => {
            const novosItens = [...(dados.itens_producao || []), item];
            onChange({ itens_producao: novosItens });
            setModalProducao(false);
          }}
          onCancel={() => setModalProducao(false)}
        />
      )}
    </div>
  );
}