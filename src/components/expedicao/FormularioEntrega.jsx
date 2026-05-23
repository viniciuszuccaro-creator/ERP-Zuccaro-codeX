import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Phone, Calendar, Mail, Zap, CheckCircle2, AlertCircle } from "lucide-react";
import BuscaCEP from "../comercial/BuscaCEP";
import { Card } from "@/components/ui/card";
import FormWrapper from "@/components/common/FormWrapper";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { useUser } from "@/components/lib/UserContext";
import { base44 } from "@/api/base44Client";
import { toast as sonnerToast } from "sonner";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";

const normalizeEntregaFormData = (dados = {}) => ({
  ...dados,
  endereco_entrega_completo: {
    ...(dados.endereco_entrega_completo || {}),
  },
  contato_entrega: {
    ...(dados.contato_entrega || {}),
  },
});


export default function FormularioEntrega({
  formData: formDataProp,
  setFormData: setFormDataProp,
  onSubmit,
  onCancel = () => {},
  clientes = [],
  pedidos = [],
  empresasDoGrupo = [],
  estaNoGrupo = false,
  isEditing = false,
  isLoading = false,
  windowMode = false
}) {
  const [formDataState, setFormDataState] = useState(() => normalizeEntregaFormData(formDataProp));
  const formData = normalizeEntregaFormData(setFormDataProp ? formDataProp : formDataState);
  const setFormData = setFormDataProp || setFormDataState;
  const [previsaoIA, setPrevisaoIA] = useState(null);
  const [calculandoPrevisao, setCalculandoPrevisao] = useState(false);

  const queryClient = useQueryClient();
  const { toast: toastHook } = useToast();
  const { user: authUser } = useUser();
  const { empresaAtual, grupoAtual, createInContext, updateInContext } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || formData?.group_id || null;
  const empresaId = formData?.empresa_id || empresaAtual?.id || null;
  const contextoValido = Boolean(groupId || empresaId);
  const canCreateEntrega = hasPermission('Expedicao', 'Entrega', 'criar') || hasPermission('Expedicao', 'Entregas', 'criar');
  const canEditEntrega = hasPermission('Expedicao', 'Entrega', 'editar') || hasPermission('Expedicao', 'Entregas', 'editar');
  const canSaveEntrega = isEditing ? canEditEntrega : canCreateEntrega;
  const sanitizePromptValue = (value) => String(value || '').replace(/[<>]/g, '').trim();

  const auditEntrega = async ({ acao, sucesso = true, motivo = null, dadosAnteriores = null, dadosNovos = null }) => {
    try {
      await base44.entities.AuditLog.create({
        acao,
        modulo: 'Expedicao',
        entidade: 'Entrega',
        tipo_auditoria: sucesso ? 'operacional' : 'seguranca',
        usuario_id: authUser?.id || authUser?.email || null,
        usuario_nome: authUser?.full_name || authUser?.email || 'Sistema',
        group_id: groupId,
        grupo_id: groupId,
        empresa_id: empresaId,
        dados_anteriores: dadosAnteriores,
        dados_novos: dadosNovos,
        resultado: sucesso ? 'sucesso' : 'bloqueado',
        motivo,
        data_hora: new Date().toISOString()
      });
    } catch (error) {
      console.warn('Falha ao auditar entrega', error);
    }
  };

  const calcularPrevisaoEntrega = async () => {
    if (!contextoValido || !canSaveEntrega) {
      await auditEntrega({ acao: "Entrega.previsao_ia.bloqueado", sucesso: false, motivo: !contextoValido ? "contexto_obrigatorio" : "permissao_negada" });
      sonnerToast.error("Contexto ou permissao obrigatoria para calcular previsao");
      return;
    }

    if (!formData.endereco_entrega_completo?.cidade) {
      sonnerToast.error("❌ Preencha o endereço primeiro");
      return;
    }

    setCalculandoPrevisao(true);
    
    try {
      const resultado = await base44.integrations.Core.InvokeLLM({
        prompt: `Calcule a previsão de entrega para:
Cidade: ${sanitizePromptValue(formData.endereco_entrega_completo.cidade)}
Estado: ${sanitizePromptValue(formData.endereco_entrega_completo.estado)}
Peso: ${Number(formData.peso_total_kg || 0)} kg
Prioridade: ${sanitizePromptValue(formData.prioridade)}
Tipo Frete: ${sanitizePromptValue(formData.tipo_frete)}

Retorne:
- data_prevista (formato YYYY-MM-DD)
- prazo_dias (número inteiro)
- horario_previsto (HH:MM)
- confianca_percentual (0-100)`,
        response_json_schema: {
          type: "object",
          properties: {
            data_prevista: { type: "string" },
            prazo_dias: { type: "number" },
            horario_previsto: { type: "string" },
            confianca_percentual: { type: "number" }
          }
        }
      });

      await auditEntrega({
        acao: "Entrega.previsao_ia",
        sucesso: true,
        dadosNovos: { cidade: formData.endereco_entrega_completo?.cidade, estado: formData.endereco_entrega_completo?.estado, resultado }
      });

      setPrevisaoIA(resultado);
      setFormData(prev => ({
        ...prev,
        data_previsao: resultado.data_prevista
      }));
      
      sonnerToast.success("🤖 Previsão calculada com IA!");
      
    } catch (error) {
      await auditEntrega({ acao: "Entrega.previsao_ia.erro", sucesso: false, motivo: error?.message || "erro_ia" });
      sonnerToast.error("Erro ao calcular previsão");
    } finally {
      setCalculandoPrevisao(false);
    }
  };

  const createMutation = useMutation({
    mutationFn: (data) => {
      const payload = {
        ...data,
        group_id: data.group_id || groupId,
        grupo_id: data.grupo_id || data.group_id || groupId,
        empresa_id: data.empresa_id || empresaId,
        usuario_responsavel: data.usuario_responsavel || (authUser?.full_name || authUser?.email),
        usuario_responsavel_id: data.usuario_responsavel_id || authUser?.id,
      };
      return createInContext('Entrega', payload);
    },
    onSuccess: async (entregaCriada) => {
      queryClient.invalidateQueries({ queryKey: ['entregas'] });
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });

      toastHook({ title: "✅ Entrega criada!" });
      sonnerToast.success("✅ Entrega criada com sucesso!");

      try {
        await base44.entities.AuditLog.create({
          empresa_id: entregaCriada?.empresa_id,
          group_id: entregaCriada?.group_id || groupId,
          grupo_id: entregaCriada?.group_id || groupId,
          usuario: authUser?.full_name || authUser?.email,
          usuario_id: authUser?.id,
          acao: 'Criação',
          modulo: 'Expedição',
          entidade: 'Entrega',
          registro_id: entregaCriada?.id,
          descricao: 'Entrega criada via formulário',
          dados_novos: entregaCriada,
          data_hora: new Date().toISOString(),
          sucesso: true
        });
      } catch (_) {}

      onCancel();
    },
    onError: (error) => {
      toastHook({ title: "❌ Erro ao criar entrega", description: error.message, variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateInContext('Entrega', id, {
      ...data,
      group_id: data.group_id || groupId,
      grupo_id: data.grupo_id || data.group_id || groupId,
      empresa_id: data.empresa_id || empresaId,
      usuario_responsavel: data.usuario_responsavel || (authUser?.full_name || authUser?.email),
      usuario_responsavel_id: data.usuario_responsavel_id || authUser?.id,
    }),
    onSuccess: async (entregaAtualizada, variables) => {
      queryClient.invalidateQueries({ queryKey: ['entregas'] });
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });

      toastHook({ title: "✅ Entrega atualizada!" });
      sonnerToast.success("✅ Entrega atualizada!");

      try {
        await base44.entities.AuditLog.create({
          empresa_id: entregaAtualizada?.empresa_id,
          group_id: entregaAtualizada?.group_id || groupId,
          grupo_id: entregaAtualizada?.group_id || groupId,
          usuario: authUser?.full_name || authUser?.email,
          usuario_id: authUser?.id,
          acao: 'Edição',
          modulo: 'Expedição',
          entidade: 'Entrega',
          registro_id: entregaAtualizada?.id,
          descricao: 'Entrega atualizada via formulário',
          dados_novos: entregaAtualizada,
          data_hora: new Date().toISOString(),
          sucesso: true
        });
      } catch (_) {}

      onCancel();
    },
    onError: (error) => {
      toastHook({ title: "❌ Erro ao atualizar entrega", description: error.message, variant: "destructive" });
    }
  });

  const handleClienteChange = (clienteId) => {
    const cliente = clientes.find(c => c.id === clienteId);
    if (cliente) {
      const enderecoPrincipal = cliente.locais_entrega?.find(l => l.principal) ||
                               cliente.locais_entrega?.[0];

      const contatoPrincipal = cliente.contatos?.find(c => c.principal) ||
                              cliente.contatos?.[0];

      setFormData(prev => ({
        ...prev,
        cliente_id: clienteId,
        cliente_nome: cliente.nome || cliente.razao_social,
        endereco_entrega_completo: enderecoPrincipal ? {
          cep: enderecoPrincipal.cep || "",
          logradouro: enderecoPrincipal.logradouro || "",
          numero: enderecoPrincipal.numero || "",
          complemento: enderecoPrincipal.complemento || "",
          bairro: enderecoPrincipal.bairro || "",
          cidade: enderecoPrincipal.cidade || "",
          estado: enderecoPrincipal.estado || "",
          latitude: enderecoPrincipal.latitude || null,
          longitude: enderecoPrincipal.longitude || null,
          referencia: enderecoPrincipal.referencia || "",
          link_google_maps: enderecoPrincipal.link_google_maps || ""
        } : prev.endereco_entrega_completo,
        contato_entrega: {
          nome: contatoPrincipal?.observacao || "", // Assuming observacao is the contact name
          telefone: contatoPrincipal?.tipo === "Telefone" ? contatoPrincipal.valor : "",
          whatsapp: (contatoPrincipal?.tipo === "WhatsApp" || contatoPrincipal?.tipo === "Telefone") ? contatoPrincipal.valor : "",
          email: "", // Assuming email field in formData, might need to derive from contactPrincipal
          instrucoes_especiais: "" // Assuming this is form-specific, not from default contact
        }
      }));
    }
  };

  const handlePedidoChange = (pedidoId) => {
    const pedido = pedidos.find(p => p.id === pedidoId);
    if (pedido) {
      setFormData(prev => ({
        ...prev,
        pedido_id: pedidoId,
        numero_pedido: pedido.numero_pedido,
        cliente_id: pedido.cliente_id,
        cliente_nome: pedido.cliente_nome,
        valor_mercadoria: pedido.valor_total,
        endereco_entrega_completo: pedido.endereco_entrega_principal || prev.endereco_entrega_completo
      }));

      if (pedido.cliente_id) {
        handleClienteChange(pedido.cliente_id);
      }
    }
  };

  const handleSubmitForm = async () => {
    if (!contextoValido) {
      await auditEntrega({ acao: "Entrega.salvar.bloqueado", sucesso: false, motivo: "contexto_obrigatorio", dadosNovos: { isEditing } });
      toastHook({
        title: "Contexto obrigatório",
        description: "Selecione o Grupo CPA ou uma empresa antes de salvar a entrega.",
        variant: "destructive"
      });
      return;
    }

    if (isEditing && !canEditEntrega) {
      await auditEntrega({ acao: "Entrega.editar.bloqueado", sucesso: false, motivo: "permissao_negada", dadosNovos: { entrega_id: formData.id || null } });
      toastHook({ title: "Acesso negado", description: "Seu perfil não pode editar entregas.", variant: "destructive" });
      return;
    }

    if (!isEditing && !canCreateEntrega) {
      await auditEntrega({ acao: "Entrega.criar.bloqueado", sucesso: false, motivo: "permissao_negada" });
      toastHook({ title: "Acesso negado", description: "Seu perfil não pode criar entregas.", variant: "destructive" });
      return;
    }

    if (estaNoGrupo && !formData.empresa_id) {
      await auditEntrega({ acao: "Entrega.salvar.bloqueado", sucesso: false, motivo: "empresa_obrigatoria" });
      toastHook({
        title: "Empresa obrigatória",
        description: "Informe a empresa responsável pela entrega.",
        variant: "destructive"
      });
      return;
    }

    if (!formData.cliente_id) {
      await auditEntrega({ acao: "Entrega.salvar.bloqueado", sucesso: false, motivo: "cliente_obrigatorio" });
      toastHook({ title: "Cliente obrigatório", description: "Selecione o cliente da entrega.", variant: "destructive" });
      return;
    }

    if (!isEditing && !window.confirm("Confirmar inclusao desta entrega?")) {
      await auditEntrega({ acao: "Entrega.criar.cancelado", sucesso: false, motivo: "confirmacao_cancelada" });
      return;
    }

    const payload = {
      ...formData,
      group_id: formData.group_id || groupId,
      grupo_id: formData.grupo_id || formData.group_id || groupId,
      empresa_id: formData.empresa_id || empresaId,
    };

    if (isEditing && formData.id) {
      updateMutation.mutate({ id: formData.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const isSubmitting = isLoading || createMutation.isPending || updateMutation.isPending;

  // 🤖 IA: Auto-preencher dados do Google Maps
  const buscarDadosGoogleMaps = async () => {
    if (!contextoValido || !canSaveEntrega) {
      await auditEntrega({ acao: "Entrega.geolocalizacao.bloqueado", sucesso: false, motivo: !contextoValido ? "contexto_obrigatorio" : "permissao_negada" });
      sonnerToast.error("Contexto ou permissao obrigatoria para buscar geolocalizacao");
      return;
    }

    const endereco = `${sanitizePromptValue(formData.endereco_entrega_completo.logradouro)}, ${sanitizePromptValue(formData.endereco_entrega_completo.numero)}, ${sanitizePromptValue(formData.endereco_entrega_completo.cidade)}, ${sanitizePromptValue(formData.endereco_entrega_completo.estado)}`;
    
    try {
      const resultado = await base44.integrations.Core.InvokeLLM({
        prompt: `Gere um link do Google Maps para o endereço: ${endereco}
Também forneça coordenadas aproximadas (latitude, longitude).

Retorne no formato JSON.`,
        response_json_schema: {
          type: "object",
          properties: {
            link_google_maps: { type: "string" },
            latitude: { type: "number" },
            longitude: { type: "number" }
          }
        }
      });

      await auditEntrega({ acao: "Entrega.geolocalizacao", sucesso: true, dadosNovos: { endereco, resultado } });

      setFormData(prev => ({
        ...prev,
        endereco_entrega_completo: {
          ...prev.endereco_entrega_completo,
          link_google_maps: resultado.link_google_maps,
          latitude: resultado.latitude,
          longitude: resultado.longitude
        }
      }));
      
      sonnerToast.success("📍 Geolocalização obtida!");
      
    } catch (error) {
      await auditEntrega({ acao: "Entrega.geolocalizacao.erro", sucesso: false, motivo: error?.message || "erro_geolocalizacao" });
      sonnerToast.error("Erro ao buscar coordenadas");
    }
  };

  const content = (
    <FormWrapper onSubmit={handleSubmitForm} externalData={formData} className={`w-full h-full space-y-6 ${windowMode ? 'p-6 overflow-auto' : ''}`} data-permission={isEditing ? "Expedicao.Entrega.editar" : "Expedicao.Entrega.criar"} data-context-required="true">
      {/* Empresa (se no grupo) */}
      {estaNoGrupo && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded">
          <Label>Empresa Responsável *</Label>
          <Select
            value={formData.empresa_id}
            onValueChange={(v) => setFormData({ ...formData, empresa_id: v })}
            required
          >
            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              {empresasDoGrupo.map(emp => (
                <SelectItem key={emp.id} value={emp.id}>
                  {emp.nome_fantasia || emp.razao_social}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Seção 1: Dados Gerais */}
      <div className="space-y-4">
        <h3 className="font-semibold text-slate-900 border-b pb-2">Dados Gerais</h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Pedido Relacionado</Label>
            <Select
              value={formData.pedido_id}
              onValueChange={handlePedidoChange}
            >
              <SelectTrigger><SelectValue placeholder="Selecione um pedido" /></SelectTrigger>
              <SelectContent>
                {pedidos.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.numero_pedido} - {p.cliente_nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Cliente *</Label>
            <Select
              value={formData.cliente_id}
              onValueChange={handleClienteChange}
              required
            >
              <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
              <SelectContent>
                {clientes.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome || c.razao_social}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label>Data Previsão</Label>
            <div className="flex gap-2">
              <Input
                type="date"
                value={formData.data_previsao}
                onChange={(e) => setFormData({ ...formData, data_previsao: e.target.value })}
                className="flex-1"
              />
              <Button
                type="button"
                onClick={calcularPrevisaoEntrega}
                disabled={calculandoPrevisao || !contextoValido || !canSaveEntrega}
                data-action="Entrega.previsao_ia"
                data-permission={isEditing ? "Expedicao.Entrega.editar" : "Expedicao.Entrega.criar"}
                data-context-required="true"
                data-sensitive="true"
                variant="outline"
                className="border-purple-300 text-purple-700 hover:bg-purple-50"
                title="Calcular com IA"
              >
                <Zap className="w-4 h-4" />
              </Button>
            </div>
            {previsaoIA && (
              <p className="text-xs text-green-600 mt-1">
                🤖 IA: {previsaoIA.prazo_dias} dia(s) • {previsaoIA.confianca_percentual}% confiança
              </p>
            )}
          </div>
          <div>
            <Label>Prioridade</Label>
            <Select
              value={formData.prioridade}
              onValueChange={(v) => setFormData({ ...formData, prioridade: v })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Baixa">Baixa</SelectItem>
                <SelectItem value="Normal">Normal</SelectItem>
                <SelectItem value="Alta">Alta</SelectItem>
                <SelectItem value="Urgente">🔥 Urgente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status Inicial</Label>
            <Select
              value={formData.status}
              onValueChange={(v) => setFormData({ ...formData, status: v })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Aguardando Separação">⏳ Aguardando</SelectItem>
                <SelectItem value="Em Separação">📦 Em Separação</SelectItem>
                <SelectItem value="Pronto para Expedir">✅ Pronto</SelectItem>
                <SelectItem value="Saiu para Entrega">🚚 Saiu</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Seção 2: Endereço de Entrega */}
      <div className="space-y-4">
        <h3 className="font-semibold text-slate-900 border-b pb-2 flex items-center gap-2">
          <MapPin className="w-5 h-5" />
          Endereço de Entrega
        </h3>

        <BuscaCEP
          value={formData.endereco_entrega_completo.cep}
          onCEPFound={(dados) => setFormData({
            ...formData,
            endereco_entrega_completo: {
              ...formData.endereco_entrega_completo,
              cep: dados.cep,
              logradouro: dados.logradouro,
              bairro: dados.bairro,
              cidade: dados.cidade,
              estado: dados.uf
            }
          })}
        />

        <div className="grid grid-cols-4 gap-4">
          <div className="col-span-3">
            <Label>Logradouro</Label>
            <Input
              value={formData.endereco_entrega_completo.logradouro}
              onChange={(e) => setFormData({
                ...formData,
                endereco_entrega_completo: { ...formData.endereco_entrega_completo, logradouro: e.target.value }
              })}
            />
          </div>
          <div>
            <Label>Número</Label>
            <Input
              value={formData.endereco_entrega_completo.numero}
              onChange={(e) => setFormData({
                ...formData,
                endereco_entrega_completo: { ...formData.endereco_entrega_completo, numero: e.target.value }
              })}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label>Bairro</Label>
            <Input
              value={formData.endereco_entrega_completo.bairro}
              onChange={(e) => setFormData({
                ...formData,
                endereco_entrega_completo: { ...formData.endereco_entrega_completo, bairro: e.target.value }
              })}
            />
          </div>
          <div>
            <Label>Cidade</Label>
            <Input
              value={formData.endereco_entrega_completo.cidade}
              onChange={(e) => setFormData({
                ...formData,
                endereco_entrega_completo: { ...formData.endereco_entrega_completo, cidade: e.target.value }
              })}
            />
          </div>
          <div>
            <Label>UF</Label>
            <Input
              value={formData.endereco_entrega_completo.estado}
              onChange={(e) => setFormData({
                ...formData,
                endereco_entrega_completo: { ...formData.endereco_entrega_completo, estado: e.target.value }
              })}
              maxLength={2}
            />
          </div>
        </div>

        <div>
          <Label>Complemento / Referência</Label>
          <Input
            value={formData.endereco_entrega_completo.complemento}
            onChange={(e) => setFormData({
              ...formData,
              endereco_entrega_completo: { ...formData.endereco_entrega_completo, complemento: e.target.value }
            })}
            placeholder="Apto, bloco, próximo a..."
          />
        </div>

        {/* 🤖 IA: Botão para gerar link Google Maps */}
        <Card className="bg-purple-50 border-purple-300">
          <div className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-purple-600" />
              <span className="text-sm text-purple-900 font-medium">
                {formData.endereco_entrega_completo.link_google_maps 
                  ? '✅ Geolocalização Configurada' 
                  : '📍 Gerar Link Google Maps'}
              </span>
            </div>
            <Button
              type="button"
              onClick={buscarDadosGoogleMaps}
              disabled={!contextoValido || !canSaveEntrega}
              data-action="Entrega.geolocalizacao"
              data-permission={isEditing ? "Expedicao.Entrega.editar" : "Expedicao.Entrega.criar"}
              data-context-required="true"
              data-sensitive="true"
              variant="outline"
              size="sm"
              className="border-purple-300 text-purple-700 hover:bg-purple-100"
            >
              <Zap className="w-4 h-4 mr-1" />
              Gerar com IA
            </Button>
          </div>
        </Card>

        <div className="flex items-center gap-2 p-3 bg-blue-50 rounded border border-blue-200">
          <input
            type="checkbox"
            id="salvar-endereco"
            checked={formData.salvar_endereco_no_cliente}
            onChange={(e) => setFormData({ ...formData, salvar_endereco_no_cliente: e.target.checked })}
          />
          <label htmlFor="salvar-endereco" className="text-sm text-blue-900">
            💾 Salvar este endereço no cadastro do cliente
          </label>
        </div>
      </div>

      {/* Seção 3: Contato para Entrega */}
      <div className="space-y-4">
        <h3 className="font-semibold text-slate-900 border-b pb-2 flex items-center gap-2">
          <Phone className="w-5 h-5" />
          Contato para Entrega
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Nome do Contato</Label>
            <Input
              value={formData.contato_entrega.nome}
              onChange={(e) => setFormData({
                ...formData,
                contato_entrega: { ...formData.contato_entrega, nome: e.target.value }
              })}
              placeholder="Quem vai receber"
            />
          </div>
          <div>
            <Label>Telefone/WhatsApp</Label>
            <Input
              value={formData.contato_entrega.whatsapp}
              onChange={(e) => setFormData({
                ...formData,
                contato_entrega: { ...formData.contato_entrega, whatsapp: e.target.value }
              })}
              placeholder="(11) 99999-9999"
            />
          </div>
        </div>

        <div>
          <Label>Instruções Especiais</Label>
          <Textarea
            value={formData.contato_entrega.instrucoes_especiais}
            onChange={(e) => setFormData({
              ...formData,
              contato_entrega: { ...formData.contato_entrega, instrucoes_especiais: e.target.value }
            })}
            rows={2}
            placeholder="Ligar antes, entregar na portaria..."
          />
        </div>

        <div className="flex items-center gap-2 p-3 bg-green-50 rounded border border-green-200">
          <input
            type="checkbox"
            id="salvar-contato"
            checked={formData.salvar_contato_no_cliente}
            onChange={(e) => setFormData({ ...formData, salvar_contato_no_cliente: e.target.checked })}
          />
          <label htmlFor="salvar-contato" className="text-sm text-green-900">
            💾 Salvar este contato no cadastro do cliente
          </label>
        </div>
      </div>

      {/* Seção 4: Transporte */}
      <div className="space-y-4">
        <h3 className="font-semibold text-slate-900 border-b pb-2">Transporte</h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Tipo de Frete</Label>
            <Select
              value={formData.tipo_frete}
              onValueChange={(v) => setFormData({ ...formData, tipo_frete: v })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CIF">CIF (Pagamos)</SelectItem>
                <SelectItem value="FOB">FOB (Cliente Paga)</SelectItem>
                <SelectItem value="Retira">Cliente Retira</SelectItem>
                <SelectItem value="Outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Transportadora</Label>
            <Input
              value={formData.transportadora}
              onChange={(e) => setFormData({ ...formData, transportadora: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label>Motorista</Label>
            <Input
              value={formData.motorista}
              onChange={(e) => setFormData({ ...formData, motorista: e.target.value })}
            />
          </div>
          <div>
            <Label>Telefone Motorista</Label>
            <Input
              value={formData.motorista_telefone}
              onChange={(e) => setFormData({ ...formData, motorista_telefone: e.target.value })}
            />
          </div>
          <div>
            <Label>Placa</Label>
            <Input
              value={formData.placa}
              onChange={(e) => setFormData({ ...formData, placa: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label>Volumes</Label>
            <Input
              type="number"
              min="1"
              value={formData.volumes}
              onChange={(e) => setFormData({ ...formData, volumes: parseInt(e.target.value) || 1 })}
            />
          </div>
          <div>
            <Label>Peso (kg)</Label>
            <Input
              type="number"
              step="0.01"
              value={formData.peso_total_kg}
              onChange={(e) => setFormData({ ...formData, peso_total_kg: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div>
            <Label>Valor Frete</Label>
            <Input
              type="number"
              step="0.01"
              value={formData.valor_frete}
              onChange={(e) => setFormData({ ...formData, valor_frete: parseFloat(e.target.value) || 0 })}
            />
          </div>
        </div>

        <div>
          <Label>Código de Rastreamento</Label>
          <Input
            value={formData.codigo_rastreamento}
            onChange={(e) => setFormData({ ...formData, codigo_rastreamento: e.target.value })}
            placeholder="Será preenchido pela integração com transportadora"
          />
        </div>
      </div>

      {/* Seção 5: Observações */}
      <div>
        <Label>Observações Logísticas</Label>
        <Textarea
          value={formData.observacoes}
          onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
          rows={3}
          placeholder="Informações adicionais sobre a entrega..."
        />
      </div>

      {/* 🤖 IA: Validações Inteligentes */}
      {formData.peso_total_kg > 1000 && (
        <Card className="bg-orange-50 border-orange-300">
          <div className="p-3 text-sm text-orange-800">
            <p className="font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              ⚠️ Atenção: Carga Pesada
            </p>
            <p className="text-xs mt-1">
              Verifique se o veículo suporta {formData.peso_total_kg}kg. Considere reforço estrutural.
            </p>
          </div>
        </Card>
      )}

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting || !contextoValido || !canSaveEntrega}
          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
          data-permission={isEditing ? "Expedicao.Entrega.editar" : "Expedicao.Entrega.criar"}
          data-action={isEditing ? "Entrega.atualizar" : "Entrega.criar"}
          data-context-required="true"
          data-sensitive="true"
        >
          <CheckCircle2 className="w-4 h-4 mr-2" />
          {isEditing ? '💾 Atualizar' : '🚀 Criar'} Entrega
        </Button>
      </div>
    </FormWrapper>
  );

  if (windowMode) {
    return <div className="w-full h-full bg-white overflow-auto">{content}</div>;
  }

  return content;
}
