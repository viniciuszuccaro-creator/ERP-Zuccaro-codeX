import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Package, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import usePermissions from '@/components/lib/usePermissions';
import { useContextoVisual } from '@/components/lib/useContextoVisual';

const sanitizeText = (value, max = 500) => String(value ?? '').replace(/[<>]/g, '').slice(0, max).trim();
const toNumber = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

/**
 * Criação de etapa de entrega a partir do pedido — RBAC fail-closed + sanitização.
 * Não gera MASTER_CODE; etapa é subdocumento do pedido.
 */
export default function CriarEtapaEntregaForm({ pedidoData, onCriarEtapa, windowMode = false }) {
  const { canCreate, canEdit } = usePermissions();
  const { empresaAtual, grupoAtual } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || pedidoData?.group_id || null;
  const contextoValido = Boolean(empresaAtual?.id || groupId || pedidoData?.empresa_id || pedidoData?.group_id);
  const podeCriar = canCreate('Comercial', 'Pedido') || canCreate('Comercial', 'Entrega') || canEdit('Comercial', 'Pedido') || canCreate('Comercial', null);

  const [etapaForm, setEtapaForm] = useState({
    nome_etapa: '',
    descricao_etapa: '',
    data_prevista_entrega: '',
    itens_selecionados: []
  });

  const itensDisponiveis = [
    ...(pedidoData?.itens_revenda || []).map((item, idx) => ({
      id: `revenda-${idx}`,
      origem: 'revenda',
      descricao: item.descricao,
      quantidade: item.quantidade,
      peso_kg: (item.peso_unitario || 0) * (item.quantidade || 0),
      valor: item.valor_item || 0,
      unidade: item.unidade_medida
    })),
    ...(pedidoData?.itens_armado_padrao || []).map((item, idx) => ({
      id: `armado-${idx}`,
      origem: 'armado_padrao',
      descricao: item.descricao_automatica || `Armado ${item.tipo_peca}`,
      quantidade: item.quantidade || 0,
      peso_kg: item.peso_total_kg || 0,
      valor: item.preco_venda_total || 0,
      unidade: 'PC'
    })),
    ...(pedidoData?.itens_corte_dobra || []).map((item, idx) => ({
      id: `corte-${idx}`,
      origem: 'corte_dobra',
      descricao: `${item.tipo_peca || 'Peça'} - ${item.elemento}`,
      quantidade: item.quantidade || 0,
      peso_kg: item.peso_total_kg || 0,
      valor: item.preco_venda_total || 0,
      unidade: 'PC'
    }))
  ].filter(item => {
    const jaUsado = (pedidoData?.etapas_entrega || []).some(etapa =>
      (etapa.itens_etapa || []).some(ei => ei.item_pedido_id === item.id)
    );
    return !jaUsado;
  });

  const toggleItem = (itemId) => {
    if (!podeCriar) return;
    setEtapaForm(prev => {
      const selecionados = prev.itens_selecionados.includes(itemId)
        ? prev.itens_selecionados.filter(id => id !== itemId)
        : [...prev.itens_selecionados, itemId];
      return { ...prev, itens_selecionados: selecionados };
    });
  };

  const calcularTotais = () => {
    const itensSelecionados = itensDisponiveis.filter(i =>
      etapaForm.itens_selecionados.includes(i.id)
    );

    return {
      quantidade: itensSelecionados.length,
      peso: itensSelecionados.reduce((sum, i) => sum + toNumber(i.peso_kg, 0), 0),
      valor: itensSelecionados.reduce((sum, i) => sum + toNumber(i.valor, 0), 0)
    };
  };

  const handleCriar = () => {
    if (!contextoValido) {
      toast.error('Selecione um grupo ou empresa antes de criar a etapa.');
      return;
    }
    if (!podeCriar) {
      toast.error('Sem permissão para criar etapa de entrega.');
      return;
    }
    if (!sanitizeText(etapaForm.nome_etapa, 160)) {
      toast.error('Informe o nome da etapa');
      return;
    }

    if (etapaForm.itens_selecionados.length === 0) {
      toast.error('Selecione pelo menos um item');
      return;
    }

    const itensSelecionados = itensDisponiveis.filter(i =>
      etapaForm.itens_selecionados.includes(i.id)
    );

    const totais = calcularTotais();

    const novaEtapa = {
      id: `etapa-${Date.now()}`,
      nome_etapa: sanitizeText(etapaForm.nome_etapa, 160),
      descricao_etapa: sanitizeText(etapaForm.descricao_etapa, 1000),
      data_prevista_entrega: etapaForm.data_prevista_entrega || '',
      itens_etapa: itensSelecionados.map(i => ({
        item_pedido_id: i.id,
        origem_item: i.origem,
        descricao: sanitizeText(i.descricao, 240),
        quantidade: toNumber(i.quantidade, 0),
        peso_kg: toNumber(i.peso_kg, 0),
        valor_item: toNumber(i.valor, 0)
      })),
      quantidade_total_itens: totais.quantidade,
      peso_total_etapa_kg: totais.peso,
      valor_total_etapa: totais.valor,
      status_etapa: 'Pendente',
      faturada: false,
      visivel_portal: true,
      group_id: pedidoData?.group_id || groupId || undefined,
      empresa_id: pedidoData?.empresa_id || empresaAtual?.id || undefined,
    };

    onCriarEtapa?.(novaEtapa);
    toast.success('Etapa criada');
    setEtapaForm({
      nome_etapa: '',
      descricao_etapa: '',
      data_prevista_entrega: '',
      itens_selecionados: []
    });
  };

  const totais = calcularTotais();
  const podeSubmit = podeCriar && contextoValido && Boolean(etapaForm.nome_etapa) && etapaForm.itens_selecionados.length > 0;

  const content = (
    <div className={`space-y-4 w-full ${windowMode ? 'p-6 h-full overflow-auto' : ''}`}>
      {!contextoValido && (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertDescription className="text-sm text-amber-900">
            Selecione um grupo ou empresa para criar etapas de entrega.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label>Nome da Etapa *</Label>
          <Input
            value={etapaForm.nome_etapa}
            onChange={(e) => setEtapaForm(prev => ({ ...prev, nome_etapa: e.target.value }))}
            placeholder="Ex: Etapa 1 - Fundação"
            className="mt-1"
            disabled={!podeCriar}
            data-permission="Comercial.Pedido.editar"
            data-action="editar-nome-etapa-entrega"
            data-sensitive
          />
        </div>

        <div className="col-span-2">
          <Label>Descrição</Label>
          <Textarea
            value={etapaForm.descricao_etapa}
            onChange={(e) => setEtapaForm(prev => ({ ...prev, descricao_etapa: e.target.value }))}
            placeholder="Detalhes da etapa..."
            rows={2}
            className="mt-1"
            disabled={!podeCriar}
            data-permission="Comercial.Pedido.editar"
            data-action="editar-descricao-etapa-entrega"
          />
        </div>

        <div>
          <Label>Data Prevista de Entrega</Label>
          <Input
            type="date"
            value={etapaForm.data_prevista_entrega}
            onChange={(e) => setEtapaForm(prev => ({ ...prev, data_prevista_entrega: e.target.value }))}
            className="mt-1"
            disabled={!podeCriar}
            data-permission="Comercial.Pedido.editar"
            data-action="editar-data-etapa-entrega"
          />
        </div>
      </div>

      <div className="border-t pt-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2 text-sky-800">
          <Package className="w-5 h-5 text-sky-600" />
          Selecione os Itens desta Etapa
        </h3>

        {itensDisponiveis.length === 0 ? (
          <Alert className="border-amber-200 bg-amber-50">
            <AlertDescription>
              Todos os itens já foram alocados em etapas. Adicione novos itens nas Abas 2, 3 ou 4.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto border rounded-lg p-2">
            {itensDisponiveis.map((item) => (
              <div
                key={item.id}
                className={`p-3 rounded border cursor-pointer transition-all ${
                  etapaForm.itens_selecionados.includes(item.id) ? 'bg-sky-50 border-sky-300' : 'bg-white hover:bg-slate-50'
                }`}
                onClick={() => toggleItem(item.id)}
                data-action="toggle-item-etapa-entrega"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <Checkbox
                      checked={etapaForm.itens_selecionados.includes(item.id)}
                      onCheckedChange={() => toggleItem(item.id)}
                      disabled={!podeCriar}
                    />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{item.descricao}</p>
                      <div className="flex items-center gap-3 text-xs text-slate-600 mt-1">
                        <span>{item.quantidade} {item.unidade}</span>
                        <span>≈ {toNumber(item.peso_kg, 0).toFixed(2)} KG</span>
                        <Badge variant="outline" className="text-xs">
                          {item.origem === 'revenda' ? 'Revenda' :
                           item.origem === 'armado_padrao' ? 'Armado' : 'Corte/Dobra'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-sky-700">
                    R$ {toNumber(item.valor, 0).toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {etapaForm.itens_selecionados.length > 0 && (
        <div className="bg-sky-50 p-4 rounded-lg border-2 border-sky-200">
          <h4 className="font-semibold text-sky-900 mb-3 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Resumo da Etapa
          </h4>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-sky-700">Itens Selecionados</p>
              <p className="text-xl font-bold text-sky-900">{totais.quantidade}</p>
            </div>
            <div>
              <p className="text-xs text-sky-700">Peso Total</p>
              <p className="text-xl font-bold text-sky-900">{totais.peso.toFixed(2)} KG</p>
            </div>
            <div>
              <p className="text-xs text-sky-700">Valor Total</p>
              <p className="text-xl font-bold text-sky-800">
                R$ {totais.valor.toLocaleString('pt-BR')}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-4 border-t sticky bottom-0 bg-white">
        <Button
          onClick={handleCriar}
          className="bg-sky-600 hover:bg-sky-700"
          disabled={!podeSubmit}
          data-permission="Comercial.Pedido.editar"
          data-action="criar-etapa-entrega"
          data-sensitive
        >
          <CheckCircle className="w-4 h-4 mr-2" />
          Criar Etapa
        </Button>
      </div>
    </div>
  );

  if (windowMode) {
    return <div className="w-full h-full bg-white">{content}</div>;
  }

  return content;
}
