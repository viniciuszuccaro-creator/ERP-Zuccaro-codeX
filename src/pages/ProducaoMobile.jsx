
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import {
  Factory,
  Clock,
  CheckCircle,
  AlertCircle,
  Camera,
  ArrowLeft,
  Send,
  Package,
  User,
  TrendingUp,
  QrCode
} from "lucide-react";

/**
 * Tela Mobile/Tablet para Apontamento de Produção
 * Interface simplificada para chão de fábrica
 */
export default function ProducaoMobile() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [user, setUser] = useState(null);
  const [opSelecionada, setOpSelecionada] = useState(null);
  const [itemSelecionado, setItemSelecionado] = useState(null);
  const [apontamentoAberto, setApontamentoAberto] = useState(false); // NOVO: Estado para controlar se o formulário de apontamento está aberto

  const [apontamento, setApontamento] = useState({
    setor: "Em Corte",
    quantidade_produzida: 0,
    peso_produzido_kg: 0,
    tempo_minutos: 0,
    observacoes: ""
  });

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: ops = [], isLoading } = useQuery({
    queryKey: ['ops-mobile', user?.empresa_atual_id],
    queryFn: async () => {
      const todas = await base44.entities.OrdemProducao.list('-created_date');
      return todas.filter(op => 
        op.empresa_id === user?.empresa_atual_id &&
        ['Liberada', 'Em Corte', 'Em Dobra', 'Em Armação', 'Aguardando Matéria-Prima'].includes(op.status)
      );
    },
    enabled: !!user?.empresa_atual_id,
  });

  const apontarMutation = useMutation({
    mutationFn: async (/** @type {typeof apontamento} */ dados) => {
      const novoApontamento = {
        data_hora: new Date().toISOString(),
        operador: user?.full_name || "Operador",
        operador_id: user?.id,
        item_elemento: itemSelecionado.elemento,
        setor: dados.setor,
        quantidade_produzida: dados.quantidade_produzida,
        peso_produzido_kg: dados.peso_produzido_kg,
        tempo_minutos: dados.tempo_minutos,
        observacoes: dados.observacoes,
        tipo: "Andamento"
      };

      const apontamentosAtuais = opSelecionada.apontamentos || [];
      const itensAtualizados = (opSelecionada.itens_producao || []).map(item => {
        if (item.elemento === itemSelecionado.elemento) {
          return {
            ...item,
            apontado: true,
            data_apontamento: new Date().toISOString(),
            operador_apontamento: user?.full_name,
            peso_real_total: (item.peso_real_total || 0) + dados.peso_produzido_kg
          };
        }
        return item;
      });

      const itensConcluidos = itensAtualizados.filter(i => i.apontado).length;
      const percentual = opSelecionada.itens_producao?.length > 0
        ? Math.round((itensConcluidos / opSelecionada.itens_producao.length) * 100)
        : 0;

      await base44.entities.OrdemProducao.update(opSelecionada.id, {
        apontamentos: [...apontamentosAtuais, novoApontamento],
        itens_producao: itensAtualizados,
        peso_real_total_kg: (opSelecionada.peso_real_total_kg || 0) + dados.peso_produzido_kg,
        itens_concluidos: itensConcluidos,
        percentual_conclusao: percentual,
        status: percentual === 100 ? "Em Conferência" : dados.setor,
        data_inicio_real: opSelecionada.data_inicio_real || new Date().toISOString()
      });

      // Baixa de estoque (se configurado)
      // TODO: implementar quando configuração estiver ativa

      return { sucesso: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ops-mobile'] });
      setItemSelecionado(null);
      setApontamento({
        setor: "Em Corte",
        quantidade_produzida: 0,
        peso_produzido_kg: 0,
        tempo_minutos: 0,
        observacoes: ""
      });
      toast({
        title: "✅ Apontamento registrado!",
        description: "Produção atualizada com sucesso"
      });
    },
  });

  const finalizarEEnviarMutation = useMutation({
    mutationFn: async (/** @type {string} */ opId) => {
      const op = ops.find(o => o.id === opId);

      // Criar entrega
      const novaEntrega = await base44.entities.Entrega.create({
        group_id: op.group_id,
        empresa_id: op.empresa_id,
        pedido_id: op.pedido_id,
        numero_pedido: op.numero_pedido,
        op_id: op.id,
        cliente_id: op.cliente_id,
        cliente_nome: op.cliente_nome,
        endereco_entrega_completo: {},
        data_previsao: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        peso_total_kg: op.peso_real_total_kg,
        status: "Pronto para Expedir",
        qr_code: `QR-${Date.now()}`,
        historico_status: [{
          status: "Pronto para Expedir",
          data_hora: new Date().toISOString(),
          usuario: user?.full_name || "Sistema",
          observacao: `Finalizado via mobile por ${user?.full_name}`
        }]
      });

      await base44.entities.OrdemProducao.update(opId, {
        status: "Expedida",
        entrega_id: novaEntrega.id
      });

      return novaEntrega;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ops-mobile'] });
      setOpSelecionada(null);
      toast({
        title: "✅ Enviado para expedição!",
        description: "OP finalizada com sucesso"
      });
    },
  });

  const handleSubmitApontamento = (e) => {
    e.preventDefault();
    
    if (!apontamento.quantidade_produzida || apontamento.quantidade_produzida <= 0) {
      toast({
        title: "⚠️ Informe a quantidade",
        variant: "destructive"
      });
      return;
    }

    apontarMutation.mutate(apontamento);
  };

  // NOVO: Função para escanear QR Code
  const handleEscanearQR = () => {
    // Em produção, isso abriria a câmera para escanear QR Code da etiqueta
    toast({
      title: "📷 Escaneamento QR",
      description: "Funcionalidade de escaneamento de QR Code será implementada aqui em produção.",
      duration: 3000,
    });
  };

  // TELA: Lista de OPs
  if (!opSelecionada) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-800 to-slate-900 p-4">
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Header */}
          <div className="bg-blue-600 text-white p-6 rounded-xl shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <Factory className="w-8 h-8" />
                <div>
                  <h1 className="text-2xl font-bold">Apontamento</h1>
                  <p className="text-blue-100 text-sm">Chão de Fábrica</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-blue-100">Operador</p>
                <p className="font-semibold">{user?.full_name}</p>
              </div>
            </div>
            {/* NOVO: Botão Escanear QR */}
            <div className="mt-4">
              <Button
                onClick={handleEscanearQR}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                size="lg"
              >
                <QrCode className="w-5 h-5 mr-2" />
                Escanear QR para iniciar
              </Button>
            </div>
          </div>


          {/* Lista de OPs */}
          <div className="space-y-3">
            {isLoading ? (
              <Card className="bg-white/90">
                <CardContent className="p-8 text-center">
                  <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p className="text-slate-600">Carregando ordens...</p>
                </CardContent>
              </Card>
            ) : ops.length === 0 ? (
              <Card className="bg-white/90">
                <CardContent className="p-12 text-center text-slate-500">
                  <Package className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg">Nenhuma OP disponível</p>
                  <p className="text-sm mt-2">Aguarde novas ordens de produção</p>
                </CardContent>
              </Card>
            ) : (
              ops.map(op => (
                <Card
                  key={op.id}
                  className="bg-white/95 hover:bg-white cursor-pointer transition-all"
                  onClick={() => setOpSelecionada(op)}
                >
                  <CardContent className="p-5">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="text-2xl font-bold text-blue-600">{op.numero_op}</p>
                        <p className="text-sm text-slate-600">Pedido: {op.numero_pedido}</p>
                      </div>
                      <Badge className={
                        op.prioridade === 'Urgente' ? 'bg-red-500' :
                        op.prioridade === 'Alta' ? 'bg-orange-500' :
                        'bg-slate-500'
                      }>
                        {op.prioridade}
                      </Badge>
                    </div>

                    <p className="font-semibold text-slate-900 mb-2">{op.cliente_nome}</p>

                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex-1 bg-slate-200 rounded-full h-3">
                        <div
                          className="bg-blue-600 h-3 rounded-full transition-all"
                          style={{ width: `${op.percentual_conclusao || 0}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-semibold text-blue-600">
                        {op.percentual_conclusao || 0}%
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-sm">
                      <Badge variant="outline">{op.status}</Badge>
                      <span className="text-slate-600">
                        {op.itens_producao?.length || 0} itens
                      </span>
                    </div>

                    {op.alerta_falta_estoque && (
                      <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-600" />
                        <span className="text-xs text-red-700">Falta material</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  // TELA: Itens da OP (seleção)
  if (opSelecionada && !itemSelecionado) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-800 to-slate-900 p-4">
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Header com voltar */}
          <div className="bg-blue-600 text-white p-6 rounded-xl shadow-lg">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOpSelecionada(null)}
              className="text-white hover:bg-blue-700 mb-3"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Voltar
            </Button>
            <h2 className="text-2xl font-bold">{opSelecionada.numero_op}</h2>
            <p className="text-blue-100">{opSelecionada.cliente_nome}</p>
            <div className="flex items-center gap-2 mt-3">
              <div className="flex-1 bg-blue-700 rounded-full h-2">
                <div
                  className="bg-white h-2 rounded-full"
                  style={{ width: `${opSelecionada.percentual_conclusao || 0}%` }}
                ></div>
              </div>
              <span className="font-bold">{opSelecionada.percentual_conclusao || 0}%</span>
            </div>
          </div>

          {/* Info */}
          <Card className="bg-white/90">
            <CardContent className="p-5">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Pedido</p>
                  <p className="font-semibold">{opSelecionada.numero_pedido}</p>
                </div>
                <div>
                  <p className="text-slate-500">Status</p>
                  <Badge>{opSelecionada.status}</Badge>
                </div>
                <div>
                  <p className="text-slate-500">Peso Teórico</p>
                  <p className="font-semibold">{opSelecionada.peso_teorico_total_kg?.toFixed(1)} kg</p>
                </div>
                <div>
                  <p className="text-slate-500">Peso Real</p>
                  <p className="font-semibold text-green-600">{opSelecionada.peso_real_total_kg?.toFixed(1) || 0} kg</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lista de Itens */}
          <div className="space-y-3">
            <h3 className="text-white font-bold text-lg px-2">Selecione o item:</h3>
            {(opSelecionada.itens_producao || []).map((item, idx) => (
              <Card
                key={idx}
                className={`${
                  item.apontado 
                    ? 'bg-green-50 border-2 border-green-300' 
                    : 'bg-white/95 hover:bg-white cursor-pointer'
                } transition-all`}
                onClick={() => !item.apontado && setItemSelecionado(item)}
              >
                <CardContent className="p-5">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-xl font-bold text-slate-900">{item.elemento}</p>
                      <p className="text-sm text-slate-600">{item.tipo_peca}</p>
                    </div>
                    {item.apontado ? (
                      <Badge className="bg-green-600">
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Concluído
                      </Badge>
                    ) : (
                      <Badge variant="outline">Pendente</Badge>
                    )}
                  </div>

                  <p className="text-sm text-slate-700 mb-2">
                    {item.descricao_automatica || `${item.quantidade_pecas} peça(s)`}
                  </p>

                  <div className="flex gap-4 text-xs text-slate-600">
                    <span>Bitola: {item.bitola_principal}</span>
                    <span>Peso: {item.peso_teorico_total?.toFixed(1)} kg</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Botão Finalizar */}
          {opSelecionada.percentual_conclusao === 100 && (
            <Button
              className="w-full h-16 bg-green-600 hover:bg-green-700 text-lg"
              onClick={() => finalizarEEnviarMutation.mutate(opSelecionada.id)}
              disabled={finalizarEEnviarMutation.isPending}
            >
              <Send className="w-6 h-6 mr-3" />
              {finalizarEEnviarMutation.isPending ? 'Enviando...' : 'Finalizar e Enviar p/ Expedição'}
            </Button>
          )}
        </div>
      </div>
    );
  }

  // TELA: Formulário de Apontamento
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 to-slate-900 p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <div className="bg-blue-600 text-white p-6 rounded-xl shadow-lg">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setItemSelecionado(null)}
            className="text-white hover:bg-blue-700 mb-3"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Voltar
          </Button>
          <h2 className="text-2xl font-bold">{opSelecionada.numero_op}</h2>
          <p className="text-blue-100 text-lg">{itemSelecionado.elemento} - {itemSelecionado.tipo_peca}</p>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmitApontamento} className="space-y-4">
          <Card className="bg-white/95">
            <CardHeader className="bg-slate-50 border-b">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-6 h-6 text-blue-600" />
                Registrar Produção
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              <div>
                <Label className="text-base mb-2 block">Setor *</Label>
                <Select
                  value={apontamento.setor}
                  onValueChange={(v) => setApontamento({ ...apontamento, setor: v })}
                >
                  <SelectTrigger className="h-14 text-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Em Corte" className="text-lg py-3">🔪 Corte</SelectItem>
                    <SelectItem value="Em Dobra" className="text-lg py-3">🔧 Dobra</SelectItem>
                    <SelectItem value="Em Armação" className="text-lg py-3">🏗️ Armação</SelectItem>
                    <SelectItem value="Em Conferência" className="text-lg py-3">✅ Conferência</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-base mb-2 block">Quantidade Produzida *</Label>
                <Input
                  type="number"
                  value={apontamento.quantidade_produzida}
                  onChange={(e) => setApontamento({ ...apontamento, quantidade_produzida: parseInt(e.target.value) })}
                  className="h-14 text-2xl font-bold text-center"
                  placeholder="0"
                  required
                />
                <p className="text-sm text-slate-500 mt-2">
                  Total previsto: {itemSelecionado.quantidade_pecas} peças
                </p>
              </div>

              <div>
                <Label className="text-base mb-2 block">Peso Produzido (kg)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={apontamento.peso_produzido_kg}
                  onChange={(e) => setApontamento({ ...apontamento, peso_produzido_kg: parseFloat(e.target.value) })}
                  className="h-14 text-2xl font-bold text-center"
                  placeholder="0.0"
                />
                <p className="text-sm text-slate-500 mt-2">
                  Peso teórico: {itemSelecionado.peso_teorico_total?.toFixed(2)} kg
                </p>
              </div>

              <div>
                <Label className="text-base mb-2 block">Tempo Gasto (minutos)</Label>
                <Input
                  type="number"
                  value={apontamento.tempo_minutos}
                  onChange={(e) => setApontamento({ ...apontamento, tempo_minutos: parseInt(e.target.value) })}
                  className="h-14 text-xl text-center"
                  placeholder="0"
                />
              </div>

              <div>
                <Label className="text-base mb-2 block">Observações</Label>
                <Textarea
                  value={apontamento.observacoes}
                  onChange={(e) => setApontamento({ ...apontamento, observacoes: e.target.value })}
                  className="min-h-24 text-base"
                  placeholder="Alguma observação sobre esta produção..."
                  rows={3}
                />
              </div>

              {/* Foto (preparado) */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <Button type="button" variant="outline" className="w-full h-12" disabled>
                  <Camera className="w-5 h-5 mr-2" />
                  Tirar Foto (em breve)
                </Button>
                <p className="text-xs text-blue-700 text-center mt-2">
                  Função de foto em desenvolvimento
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Botões */}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1 h-14 bg-white text-lg"
              onClick={() => setItemSelecionado(null)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1 h-14 bg-green-600 hover:bg-green-700 text-lg"
              disabled={apontarMutation.isPending}
            >
              {apontarMutation.isPending ? 'Salvando...' : 'Registrar'}
            </Button>
          </div>
        </form>

        {/* Info do Operador */}
        <Card className="bg-white/90">
          <CardContent className="p-4 flex items-center gap-3">
            <User className="w-5 h-5 text-slate-600" />
            <div className="flex-1">
              <p className="text-xs text-slate-500">Apontando como</p>
              <p className="font-semibold text-slate-900">{user?.full_name}</p>
            </div>
            <p className="text-xs text-slate-500">
              {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
