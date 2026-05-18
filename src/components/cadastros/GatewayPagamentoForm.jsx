import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreditCard, Globe, Lock, BarChart3, Settings } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import useContextoVisual from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";

export default function GatewayPagamentoForm({ gateway, windowMode = false, onSubmit }) {
  const { empresaAtual, grupoAtual, contexto, filterInContext } = useContextoVisual();
  const { canCreate, canEdit } = usePermissions();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || gateway?.group_id || null;
  const contextoValido = Boolean(groupId || empresaAtual?.id || gateway?.empresa_id);
  const podeCriar = canCreate("Cadastros", "GatewayPagamento") || canCreate("Financeiro", "GatewayPagamento") || canCreate("Cadastros", null);
  const podeEditar = canEdit("Cadastros", "GatewayPagamento") || canEdit("Financeiro", "GatewayPagamento") || canEdit("Cadastros", null);
  const podeSalvar = gateway?.id ? podeEditar : podeCriar;
  const { data: empresas = [] } = useQuery({
    queryKey: ['empresas-gateway-pagamento', groupId, empresaAtual?.id],
    queryFn: () => filterInContext('Empresa', {}, 'nome_fantasia', 500),
    enabled: contextoValido,
  });

  const [formData, setFormData] = useState(gateway || {
    nome: "",
    provedor: "Pagar.me",
    empresa_id: "",
    chave_api_publica: "",
    chave_api_secreta: "",
    webhook_url: "",
    webhook_secret: "",
    ambiente: "Teste",
    configuracoes_extras: {},
    taxas_gateway: {
      taxa_boleto_fixa: 0,
      taxa_pix_percentual: 0,
      taxa_cartao_debito_percentual: 0,
      taxa_cartao_credito_percentual: 0,
      taxa_link_pagamento_percentual: 0
    },
    limites_transacao: {
      valor_minimo: 0,
      valor_maximo: 0,
      limite_diario: 0,
      limite_mensal: 0
    },
    tipos_pagamento_suportados: ["PIX", "Boleto", "Cartão Crédito"],
    ativo: true,
    prioridade: 1
  });

  const [tiposSelecionados, setTiposSelecionados] = useState(
    formData.tipos_pagamento_suportados || ["PIX", "Boleto"]
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!contextoValido) {
      alert('Selecione um grupo ou empresa antes de salvar.');
      return;
    }
    if (!podeSalvar) {
      alert('Sem permissao para salvar gateways de pagamento.');
      return;
    }
    onSubmit?.({
      ...formData,
      tipos_pagamento_suportados: tiposSelecionados,
      group_id: groupId || formData.group_id,
      empresa_id: contexto === "empresa" ? empresaAtual?.id : formData.empresa_id,
    });
  };

  const tiposPagamentoDisponiveis = [
    "PIX",
    "Boleto",
    "Cartão Crédito",
    "Cartão Débito",
    "Transferência",
    "Link de Pagamento"
  ];

  return (
    <div className={windowMode ? "w-full h-full flex flex-col" : ""}>
      <form onSubmit={handleSubmit} className={windowMode ? "flex-1 flex flex-col overflow-hidden" : ""}>
        <div className={windowMode ? "flex-1 overflow-auto p-6" : ""}>
          <Tabs defaultValue="geral" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="geral">
                <Settings className="w-4 h-4 mr-2" />
                Geral
              </TabsTrigger>
              <TabsTrigger value="credenciais">
                <Lock className="w-4 h-4 mr-2" />
                Credenciais
              </TabsTrigger>
              <TabsTrigger value="taxas">
                <BarChart3 className="w-4 h-4 mr-2" />
                Taxas
              </TabsTrigger>
              <TabsTrigger value="config">
                <Globe className="w-4 h-4 mr-2" />
                Configurações
              </TabsTrigger>
            </TabsList>

            <TabsContent value="geral" className="space-y-4 mt-4">
              <div>
                <Label>Empresa *</Label>
                <Select
                  value={formData.empresa_id || ''}
                  onValueChange={(v) => setFormData({ ...formData, empresa_id: v })}
                  required
                >
                  <SelectTrigger><SelectValue placeholder="Selecione a empresa..." /></SelectTrigger>
                  <SelectContent>
                    {empresas.map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.nome_fantasia || emp.razao_social}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Nome do Gateway *</Label>
                  <Input
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    placeholder="Ex: Pagar.me Principal"
                    required
                  />
                </div>
                <div>
                  <Label>Provedor *</Label>
                  <Select
                    value={formData.provedor}
                    onValueChange={(v) => setFormData({ ...formData, provedor: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pagar.me">Pagar.me</SelectItem>
                      <SelectItem value="Stripe">Stripe</SelectItem>
                      <SelectItem value="Asaas">Asaas</SelectItem>
                      <SelectItem value="Juno">Juno</SelectItem>
                      <SelectItem value="PagSeguro">PagSeguro</SelectItem>
                      <SelectItem value="Mercado Pago">Mercado Pago</SelectItem>
                      <SelectItem value="Adyen">Adyen</SelectItem>
                      <SelectItem value="Cielo">Cielo</SelectItem>
                      <SelectItem value="Rede">Rede</SelectItem>
                      <SelectItem value="Stone">Stone</SelectItem>
                      <SelectItem value="Outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Ambiente *</Label>
                  <Select
                    value={formData.ambiente}
                    onValueChange={(v) => setFormData({ ...formData, ambiente: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Teste">Teste</SelectItem>
                      <SelectItem value="Homologação">Homologação</SelectItem>
                      <SelectItem value="Produção">Produção</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Prioridade</Label>
                  <Input
                    type="number"
                    value={formData.prioridade}
                    onChange={(e) => setFormData({ ...formData, prioridade: parseInt(e.target.value) })}
                  />
                </div>
              </div>

              <div>
                <Label className="mb-2 block">Tipos de Pagamento Suportados</Label>
                <div className="grid grid-cols-2 gap-3">
                  {tiposPagamentoDisponiveis.map((tipo) => (
                    <div key={tipo} className="flex items-center space-x-2">
                      <Checkbox
                        checked={tiposSelecionados.includes(tipo)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setTiposSelecionados([...tiposSelecionados, tipo]);
                          } else {
                            setTiposSelecionados(tiposSelecionados.filter(t => t !== tipo));
                          }
                        }}
                      />
                      <label className="text-sm">{tipo}</label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Gateway Ativo</Label>
                  <p className="text-xs text-slate-500">Habilitar para uso no sistema</p>
                </div>
                <Switch
                  checked={formData.ativo}
                  onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
                />
              </div>
            </TabsContent>

            <TabsContent value="credenciais" className="space-y-4 mt-4">
              <div>
                <Label>Chave API Pública *</Label>
                <Input
                  value={formData.chave_api_publica}
                  onChange={(e) => setFormData({ ...formData, chave_api_publica: e.target.value })}
                  placeholder="pk_test_..."
                  type="text"
                />
              </div>
              <div>
                <Label>Chave API Secreta *</Label>
                <Input
                  value={formData.chave_api_secreta}
                  onChange={(e) => setFormData({ ...formData, chave_api_secreta: e.target.value })}
                  placeholder="sk_test_..."
                  type="password"
                />
              </div>
              <div>
                <Label>URL do Webhook</Label>
                <Input
                  value={formData.webhook_url}
                  onChange={(e) => setFormData({ ...formData, webhook_url: e.target.value })}
                  placeholder="https://api.seuapp.com/webhooks/pagamentos"
                />
              </div>
              <div>
                <Label>Secret do Webhook</Label>
                <Input
                  value={formData.webhook_secret}
                  onChange={(e) => setFormData({ ...formData, webhook_secret: e.target.value })}
                  placeholder="whsec_..."
                  type="password"
                />
              </div>
            </TabsContent>

            <TabsContent value="taxas" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Taxa Boleto (Fixa em R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.taxas_gateway?.taxa_boleto_fixa || 0}
                    onChange={(e) => setFormData({
                      ...formData,
                      taxas_gateway: {
                        ...formData.taxas_gateway,
                        taxa_boleto_fixa: parseFloat(e.target.value) || 0
                      }
                    })}
                  />
                </div>
                <div>
                  <Label>Taxa PIX (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.taxas_gateway?.taxa_pix_percentual || 0}
                    onChange={(e) => setFormData({
                      ...formData,
                      taxas_gateway: {
                        ...formData.taxas_gateway,
                        taxa_pix_percentual: parseFloat(e.target.value) || 0
                      }
                    })}
                  />
                </div>
                <div>
                  <Label>Taxa Cartão Débito (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.taxas_gateway?.taxa_cartao_debito_percentual || 0}
                    onChange={(e) => setFormData({
                      ...formData,
                      taxas_gateway: {
                        ...formData.taxas_gateway,
                        taxa_cartao_debito_percentual: parseFloat(e.target.value) || 0
                      }
                    })}
                  />
                </div>
                <div>
                  <Label>Taxa Cartão Crédito (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.taxas_gateway?.taxa_cartao_credito_percentual || 0}
                    onChange={(e) => setFormData({
                      ...formData,
                      taxas_gateway: {
                        ...formData.taxas_gateway,
                        taxa_cartao_credito_percentual: parseFloat(e.target.value) || 0
                      }
                    })}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="config" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Valor Mínimo Transação (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.limites_transacao?.valor_minimo || 0}
                    onChange={(e) => setFormData({
                      ...formData,
                      limites_transacao: {
                        ...formData.limites_transacao,
                        valor_minimo: parseFloat(e.target.value) || 0
                      }
                    })}
                  />
                </div>
                <div>
                  <Label>Valor Máximo Transação (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.limites_transacao?.valor_maximo || 0}
                    onChange={(e) => setFormData({
                      ...formData,
                      limites_transacao: {
                        ...formData.limites_transacao,
                        valor_maximo: parseFloat(e.target.value) || 0
                      }
                    })}
                  />
                </div>
                <div>
                  <Label>Limite Diário (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.limites_transacao?.limite_diario || 0}
                    onChange={(e) => setFormData({
                      ...formData,
                      limites_transacao: {
                        ...formData.limites_transacao,
                        limite_diario: parseFloat(e.target.value) || 0
                      }
                    })}
                  />
                </div>
                <div>
                  <Label>Limite Mensal (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.limites_transacao?.limite_mensal || 0}
                    onChange={(e) => setFormData({
                      ...formData,
                      limites_transacao: {
                        ...formData.limites_transacao,
                        limite_mensal: parseFloat(e.target.value) || 0
                      }
                    })}
                  />
                </div>
              </div>

              <div>
                <Label>Observações</Label>
                <Textarea
                  value={formData.observacoes || ''}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  placeholder="Informações adicionais sobre este gateway..."
                  rows={3}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className={windowMode ? "border-t bg-slate-50 p-4" : "mt-6"}>
          <div className="flex justify-end gap-3">
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={!contextoValido || !podeSalvar} data-permission="Cadastros.GatewayPagamento.salvar" data-action="salvar-gateway-pagamento" data-sensitive>
              <CreditCard className="w-4 h-4 mr-2" />
              {gateway ? 'Atualizar Gateway' : 'Cadastrar Gateway'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
