
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Lock, Unlock, Save, AlertTriangle, TrendingDown, DollarSign, Clock, Settings, Package } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";

export default function ConfiguracaoProducao({ empresaId }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { empresaAtual, grupoAtual, filterInContext } = useContextoVisual();
  const { isAdmin: isPermissionAdmin, hasPermission } = usePermissions();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const isAdmin = user?.role === 'admin';
  const empresaOperacionalId = empresaId || empresaAtual?.id || null;
  const groupId = grupoAtual?.id || empresaAtual?.group_id || null;
  const contextoValido = Boolean(groupId || empresaOperacionalId);
  const contextKey = groupId ? `grupo:${groupId}` : `empresa:${empresaOperacionalId || "sem-empresa"}`;
  const podeEditarConfig = isAdmin || isPermissionAdmin() ||
    hasPermission("Produção", "Configurações", "editar") ||
    hasPermission("Produção", "ConfiguracaoProducao", "editar") ||
    hasPermission("Producao", "Configuracoes", "editar") ||
    hasPermission("Producao", "ConfiguracaoProducao", "editar");
  const podeBloquearConfig = isAdmin || isPermissionAdmin() ||
    hasPermission("Produção", "Configurações", "bloquear") ||
    hasPermission("Produção", "ConfiguracaoProducao", "bloquear") ||
    hasPermission("Producao", "Configuracoes", "bloquear") ||
    hasPermission("Producao", "ConfiguracaoProducao", "bloquear") ||
    podeEditarConfig;

  const { data: config } = useQuery({
    queryKey: ['configProducao', contextKey],
    queryFn: async () => {
      const filtro = empresaOperacionalId ? { empresa_id: empresaOperacionalId } : { group_id: groupId };
      const configs = await base44.entities.ConfiguracaoProducao.filter({
        ...filtro
      });
      return configs[0] || null;
    },
    enabled: contextoValido,
  });

  const { data: produtos = [] } = useQuery({
    queryKey: ['produtos-bitola', contextKey],
    queryFn: async () => {
      const todos = await filterInContext("Produto", {}, "descricao", 1000);
      return todos.filter(p => p.eh_bitola && p.status === 'Ativo');
    },
    enabled: contextoValido,
  });

  const [formData, setFormData] = useState({
    empresa_id: empresaOperacionalId,
    perda_aco_percentual: config?.perda_aco_percentual || 5,
    perda_arame_percentual: config?.perda_arame_percentual || 10,
    preco_aco_kg: config?.preco_aco_kg || 8.5,
    preco_arame_kg: config?.preco_arame_kg || 12.0,
    tempo_corte_por_barra: config?.tempo_corte_por_barra || 2,
    tempo_dobra_por_barra: config?.tempo_dobra_por_barra || 3,
    tempo_armacao_por_peca: config?.tempo_armacao_por_peca || 15,
    bloqueado_edicao: config?.bloqueado_edicao || false,
    
    // NOVOS CAMPOS
    gerar_op_ao_aprovar: config?.gerar_op_ao_aprovar || false,
    gerar_op_ao_faturar: config?.gerar_op_ao_faturar || false,
    permitir_op_sem_pedido: config?.permitir_op_sem_pedido || true,
    modo_integracao_estoque: config?.modo_integracao_estoque || "reserva",
    permitir_baixa_maior_teorico: config?.permitir_baixa_maior_teorico || false,
    produto_arame_recozido_id: config?.produto_arame_recozido_id || "",
    produto_sucata_id: config?.produto_sucata_id || "",
    exigir_bitola_cadastrada: config?.exigir_bitola_cadastrada || true,
    bloquear_op_sem_estoque: config?.bloquear_op_sem_estoque || false,
    gerar_etiqueta_automatica: config?.gerar_etiqueta_automatica || false,
    prazo_padrao_op_dias: config?.prazo_padrao_op_dias || 7
  });

  React.useEffect(() => {
    if (config) {
      setFormData({
        empresa_id: empresaOperacionalId,
        perda_aco_percentual: config.perda_aco_percentual || 5,
        perda_arame_percentual: config.perda_arame_percentual || 10,
        preco_aco_kg: config.preco_aco_kg || 8.5,
        preco_arame_kg: config.preco_arame_kg || 12.0,
        tempo_corte_por_barra: config.tempo_corte_por_barra || 2,
        tempo_dobra_por_barra: config.tempo_dobra_por_barra || 3,
        tempo_armacao_por_peca: config.tempo_armacao_por_peca || 15,
        bloqueado_edicao: config.bloqueado_edicao || false,
        gerar_op_ao_aprovar: config.gerar_op_ao_aprovar || false,
        gerar_op_ao_faturar: config.gerar_op_ao_faturar || false,
        permitir_op_sem_pedido: config.permitir_op_sem_pedido || true,
        modo_integracao_estoque: config.modo_integracao_estoque || "reserva",
        permitir_baixa_maior_teorico: config.permitir_baixa_maior_teorico || false,
        produto_arame_recozido_id: config.produto_arame_recozido_id || "",
        produto_sucata_id: config.produto_sucata_id || "",
        exigir_bitola_cadastrada: config.exigir_bitola_cadastrada || true,
        bloquear_op_sem_estoque: config.bloquear_op_sem_estoque || false,
        gerar_etiqueta_automatica: config.gerar_etiqueta_automatica || false,
        prazo_padrao_op_dias: config.prazo_padrao_op_dias || 7
      });
    } else {
      // If config is null initially, ensure empresa_id is set for new config creation
      setFormData(prev => ({ ...prev, empresa_id: empresaOperacionalId }));
    }
  }, [config, empresaOperacionalId]);

  const auditarConfiguracao = async ({ acao, descricao, sucesso = true, dadosNovos = null, dadosAnteriores = null, registroId = null }) => {
    try {
      await base44.entities.AuditLog.create({
        usuario: user?.full_name || user?.email || "Usuario local",
        usuario_id: user?.id || null,
        empresa_id: empresaOperacionalId || dadosNovos?.empresa_id || dadosAnteriores?.empresa_id || null,
        group_id: groupId || dadosNovos?.group_id || dadosAnteriores?.group_id || null,
        grupo_id: groupId || dadosNovos?.grupo_id || dadosAnteriores?.grupo_id || null,
        acao,
        modulo: "Produção",
        entidade: "ConfiguracaoProducao",
        registro_id: registroId || config?.id || null,
        tipo_auditoria: sucesso ? "operacional" : "seguranca",
        descricao,
        dados_anteriores: dadosAnteriores,
        dados_novos: dadosNovos,
        sucesso,
        data_hora: new Date().toISOString()
      });
    } catch (error) {
      console.warn("Falha ao auditar configuração de produção:", error);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (!contextoValido) {
        await auditarConfiguracao({ acao: "ConfiguracaoProducao.bloqueada", descricao: "Tentativa de salvar configuração sem contexto grupo/empresa.", sucesso: false, dadosNovos: data });
        throw new Error("Contexto multiempresa obrigatório.");
      }
      if (!empresaOperacionalId) {
        await auditarConfiguracao({ acao: "ConfiguracaoProducao.bloqueada", descricao: "Tentativa de salvar configuração sem empresa operacional.", sucesso: false, dadosNovos: data });
        throw new Error("Empresa operacional obrigatória.");
      }
      if (!podeEditarConfig) {
        await auditarConfiguracao({ acao: "ConfiguracaoProducao.bloqueada", descricao: "Tentativa de salvar configuração sem permissão.", sucesso: false, dadosNovos: data, dadosAnteriores: config });
        throw new Error("Seu perfil não pode editar configurações de produção.");
      }
      if (config?.bloqueado_edicao && !podeBloquearConfig) {
        await auditarConfiguracao({ acao: "ConfiguracaoProducao.bloqueada", descricao: "Tentativa de salvar configuração bloqueada sem liberação.", sucesso: false, dadosNovos: data, dadosAnteriores: config });
        throw new Error("Configurações bloqueadas por administrador.");
      }
      const historico = config?.historico_alteracoes || [];
      
      // Adicionar ao histórico
      Object.keys(data).forEach(campo => {
        // Only log changes to fields that are not blocked_edition and have changed value
        if (data[campo] !== config?.[campo] && campo !== 'bloqueado_edicao' && campo !== 'historico_alteracoes') {
          historico.push({
            data: new Date().toISOString(),
            usuario: user?.full_name,
            campo,
            valor_anterior: config?.[campo],
            valor_novo: data[campo]
          });
        }
      });

      const dadosCompletos = {
        ...data,
        empresa_id: empresaOperacionalId,
        group_id: groupId,
        grupo_id: groupId,
        chave: `config_producao_${empresaOperacionalId}`,
        tipo: "Configuração Geral",
        historico_alteracoes: historico
      };

      if (config?.id) {
        const result = await base44.entities.ConfiguracaoProducao.update(config.id, dadosCompletos);
        await auditarConfiguracao({ acao: "Edição", descricao: "Configuração de produção atualizada.", dadosNovos: result || dadosCompletos, dadosAnteriores: config, registroId: config.id });
        return result;
      } else {
        const result = await base44.entities.ConfiguracaoProducao.create(dadosCompletos);
        await auditarConfiguracao({ acao: "Criação", descricao: "Configuração de produção criada.", dadosNovos: result || dadosCompletos, registroId: result?.id });
        return result;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configProducao'] });
      toast({ title: "✅ Configurações Salvas!" });
    },
    onError: (error) => {
      toast({ title: "❌ Erro ao salvar", description: error.message, variant: "destructive" });
    },
  });

  const toggleBloquear = useMutation({
    mutationFn: async (bloquear) => {
      if (!contextoValido || !empresaOperacionalId) {
        await auditarConfiguracao({ acao: "ConfiguracaoProducao.bloqueada", descricao: "Tentativa de bloquear/desbloquear sem contexto grupo/empresa.", sucesso: false, dadosNovos: { bloquear } });
        throw new Error("Selecione grupo/empresa antes de bloquear configurações.");
      }
      if (!podeBloquearConfig) {
        await auditarConfiguracao({ acao: "ConfiguracaoProducao.bloqueada", descricao: "Tentativa de bloquear/desbloquear sem permissão.", sucesso: false, dadosNovos: { bloquear }, dadosAnteriores: config });
        throw new Error("Seu perfil não pode bloquear configurações de produção.");
      }
      const dados = {
        ...formData,
        empresa_id: empresaOperacionalId,
        group_id: groupId,
        grupo_id: groupId,
        bloqueado_edicao: bloquear,
        bloqueado_por: bloquear ? user?.full_name : null,
        bloqueado_em: bloquear ? new Date().toISOString() : null
      };
      
      if (config?.id) {
        const result = await base44.entities.ConfiguracaoProducao.update(config.id, dados);
        await auditarConfiguracao({ acao: bloquear ? "Bloqueio" : "Desbloqueio", descricao: bloquear ? "Configuração de produção bloqueada." : "Configuração de produção desbloqueada.", dadosNovos: result || dados, dadosAnteriores: config, registroId: config.id });
        return result;
      } else {
         // If there's no config yet, create one with the blocked status
        const historico = [];
        historico.push({
            data: new Date().toISOString(),
            usuario: user?.full_name,
            campo: 'bloqueado_edicao',
            valor_anterior: false,
            valor_novo: bloquear
        });
        const newConfigData = {
          ...dados,
          chave: `config_producao_${empresaOperacionalId}`,
          tipo: "Configuração Geral",
          historico_alteracoes: historico,
          empresa_id: empresaOperacionalId,
          group_id: groupId,
          grupo_id: groupId,
        };
        const result = await base44.entities.ConfiguracaoProducao.create(newConfigData);
        await auditarConfiguracao({ acao: bloquear ? "Bloqueio" : "Desbloqueio", descricao: "Configuração de produção criada com estado de bloqueio.", dadosNovos: result || newConfigData, registroId: result?.id });
        return result;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configProducao'] });
      toast({ 
        title: formData.bloqueado_edicao ? "🔓 Configurações Desbloqueadas" : "🔒 Configurações Bloqueadas",
        description: formData.bloqueado_edicao ? "Usuários comuns podem editar" : "Apenas administradores podem editar"
      });
    },
    onError: (error) => {
      toast({ title: "❌ Acesso negado", description: error.message, variant: "destructive" });
    },
  });

  const handleSalvar = () => {
    if (!contextoValido || !empresaOperacionalId) {
      toast({
        title: "❌ Contexto obrigatório",
        description: "Selecione um grupo e empresa antes de salvar.",
        variant: "destructive"
      });
      return;
    }
    if (!podeEditarConfig) {
      toast({
        title: "❌ Acesso Negado",
        description: "Seu perfil não pode editar configurações de produção",
        variant: "destructive"
      });
      return;
    }
    if (config?.bloqueado_edicao && !podeBloquearConfig) {
      toast({
        title: "❌ Acesso Negado",
        description: "Configurações bloqueadas por administrador",
        variant: "destructive"
      });
      return;
    }

    saveMutation.mutate(formData);
  };

  const isDisabled = !contextoValido || !empresaOperacionalId || !podeEditarConfig || (config?.bloqueado_edicao && !podeBloquearConfig);

  return (
    <Tabs defaultValue="perdas" className="space-y-6 w-full h-full" data-permission="Producao.ConfiguracaoProducao.editar" data-context-required="true">
      <TabsList className="bg-white border shadow-sm">
        <TabsTrigger value="perdas">
          <TrendingDown className="w-4 h-4 mr-2" />
          Perdas e Custos
        </TabsTrigger>
        <TabsTrigger value="automacao">
          <Settings className="w-4 h-4 mr-2" />
          Automação
        </TabsTrigger>
        <TabsTrigger value="estoque">
          <Package className="w-4 h-4 mr-2" />
          Integração Estoque
        </TabsTrigger>
      </TabsList>

      <TabsContent value="perdas" className="space-y-6">
        {config?.bloqueado_edicao && (
          <div className="p-4 bg-red-50 border border-red-200 rounded flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 text-red-600" />
              <div>
                <p className="font-semibold text-red-900">Configurações Bloqueadas</p>
                <p className="text-sm text-red-700">
                  Bloqueado por {config.bloqueado_por} em {new Date(config.bloqueado_em).toLocaleString('pt-BR')}
                </p>
              </div>
            </div>
            {podeBloquearConfig && (
              <Button onClick={() => toggleBloquear.mutate(false)} variant="outline" className="border-red-300" data-permission="Producao.ConfiguracaoProducao.bloquear" data-sensitive>
                <Unlock className="w-4 h-4 mr-2" />
                Desbloquear
              </Button>
            )}
          </div>
        )}

        {!config?.bloqueado_edicao && podeBloquearConfig && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Unlock className="w-5 h-5 text-blue-600" />
              <div>
                <p className="font-semibold text-blue-900">Configurações Desbloqueadas</p>
                <p className="text-sm text-blue-700">Todos os usuários podem editar estas configurações</p>
              </div>
            </div>
            <Button onClick={() => toggleBloquear.mutate(true)} variant="outline" className="border-blue-300" data-permission="Producao.ConfiguracaoProducao.bloquear" data-sensitive>
              <Lock className="w-4 h-4 mr-2" />
              Bloquear Edição
            </Button>
          </div>
        )}

        <Card>
          <CardHeader className="bg-gradient-to-r from-orange-50 to-red-50">
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-orange-600" />
              Perdas de Material
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <Label htmlFor="perda_aco">Perda de Aço (%)</Label>
                <div className="flex items-center gap-3 mt-2">
                  <Input
                    id="perda_aco"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={formData.perda_aco_percentual}
                    onChange={(e) => setFormData({ ...formData, perda_aco_percentual: parseFloat(e.target.value) || 0 })}
                    disabled={isDisabled}
                    className="text-lg font-semibold"
                  />
                  <Badge className="bg-orange-600 text-lg px-3 py-1">%</Badge>
                </div>
                <p className="text-sm text-slate-500 mt-2">
                  Percentual de perda considerado no cálculo de aço CA-50
                </p>
              </div>

              <div>
                <Label htmlFor="perda_arame">Perda de Arame Recozido (%)</Label>
                <div className="flex items-center gap-3 mt-2">
                  <Input
                    id="perda_arame"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={formData.perda_arame_percentual}
                    onChange={(e) => setFormData({ ...formData, perda_arame_percentual: parseFloat(e.target.value) || 0 })}
                    disabled={isDisabled}
                    className="text-lg font-semibold"
                  />
                  <Badge className="bg-red-600 text-lg px-3 py-1">%</Badge>
                </div>
                <p className="text-sm text-slate-500 mt-2">
                  Percentual de perda considerado no cálculo de arame
                </p>
              </div>
            </div>

            <div className="p-4 bg-yellow-50 rounded border border-yellow-200">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
                <p className="font-semibold text-yellow-900">Importante</p>
              </div>
              <p className="text-sm text-yellow-800">
                A perda é aplicada automaticamente em todos os cálculos de orçamento. 
                Valores típicos: Aço 3-7%, Arame 8-12%.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50">
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              Preços de Materiais
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <Label htmlFor="preco_aco">Preço do Aço (R$/kg)</Label>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-lg font-semibold text-slate-600">R$</span>
                  <Input
                    id="preco_aco"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.preco_aco_kg}
                    onChange={(e) => setFormData({ ...formData, preco_aco_kg: parseFloat(e.target.value) || 0 })}
                    disabled={isDisabled}
                    className="text-lg font-semibold"
                  />
                </div>
                <p className="text-sm text-slate-500 mt-2">
                  Preço médio do aço CA-50 por quilograma
                </p>
              </div>

              <div>
                <Label htmlFor="preco_arame">Preço do Arame (R$/kg)</Label>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-lg font-semibold text-slate-600">R$</span>
                  <Input
                    id="preco_arame"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.preco_arame_kg}
                    onChange={(e) => setFormData({ ...formData, preco_arame_kg: parseFloat(e.target.value) || 0 })}
                    disabled={isDisabled}
                    className="text-lg font-semibold"
                  />
                </div>
                <p className="text-sm text-slate-500 mt-2">
                  Preço médio do arame recozido 18 por quilograma
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50">
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              Tempos de Produção
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-3 gap-6">
              <div>
                <Label htmlFor="tempo_corte">Tempo de Corte (min/barra)</Label>
                <div className="flex items-center gap-3 mt-2">
                  <Input
                    id="tempo_corte"
                    type="number"
                    step="0.5"
                    min="0"
                    value={formData.tempo_corte_por_barra}
                    onChange={(e) => setFormData({ ...formData, tempo_corte_por_barra: parseFloat(e.target.value) || 0 })}
                    disabled={isDisabled}
                    className="text-lg font-semibold"
                  />
                  <Badge variant="outline">min</Badge>
                </div>
              </div>

              <div>
                <Label htmlFor="tempo_dobra">Tempo de Dobra (min/barra)</Label>
                <div className="flex items-center gap-3 mt-2">
                  <Input
                    id="tempo_dobra"
                    type="number"
                    step="0.5"
                    min="0"
                    value={formData.tempo_dobra_por_barra}
                    onChange={(e) => setFormData({ ...formData, tempo_dobra_por_barra: parseFloat(e.target.value) || 0 })}
                    disabled={isDisabled}
                    className="text-lg font-semibold"
                  />
                  <Badge variant="outline">min</Badge>
                </div>
              </div>

              <div>
                <Label htmlFor="tempo_armacao">Tempo de Armação (min/peça)</Label>
                <div className="flex items-center gap-3 mt-2">
                  <Input
                    id="tempo_armacao"
                    type="number"
                    step="1"
                    min="0"
                    value={formData.tempo_armacao_por_peca}
                    onChange={(e) => setFormData({ ...formData, tempo_armacao_por_peca: parseFloat(e.target.value) || 0 })}
                    disabled={isDisabled}
                    className="text-lg font-semibold"
                  />
                  <Badge variant="outline">min</Badge>
                </div>
              </div>
            </div>

            <p className="text-sm text-slate-500">
              Tempos médios utilizados para estimar prazos de produção e calcular custos de mão de obra.
            </p>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="automacao" className="space-y-6">
        <Card>
          <CardHeader className="bg-blue-50">
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings className="w-5 h-5 text-blue-600" />
              Geração Automática de OP
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3 p-4 bg-green-50 rounded border border-green-200">
              <input
                type="checkbox"
                id="gerar-aprovar"
                checked={formData.gerar_op_ao_aprovar}
                onChange={(e) => setFormData({ ...formData, gerar_op_ao_aprovar: e.target.checked })}
                disabled={isDisabled}
                className="w-4 h-4 text-green-600 bg-gray-100 border-gray-300 rounded focus:ring-green-500"
              />
              <div>
                <label htmlFor="gerar-aprovar" className="font-semibold text-green-900 cursor-pointer">
                  Gerar OP automaticamente ao aprovar pedido
                </label>
                <p className="text-sm text-green-700">
                  Quando o pedido for aprovado, todos os itens de produção viram OP automaticamente.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-blue-50 rounded border border-blue-200">
              <input
                type="checkbox"
                id="gerar-faturar"
                checked={formData.gerar_op_ao_faturar}
                onChange={(e) => setFormData({ ...formData, gerar_op_ao_faturar: e.target.checked })}
                disabled={isDisabled}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
              />
              <div>
                <label htmlFor="gerar-faturar" className="font-semibold text-blue-900 cursor-pointer">
                  Gerar OP automaticamente ao faturar pedido
                </label>
                <p className="text-sm text-blue-700">
                  Quando a NF-e for emitida, gera as OPs pendentes.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-purple-50 rounded border border-purple-200">
              <input
                type="checkbox"
                id="permitir-sem-pedido"
                checked={formData.permitir_op_sem_pedido}
                onChange={(e) => setFormData({ ...formData, permitir_op_sem_pedido: e.target.checked })}
                disabled={isDisabled}
                className="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500"
              />
              <div>
                <label htmlFor="permitir-sem-pedido" className="font-semibold text-purple-900 cursor-pointer">
                  Permitir criação de OP sem pedido
                </label>
                <p className="text-sm text-purple-700">
                  Permite criar OPs manuais (produção interna, testes, manutenção).
                </p>
              </div>
            </div>

            <div>
              <Label htmlFor="prazo_padrao_op_dias">Prazo Padrão de OP (dias)</Label>
              <Input
                id="prazo_padrao_op_dias"
                type="number"
                min="1"
                value={formData.prazo_padrao_op_dias}
                onChange={(e) => setFormData({ ...formData, prazo_padrao_op_dias: parseInt(e.target.value) || 0 })}
                disabled={isDisabled}
                className="mt-2"
              />
              <p className="text-sm text-slate-500 mt-1">
                Prazo padrão em dias para conclusão da OP (usado se não vier do pedido).
              </p>
            </div>

            <div className="flex items-center gap-3 p-4 bg-amber-50 rounded border border-amber-200">
              <input
                type="checkbox"
                id="gerar-etiqueta"
                checked={formData.gerar_etiqueta_automatica}
                onChange={(e) => setFormData({ ...formData, gerar_etiqueta_automatica: e.target.checked })}
                disabled={isDisabled}
                className="w-4 h-4 text-amber-600 bg-gray-100 border-gray-300 rounded focus:ring-amber-500"
              />
              <div>
                <label htmlFor="gerar-etiqueta" className="font-semibold text-amber-900 cursor-pointer">
                  Gerar etiquetas automaticamente ao criar OP
                </label>
                <p className="text-sm text-amber-700">
                  Gera etiquetas com QR Code para cada peça (função preparada).
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="estoque" className="space-y-6">
        <Card>
          <CardHeader className="bg-green-50">
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="w-5 h-5 text-green-600" />
              Integração com Estoque
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div>
              <Label className="text-base mb-3 block">Modo de Integração com Estoque *</Label>
              <Select
                value={formData.modo_integracao_estoque}
                onValueChange={(v) => setFormData({ ...formData, modo_integracao_estoque: v })}
                disabled={isDisabled}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Selecione o modo de integração..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="reserva">
                    <div className="py-1">
                      <p className="font-semibold">Somente Reserva</p>
                      <p className="text-xs text-slate-600">Reserva material mas não baixa automaticamente.</p>
                    </div>
                  </SelectItem>
                  <SelectItem value="reserva_baixa">
                    <div className="py-1">
                      <p className="font-semibold">Reserva + Baixa na Conclusão</p>
                      <p className="text-xs text-slate-600">Reserva ao criar e baixa quando concluir OP.</p>
                    </div>
                  </SelectItem>
                  <SelectItem value="manual">
                    <div className="py-1">
                      <p className="font-semibold">Baixa Manual por Apontamento</p>
                      <p className="text-xs text-slate-600">Operador informa consumo real no apontamento.</p>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div>
              <Label htmlFor="produto_arame_recozido_id">Produto Padrão: Arame Recozido 18</Label>
              <Select
                value={formData.produto_arame_recozido_id}
                onValueChange={(v) => setFormData({ ...formData, produto_arame_recozido_id: v })}
                disabled={isDisabled}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Selecione o produto..." />
                </SelectTrigger>
                <SelectContent>
                  {produtos
                    .filter(p => p.descricao?.toLowerCase().includes('arame'))
                    .map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.codigo ? `${p.codigo} - ` : ''}{p.descricao}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-slate-500 mt-1">
                Produto usado para baixa automática de arame recozido.
              </p>
            </div>

            <div>
              <Label htmlFor="produto_sucata_id">Produto Padrão: Sucata/Retalho</Label>
              <Select
                value={formData.produto_sucata_id}
                onValueChange={(v) => setFormData({ ...formData, produto_sucata_id: v })}
                disabled={isDisabled}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Selecione o produto..." />
                </SelectTrigger>
                <SelectContent>
                  {produtos
                    .filter(p => p.descricao?.toLowerCase().includes('sucata') || p.descricao?.toLowerCase().includes('retalho'))
                    .map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.codigo ? `${p.codigo} - ` : ''}{p.descricao}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-slate-500 mt-1">
                Produto usado para registrar sobras e refugo.
              </p>
            </div>

            <Separator />

            <div className="flex items-center gap-3 p-4 bg-orange-50 rounded border border-orange-200">
              <input
                type="checkbox"
                id="exigir-bitola"
                checked={formData.exigir_bitola_cadastrada}
                onChange={(e) => setFormData({ ...formData, exigir_bitola_cadastrada: e.target.checked })}
                disabled={isDisabled}
                className="w-4 h-4 text-orange-600 bg-gray-100 border-gray-300 rounded focus:ring-orange-500"
              />
              <div>
                <label htmlFor="exigir-bitola" className="font-semibold text-orange-900 cursor-pointer">
                  Exigir bitola cadastrada no estoque
                </label>
                <p className="text-sm text-orange-700">
                  Não permite criar OP com bitola que não existe no cadastro de produtos.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-red-50 rounded border border-red-200">
              <input
                type="checkbox"
                id="bloquear-sem-estoque"
                checked={formData.bloquear_op_sem_estoque}
                onChange={(e) => setFormData({ ...formData, bloquear_op_sem_estoque: e.target.checked })}
                disabled={isDisabled}
                className="w-4 h-4 text-red-600 bg-gray-100 border-gray-300 rounded focus:ring-red-500"
              />
              <div>
                <label htmlFor="bloquear-sem-estoque" className="font-semibold text-red-900 cursor-pointer">
                  Bloquear liberação de OP sem estoque disponível
                </label>
                <p className="text-sm text-red-700">
                  OP fica com status "Aguardando Matéria-Prima" se não tiver material.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-purple-50 rounded border border-purple-200">
              <input
                type="checkbox"
                id="baixa-maior"
                checked={formData.permitir_baixa_maior_teorico}
                onChange={(e) => setFormData({ ...formData, permitir_baixa_maior_teorico: e.target.checked })}
                disabled={isDisabled}
                className="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500"
              />
              <div>
                <label htmlFor="baixa-maior" className="font-semibold text-purple-900 cursor-pointer">
                  Permitir baixa de estoque maior que o teórico
                </label>
                <p className="text-sm text-purple-700">
                  Permite consumo real maior que o planejado (útil para retrabalhos).
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="p-4 bg-yellow-50 rounded border border-yellow-200">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
            <p className="font-semibold text-yellow-900">Atenção - Integração com Estoque</p>
          </div>
          <p className="text-sm text-yellow-800">
            As configurações de estoque afetam diretamente a disponibilidade de material para produção.
            Se ativar "Bloquear sem estoque", pedidos podem ficar parados aguardando compra.
          </p>
        </div>
      </TabsContent>

      {config?.historico_alteracoes && config.historico_alteracoes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Alterações</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {config.historico_alteracoes.slice(-10).reverse().map((registro, idx) => (
                <div key={idx} className="p-3 bg-slate-50 rounded border text-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">{registro.campo}</p>
                      <p className="text-slate-600">
                        De: <span className="font-mono">{typeof registro.valor_anterior === 'boolean' ? (registro.valor_anterior ? 'Sim' : 'Não') : registro.valor_anterior?.toString()}</span> → 
                        Para: <span className="font-mono text-green-600">{typeof registro.valor_novo === 'boolean' ? (registro.valor_novo ? 'Sim' : 'Não') : registro.valor_novo?.toString()}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">
                        {new Date(registro.data).toLocaleString('pt-BR')}
                      </p>
                      <p className="text-xs text-slate-600">{registro.usuario}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button
          onClick={handleSalvar}
          disabled={isDisabled || saveMutation.isPending}
          className="bg-green-600 hover:bg-green-700 min-w-[200px]"
          data-permission="Producao.ConfiguracaoProducao.editar"
          data-sensitive
        >
          <Save className="w-4 h-4 mr-2" />
          {saveMutation.isPending ? 'Salvando...' : 'Salvar Configurações'}
        </Button>
      </div>
    </Tabs>
  );
}
