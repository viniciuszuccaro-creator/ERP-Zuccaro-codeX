import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import { useUser } from "@/components/lib/UserContext";
import usePermissions from "@/components/lib/usePermissions";
import { Clock, CheckCircle, Play, Pause, AlertTriangle } from "lucide-react";

/**
 * Apontamento de Produção - Chão de Fábrica
 */
export default function ApontamentoProducao({ opId, op, onApontamentoSalvo }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { getFiltroContexto, empresaAtual, grupoAtual } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const groupId = op?.group_id || grupoAtual?.id || empresaAtual?.group_id || null;
  const empresaId = op?.empresa_id || empresaAtual?.id || null;
  const ordemId = opId || op?.id || null;
  const contextoValido = Boolean(groupId || empresaId);
  const canApontar = hasPermission("Produção", "Apontamento", "criar") ||
    hasPermission("Produção", "Ordens Produção", "editar") ||
    hasPermission("Producao", "Apontamento", "criar") ||
    hasPermission("Producao", "Ordens Producao", "editar");

  // Assuming the first collaborator is the current user for this context.
  // In a real application, you might use a dedicated authentication hook like `useUser`.
  const { data: colaboradores = [] } = useQuery({
    queryKey: ['colaboradores', getFiltroContexto('empresa_id')],
    queryFn: () => base44.entities.Colaborador.filter(getFiltroContexto('empresa_id')),
  });
  const { user: authUser } = useUser();
  const operador = authUser || null;
  const fallbackColab = colaboradores[0];
  const operadorNome = (operador?.full_name || operador?.email || fallbackColab?.nome_completo || "Operador");
  const operadorId = (operador?.id || fallbackColab?.id || null);

  const auditarApontamento = async ({ acao, descricao, sucesso = true, dadosNovos = null, dadosAnteriores = null }) => {
    try {
      await base44.entities.AuditLog.create({
        empresa_id: empresaId || null,
        group_id: groupId || null,
        grupo_id: groupId || null,
        usuario: operadorNome,
        usuario_id: operadorId,
        acao,
        modulo: "Produção",
        entidade: "ApontamentoProducao",
        registro_id: ordemId,
        tipo_auditoria: sucesso ? "operacional" : "seguranca",
        descricao,
        dados_anteriores: dadosAnteriores,
        dados_novos: dadosNovos,
        data_hora: new Date().toISOString(),
        sucesso
      });
    } catch (error) {
      console.warn("Falha ao auditar apontamento de producao:", error);
    }
  };

  const [formApontamento, setFormApontamento] = useState({
    setor: op?.status || "Em Corte",
    item_elemento: "",
    quantidade_produzida: 0,
    peso_produzido_kg: 0,
    quantidade_refugada: 0,
    peso_refugado_kg: 0,
    motivo_refugo: "",
    tempo_minutos: 0,
    hora_inicio: "",
    hora_fim: "",
    observacoes: "",
    tipo: "Andamento"
  });

  const salvarApontamentoMutation = useMutation({
    mutationFn: async () => {
      if (!contextoValido) {
        await auditarApontamento({
          acao: "Apontamento.bloqueado",
          descricao: "Tentativa de apontamento de producao sem contexto grupo/empresa.",
          sucesso: false,
          dadosNovos: formApontamento
        });
        throw new Error("Selecione um grupo ou empresa antes de apontar produção.");
      }
      if (!canApontar) {
        await auditarApontamento({
          acao: "Apontamento.bloqueado",
          descricao: "Tentativa de apontamento de producao sem permissao.",
          sucesso: false,
          dadosNovos: formApontamento
        });
        throw new Error("Seu perfil nao possui permissao para registrar apontamento.");
      }
      if (!ordemId) throw new Error("OP obrigatoria para registrar apontamento.");

      const novoApontamento = {
        data_hora: new Date().toISOString(),
        operador: operadorNome,
        operador_id: operadorId,
        setor: formApontamento.setor,
        item_elemento: formApontamento.item_elemento,
        quantidade_produzida: formApontamento.quantidade_produzida,
        peso_produzido_kg: formApontamento.peso_produzido_kg,
        quantidade_refugada: formApontamento.quantidade_refugada || 0,
        peso_refugado_kg: formApontamento.peso_refugado_kg || 0,
        motivo_refugo: formApontamento.motivo_refugo || "",
        tempo_minutos: formApontamento.tempo_minutos,
        hora_inicio: formApontamento.hora_inicio,
        hora_fim: formApontamento.hora_fim,
        observacoes: formApontamento.observacoes,
        tipo: formApontamento.tipo
      };

      const apontamentosAtuais = op.apontamentos || [];
      const itensAtualizados = (op.itens_producao || []).map(item => {
        if (item.elemento === formApontamento.item_elemento) {
          return {
            ...item,
            apontado: true,
            data_apontamento: new Date().toISOString(),
            operador_apontamento: operadorNome,
            peso_real_total: (item.peso_real_total || 0) + formApontamento.peso_produzido_kg
          };
        }
        return item;
      });

      const itensConcluidos = itensAtualizados.filter(i => i.apontado).length;
      const percentual = op.itens_producao?.length > 0
        ? Math.round((itensConcluidos / op.itens_producao.length) * 100)
        : 0;

      // Registrar refugo se houver
      const refugosAtuais = op.refugos || [];
      const novoRefugo = formApontamento.quantidade_refugada > 0 ? {
        data: new Date().toISOString(),
        item_elemento: formApontamento.item_elemento,
        bitola: itensAtualizados.find(i => i.elemento === formApontamento.item_elemento)?.bitola_principal,
        quantidade_refugada: formApontamento.quantidade_refugada,
        peso_refugado_kg: formApontamento.peso_refugado_kg,
        motivo: formApontamento.motivo_refugo,
        operador: operadorNome,
        operador_id: operadorId,
        custo_perdido: formApontamento.peso_refugado_kg * 8.5, // Preço médio do aço
        reaproveitavel: false
      } : null;

      // Atualizar custos reais
      const custosReais = {
        material: (op.custos_reais?.material || 0) + (formApontamento.peso_produzido_kg * 8.5),
        mao_obra: (op.custos_reais?.mao_obra || 0) + (formApontamento.tempo_minutos / 60 * 50), // R$ 50/hora
        overhead: op.custos_reais?.overhead || 0,
        total: 0
      };
      custosReais.total = custosReais.material + custosReais.mao_obra + custosReais.overhead;

      const dadosAtualizados = {
        apontamentos: [...apontamentosAtuais, novoApontamento],
        itens_producao: itensAtualizados,
        peso_real_total_kg: (op.peso_real_total_kg || 0) + formApontamento.peso_produzido_kg,
        perda_kg_real: (op.perda_kg_real || 0) + formApontamento.peso_refugado_kg,
        itens_concluidos: itensConcluidos,
        percentual_conclusao: percentual,
        status: percentual === 100 ? "Em Conferência" : formApontamento.setor,
        data_inicio_real: op.data_inicio_real || new Date().toISOString(),
        custos_reais: custosReais,
        tempo_real_horas: (op.tempo_real_horas || 0) + (formApontamento.tempo_minutos / 60)
      };

      if (novoRefugo) {
        dadosAtualizados.refugos = [...refugosAtuais, novoRefugo];
        if (op.peso_teorico_total_kg > 0) {
          dadosAtualizados.perda_percentual_real =
            (((op.peso_real_total_kg || 0) + formApontamento.peso_produzido_kg) / op.peso_teorico_total_kg - 1) * 100;
        } else {
          dadosAtualizados.perda_percentual_real = 0; // Handle division by zero
        }
      }

      if (novoRefugo) {
        await base44.entities.AuditLog.create({
          empresa_id: empresaId,
          group_id: groupId,
          grupo_id: groupId,
          usuario: operadorNome,
          usuario_id: operadorId,
          acao: "Criação",
          modulo: "Produção",
          entidade: "Refugo",
          registro_id: ordemId,
          descricao: `Refugo registrado no item ${formApontamento.item_elemento} (${formApontamento.motivo_refugo || "Motivo não informado"})`,
          dados_novos: novoRefugo,
          data_hora: new Date().toISOString(),
          sucesso: true
        });
      }

       // Se concluiu 100% e modo for "reserva_baixa", baixar estoque
      if (percentual === 100 && !op.estoque_baixado) {
        const config = await base44.entities.ConfiguracaoProducao.filter({
          empresa_id: empresaId
        });

        if (config.length > 0 && config[0]?.modo_integracao_estoque === "reserva_baixa") {
          // Baixar estoque automaticamente
          const baixas = [];
          for (const material of (op.materiais_necessarios || [])) {
            const movBaixa = await base44.entities.MovimentacaoEstoque.create({
              group_id: groupId,
              empresa_id: empresaId,
              tipo_movimento: "saida",
              origem_movimento: "producao",
              origem_documento_id: ordemId,
              produto_id: material.produto_id,
              produto_descricao: material.descricao,
              quantidade: material.quantidade_kg,
              unidade_medida: material.unidade,
              documento: op.numero_op,
              motivo: "Consumo em produção",
              data_movimentacao: new Date().toISOString(),
              responsavel: operadorNome,
              responsavel_id: operadorId
            });

            await base44.entities.AuditLog.create({
              empresa_id: empresaId,
              group_id: groupId,
              grupo_id: groupId,
              usuario: operadorNome,
              usuario_id: operadorId,
              acao: "Criação",
              modulo: "Estoque",
              entidade: "MovimentacaoEstoque",
              registro_id: movBaixa.id,
              descricao: `Baixa de material na OP ${op.numero_op}`,
              dados_novos: movBaixa,
              data_hora: new Date().toISOString(),
              sucesso: true
            });
            baixas.push(movBaixa.id);

            // Atualizar produto
            const produto = await base44.entities.Produto.filter({ id: material.produto_id });
            if (produto[0]) {
              await base44.entities.Produto.update(material.produto_id, {
                estoque_atual: (produto[0].estoque_atual || 0) - material.quantidade_kg,
                estoque_reservado: (produto[0].estoque_reservado || 0) - material.quantidade_kg
              });
            }
          }

          dadosAtualizados.estoque_baixado = true;
          dadosAtualizados.baixa_estoque_ids = baixas;
        }
      }

      const opAtualizada = await base44.entities.OrdemProducao.update(ordemId, dadosAtualizados);
      await base44.entities.AuditLog.create({
        empresa_id: empresaId,
        group_id: groupId,
        grupo_id: groupId,
        usuario: operadorNome,
        usuario_id: operadorId,
        acao: "Edição",
        modulo: "Produção",
        entidade: "OrdemProducao",
        registro_id: ordemId,
        descricao: `Apontamento registrado no item ${formApontamento.item_elemento} (${formApontamento.setor})`,
        dados_anteriores: op,
        dados_novos: dadosAtualizados,
        data_hora: new Date().toISOString(),
        sucesso: true
      });
      return opAtualizada;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordens-producao'] });
      toast({ title: "✅ Apontamento registrado!" });
      onApontamentoSalvo?.();

      // Reset form
      setFormApontamento({
        setor: op?.status || "Em Corte",
        item_elemento: "",
        quantidade_produzida: 0,
        peso_produzido_kg: 0,
        quantidade_refugada: 0,
        peso_refugado_kg: 0,
        motivo_refugo: "",
        tempo_minutos: 0,
        hora_inicio: "",
        hora_fim: "",
        observacoes: "",
        tipo: "Andamento"
      });
    },
    onError: (error) => {
      toast({
        title: "❌ Erro ao registrar apontamento",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const itensDisponiveis = op?.itens_producao || [];

  return (
    <Card className="border-0 shadow-md" data-permission="Producao.Apontamento.criar" data-context-required="true">
      <CardHeader className="bg-blue-50 border-b">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-600" />
          Apontar Produção - OP {op?.numero_op}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <form onSubmit={(e) => { e.preventDefault(); salvarApontamentoMutation.mutate(); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Item / Elemento *</Label>
              <Select
                value={formApontamento.item_elemento}
                onValueChange={(v) => setFormApontamento({ ...formApontamento, item_elemento: v })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o item" />
                </SelectTrigger>
                <SelectContent>
                  {itensDisponiveis.map((item, idx) => (
                    <SelectItem key={idx} value={item.elemento}>
                      {item.elemento} - {item.descricao_automatica || item.tipo_peca}
                      {item.apontado && " ✓"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Setor *</Label>
              <Select
                value={formApontamento.setor}
                onValueChange={(v) => setFormApontamento({ ...formApontamento, setor: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Em Corte">Corte</SelectItem>
                  <SelectItem value="Em Dobra">Dobra</SelectItem>
                  <SelectItem value="Em Armação">Armação</SelectItem>
                  <SelectItem value="Em Conferência">Conferência</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Quantidade Produzida *</Label>
              <Input
                type="number"
                value={formApontamento.quantidade_produzida}
                onChange={(e) => setFormApontamento({ ...formApontamento, quantidade_produzida: parseInt(e.target.value) || 0 })}
                required
              />
            </div>

            <div>
              <Label>Peso Produzido (kg) *</Label>
              <Input
                type="number"
                step="0.01"
                value={formApontamento.peso_produzido_kg}
                onChange={(e) => setFormApontamento({ ...formApontamento, peso_produzido_kg: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>

            <div>
              <Label>Quantidade Refugada</Label>
              <Input
                type="number"
                value={formApontamento.quantidade_refugada}
                onChange={(e) => setFormApontamento({ ...formApontamento, quantidade_refugada: parseInt(e.target.value) || 0 })}
              />
            </div>

            <div>
              <Label>Peso Refugado (kg)</Label>
              <Input
                type="number"
                step="0.01"
                value={formApontamento.peso_refugado_kg}
                onChange={(e) => setFormApontamento({ ...formApontamento, peso_refugado_kg: parseFloat(e.target.value) || 0 })}
              />
            </div>

            {formApontamento.quantidade_refugada > 0 && (
              <div className="col-span-2">
                <Label>Motivo do Refugo</Label>
                <Select
                  value={formApontamento.motivo_refugo}
                  onValueChange={(v) => setFormApontamento({ ...formApontamento, motivo_refugo: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione o motivo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Corte Errado">Corte Errado</SelectItem>
                    <SelectItem value="Dobra Errada">Dobra Errada</SelectItem>
                    <SelectItem value="Falta de Material">Falta de Material</SelectItem>
                    <SelectItem value="Desenho Incorreto">Desenho Incorreto</SelectItem>
                    <SelectItem value="Falha Equipamento">Falha Equipamento</SelectItem>
                    <SelectItem value="Medida Errada">Medida Errada</SelectItem>
                    <SelectItem value="Qualidade Inferior">Qualidade Inferior</SelectItem>
                    <SelectItem value="Outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Tempo em Minutos</Label>
              <Input
                type="number"
                value={formApontamento.tempo_minutos}
                onChange={(e) => setFormApontamento({ ...formApontamento, tempo_minutos: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label>Hora Início</Label>
              <Input
                type="time"
                value={formApontamento.hora_inicio}
                onChange={(e) => setFormApontamento({ ...formApontamento, hora_inicio: e.target.value })}
              />
            </div>

            <div>
              <Label>Hora Fim</Label>
              <Input
                type="time"
                value={formApontamento.hora_fim}
                onChange={(e) => setFormApontamento({ ...formApontamento, hora_fim: e.target.value })}
              />
            </div>

            <div className="col-span-2">
              <Label>Observações</Label>
              <Textarea
                value={formApontamento.observacoes}
                onChange={(e) => setFormApontamento({ ...formApontamento, observacoes: e.target.value })}
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="submit"
              disabled={salvarApontamentoMutation.isPending || !contextoValido || !canApontar}
              className="bg-blue-600 hover:bg-blue-700"
              data-action="Producao.Apontamento.registrar"
              data-permission="Producao.Apontamento.criar"
              data-context-required="true"
              data-sensitive="true"
            >
              {salvarApontamentoMutation.isPending ? 'Salvando...' : 'Registrar Apontamento'}
            </Button>
          </div>
        </form>

        {/* Histórico de Apontamentos */}
        {op?.apontamentos && op.apontamentos.length > 0 && (
          <div className="mt-6 pt-6 border-t">
            <h3 className="font-semibold mb-3 text-sm">Histórico de Apontamentos</h3>
            <div className="space-y-2">
              {op.apontamentos
                .sort((a, b) => new Date(b.data_hora) - new Date(a.data_hora))
                .slice(0, 10)
                .map((apt, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 bg-slate-50 rounded text-sm">
                    <Clock className="w-4 h-4 text-slate-400 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <span className="font-medium">
                          {apt.item_elemento} - {apt.setor}
                        </span>
                        <span className="text-xs text-slate-500">
                          {new Date(apt.data_hora).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">
                        Produzido: {apt.quantidade_produzida} un ({apt.peso_produzido_kg} kg)
                        {apt.quantidade_refugada > 0 && ` • Refugo: ${apt.quantidade_refugada} un`}
                      </p>
                      {apt.observacoes && (
                        <p className="text-xs text-slate-500 mt-1 italic">{apt.observacoes}</p>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
